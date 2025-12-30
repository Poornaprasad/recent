# API Summary & Retry Logic Overview

Quick reference guide for external APIs and retry mechanisms.

---

## ✅ Retry Logic: Already Implemented!

**YES**, there is a comprehensive retry utility with exponential backoff implemented at:

📁 **Location**: `src/lib/utils/retry.ts`

### Features
- ✅ Exponential backoff (2s → 4s → 8s)
- ✅ Jitter (±20% randomness)
- ✅ Smart retry logic (only retries retriable errors)
- ✅ HTTP status code aware
- ✅ Configurable retry count and delays
- ✅ **Already applied to ALL SmartAdvocate API calls**

---

## 📡 All External APIs Using Retry Logic

### SmartAdvocate CRM APIs (ALL use retry)

| API | File | Function | Retry? | Timeout |
|-----|------|----------|--------|---------|
| **Document APIs** |
| Get Documents by Date | `document.ts` | `getDocumentsByDate()` | ✅ Yes | 60s |
| Download Document | `document.ts` | `getDocumentContent()` | ✅ Yes | 60s |
| **Case APIs** |
| Get Case Info | `case-info.ts` | `getCaseInfo()` | ✅ Yes | 30s |
| **Contact APIs** |
| Get Contact Types | `contact.ts` | `getContactTypes()` | ✅ Yes | 30s |
| Lookup Contacts | `contact.ts` | `lookupContacts()` | ✅ Yes | 30s |
| **Disbursement APIs** |
| Get Disbursement Types | `disbursement.ts` | `getDisbursementTypes()` | ✅ Yes | 30s |
| Get Disbursement Statuses | `disbursement.ts` | `getDisbursementStatuses()` | ✅ Yes | 30s |
| Create Disbursement | `disbursement.ts` | `createDisbursement()` | ✅ Yes | 30s |

### Summary
- **Total External APIs**: 8
- **Using Retry Logic**: 8 (100%)
- **Retry Configuration**: 3 retries, 2s base delay, exponential backoff

---

## 🔄 Default Cron Schedule

**UPDATED**: Changed to run every 6 hours

```bash
# Old default
DOCUMENT_SYNC_CRON_SCHEDULE=0 2 * * *  # Daily at 2 AM

# New default (CURRENT)
DOCUMENT_SYNC_CRON_SCHEDULE=0 */6 * * *  # Every 6 hours
```

**Schedule Details**:
- Runs at: 12 AM, 6 AM, 12 PM, 6 PM (every day)
- Timezone: Configurable (default: America/New_York)
- Syncs: Yesterday to today (one day range)

**Files Changed**:
- ✅ `.env.example` - Updated default and examples
- ✅ `src/lib/services/document-sync-cron.service.ts` - Updated code default

---

## 🔍 Duplicate Detection Logic

### How It Works

**Step 1: Generate Hash**
```
documentHash = SHA256(documentID + caseNumber)
```

**Example**:
```
Document ID: 12345
Case Number: "2024-001"
Result Hash: "8f3d4b2a1c9e7f6d5e4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6"
```

**Step 2: Database Lookup**
```sql
SELECT * FROM invoices
WHERE document_hash = '{hash}'
LIMIT 1;
```

**Step 3: Decision**
- **Not Found**: New document → Process
- **Found**: Existing → Check if update needed

---

## 🔄 Modified Date Logic

### Purpose
Detect when documents have been updated in SmartAdvocate and need re-processing.

### How It Works

```
Document exists in database
  │
  ├─→ Check invoice status
  │    │
  │    ├─→ Status = "Paid" or "Pending"
  │    │    └─→ ❌ SKIP (finalized, don't update)
  │    │
  │    └─→ Status = "Draft" or "Review"
  │         │
  │         └─→ Compare modified dates
  │              │
  │              ├─→ SmartAdvocate date > Database date
  │              │    └─→ ✅ UPDATE (newer version)
  │              │
  │              └─→ SmartAdvocate date ≤ Database date
  │                   └─→ ❌ SKIP (up to date)
```

### Fields Used

1. **From SmartAdvocate API**:
   - `modifiedDate`: Last modified timestamp from API

2. **Stored in Database**:
   - `invoices.sa_modified_date`: Timestamp from last sync

3. **Status Field**:
   - `invoices.status`: Current processing status
   - Values: Draft, Review, Pending, Paid

### Update Rules

| Current Status | Can Update? | Reason |
|----------------|-------------|--------|
| Draft | ✅ Yes | Not reviewed yet, safe to update |
| Review | ✅ Yes | Under review, can incorporate changes |
| Pending | ❌ No | Approved by manager, locked |
| Paid | ❌ No | Payment complete, immutable |

---

## 🎯 Complete Decision Flow

```
Document from SmartAdvocate
  │
  ├─→ [1] Force mode enabled?
  │    └─→ YES: Process (bypass all checks)
  │
  ├─→ [2] Generate documentHash
  │    └─→ Query database
  │         │
  │         ├─→ NOT FOUND
  │         │    └─→ ✅ CREATE NEW
  │         │        - Counter: successful++
  │         │        - Save with saModifiedDate
  │         │
  │         └─→ FOUND (duplicate detected)
  │              │
  │              ├─→ [3] Status = Paid/Pending?
  │              │    └─→ YES: ⏭️ SKIP
  │              │        - Counter: skipped++
  │              │        - Reason: Already processed
  │              │
  │              └─→ [4] Status = Draft/Review
  │                   │
  │                   ├─→ No modified date in DB?
  │                   │    └─→ 🔄 UPDATE
  │                   │        - Counter: updated++, successful++
  │                   │
  │                   ├─→ SA date > DB date?
  │                   │    └─→ 🔄 UPDATE
  │                   │        - Counter: updated++, successful++
  │                   │
  │                   └─→ SA date ≤ DB date
  │                        └─→ ⏭️ SKIP
  │                            - Counter: skipped++
  │                            - Reason: Up to date
```

---

## 📊 Result Counters Explained

After sync completes, you see these statistics:

```typescript
{
  totalDocuments: 150,      // All docs from API (all categories)
  filteredDocuments: 45,    // After category filter (invoices + receipts)
  processedDocuments: 30,   // Actually processed (not skipped)
  successful: 28,           // Successfully saved/updated
  failed: 2,                // Processing errors
  skipped: 13,              // Duplicates (already synced & up-to-date)
  updated: 2                // Existing docs that were updated
}
```

**What Each Means**:

1. **totalDocuments**: Raw count from SmartAdvocate API
2. **filteredDocuments**: After applying category IDs (78=Invoices, 1080=Receipts)
3. **skipped**: Documents that already exist and don't need updating
4. **updated**: Existing documents that were updated (newer in SA)
5. **successful**: Total saved (new documents + updated documents)
6. **failed**: Errors during processing
7. **processedDocuments**: Everything we attempted (successful + failed)

**Math**:
```
filteredDocuments = skipped + processedDocuments
processedDocuments = successful + failed
successful = (new documents) + updated
```

---

## 🔧 Example Scenarios

### Scenario 1: First Sync
```
Day 1, 2 AM: First sync
- 100 documents from SA
- 0 exist in DB
- Result:
  • totalDocuments: 100
  • filteredDocuments: 30 (category filter)
  • successful: 28
  • failed: 2
  • skipped: 0
  • updated: 0
```

### Scenario 2: Second Sync (No Changes)
```
Day 1, 8 AM: Second sync (6 hours later)
- Same 100 documents
- All exist in DB, no modifications
- Result:
  • totalDocuments: 100
  • filteredDocuments: 30
  • successful: 0
  • failed: 0
  • skipped: 30 (all duplicates)
  • updated: 0
```

### Scenario 3: Sync with Updates
```
Day 2, 2 AM: Third sync
- 100 documents (same as before)
- 5 were modified in SA yesterday
- 3 are still in Draft status
- 2 are already Paid
- Result:
  • totalDocuments: 100
  • filteredDocuments: 30
  • successful: 3 (only Draft ones updated)
  • failed: 0
  • skipped: 27 (25 unchanged + 2 Paid)
  • updated: 3
```

### Scenario 4: Force Sync
```
Day 2, Manual: Force sync with UI button
- User checks "Force sync" option
- All 30 documents re-processed
- Result:
  • totalDocuments: 100
  • filteredDocuments: 30
  • successful: 28
  • failed: 2
  • skipped: 0 (force bypasses checks)
  • updated: 28 (all existing updated)
```

---

## 🚨 Retry Logic Examples

### Example 1: Network Error (Retries)
```
Attempt 1: Network error (ECONNRESET)
[Retry] Attempt 1/3 failed, retrying in 2134ms: ECONNRESET
  ↓ Wait ~2s
Attempt 2: Success ✅
```

### Example 2: Rate Limit (Retries)
```
Attempt 1: 429 Too Many Requests
[Retry] Attempt 1/3 failed, retrying in 2287ms: HTTP error: 429
  ↓ Wait ~2s
Attempt 2: 429 Too Many Requests
[Retry] Attempt 2/3 failed, retrying in 4512ms: HTTP error: 429
  ↓ Wait ~4s
Attempt 3: Success ✅
```

### Example 3: Server Error (Retries)
```
Attempt 1: 503 Service Unavailable
[Retry] Attempt 1/3 failed, retrying in 2091ms: HTTP error: 503
  ↓ Wait ~2s
Attempt 2: 503 Service Unavailable
[Retry] Attempt 2/3 failed, retrying in 4234ms: HTTP error: 503
  ↓ Wait ~4s
Attempt 3: 503 Service Unavailable
[Retry] Attempt 3/3 failed, retrying in 8467ms: HTTP error: 503
  ↓ Wait ~8s
Attempt 4: Fail ❌ (max retries reached)
Error thrown: Service unavailable after 3 retries
```

### Example 4: Bad Request (No Retry)
```
Attempt 1: 400 Bad Request
Error thrown immediately ❌ (client error, don't retry)
```

---

## 📚 Documentation Files

All detailed documentation available:

1. **DOCUMENT_SYNC.md** (1000+ lines)
   - Complete setup guide
   - Configuration examples
   - Deployment instructions
   - Troubleshooting

2. **RETRY_AND_DUPLICATE_LOGIC.md** (700+ lines)
   - Retry algorithm explained
   - All external APIs listed
   - Duplicate detection flow
   - Modified date logic
   - Performance characteristics

3. **API_SUMMARY.md** (this file)
   - Quick reference
   - Key concepts
   - Common scenarios

---

## ✅ Summary Checklist

- [✅] Retry logic implemented? **YES** - in `src/lib/utils/retry.ts`
- [✅] Applied to all external APIs? **YES** - all 8 SmartAdvocate APIs
- [✅] Default cron schedule? **Every 6 hours** (updated)
- [✅] Duplicate detection? **Hash-based** (documentID + caseNumber)
- [✅] Modified date tracking? **Timestamp comparison** with status checks
- [✅] Configurable? **YES** - via environment variables
- [✅] Production ready? **YES** - fully tested and documented

---

## 🎯 Quick Configuration

### Minimal Setup
```bash
# .env
DOCUMENT_SYNC_CRON_ENABLED=true
DOCUMENT_SYNC_CRON_SCHEDULE=0 */6 * * *
SA_API_BASE_URL=https://your-api.smartadvocate.com
SA_API_KEY=your_key_here
```

### That's It!
The system will:
- ✅ Run every 6 hours automatically
- ✅ Retry failed API calls (3 attempts with exponential backoff)
- ✅ Skip duplicates automatically
- ✅ Update modified documents intelligently
- ✅ Log everything for monitoring

---

## 🔗 Related Files

```
src/lib/utils/retry.ts                        # Retry utility
src/lib/services/document-sync.service.ts     # Core sync logic
src/lib/services/document-sync-cron.service.ts # Cron management
src/lib/crm/smartadvocate/document.ts         # Document APIs
src/lib/crm/smartadvocate/case-info.ts        # Case APIs
src/lib/crm/smartadvocate/contact.ts          # Contact APIs
src/lib/crm/smartadvocate/disbursement.ts     # Disbursement APIs
```

---

End of Summary
