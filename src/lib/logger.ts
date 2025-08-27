export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
  NONE,
}

// Default to INFO level, but can be overridden by environment variables or a setter.
let currentLogLevel: LogLevel = LogLevel.INFO;

export const setLogLevel = (level: LogLevel) => {
  currentLogLevel = level;
};

const log = (level: LogLevel, message: string, ...args: any[]) => {
  if (level >= currentLogLevel) {
    const now = new Date();
    const timestamp = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}.${now.getMilliseconds()}`;
    const prefix = `[${LogLevel[level]}] @ ${timestamp}:`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, ...args);
        break;
      case LogLevel.INFO:
        console.info(prefix, message, ...args);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, ...args);
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, ...args);
        break;
    }
  }
};

export const logger = {
  debug: (message: string, ...args: any[]) => log(LogLevel.DEBUG, message, ...args),
  info: (message: string, ...args: any[]) => log(LogLevel.INFO, message, ...args),
  warn: (message: string, ...args: any[]) => log(LogLevel.WARN, message, ...args),
  error: (message: string, ...args: any[]) => log(LogLevel.ERROR, message, ...args),
};
