import type { Response } from 'express';

export const appendSetCookies = (res: Response, cookies: string[]) => {
  for (const cookie of cookies) {
    res.append('Set-Cookie', cookie);
  }
};
