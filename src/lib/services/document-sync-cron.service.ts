/**
 * Document Sync Cron Service
 * Automated document synchronization using node-cron
 * Runs on a configurable schedule
 */

import cron from 'node-cron';
import { syncDocumentsFromSmartAdvocate } from '../actions/document-sync.actions';
import { getYesterdayDateRange } from './document-sync.service';

interface CronConfig {
  enabled: boolean;
  schedule: string; // Cron expression (e.g., "0 2 * * *" for 2 AM daily)
  timezone?: string; // Timezone for cron schedule (e.g., "America/New_York")
}

let cronJob: cron.ScheduledTask | null = null;
let isInitialized = false;

/**
 * Parse cron configuration from environment variables
 */
function parseCronConfig(): CronConfig {
  const enabled = process.env.DOCUMENT_SYNC_CRON_ENABLED === 'true';
  const schedule = process.env.DOCUMENT_SYNC_CRON_SCHEDULE || '0 */6 * * *'; // Default: every 6 hours
  const timezone = process.env.DOCUMENT_SYNC_CRON_TIMEZONE || 'America/New_York';

  return {
    enabled,
    schedule,
    timezone,
  };
}

/**
 * Validate cron expression
 */
function isValidCronExpression(expression: string): boolean {
  return cron.validate(expression);
}

/**
 * Execute the document sync
 */
async function executeSyncTask() {
  const startTime = new Date();
  console.log(`[Document Sync Cron] Starting automated sync at ${startTime.toISOString()}`);

  try {
    // Get yesterday's date range
    const dateRange = getYesterdayDateRange();

    console.log(`[Document Sync Cron] Syncing documents from ${dateRange.fromDate} to ${dateRange.toDate}`);

    // Execute sync
    const result = await syncDocumentsFromSmartAdvocate({
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      force: false, // Never force in automated sync
    });

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    if (result.error) {
      console.error(`[Document Sync Cron] Sync failed: ${result.error}`);
      console.error(`[Document Sync Cron] Duration: ${duration}s`);
    } else {
      console.log(`[Document Sync Cron] Sync completed successfully in ${duration}s`);
      console.log(`[Document Sync Cron] Summary:`, {
        totalDocuments: result.data?.totalDocuments,
        filteredDocuments: result.data?.filteredDocuments,
        processed: result.data?.processedDocuments,
        successful: result.data?.successful,
        failed: result.data?.failed,
        skipped: result.data?.skipped,
        updated: result.data?.updated,
      });

      if (result.data?.errors && result.data.errors.length > 0) {
        console.warn(`[Document Sync Cron] ${result.data.errors.length} errors occurred during sync`);
        result.data.errors.slice(0, 5).forEach((error, index) => {
          console.warn(`[Document Sync Cron] Error ${index + 1}: Document ${error.documentID} - ${error.error}`);
        });
        if (result.data.errors.length > 5) {
          console.warn(`[Document Sync Cron] ... and ${result.data.errors.length - 5} more errors`);
        }
      }
    }
  } catch (error) {
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.error(`[Document Sync Cron] Unexpected error during sync:`, error);
    console.error(`[Document Sync Cron] Duration: ${duration}s`);
  }
}

/**
 * Initialize the cron job
 * Should be called once when the application starts
 */
export function initializeDocumentSyncCron() {
  // Prevent re-initialization
  if (isInitialized) {
    console.log('[Document Sync Cron] Already initialized, skipping...');
    return;
  }

  const config = parseCronConfig();

  if (!config.enabled) {
    console.log('[Document Sync Cron] Cron job is disabled (DOCUMENT_SYNC_CRON_ENABLED=false)');
    isInitialized = true;
    return;
  }

  // Validate cron expression
  if (!isValidCronExpression(config.schedule)) {
    console.error(`[Document Sync Cron] Invalid cron expression: ${config.schedule}`);
    isInitialized = true;
    return;
  }

  console.log(`[Document Sync Cron] Initializing with schedule: ${config.schedule} (${config.timezone})`);

  try {
    // Create cron job
    cronJob = cron.schedule(
      config.schedule,
      () => {
        executeSyncTask().catch((error) => {
          console.error('[Document Sync Cron] Error in scheduled task:', error);
        });
      },
      {
        scheduled: true,
        timezone: config.timezone,
      }
    );

    console.log('[Document Sync Cron] Cron job initialized successfully');
    console.log(`[Document Sync Cron] Next execution: ${getNextExecutionTime(config.schedule, config.timezone)}`);

    isInitialized = true;
  } catch (error) {
    console.error('[Document Sync Cron] Failed to initialize cron job:', error);
    isInitialized = true;
  }
}

/**
 * Stop the cron job
 */
export function stopDocumentSyncCron() {
  if (cronJob) {
    cronJob.stop();
    console.log('[Document Sync Cron] Cron job stopped');
    cronJob = null;
    isInitialized = false;
  }
}

/**
 * Get status of the cron job
 */
export function getDocumentSyncCronStatus() {
  const config = parseCronConfig();
  return {
    initialized: isInitialized,
    enabled: config.enabled,
    schedule: config.schedule,
    timezone: config.timezone,
    running: cronJob !== null,
    nextExecution: cronJob ? getNextExecutionTime(config.schedule, config.timezone) : null,
  };
}

/**
 * Get next execution time for a cron expression
 */
function getNextExecutionTime(schedule: string, timezone: string): string {
  try {
    // This is a simplified version - in production, you'd use a library like cron-parser
    return 'Check your cron schedule for next execution time';
  } catch (error) {
    return 'Unable to calculate next execution time';
  }
}

/**
 * Manually trigger a sync (for testing)
 */
export async function triggerManualSync() {
  console.log('[Document Sync Cron] Manual sync triggered');
  await executeSyncTask();
}
