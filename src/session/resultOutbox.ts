import { isSessionResult } from './types';
import type { SessionRepository, SessionResult } from './types';
export const OUTBOX_KEY = 'virtualter.pending-results.v2';
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** Só persiste envios que falharam e mantém o mesmo ID para o reenvio. */
export class ResultOutbox {
  private pending = new Map<string, SessionResult>();
  private inFlight = new Map<string, SessionResult>();
  private storage: StoragePort;
  private syncing: Promise<void> | null = null;
  private corrupt = false;
  durable = true;
  constructor(
    storage: StoragePort = {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: (key) => localStorage.removeItem(key),
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
  async send(
    repository: SessionRepository,
    result: SessionResult
  ): Promise<void> {
    if (!isSessionResult(result)) throw new Error('Resultado inválido');
    const snapshot = structuredClone(result);
    this.inFlight.set(snapshot.id, snapshot);
    try {
      await repository.saveResult(structuredClone(snapshot));
      if (this.pending.delete(snapshot.id)) this.persist();
    } catch {
      this.pending.set(snapshot.id, snapshot);
      this.persist();
    } finally {
      this.inFlight.delete(snapshot.id);
    }
  }
  preserveUnconfirmed(): void {
    const size = this.pending.size;
    for (const [id, result] of this.inFlight) this.pending.set(id, result);
    if (this.pending.size !== size) this.persist();
  }
  has(id: string): boolean {
    return this.pending.has(id);
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
      if (this.pending.size)
        this.storage.setItem(
          OUTBOX_KEY,
          JSON.stringify([...this.pending.values()])
        );
      else this.storage.removeItem(OUTBOX_KEY);
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
