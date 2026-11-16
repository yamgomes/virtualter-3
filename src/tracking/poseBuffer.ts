import type { PoseFrame } from './types';
export const MAX_POSE_AGE_MS = 500;
/** Recusa frames repetidos, atrasados ou de um relógio incompatível. */
export class PoseBuffer {
  private frame: PoseFrame | null = null;
  private lastTimestamp = -Infinity;
  publish(frame: PoseFrame | null, now: number): boolean {
    if (!frame) {
      this.frame = null;
      return true;
    }
    if (
      !Number.isFinite(frame.timestamp) ||
      frame.timestamp <= this.lastTimestamp ||
      frame.timestamp > now ||
      now - frame.timestamp > MAX_POSE_AGE_MS
    )
      return false;
    this.frame = frame;
    this.lastTimestamp = frame.timestamp;
    return true;
  }
  read(now: number): PoseFrame | null {
    return this.frame && now - this.frame.timestamp <= MAX_POSE_AGE_MS
      ? this.frame
      : null;
  }
  reset(): void {
    this.frame = null;
    this.lastTimestamp = -Infinity;
  }
}
