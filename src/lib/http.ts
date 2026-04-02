import type { AppContext } from '../types';

export const jsonSuccess = (
  c: AppContext,
  data: unknown,
  status = 200,
): Response => {
  return c.json(
    {
      success: true,
      data,
    },
    {
      status: status as never,
    },
  );
};

export const jsonError = (
  c: AppContext,
  status: number,
  message: string,
  details?: unknown,
): Response => {
  return c.json(
    {
      success: false,
      error: {
        message,
        details: details ?? null,
      },
    },
    {
      status: status as never,
    },
  );
};

export const parseInteger = (value: string | null | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
