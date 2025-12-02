/**
 * Logging Service
 * Structured logging with different log levels and destinations
 */

import 'server-only';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  resourceId?: string;
  action?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  error?: Error;
}

class LoggerService {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log a message with context
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error,
    };

    // Format log entry
    const logMessage = this.formatLogEntry(entry);

    // Output based on level
    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(logMessage);
        }
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(logMessage);
        if (error) {
          console.error(error);
        }
        break;
    }

    // In production, you might want to send to external logging service
    // this.sendToExternalService(entry);
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp.toISOString()}]`,
      `[${entry.level}]`,
      entry.message,
    ];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context));
    }

    if (entry.error) {
      parts.push(`Error: ${entry.error.message}`);
    }

    return parts.join(' ');
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  /**
   * Error level logging
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Critical level logging
   */
  critical(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, userId?: string, requestId?: string): void {
    this.info(`API Request: ${method} ${path}`, {
      userId,
      requestId,
      action: 'api_request',
      method,
      path,
    });
  }

  /**
   * Log API response
   */
  logResponse(method: string, path: string, statusCode: number, duration: number, userId?: string, requestId?: string): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, `API Response: ${method} ${path} - ${statusCode} (${duration}ms)`, {
      userId,
      requestId,
      action: 'api_response',
      method,
      path,
      statusCode,
      duration,
    });
  }

  /**
   * Log user action
   */
  logUserAction(userId: string, action: string, resource: string, details?: any): void {
    this.info(`User Action: ${action} on ${resource}`, {
      userId,
      action,
      resource,
      details,
    });
  }

  /**
   * Log data edit
   */
  logDataEdit(userId: string, resource: string, resourceId: string, changes: Record<string, { old: any; new: any }>): void {
    this.info(`Data Edit: ${resource} ${resourceId}`, {
      userId,
      action: 'data_edit',
      resource,
      resourceId,
      changes,
    });
  }
}

// Export singleton instance
export const logger = new LoggerService();

