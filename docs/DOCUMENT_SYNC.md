# Document Sync System

Comprehensive documentation for the SmartAdvocate document synchronization system.

## Overview

The document sync system automatically synchronizes invoices and receipts from SmartAdvocate CRM to the invoice management system. It supports both automated (cron-based) and manual synchronization.

## Features

### 1. Automated Synchronization (Cron Job)
- Runs on a configurable schedule (default: daily at 2 AM)
- Automatically syncs documents from yesterday to today
- Checks for modified documents and updates them if not yet processed
- Skips duplicates automatically
- Configurable timezone support

### 2. Manual Synchronization (UI Button)
- "Sync Documents" button in the All Invoices page
- Interactive date picker for custom date ranges
- Force sync option to re-process existing documents
- Real-time progress and results display

### 3. Smart Duplicate Detection
- Generates unique hash from document ID and case number
- Automatically skips documents that already exist
- Tracks document modified dates
- Updates documents if:
  - Document has been modified in SmartAdvocate
  - Invoice is still in Draft or Review status (not yet processed)

### 4. Modified Date Tracking
- Tracks `saModifiedDate` from SmartAdvocate
- Compares with existing invoices
- Updates only if document is newer and not yet processed
- Prevents unnecessary re-processing of completed invoices

## Setup Instructions

### 1. Install Dependencies

The required dependencies are already installed:
- `node-cron`: For scheduled tasks
- `@types/node-cron`: TypeScript types

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
# SmartAdvocate CRM Integration
SA_API_BASE_URL=https://api.smartadvocate.com
SA_API_KEY=your_smartadvocate_api_key_here

# Document Sync Configuration
SA_DOCUMENT_SYNC_FROM_DATE=2024-01-01  # Optional: for manual sync
SA_DOCUMENT_SYNC_TO_DATE=2024-12-31    # Optional: for manual sync
SA_DOCUMENT_SYNC_PAGE_SIZE=100
SA_DOCUMENT_SYNC_CATEGORY_IDS=78,1080  # 78=Invoices, 1080=Receipts

# Cron Job Configuration
DOCUMENT_SYNC_CRON_ENABLED=true        # Enable automated sync
DOCUMENT_SYNC_CRON_SCHEDULE=0 2 * * *  # 2 AM daily
DOCUMENT_SYNC_CRON_TIMEZONE=America/New_York
```

### 3. Cron Job Initialization

The cron job is **automatically initialized** when the server starts using Next.js's `instrumentation.ts` hook.

**How it works:**
1. Next.js calls `instrumentation.ts` when the server starts
2. This imports and executes `initializeCronJobs()` from `src/lib/init/cron-init.ts`
3. The cron job starts if `DOCUMENT_SYNC_CRON_ENABLED=true`

**Files involved:**
- `instrumentation.ts` - Next.js instrumentation hook (root level)
- `next.config.ts` - Enables `instrumentationHook` in experimental features
- `src/lib/init/cron-init.ts` - Cron initialization logic
- `src/lib/services/document-sync-cron.service.ts` - Cron job implementation

**No manual setup required** - the cron job will auto-start when you run:
```bash
npm start  # Production
npm run dev  # Development (if DOCUMENT_SYNC_CRON_ENABLED=true)
```

### 4. Configure Next.js

The `next.config.ts` has been updated to mark `node-cron` as a server-only package:

```typescript
serverExternalPackages: ['pdf-img-convert', 'canvas', 'node-cron']
```

## Usage

### Automated Sync (Cron Job)

1. Set `DOCUMENT_SYNC_CRON_ENABLED=true` in your `.env` file
2. Configure the schedule using cron expression (default: every 6 hours):
   - `0 */6 * * *` - Every 6 hours (default)
   - `0 2 * * *` - Daily at 2 AM
   - `0 8,20 * * *` - Twice daily (8 AM and 8 PM)
   - `0 0,6,12,18 * * *` - Four times daily
3. Set your timezone: `DOCUMENT_SYNC_CRON_TIMEZONE=America/New_York`
4. The cron job will automatically run on the configured schedule

**Behavior:**
- Syncs documents from yesterday (00:00:00) to today (00:00:00)
- Skips duplicates automatically
- Updates modified documents if not yet processed
- Logs all activities to console

### Manual Sync (UI Button)

1. Navigate to **All Invoices** page
2. Click the **"Sync Documents"** button (next to Export button)
3. In the dialog:
   - **From Date**: Start date (default: yesterday)
   - **To Date**: End date (default: today)
   - **Force sync**: Check to re-process existing documents
4. Click **"Start Sync"**
5. View real-time results

**Force Sync Option:**
- When unchecked: Skips existing documents (default behavior)
- When checked: Re-processes all documents in the date range, even if they already exist

## Architecture

### Core Components

#### 1. `document-sync.service.ts`
Core business logic for document synchronization:
- `syncDocumentsCore()`: Main sync function
- `getYesterdayDateRange()`: Helper for date range calculation
- Handles duplicate detection and modified date checking
- Configurable and reusable across different contexts

#### 2. `document-sync-cron.service.ts`
Cron job management:
- `initializeDocumentSyncCron()`: Initialize cron job
- `stopDocumentSyncCron()`: Stop cron job
- `getDocumentSyncCronStatus()`: Get status
- `triggerManualSync()`: Manually trigger sync

#### 3. `document-sync.actions.ts`
Next.js server action:
- `syncDocumentsFromSmartAdvocate()`: Server action for sync
- Wraps core sync logic with Next.js specifics
- Handles revalidation of cached pages

#### 4. `document-sync-button.tsx`
UI component:
- Interactive date picker
- Force sync checkbox
- Real-time results display
- Auto-closes on success

### Data Flow

```
┌─────────────────────┐
│  SmartAdvocate CRM  │
└──────────┬──────────┘
           │
           ├── Automated (Cron)
           │   └── document-sync-cron.service.ts
           │       └── Triggers at scheduled time
           │
           └── Manual (UI)
               └── DocumentSyncButton
                   └── User clicks "Sync Documents"

           Both paths converge at:
           ↓
┌─────────────────────────────────┐
│  syncDocumentsFromSmartAdvocate │ (Server Action)
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│    syncDocumentsCore            │ (Core Logic)
│  - Fetch documents by date      │
│  - Filter by category           │
│  - Check for duplicates         │
│  - Check modified dates         │
│  - Process documents            │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│   Database (PostgreSQL)         │
│  - invoices table               │
│  - documentSyncErrors table     │
└─────────────────────────────────┘
```

## Smart Duplicate & Update Logic

### Document Hash
Each document gets a unique hash based on:
- Document ID from SmartAdvocate
- Case Number

```typescript
documentHash = hash(documentID + caseNumber)
```

### Decision Tree

```
Document from SmartAdvocate
  │
  ├─→ Force mode enabled?
  │    └─→ Yes: Process (update if exists)
  │
  ├─→ Hash exists in database?
  │    ├─→ No: Process as new document
  │    └─→ Yes: Check modified date
  │         ├─→ No modified date: Skip
  │         ├─→ Invoice already processed (Paid/Pending): Skip
  │         └─→ Modified date newer AND status is Draft/Review:
  │              └─→ Process (update existing)
  │
  └─→ Result:
       ├─→ New document: Created
       ├─→ Updated document: Updated
       └─→ Duplicate: Skipped
```

### Status-Based Update Logic

Documents are only updated if:
1. They have been modified in SmartAdvocate (newer `modifiedDate`)
2. **AND** Invoice status is `Draft` or `Review`

Documents are **NOT** updated if:
- Status is `Paid` or `Pending` (already processed/approved)
- Modified date is not newer
- Force mode is disabled and no changes detected

## Monitoring & Logging

### Console Logs

The system logs all activities:

```
[Document Sync] Starting sync from 2024-01-01 to 2024-01-31
[Document Sync] Filtering by category IDs: 78, 1080
[Document Sync] Force mode: disabled
[Document Sync] Fetching page 0...
[Document Sync] Page 0: 150 total, 45 filtered
[Document Sync] Processing document 12345 (Invoice_2024.pdf)
[Document Sync] Successfully processed document 12345 -> Invoice ID: inv_abc123
[Document Sync] Document 12346 has been modified and will be updated
[Document Sync] Skipping document 12347 - already exists and processed
[Document Sync] Sync completed:
  Total documents: 150
  Filtered documents: 45
  Processed: 30
  Successful: 28
  Failed: 2
  Skipped: 13
  Updated: 2
```

### Cron Job Logs

```
[Document Sync Cron] Initializing with schedule: 0 2 * * * (America/New_York)
[Document Sync Cron] Cron job initialized successfully
[Document Sync Cron] Starting automated sync at 2024-01-15T02:00:00.000Z
[Document Sync Cron] Syncing documents from 2024-01-14 to 2024-01-15
[Document Sync Cron] Sync completed successfully in 45.2s
[Document Sync Cron] Summary: {
  totalDocuments: 85,
  successful: 12,
  failed: 1,
  skipped: 3,
  updated: 1
}
```

## Error Handling

### Document Sync Errors Table

Failed documents are logged to the `documentSyncErrors` table with:
- Document ID and metadata
- Error message and type
- SmartAdvocate metadata (case number, category, etc.)
- Timestamp

### Error Types

1. **Unsupported File Type**: Document is not PDF or image
2. **Processing Error**: Failed during invoice extraction/processing
3. **API Error**: SmartAdvocate API error
4. **Other**: Unexpected errors

### Viewing Errors

Errors can be viewed in the sync-errors page (if implemented) or directly in the database:

```sql
SELECT * FROM document_sync_errors
ORDER BY created_at DESC
LIMIT 100;
```

## Cron Schedule Examples

### Common Schedules

```bash
# Every day at 2 AM
DOCUMENT_SYNC_CRON_SCHEDULE=0 2 * * *

# Every 6 hours
DOCUMENT_SYNC_CRON_SCHEDULE=0 */6 * * *

# Twice daily (8 AM and 8 PM)
DOCUMENT_SYNC_CRON_SCHEDULE=0 8,20 * * *

# Every hour during business hours (9 AM - 5 PM, Monday-Friday)
DOCUMENT_SYNC_CRON_SCHEDULE=0 9-17 * * 1-5

# Every Monday at 3 AM
DOCUMENT_SYNC_CRON_SCHEDULE=0 3 * * 1

# First day of every month at midnight
DOCUMENT_SYNC_CRON_SCHEDULE=0 0 1 * *
```

### Cron Expression Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, where 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

## Deployment

### GCP VM Deployment

For deploying to Google Cloud Platform VM:

1. **Set Environment Variables**:
   ```bash
   export DOCUMENT_SYNC_CRON_ENABLED=true
   export DOCUMENT_SYNC_CRON_SCHEDULE="0 2 * * *"
   export DOCUMENT_SYNC_CRON_TIMEZONE="America/New_York"
   ```

2. **Configure as systemd service** (recommended):
   ```bash
   # /etc/systemd/system/invoice-app.service
   [Unit]
   Description=Invoice Management Application
   After=network.target

   [Service]
   Type=simple
   User=appuser
   WorkingDirectory=/opt/invoice-app
   Environment="NODE_ENV=production"
   Environment="DOCUMENT_SYNC_CRON_ENABLED=true"
   ExecStart=/usr/bin/node /opt/invoice-app/server.js
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start**:
   ```bash
   sudo systemctl enable invoice-app
   sudo systemctl start invoice-app
   sudo systemctl status invoice-app
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

# Set timezone
ENV TZ=America/New_York
RUN apk add --no-cache tzdata

# App configuration
WORKDIR /app
COPY . .
RUN npm ci --only=production

# Cron configuration
ENV DOCUMENT_SYNC_CRON_ENABLED=true
ENV DOCUMENT_SYNC_CRON_SCHEDULE="0 2 * * *"
ENV DOCUMENT_SYNC_CRON_TIMEZONE="America/New_York"

CMD ["npm", "start"]
```

## Troubleshooting

### Cron Job Not Running

1. Check if cron is enabled:
   ```typescript
   import { getDocumentSyncCronStatus } from '@/lib/services/document-sync-cron.service';
   console.log(getDocumentSyncCronStatus());
   ```

2. Verify environment variables:
   ```bash
   echo $DOCUMENT_SYNC_CRON_ENABLED
   echo $DOCUMENT_SYNC_CRON_SCHEDULE
   ```

3. Check logs for initialization errors:
   ```bash
   grep "Document Sync Cron" /var/log/app.log
   ```

### Documents Not Syncing

1. Check SmartAdvocate API credentials
2. Verify date range is correct
3. Check category IDs (78 for Invoices, 1080 for Receipts)
4. Review document sync errors table

### Performance Issues

1. Reduce page size: `SA_DOCUMENT_SYNC_PAGE_SIZE=50`
2. Limit date range for large syncs
3. Monitor memory usage during sync
4. Consider running sync during off-peak hours

## Best Practices

1. **Schedule During Off-Peak Hours**: Run cron job when system load is low (e.g., 2 AM)
2. **Monitor Sync Errors**: Regularly check `documentSyncErrors` table
3. **Use Force Sync Sparingly**: Only use force mode when necessary (re-processing is expensive)
4. **Set Appropriate Timezone**: Match your business hours timezone
5. **Test Before Production**: Use manual sync to test date ranges before enabling cron
6. **Log Rotation**: Implement log rotation for production deployments
7. **Alerting**: Set up alerts for sync failures or high error rates

## API Reference

### Server Actions

#### `syncDocumentsFromSmartAdvocate(options)`

Sync documents from SmartAdvocate.

**Parameters:**
- `options.fromDate` (string, optional): Start date (YYYY-MM-DD)
- `options.toDate` (string, optional): End date (YYYY-MM-DD)
- `options.categoryIDs` (number[], optional): Category IDs to filter
- `options.force` (boolean, optional): Force re-process existing documents

**Returns:**
```typescript
{
  data?: DocumentSyncResult;
  error?: string;
}
```

### Cron Service Functions

#### `initializeDocumentSyncCron()`
Initialize the cron job. Should be called once at app startup.

#### `stopDocumentSyncCron()`
Stop the running cron job.

#### `getDocumentSyncCronStatus()`
Get current status of the cron job.

Returns:
```typescript
{
  initialized: boolean;
  enabled: boolean;
  schedule: string;
  timezone: string;
  running: boolean;
  nextExecution: string | null;
}
```

#### `triggerManualSync()`
Manually trigger a sync (bypasses schedule). Useful for testing.

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Review the `documentSyncErrors` table for failed documents
3. Verify environment variables are correctly set
4. Ensure SmartAdvocate API credentials are valid

## Version History

### Version 1.0.0 (Current)
- Initial release with automated and manual sync
- Smart duplicate detection and modified date tracking
- Configurable cron scheduling
- UI component for manual sync
- Comprehensive error logging
