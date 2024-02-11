import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";

const logFormat = format.combine(
  format.timestamp({
    format: () => {
      const date = new Date();
      date.setHours(date.getUTCHours() - 3);
      return date.toISOString().split(".")[0].replace("T", " ").replace("Z", "");
    },
  }),
  format.errors({ stack: true }),
  format.splat(),
  format.simple(),
  format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

const debugTransport = new transports.Console({
  level: "debug",
  format: format.combine(
    format.colorize(),
    format.printf(({ level, message, timestamp }) => {
      return `${timestamp} - ${level}: ${message}`;
    })
  ),
});

const logger = createLogger({
  level: "info",
  format: logFormat,
  transports: [
    new transports.DailyRotateFile({
      filename: "logs/errors-%DATE%.log",
      maxSize: "20m",
      maxFiles: "14d",
      level: "error",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(debugTransport);
}

export { logger };
