# Cron Job Setup & Initialization

Quick guide on how the automated cron job works and initializes.

---

## 🚀 **How It Works**

### **Automatic Initialization Flow**

```
Server Starts (npm start or npm run dev)
  │
  ↓
Next.js calls instrumentation.ts
  │
  ↓
instrumentation.ts imports initializeCronJobs()
  │
  ↓
initializeCronJobs() checks environment
  ├─→ DOCUMENT_SYNC_CRON_ENABLED = false
  │    └─→ ❌ Skip (cron disabled)
  │
  └─→ DOCUMENT_SYNC_CRON_ENABLED = true
       │
       ↓
  initializeDocumentSyncCron()
       │
       ├─→ Parse config from env vars
       ├─→ Validate cron expression
       ├─→ Create scheduled task
       └─→ ✅ Cron job running!

Every 6 hours (default):
  ↓
  Execute sync task
  ├─→ Get yesterday's date range
  ├─→ Call syncDocumentsFromSmartAdvocate()
  ├─→ Process documents
  └─→ Log results
```

---

## 📁 **Files Involved**

### **1. instrumentation.ts** (root level)
Next.js instrumentation hook - runs once when server starts

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeCronJobs } = await import('./src/lib/init/cron-init');
    initializeCronJobs();
  }
}
```

**Purpose:** Entry point for server initialization

### **2. next.config.ts**
Enables the instrumentation hook

```typescript
experimental: {
  instrumentationHook: true,
},
```

**Purpose:** Tells Next.js to load instrumentation.ts

### **3. src/lib/init/cron-init.ts**
Cron initialization logic

```typescript
export function initializeCronJobs() {
  // Prevent multiple initializations
  // Initialize document sync cron
  initializeDocumentSyncCron();
}
```

**Purpose:** Centralized initialization for all cron jobs

### **4. src/lib/services/document-sync-cron.service.ts**
Cron job implementation

```typescript
export function initializeDocumentSyncCron() {
  // Parse config from env
  // Create cron schedule
  // Execute sync task
}
```

**Purpose:** Document sync cron logic

---

## ⚙️ **Configuration**

### **Environment Variables**

```bash
# Enable/disable automated sync
DOCUMENT_SYNC_CRON_ENABLED=true

# Cron schedule (default: every 6 hours)
DOCUMENT_SYNC_CRON_SCHEDULE=0 */6 * * *

# Timezone
DOCUMENT_SYNC_CRON_TIMEZONE=America/New_York
```

### **When Cron Runs**

With default settings (`0 */6 * * *`):
- **12:00 AM** (midnight)
- **6:00 AM**
- **12:00 PM** (noon)
- **6:00 PM**

Each run syncs: **Yesterday to Today** (one day of documents)

---

## 🔍 **Verification**

### **Check If Cron Initialized**

When you start the server, you should see:

```
[Cron Init] Initializing cron jobs...
[Document Sync Cron] Initializing with schedule: 0 */6 * * * (America/New_York)
[Document Sync Cron] Cron job initialized successfully
[Document Sync Cron] Next execution: Check your cron schedule for next execution time
[Cron Init] Cron jobs initialized successfully
```

### **If Cron Is Disabled**

```
[Document Sync Cron] Cron job is disabled (DOCUMENT_SYNC_CRON_ENABLED=false)
```

### **If Already Initialized**

```
[Document Sync Cron] Already initialized, skipping...
[Cron Init] Already initialized, skipping...
```

---

## 🚨 **Troubleshooting**

### **Cron Not Starting**

**Problem:** No cron initialization logs

**Checks:**
1. Is `instrumentation.ts` in the root directory?
2. Is `instrumentationHook: true` in `next.config.ts`?
3. Did you restart the server?
4. Check `NEXT_RUNTIME` environment variable

**Solution:**
```bash
# Restart the server
npm run dev  # or npm start
```

### **Cron Not Running**

**Problem:** Initialized but not executing

**Checks:**
1. Is `DOCUMENT_SYNC_CRON_ENABLED=true`?
2. Is the cron expression valid?
3. Check timezone settings

**Solution:**
```bash
# Verify environment variables
echo $DOCUMENT_SYNC_CRON_ENABLED
echo $DOCUMENT_SYNC_CRON_SCHEDULE
```

### **Multiple Initializations**

**Problem:** Cron initialized multiple times

**Why:** Development server hot-reloads, but we have guards

**Result:** ✅ Safe - duplicate initialization is prevented

**Logs:**
```
[Document Sync Cron] Already initialized, skipping...
```

---

## 🧪 **Testing**

### **Test Initialization**

1. Set environment variables:
```bash
export DOCUMENT_SYNC_CRON_ENABLED=true
export DOCUMENT_SYNC_CRON_SCHEDULE="0 */6 * * *"
```

2. Start server:
```bash
npm run dev
```

3. Check logs for initialization messages

### **Test Manual Trigger**

```typescript
import { triggerManualSync } from '@/lib/services/document-sync-cron.service';

// Manually trigger a sync (for testing)
await triggerManualSync();
```

### **Check Cron Status**

```typescript
import { getDocumentSyncCronStatus } from '@/lib/services/document-sync-cron.service';

const status = getDocumentSyncCronStatus();
console.log(status);
// {
//   initialized: true,
//   enabled: true,
//   schedule: "0 */6 * * *",
//   timezone: "America/New_York",
//   running: true,
//   nextExecution: "..."
// }
```

---

## 🎯 **Development vs Production**

### **Development Mode**

```bash
npm run dev
```

- Cron initializes if `DOCUMENT_SYNC_CRON_ENABLED=true`
- Hot-reload may re-initialize (safe, guards prevent duplicates)
- Good for testing cron behavior

### **Production Mode**

```bash
npm start
```

- Cron initializes once on server start
- No hot-reload, single initialization
- Runs reliably on schedule

---

## 📊 **Monitoring**

### **Logs to Watch**

**Initialization:**
```
[Cron Init] Initializing cron jobs...
[Document Sync Cron] Initialized successfully
```

**Execution:**
```
[Document Sync Cron] Starting automated sync at 2024-01-15T06:00:00.000Z
[Document Sync Cron] Syncing documents from 2024-01-14 to 2024-01-15
[Document Sync Cron] Sync completed successfully in 45.2s
```

**Errors:**
```
[Document Sync Cron] Sync failed: <error message>
[Cron Init] Failed to initialize cron jobs: <error>
```

### **Health Checks**

Monitor these metrics:
- ✅ Cron initialization on server start
- ✅ Scheduled executions (every 6 hours)
- ✅ Successful sync completion
- ⚠️ Sync failures or errors
- ⚠️ Missing scheduled runs

---

## 🔧 **Advanced Configuration**

### **Custom Schedule Examples**

```bash
# Every hour
DOCUMENT_SYNC_CRON_SCHEDULE="0 * * * *"

# Every day at 2 AM
DOCUMENT_SYNC_CRON_SCHEDULE="0 2 * * *"

# Twice daily (8 AM and 8 PM)
DOCUMENT_SYNC_CRON_SCHEDULE="0 8,20 * * *"

# Four times daily (midnight, 6 AM, noon, 6 PM)
DOCUMENT_SYNC_CRON_SCHEDULE="0 0,6,12,18 * * *"

# Every weekday at 9 AM
DOCUMENT_SYNC_CRON_SCHEDULE="0 9 * * 1-5"

# First day of month at midnight
DOCUMENT_SYNC_CRON_SCHEDULE="0 0 1 * *"
```

### **Multiple Timezones**

```bash
# New York (EST/EDT)
DOCUMENT_SYNC_CRON_TIMEZONE=America/New_York

# Los Angeles (PST/PDT)
DOCUMENT_SYNC_CRON_TIMEZONE=America/Los_Angeles

# Chicago (CST/CDT)
DOCUMENT_SYNC_CRON_TIMEZONE=America/Chicago

# London (GMT/BST)
DOCUMENT_SYNC_CRON_TIMEZONE=Europe/London

# UTC
DOCUMENT_SYNC_CRON_TIMEZONE=UTC
```

---

## 🎬 **Quick Start Checklist**

- [ ] Set `DOCUMENT_SYNC_CRON_ENABLED=true` in `.env`
- [ ] Configure schedule: `DOCUMENT_SYNC_CRON_SCHEDULE=0 */6 * * *`
- [ ] Set timezone: `DOCUMENT_SYNC_CRON_TIMEZONE=America/New_York`
- [ ] Configure SmartAdvocate API credentials
- [ ] Start server: `npm start` or `npm run dev`
- [ ] Check logs for initialization messages
- [ ] Verify cron is running
- [ ] Wait for first scheduled execution
- [ ] Monitor sync results

---

## 📚 **Related Documentation**

- **DOCUMENT_SYNC.md** - Complete sync documentation
- **RETRY_AND_DUPLICATE_LOGIC.md** - Retry and duplicate detection
- **API_SUMMARY.md** - Quick reference guide

---

## ✅ **Summary**

**What happens automatically:**
1. ✅ Server starts
2. ✅ `instrumentation.ts` runs
3. ✅ Cron job initializes (if enabled)
4. ✅ Runs on schedule (every 6 hours by default)
5. ✅ Syncs yesterday's documents
6. ✅ Logs results

**What you need to do:**
1. Set environment variables
2. Start the server
3. Monitor logs

**That's it!** 🎉
