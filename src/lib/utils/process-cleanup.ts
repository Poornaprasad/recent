/**
 * Process cleanup handler manager
 * Ensures signal handlers are only registered once to prevent MaxListenersExceededWarning
 * 
 * Uses a global symbol to track registration across hot reloads
 */

// Use a global symbol to track if handlers are registered
// This persists across hot reloads in Next.js dev mode
const CLEANUP_KEY = Symbol.for('__tbf_reconx_cleanup_registered__');
const CALLBACKS_KEY = Symbol.for('__tbf_reconx_cleanup_callbacks__');

// Get or initialize global state
const globalState = (global as any)[CLEANUP_KEY] || {
  registered: false,
  callbacks: [] as Array<() => Promise<void> | void>,
};

// Store in global to persist across hot reloads
(global as any)[CLEANUP_KEY] = globalState;
(global as any)[CALLBACKS_KEY] = globalState.callbacks;

/**
 * Register a cleanup callback to be called on process termination
 * This ensures handlers are only registered once, preventing listener leaks
 */
export function registerCleanup(callback: () => Promise<void> | void): void {
  globalState.callbacks.push(callback);

  // Only register signal handlers once per process
  if (!globalState.registered) {
    globalState.registered = true;

    const cleanup = async (signal: string) => {
      console.log(`[Cleanup] Received ${signal}, shutting down gracefully...`);
      
      // Execute all cleanup callbacks
      await Promise.all(
        globalState.callbacks.map(async (cb) => {
          try {
            await cb();
          } catch (error) {
            console.error('[Cleanup] Error during cleanup:', error);
          }
        })
      );

      process.exit(0);
    };

    // Register handlers using once() to ensure they're only called once
    // The globalState.registered flag ensures we only register once per process
    // even if this module is hot-reloaded
    process.once('SIGTERM', () => cleanup('SIGTERM'));
    process.once('SIGINT', () => cleanup('SIGINT'));
  }
}

/**
 * Unregister all cleanup handlers (useful for testing or hot reload scenarios)
 */
export function unregisterCleanup(): void {
  globalState.registered = false;
  globalState.callbacks.length = 0;
  
  // Note: We don't remove all listeners here as other libraries (Next.js, etc.)
  // may have registered their own handlers. Only remove if we're sure we own them.
  // In practice, the global state tracking prevents duplicate registration.
}

