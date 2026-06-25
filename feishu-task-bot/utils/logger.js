const winston = require('winston');
const { config } = require('../config');

// 安全序列化函数，处理循环引用
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // 处理 axios 错误对象
    if (value && value.constructor && value.constructor.name === 'AxiosError') {
      return {
        message: value.message,
        code: value.code,
        status: value.response?.status,
        data: value.response?.data
      };
    }
    // 处理 Error 对象
    if (value instanceof Error) {
      return {
        message: value.message,
        stack: value.stack,
        code: value.code
      };
    }
    return value;
  });
}

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaStr = '';
      try {
        metaStr = Object.keys(meta).length ? ` ${safeStringify(meta)}` : '';
      } catch (e) {
        metaStr = ' [序列化失败]';
      }
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let metaStr = '';
          try {
            metaStr = Object.keys(meta).length ? ` ${safeStringify(meta)}` : '';
          } catch (e) {
            metaStr = ' [序列化失败]';
          }
          return `${timestamp} [${level}] ${message}${metaStr}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
