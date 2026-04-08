import crypto from 'crypto';

export const sha256 = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

export const randomToken = (size = 32): string => {
  return crypto.randomBytes(size).toString('hex');
};
