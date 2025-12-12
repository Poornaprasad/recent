#!/usr/bin/env node

/**
 * Development script that suppresses common warnings
 * Cross-platform solution for suppressing MaxListenersExceededWarning and url.parse() deprecation
 */

// Increase max listeners before requiring Next.js
if (process && process.setMaxListeners) {
  process.setMaxListeners(20);
}

// Suppress specific warnings
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
    // Suppress these warnings silently
    return;
  }
  // Allow other warnings through
  console.warn(warning);
});

// Now spawn Next.js dev server
const { spawn } = require('child_process');
const path = require('path');

// Use npx to run next (works cross-platform)
const args = ['next', 'dev', '--turbopack', ...process.argv.slice(2)];

const nextProcess = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..'),
});

nextProcess.on('close', (code) => {
  process.exit(code || 0);
});

nextProcess.on('error', (error) => {
  console.error('Failed to start Next.js:', error);
  process.exit(1);
});
