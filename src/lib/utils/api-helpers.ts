/**
 * API Helper Utilities
 * Common utilities for handling API responses and errors
 */

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error("Empty response from server");
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function handleApiError(response: Response): Promise<Error> {
  let errorMessage = "An error occurred";
  
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.error || errorMessage;
  } catch {
    // If JSON parsing fails, try to get text
    try {
      const errorText = await response.text();
      if (errorText) {
        errorMessage = errorText;
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
  }
  
  return new Error(errorMessage);
}
