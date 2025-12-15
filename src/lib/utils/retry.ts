/**
 * Error with HTTP status code
 */
export interface HttpError extends Error {
  status?: number;
}

/**
 * Create an HTTP error with status code
 */
export function createHttpError(status: number, statusText: string): HttpError {
  const error = new Error(`HTTP error: ${status} ${statusText}`) as HttpError;
  error.status = status;
  return error;
}

/**
 * Check if an HTTP error should be retried based on status code
 * - Retries: network errors, timeouts, 5xx errors, 429 rate limits
 * - Does not retry: 4xx client errors (except 429)
 */
export function shouldRetryHttpError(error: Error): boolean {
  const httpError = error as HttpError;
  const status = httpError.status;
  
  // If we have a status code, use it for the decision
  if (status !== undefined) {
    // Don't retry 4xx client errors (except 429 rate limit)
    if (status >= 400 && status < 500 && status !== 429) {
      return false;
    }
    // Retry 5xx server errors and 429 rate limits
    if (status >= 500 || status === 429) {
      return true;
    }
  }
  
  // Fall back to message-based detection
  return isRetryableError(error);
}

/**
 * Check if an error is retryable based on error message
 * (Used when status code is not available)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors
  if (message.includes('network') || message.includes('econnreset') || message.includes('etimedout')) {
    return true;
  }
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('aborted')) {
    return true;
  }
  
  // HTTP 5xx errors (server errors)
  if (/\b5\d{2}\b/.test(message)) {
    return true;
  }
  
  // Rate limiting (429) - should retry
  if (message.includes('429') || message.includes('rate limit')) {
    return true;
  }
  
  // Don't retry 4xx errors (except 429) - these are client errors
  if (/\b4\d{2}\b/.test(message) && !message.includes('429')) {
    return false;
  }
  
  // Default: retry unknown errors
  return true;
}

/**
 * Retry utility with exponential backoff and jitter
 * Adds randomness to prevent thundering herd problem
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 2000)
 * @param shouldRetry - Optional function to determine if error should be retried (default: shouldRetryHttpError)
 * @returns Result of the function call
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000,
  shouldRetry: (error: Error) => boolean = shouldRetryHttpError
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(errorMessage);
      
      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter: baseDelay * 2^(attempt-1) ± random(0-20%)
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = exponentialDelay * 0.2 * Math.random(); // ±20% jitter
        const delay = Math.floor(exponentialDelay + jitter);
        console.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms:`, errorMessage);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

