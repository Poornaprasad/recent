/**
 * Action wrapper utility
 * Provides consistent error handling for Next.js server actions
 */

'use server';

export interface ActionResult<T> {
  data?: T;
  error?: string;
}

/**
 * Wraps a server action with standardized error handling
 *
 * @param action The async function to wrap
 * @param errorMessage Default error message if the error doesn't have one
 * @returns A promise with either data or error
 *
 * @example
 * export async function myAction() {
 *   return withActionHandler(
 *     async () => await someService.doSomething(),
 *     'Failed to perform action'
 *   );
 * }
 */
export async function withActionHandler<T>(
  action: () => Promise<T>,
  errorMessage: string = 'An error occurred'
): Promise<ActionResult<T>> {
  try {
    const data = await action();
    return { data };
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage;
    return { error: message };
  }
}
