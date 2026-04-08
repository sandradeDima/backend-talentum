import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMetadata = Record<string, unknown>;

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel = (() => {
  const value = env.LOG_LEVEL?.toLowerCase();
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }

  return 'info';
})();

const shouldRedactKey = (key: string) => {
  return /(token|password|authorization|cookie|secret|pin|credential)/i.test(key);
};

const redactValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (value === null || typeof value === 'undefined') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.length > 240) {
      return `${value.slice(0, 237)}...`;
    }

    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[Circular]';
    }

    seen.add(value as object);

    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (shouldRedactKey(entryKey)) {
        output[entryKey] = '[REDACTED]';
        continue;
      }

      output[entryKey] = redactValue(entryValue, seen);
    }

    seen.delete(value as object);
    return output;
  }

  return String(value);
};

const writeLog = (level: LogLevel, message: string, metadata?: LogMetadata) => {
  if (levelWeight[level] < levelWeight[configuredLevel]) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(metadata ? { metadata: redactValue(metadata, new WeakSet<object>()) } : {})
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logger = {
  debug(message: string, metadata?: LogMetadata) {
    writeLog('debug', message, metadata);
  },
  info(message: string, metadata?: LogMetadata) {
    writeLog('info', message, metadata);
  },
  warn(message: string, metadata?: LogMetadata) {
    writeLog('warn', message, metadata);
  },
  error(message: string, metadata?: LogMetadata) {
    writeLog('error', message, metadata);
  }
};
