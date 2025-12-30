/**
 * Client-side Logging Utility
 * Simple logging for client components that can be used with 'use client'
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  [key: string]: any;
}

class ClientLogger {
  private isDevelopment = typeof window !== 'undefined' &&
    (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost');

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const parts = [`[${timestamp}]`, `[${level}]`, message];
    if (context) {
      parts.push(JSON.stringify(context));
    }
    return parts.join(' ');
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage(LogLevel.INFO, message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, context));
  }
}

export const logger = new ClientLogger();
