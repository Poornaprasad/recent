/**
 * Application error classes
 * Custom error types for better error handling
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id "${id}" not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500);
  }
}

export class FileStorageError extends AppError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'FILE_STORAGE_ERROR', 500);
  }
}

export class AIProcessingError extends AppError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'AI_PROCESSING_ERROR', 500);
  }
}





