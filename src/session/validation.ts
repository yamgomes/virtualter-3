export const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const count = (value: unknown): value is number =>
  number(value) && Number.isInteger(value) && value >= 0;
