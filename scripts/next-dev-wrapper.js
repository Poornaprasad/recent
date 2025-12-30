#!/usr/bin/env node

/**
 * Wrapper script for Next.js dev server that increases max listeners
 * and suppresses known deprecation warnings from dependencies
 */

// Increase max listeners BEFORE requiring Next.js or any other modules
if (process && process.setMaxListeners) {
  process.setMaxListeners(20);
}

// Suppress url.parse() deprecation warning from dependencies (e.g., node-cron)
// This is a known issue in third-party packages and doesn't affect security
const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning, ...args) {
  if (typeof warning === 'string') {
    if (
      warning.includes('url.parse()') ||
      warning.includes('DEP0169') ||
      warning.includes('MaxListenersExceededWarning')
    ) {
      return;
    }
  } else if (warning && typeof warning === 'object') {
    if (
      warning.name === 'MaxListenersExceededWarning' ||
      warning.message?.includes('url.parse()') ||
      warning.message?.includes('DEP0169')
    ) {
      return;
    }
  }
  return originalEmitWarning.call(process, warning, ...args);
};

// Suppress warning events
process.on('warning', (warning) => {
  if (
    warning.name === 'MaxListenersExceededWarning' ||
    warning.message?.includes('url.parse()') ||
    warning.message?.includes('DEP0169')
  ) {
    return;
  }
  // Allow other warnings through
  console.warn(warning);
});

// Now require and run Next.js CLI
require('next/dist/bin/next');

