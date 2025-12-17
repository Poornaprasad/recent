#!/usr/bin/env node

/**
 * Wrapper script for Next.js dev server that increases max listeners
 * to prevent MaxListenersExceededWarning
 * 
 * This sets the limit before Next.js loads, allowing legitimate handlers
 * to be registered without triggering warnings.
 */

// Increase max listeners BEFORE requiring Next.js or any other modules
// This prevents the warning from appearing when multiple handlers are legitimately needed
if (process && process.setMaxListeners) {
  process.setMaxListeners(20);
}

// Now require and run Next.js CLI
require('next/dist/bin/next');

