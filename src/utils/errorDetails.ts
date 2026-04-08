import { env } from '../config/env';

export const buildTechnicalMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (env.NODE_ENV === 'production') {
      return `${error.name}: ${error.message}`;
    }

    return `${error.name}: ${error.message}\n${error.stack ?? ''}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};
