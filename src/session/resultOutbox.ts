import { isSessionResult } from './types';
import type { SessionRepository, SessionResult } from './types';
export const OUTBOX_KEY = 'virtualter.pending-results.v2';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
/** Mantém o mesmo ID em toda tentativa. Persistência local é explícita no protótipo. */
export class ResultOutbox {
  private pending = new Map<string, SessionResult>();
  private storage: StoragePort;
  private syncing: Promise<void> | null = null;
  private corrupt = false;
  durable = true;
  constructor(
    storage: StoragePort = {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    }
  ) {
    this.storage = storage;
    try {
      const raw = storage.getItem(OUTBOX_KEY) ?? '[]';
      let saved: unknown;
      try {
        saved = JSON.parse(raw);
      } catch {
        this.corrupt = true;
        throw new Error('Fila inválida');
      }
      if (!Array.isArray(saved) || !saved.every(isSessionResult)) {
        this.corrupt = true;
        throw new Error('Fila inválida');
      }
      saved.forEach((r) => this.pending.set(r.id, r));
    } catch {
      this.durable = false;
    }
  }
  enqueue(result: SessionResult): void {
    if (!isSessionResult(result)) throw new Error('Resultado inválido');
    this.pending.set(result.id, structuredClone(result));
    this.persist();
  }
  count(patientId: string): number {
    return [...this.pending.values()].filter((r) => r.patientId === patientId)
      .length;
  }
  private persist(): void {
    if (this.corrupt) {
      this.durable = false;
      return;
    }
    try {
      this.storage.setItem(
        OUTBOX_KEY,
        JSON.stringify([...this.pending.values()])
      );
      this.durable = true;
    } catch {
      this.durable = false;
    }
  }
  async flush(repository: SessionRepository, patientId: string): Promise<void> {
    const run = async () => {
      let failed = false;
      for (const result of [...this.pending.values()].filter(
        (r) => r.patientId === patientId
      )) {
        try {
          await repository.saveResult(structuredClone(result));
        } catch {
          failed = true;
          continue;
        }
        this.pending.delete(result.id);
        this.persist();
      }
      if (failed) throw new Error('Há resultados pendentes de envio.');
    };
    const operation = (this.syncing ?? Promise.resolve())
      .catch(() => {})
      .then(run);
    this.syncing = operation;
    try {
      await operation;
    } finally {
      if (this.syncing === operation) this.syncing = null;
    }
  }
}
