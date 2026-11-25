import { number } from '../session/validation';

export function acceptsShoulderCalibration(
  c: Record<string, unknown>
): boolean {
  return (
    number(c.leftRest) &&
    number(c.leftMaximum) &&
    number(c.rightRest) &&
    number(c.rightMaximum) &&
    c.leftMaximum - c.leftRest >= 15 &&
    c.rightMaximum - c.rightRest >= 15
  );
}
