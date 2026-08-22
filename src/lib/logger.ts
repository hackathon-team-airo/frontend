import 'server-only';

import { env } from '@/env';

const levelOrder = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

type Level = keyof typeof levelOrder;
type Bindings = Record<string, unknown>;
type LogFn = (payload: Bindings | string, message?: string) => void;

export type Logger = { [K in Level]: LogFn } & {
  child: (bindings: Bindings) => Logger;
};

const threshold = levelOrder[env.LOG_LEVEL];

const redactedKeys = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
]);

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { type: value.name, message: value.message, stack: value.stack };
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Bindings).map(([key, item]) =>
        redactedKeys.has(key.toLowerCase())
          ? [key, '[redacted]']
          : [key, serialize(item)],
      ),
    );
  }

  return value;
}

function write(
  level: Level,
  bindings: Bindings,
  payload: Bindings | string,
  message?: string,
): void {
  if (levelOrder[level] < threshold) return;

  const body =
    typeof payload === 'string'
      ? { msg: payload }
      : {
          ...(serialize(payload) as Bindings),
          ...(message === undefined ? {} : { msg: message }),
        };

  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    ...bindings,
    ...body,
  });

  if (level === 'error' || level === 'fatal') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(line);
}

function createChildLogger(bindings: Bindings): Logger {
  const instance = {} as Logger;

  for (const level of Object.keys(levelOrder) as Level[]) {
    instance[level] = (payload, message) =>
      write(level, bindings, payload, message);
  }

  instance.child = (extra) => createChildLogger({ ...bindings, ...extra });

  return instance;
}

export const logger: Logger = createChildLogger({});

export function createLogger(name: string): Logger {
  return logger.child({ name });
}
