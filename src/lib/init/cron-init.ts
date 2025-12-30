/**
 * Cron Initialization
 * Initialize all cron jobs when the application starts
 * Called from instrumentation.ts (Next.js instrumentation hook)
 */

import { initializeDocumentSyncCron } from '../services/document-sync-cron.service';

let isInitialized = false;

/**
 * Initialize all cron jobs
 * This should be called once when the application starts
 */
export function initializeCronJobs() {
  // Prevent multiple initializations
  if (isInitialized) {
    console.log('[Cron Init] Already initialized, skipping...');
    return;
  }

  // Only run in Node.js environment (not in Edge runtime)
  if (typeof process === 'undefined' || !process.env) {
    console.log('[Cron Init] Skipping cron initialization (not in Node.js environment)');
    return;
  }

  console.log('[Cron Init] Initializing cron jobs...');

  try {
    // Initialize document sync cron
    initializeDocumentSyncCron();

    isInitialized = true;
    console.log('[Cron Init] Cron jobs initialized successfully');
  } catch (error) {
    console.error('[Cron Init] Failed to initialize cron jobs:', error);
  }
}
