# Retry Logic & Duplicate Detection

Comprehensive documentation of retry mechanisms and duplicate/modified detection logic.

---

## 🔄 Retry Logic with Exponential Backoff

### Overview

**ALL external API calls** to SmartAdvocate use a centralized retry utility with exponential backoff and jitter. This ensures resilience against network issues, rate limits, and temporary service outages.

### Implementation

**Location**: `src/lib/utils/retry.ts`

### Features

✅ **Exponential Backoff**: Delay doubles with each retry attempt
✅ **Jitter**: ±20% randomness to prevent thundering herd
✅ **Smart Retry Logic**: Only retries errors that make sense
✅ **Configurable**: Retry count, base delay, and custom retry conditions
✅ **HTTP Status-Aware**: Different behavior for 4xx vs 5xx errors

### Default Configuration

```typescript
maxRetries: 3
baseDelay: 2000ms (2 seconds)
Retry delays: ~2s, ~4s, ~8s (with jitter)
```

### Retry Decision Logic

```
┌─────────────────────────────────────┐
│ Error occurs during API call        │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ Check HTTP Status Code              │
└────────────┬────────────────────────┘
             │
             ├─→ 4xx (except 429): ❌ DO NOT RETRY
             │   (Client errors: bad request, auth, etc.)
             │
             ├─→ 429 (Rate Limit): ✅ RETRY
             │   (Too many requests, backoff and try again)
             │
             ├─→ 5xx Server Errors: ✅ RETRY
             │   (Server-side issues, likely temporary)
             │
             └─→ Network/Timeout: ✅ RETRY
                 (Network issues, connection resets, timeouts)

Result: Retry with exponential backoff + jitter
```

### Retry Algorithm

```typescript
Attempt 1: Execute immediately
  ↓ (fails)
Attempt 2: Wait ~2s (2000ms base + jitter)
  ↓ (fails)
Attempt 3: Wait ~4s (4000ms exponential + jitter)
  ↓ (fails)
Attempt 4: Wait ~8s (8000ms exponential + jitter)
  ↓ (fails)
Throw error (max retries reached)
```

**Jitter Formula**:
```
delay = baseDelay * 2^(attempt-1) + random(0-20%)
```

### Code Example

```typescript
import { retryWithBackoff, createHttpError } from '@/lib/utils/retry';

const response = await retryWithBackoff(
  async () => {
    const res = await fetch(url, { method: 'POST', headers, body });

    if (!res.ok) {
      throw createHttpError(res.status, res.statusText);
    }

    return res;
  },
  3,    // maxRetries
  2000  // baseDelay in ms
);
```

### Custom Retry Logic

You can provide a custom function to determine if an error should be retried:

```typescript
const customShouldRetry = (error: Error): boolean => {
  // Only retry on specific error messages
  return error.message.includes('ECONNRESET') ||
         error.message.includes('timeout');
};

await retryWithBackoff(
  asyncOperation,
  3,
  2000,
  customShouldRetry  // Custom retry decision
);
```

---

## 📡 External API Calls Using Retry Logic

All SmartAdvocate API integrations use the retry utility:

### 1. **Document APIs** (`src/lib/crm/smartadvocate/document.ts`)

| API Endpoint | Purpose | Timeout | Retry |
|-------------|---------|---------|-------|
| `POST /case/documents/byDatePaged` | Fetch documents by date range | 60s | ✅ Yes |
| `GET /case/document/download?documentID={id}` | Download document content | 60s | ✅ Yes |

**Usage in Sync**:
- Fetches paginated documents from SmartAdvocate
- Downloads document content (PDF/images)
- Handles large responses and binary data

### 2. **Case Info APIs** (`src/lib/crm/smartadvocate/case-info.ts`)

| API Endpoint | Purpose | Timeout | Retry |
|-------------|---------|---------|-------|
| `GET /case/CaseInfo?Casenumber={num}` | Get case details | 30s | ✅ Yes |

**Usage**:
- Lookup case information by case number
- Fetch plaintiff details
- Validate case existence

### 3. **Contact APIs** (`src/lib/crm/smartadvocate/contact.ts`)

| API Endpoint | Purpose | Timeout | Retry |
|-------------|---------|---------|-------|
| `GET /contact/ContactTypes?ContactCtg={id}` | Get contact types | 30s | ✅ Yes |
| `POST /Search/contactLookup` | Search contacts | 30s | ✅ Yes |

**Usage**:
- Fetch vendor/contact types for dropdowns
- Search contacts by name
- Lookup vendor details

### 4. **Disbursement APIs** (`src/lib/crm/smartadvocate/disbursement.ts`)

| API Endpoint | Purpose | Timeout | Retry |
|-------------|---------|---------|-------|
| `GET /case/Disbursement/types` | Get disbursement types | 30s | ✅ Yes |
| `GET /case/Disbursement/statuses` | Get disbursement statuses | 30s | ✅ Yes |
| `POST /case/disbursement` | Create disbursement | 30s | ✅ Yes |

**Usage**:
- Fetch disbursement configuration
- Create disbursements from invoices
- Track disbursement status

---

## 🔍 Duplicate & Modified Detection Logic

### Overview

The system uses a **dual-layer detection mechanism**:
1. **Hash-based duplicate detection** (prevents re-processing)
2. **Modified date tracking** (enables smart updates)

### 1. Document Hash Generation

**Purpose**: Create unique identifier for each document

**Formula**:
```typescript
documentHash = SHA256(documentID + caseNumber)
```

**Why this combination?**
- `documentID`: Unique to each document in SmartAdvocate
- `caseNumber`: Ensures documents are unique per case
- Together: Globally unique identifier for document-case pair

**Example**:
```
Document ID: 12345
Case Number: "2024-001"
Hash: "8f3d4b2a1c9e7f6d5e4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6"
```

### 2. Duplicate Detection Flow

```
New Document from SmartAdvocate
  │
  ↓
Generate documentHash
  │
  ↓
┌─────────────────────────────────────┐
│ Check database for existing hash   │
└────────────┬────────────────────────┘
             │
             ├─→ Hash NOT found
             │   └─→ ✅ NEW DOCUMENT
             │       └─→ Process and save
             │
             └─→ Hash FOUND
                 └─→ 🔍 Check if update needed
                     (See Modified Detection below)
```

**Database Query**:
```sql
SELECT * FROM invoices
WHERE document_hash = '{hash}'
LIMIT 1;
```

### 3. Modified Date Tracking

**Purpose**: Detect when documents have been updated in SmartAdvocate

**Fields Tracked**:
- `saModifiedDate`: Last modified date from SmartAdvocate API
- Stored in `invoices.sa_modified_date` column

**Logic**:
```typescript
function shouldUpdateDocument(
  existingInvoice: { status: string; saModifiedDate?: Date },
  newModifiedDate?: string
): boolean {
  // 1. No existing invoice? Not an update scenario
  if (!existingInvoice) return false;

  // 2. No modified date from API? Can't determine
  if (!newModifiedDate) return false;

  // 3. Only update if NOT yet processed (Draft/Review status)
  const canUpdate =
    existingInvoice.status === 'Draft' ||
    existingInvoice.status === 'Review';

  if (!canUpdate) return false; // Already Paid/Pending = finalized

  // 4. Check if SmartAdvocate document is newer
  const existingDate = existingInvoice.saModifiedDate;
  if (!existingDate) return true; // No date recorded, assume needs update

  const docDate = new Date(newModifiedDate);
  const existingDateObj = new Date(existingDate);

  // 5. Update if SmartAdvocate date is more recent
  return docDate > existingDateObj;
}
```

### 4. Complete Decision Tree

```
Document from SmartAdvocate
  │
  ├─→ [1] Force mode enabled?
  │    └─→ YES: ✅ Process (update if exists, create if new)
  │
  ├─→ [2] Generate documentHash
  │    └─→ Query database for matching hash
  │         │
  │         ├─→ Hash NOT FOUND
  │         │    └─→ ✅ CREATE NEW DOCUMENT
  │         │        └─→ Save with saModifiedDate
  │         │
  │         └─→ Hash FOUND (existing invoice)
  │              │
  │              ├─→ [3] Check invoice status
  │              │    │
  │              │    ├─→ Status = "Paid" or "Pending"
  │              │    │    └─→ ⏭️ SKIP (already processed/approved)
  │              │    │
  │              │    └─→ Status = "Draft" or "Review"
  │              │         │
  │              │         └─→ [4] Compare modified dates
  │              │              │
  │              │              ├─→ No saModifiedDate in DB
  │              │              │    └─→ 🔄 UPDATE (assume outdated)
  │              │              │
  │              │              ├─→ SmartAdvocate date > DB date
  │              │              │    └─→ 🔄 UPDATE (newer version)
  │              │              │
  │              │              └─→ SmartAdvocate date ≤ DB date
  │              │                   └─→ ⏭️ SKIP (up to date)
  │              │
  │              └─→ Result logged with appropriate counter
  │                   ├─→ skipped++
  │                   ├─→ updated++
  │                   └─→ successful++
```

### 5. Status-Based Update Protection

**Why check status?**

Documents in different statuses have different update needs:

| Status | Meaning | Allow Updates? | Reason |
|--------|---------|---------------|--------|
| **Draft** | Initial extraction, not reviewed | ✅ Yes | User hasn't reviewed yet, safe to update |
| **Review** | Needs manual review | ✅ Yes | Under review, can incorporate changes |
| **Pending** | Approved, awaiting payment | ❌ No | Approved by manager, shouldn't change |
| **Paid** | Processed and paid | ❌ No | Financial transaction complete, locked |

**Example Scenarios**:

**Scenario 1**: Document modified before review
```
Day 1: Document synced → Status: Draft
Day 2: Document updated in SA → Status: Draft
Action: ✅ UPDATE (incorporate changes before review)
```

**Scenario 2**: Document modified after approval
```
Day 1: Document synced → Status: Draft
Day 2: Manager approves → Status: Pending
Day 3: Document updated in SA → Status: Pending
Action: ⏭️ SKIP (already approved, don't change)
```

**Scenario 3**: Completed payment
```
Day 1: Document synced → Status: Draft
Day 2: Approved → Status: Pending
Day 3: Payment processed → Status: Paid
Day 4: Document updated in SA → Status: Paid
Action: ⏭️ SKIP (payment complete, immutable)
```

### 6. Force Sync Option

**Purpose**: Override all checks and re-process everything

**Use Cases**:
- Bulk re-extraction after AI model update
- Fixing historical data issues
- Re-processing after bug fixes

**Behavior**:
```typescript
if (force === true) {
  // Ignore all checks
  // Update if exists, create if new
  // Process regardless of status or modified date
}
```

**Warning**: Use sparingly! Forces re-processing of ALL documents in date range, including completed ones.

---

## 📊 Sync Result Counters

Understanding the sync statistics:

```typescript
{
  totalDocuments: 150,      // All docs from SmartAdvocate API
  filteredDocuments: 45,    // After category filter (78, 1080)
  processedDocuments: 30,   // Actually processed (not skipped)
  successful: 28,           // Successfully saved
  failed: 2,                // Processing errors
  skipped: 13,              // Duplicates (already exist & up-to-date)
  updated: 2                // Existing docs that were updated
}
```

**Breakdown**:
- **totalDocuments**: Raw count from API (all categories)
- **filteredDocuments**: After applying category filter (invoices + receipts)
- **skipped**: Hash found + (no modified date OR status locked OR not newer)
- **updated**: Hash found + status Draft/Review + newer modified date
- **successful**: New documents created + Documents updated
- **failed**: Errors during processing
- **processedDocuments**: successful + failed (everything we attempted)

**Validation**:
```
filteredDocuments = skipped + processedDocuments
processedDocuments = successful + failed
successful = (new documents) + updated
```

---

## 🔧 Configuration

### Retry Configuration

**Default** (built into retry utility):
```bash
MAX_RETRIES=3
BASE_DELAY=2000  # 2 seconds
```

**To customize** (in API call):
```typescript
await retryWithBackoff(
  operation,
  5,     // Max 5 retries instead of 3
  1000   // 1 second base delay instead of 2
);
```

### Duplicate Detection

**Automatic** - No configuration needed
- Uses `documentID + caseNumber` for hash
- Stored in `invoices.document_hash` column
- Indexed for fast lookups

### Modified Date Tracking

**Automatic** - No configuration needed
- Extracted from `modifiedDate` field in SmartAdvocate API
- Stored in `invoices.sa_modified_date` column
- Compared as timestamps

---

## 🚨 Error Handling

### Retryable Errors

These errors trigger retry with backoff:

1. **Network Errors**:
   - `ECONNRESET` - Connection reset
   - `ETIMEDOUT` - Connection timeout
   - `ENOTFOUND` - DNS lookup failed

2. **HTTP Errors**:
   - `429 Too Many Requests` - Rate limited
   - `500 Internal Server Error` - Server issue
   - `502 Bad Gateway` - Proxy error
   - `503 Service Unavailable` - Temporary outage
   - `504 Gateway Timeout` - Upstream timeout

3. **Timeout Errors**:
   - Request timeout (60s for documents, 30s for others)
   - AbortController timeout

### Non-Retryable Errors

These errors fail immediately (no retry):

1. **Client Errors (4xx)**:
   - `400 Bad Request` - Invalid request
   - `401 Unauthorized` - Auth failed
   - `403 Forbidden` - No permission
   - `404 Not Found` - Resource missing

2. **Business Logic Errors**:
   - Invalid case number
   - Missing required fields
   - Unsupported file type

### Logging

All retry attempts are logged:

```
[Retry] Attempt 1/3 failed, retrying in 2134ms: HTTP error: 503 Service Unavailable
[Retry] Attempt 2/3 failed, retrying in 4287ms: Request timeout after 60000ms
[Retry] Attempt 3/3 failed, retrying in 8591ms: Network error: ECONNRESET
```

---

## 📈 Performance Characteristics

### Retry Impact

**Best Case** (no retries):
- 1 API call
- ~200-1000ms response time

**Worst Case** (3 retries):
- 4 API calls total
- ~2s + 4s + 8s = 14s additional delay
- Total: ~15-16s with retries

**Typical** (1 retry):
- 2 API calls
- ~2s additional delay
- Total: ~3-4s

### Duplicate Check Performance

**Hash Lookup**: O(1) - Indexed query
- Average: <10ms
- Uses PostgreSQL index on `document_hash`

**Modified Date Comparison**: O(1)
- Simple timestamp comparison
- In-memory operation after DB fetch

---

## 🎯 Best Practices

### For Development

1. **Test with low retry counts** during development:
   ```typescript
   await retryWithBackoff(operation, 1, 1000); // 1 retry, 1s delay
   ```

2. **Monitor retry logs** to identify patterns:
   ```bash
   grep "\[Retry\]" logs/app.log | wc -l
   ```

3. **Handle specific errors** with custom retry logic when needed

### For Production

1. **Use default retry settings** (3 retries, 2s base delay)
2. **Set appropriate timeouts** for different operations:
   - Document fetching: 60s
   - Metadata lookups: 30s
3. **Monitor error rates** and adjust if needed
4. **Alert on high retry rates** (indicates API issues)

### For Sync Operations

1. **Use force sync sparingly** (expensive operation)
2. **Schedule syncs during off-peak hours** to minimize API load
3. **Monitor `skipped` vs `updated` counters** to verify detection works
4. **Check `documentSyncErrors` table** for patterns

---

## 🔍 Troubleshooting

### High Skip Rate

**Symptom**: Most documents are skipped
**Cause**: Documents already synced and up-to-date
**Action**: ✅ Normal behavior

### No Updates Detected

**Symptom**: `updated: 0` even when documents were modified
**Causes**:
1. Modified documents already processed (status = Paid/Pending)
2. Modified date not changing in SmartAdvocate
3. Date comparison logic issue

**Action**: Check `saModifiedDate` values in database

### Frequent Retries

**Symptom**: Many retry log messages
**Causes**:
1. SmartAdvocate API rate limiting (429)
2. Network connectivity issues
3. SmartAdvocate server issues (5xx)

**Action**:
- Check API rate limits
- Verify network stability
- Contact SmartAdvocate support if persistent

### Duplicate Documents

**Symptom**: Same document processed multiple times
**Causes**:
1. Hash collision (extremely rare)
2. Case number changing in SmartAdvocate
3. Document ID changing

**Action**:
- Check `document_hash` values
- Verify SmartAdvocate data consistency

---

## 📚 API Reference

### `retryWithBackoff<T>()`

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries?: number,
  baseDelay?: number,
  shouldRetry?: (error: Error) => boolean
): Promise<T>
```

**Parameters**:
- `fn`: Async function to retry
- `maxRetries`: Maximum retry attempts (default: 3)
- `baseDelay`: Base delay in ms (default: 2000)
- `shouldRetry`: Custom retry decision function (default: `shouldRetryHttpError`)

**Returns**: Result of successful function call

**Throws**: Last error if all retries fail

### `shouldRetryHttpError(error: Error): boolean`

Determines if an HTTP error should be retried.

**Returns**:
- `true`: Retry (5xx, 429, network, timeout)
- `false`: Don't retry (4xx except 429)

### `createHttpError(status: number, statusText: string): HttpError`

Creates an HTTP error with status code.

**Returns**: Error object with `status` property

---

## 📊 Metrics & Monitoring

### Key Metrics to Track

1. **Retry Rate**: `(total_retries / total_requests) * 100`
2. **Success Rate**: `(successful / processed) * 100`
3. **Skip Rate**: `(skipped / filtered) * 100`
4. **Update Rate**: `(updated / filtered) * 100`

### Health Indicators

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Retry Rate | <10% | 10-30% | >30% |
| Success Rate | >95% | 90-95% | <90% |
| Skip Rate | 60-90% | 40-60% | <40% or >95% |
| Update Rate | 5-20% | 1-5% or 20-40% | >40% |

---

## 🔐 Security Considerations

### API Credentials

- Retries do NOT expose credentials in logs
- Errors logged without sensitive data
- Headers sanitized in error messages

### Rate Limiting

- Exponential backoff helps respect rate limits
- Jitter prevents coordinated retry storms
- 429 errors trigger automatic retry

### Data Integrity

- Hash ensures no duplicate processing
- Status checks prevent modifying approved data
- Modified date tracking maintains audit trail

---

## Version History

### Current Version
- Retry logic with exponential backoff: ✅ Implemented
- Smart duplicate detection: ✅ Implemented
- Modified date tracking: ✅ Implemented
- All SmartAdvocate APIs use retry: ✅ Yes
- Default cron schedule: ✅ Every 6 hours
