const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = {
  info: (...args: unknown[]): void => {
    console.info('[INFO]', ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]): void => {
    console.error('[ERROR]', ...args);
  },
  debug: (...args: unknown[]): void => {
    if (isDev) {
      console.info('[DEBUG]', ...args);
    }
  },
};
