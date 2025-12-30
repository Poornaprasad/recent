# Architecture Documentation

## Overview

This document provides detailed technical documentation of the Invoice Management System's architecture, design patterns, and implementation decisions.

## Architecture Pattern: Clean Architecture

The application follows Clean Architecture (also known as Ports and Adapters, or Hexagonal Architecture) principles:

```
┌───────────────────────────────────────────────────────────────┐
│                      External Systems                          │
│            (Browser, Mobile, External APIs)                    │
└─────────────────────┬─────────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────────┐
│                  PRESENTATION LAYER                            │
│  Responsibility: UI rendering, user interaction                │
│  Technology: Next.js App Router, React Server/Client Components│
│                                                                │
│  Components:                                                   │
│  ├── Pages (app/*/page.tsx)                                   │
│  ├── Layouts (app/layout.tsx)                                 │
│  ├── UI Components (components/ui/*)                          │
│  └── Feature Components (components/invoice/, etc.)           │
└─────────────────────┬─────────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────────┐
│                  APPLICATION LAYER                             │
│  Responsibility: Orchestrate use cases, handle requests        │
│  Technology: Next.js Server Actions                            │
│                                                                │
│  Server Actions:                                               │
│  ├── invoice.actions.ts - Invoice operations                  │
│  ├── vendor.actions.ts - Vendor management                    │
│  ├── dashboard.actions.ts - Analytics & stats                 │
│  └── pending-vendor.actions.ts - Vendor approval workflow     │
│                                                                │
│  Pattern:                                                      │
│  'use server';                                                 │
│  export async function someAction(input) {                    │
│    try {                                                       │
│      const result = await service.operation(input);           │
│      return { data: result };                                 │
│    } catch (error) {                                           │
│      return { error: errorMessage };                          │
│    }                                                           │
│  }                                                             │
└─────────────────────┬─────────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                         │
│  Responsibility: Core business rules, domain logic             │
│  Technology: TypeScript services                               │
│                                                                │
│  Services:                                                     │
│  ├── invoice.service.ts - Invoice processing business rules   │
│  ├── vendor.service.ts - Vendor management logic              │
│  ├── dashboard-stats.service.ts - Analytics calculations      │
│  ├── recurring-bill.service.ts - Recurring bill detection     │
│  └── pending-vendor.service.ts - Vendor approval logic        │
│                                                                │
│  Core Services (cross-cutting concerns):                       │
│  ├── core/approval/ - Approval workflow logic                 │
│  ├── core/audit/ - Audit trail logic                          │
│  ├── core/auth/ - RBAC authorization                          │
│  ├── core/logging/ - Structured logging                       │
│  ├── core/payment-type/ - Payment categorization              │
│  └── core/state/ - State detection logic                      │
│                                                                │
│  Pattern:                                                      │
│  class InvoiceService {                                        │
│    async processInvoice(input) {                              │
│      // Business logic here                                    │
│      await repository.save(invoice);                          │
│      return invoice;                                           │
│    }                                                           │
│  }                                                             │
└─────────────────────┬─────────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────────┐
│                    DATA ACCESS LAYER                           │
│  Responsibility: Abstract data persistence                     │
│  Technology: Repository pattern with Drizzle ORM               │
│                                                                │
│  Repositories:                                                 │
│  ├── invoice.repository.ts - Invoice CRUD operations          │
│  ├── vendor.repository.ts - Vendor CRUD operations            │
│  └── pending-vendor.repository.ts - Pending vendor operations │
│                                                                │
│  Mappers (data transformation):                                │
│  ├── mappers/invoice.mapper.ts - DB ↔ Domain mapping          │
│  ├── mappers/vendor.mapper.ts - DB ↔ Domain mapping           │
│  └── mappers/pending-vendor.mapper.ts - DB ↔ Domain mapping   │
│                                                                │
│  Pattern:                                                      │
│  export async function findAllInvoices() {                    │
│    const db = await getDatabase();                            │
│    const rows = await db.select().from(invoices);            │
│    return rows.map(mapDbRowToInvoice);                       │
│  }                                                             │
└─────────────────────┬─────────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                          │
│  Responsibility: External systems, database, file storage      │
│  Technology: PostgreSQL, Firebase, Google AI                   │
│                                                                │
│  Components:                                                   │
│  ├── Database (PostgreSQL via Drizzle ORM)                    │
│  ├── File Storage (Firebase or local filesystem)              │
│  ├── AI Services (Google Gemini via Genkit)                   │
│  ├── External APIs (QuickBooks, CRM)                          │
│  └── Email/Notification Services (future)                     │
└───────────────────────────────────────────────────────────────┘
```

## Design Patterns

### 1. Repository Pattern

**Purpose**: Abstract data access logic from business logic

**Implementation**:
```typescript
// Repository interface (implicit through functions)
export async function findAllInvoices(): Promise<StoredInvoice[]> {
  const db = await getDatabase();
  const rows = await db.select().from(invoices).orderBy(desc(invoices.invoiceDate));
  return rows.map(mapDbRowToInvoice);
}

export async function findInvoiceById(id: string): Promise<StoredInvoice | undefined> {
  const db = await getDatabase();
  const row = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return row[0] ? mapDbRowToInvoice(row[0]) : undefined;
}
```

**Benefits**:
- Centralized data access
- Easy to mock for testing
- Database-agnostic business logic
- Simplified migration (SQLite → PostgreSQL was straightforward)

### 2. Mapper Pattern

**Purpose**: Transform between database models and domain models

**Implementation**:
```typescript
// mapper/invoice.mapper.ts
export function mapDbRowToInvoice(row: Invoice): StoredInvoice {
  return {
    id: row.id,
    status: row.status,
    invoiceNumber: createField(row.invoiceNumber, row.invoiceNumberMeta),
    invoiceDate: createField(row.invoiceDate, row.invoiceDateMeta),
    // ... field mappings with metadata
  };
}

export function mapInvoiceToDbRow(invoice: StoredInvoice): Partial<Invoice> {
  return {
    id: invoice.id,
    status: invoice.status,
    invoiceNumber: extractValue(invoice.invoiceNumber),
    invoiceNumberMeta: serializeMeta(invoice.invoiceNumber),
    // ... reverse mapping
  };
}
```

**Benefits**:
- Single source of truth for transformations
- Eliminates 300+ lines of duplicate mapping code
- Proper type safety (no `any` types)
- Centralized metadata handling

### 3. Service Layer Pattern

**Purpose**: Encapsulate business logic

**Implementation**:
```typescript
class InvoiceService {
  async processInvoice(input: ProcessInvoiceInput): Promise<InvoiceProcessingResult> {
    // Validate file
    await this.validateFile(input);

    // Extract data using AI
    const extractedData = await extractInvoiceData(input.invoiceDataUri);

    // Build invoice with business rules
    const invoice = await this.buildInvoice(input, extractedData);

    // Apply analytics
    await this.enrichWithAnalytics(invoice);

    // Handle vendor
    await this.handleVendor(invoice);

    // Persist
    return await invoiceRepository.upsertInvoice(invoice);
  }
}
```

**Benefits**:
- Business logic isolated from UI and data access
- Reusable across different interfaces (API, CLI, web)
- Easy to test
- Clear separation of concerns

### 4. Singleton Pattern (Database Context)

**Purpose**: Ensure single database connection pool

**Implementation**:
```typescript
// db/context.ts
class DbContext {
  private initialized = false;

  async getDatabase(): Promise<NodePgDatabase<typeof schema>> {
    if (!this.initialized) {
      await initDb();
      this.initialized = true;
    }
    return getDb();
  }
}

export const dbContext = new DbContext();
export async function getDatabase() {
  return dbContext.getDatabase();
}
```

**Benefits**:
- Single connection pool for entire application
- Lazy initialization
- Prevents connection leaks
- Thread-safe (JavaScript single-threaded)

### 5. Factory Pattern (Genkit Flows)

**Purpose**: Create AI flows with configuration

**Implementation**:
```typescript
// ai/flows/extract-invoice-data.ts
export const extractInvoiceData = ai.defineFlow(
  {
    name: 'extractInvoiceData',
    inputSchema: z.object({ /* ... */ }),
    outputSchema: invoiceExtractionSchema,
  },
  async (input) => {
    // AI extraction logic
  }
);
```

## Data Flow

### Invoice Processing Flow

```
┌──────────────┐
│  User Upload │
│  (Component) │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────┐
│  processInvoiceAction          │
│  (Server Action)               │
│  - Validates input             │
│  - Calls service layer         │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  InvoiceService.processInvoice │
│  (Business Logic)              │
│  1. Validate file              │
│  2. Extract data (AI)          │
│  3. Detect duplicates          │
│  4. Analyze recurring bills    │
│  5. Check high-value           │
│  6. Handle vendor              │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Invoice Repository            │
│  (Data Access)                 │
│  - Maps domain → DB            │
│  - Executes query              │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  PostgreSQL Database           │
│  - Persists invoice            │
│  - Returns saved record        │
└────────────────────────────────┘
```

### Database Query Flow

```
Service Layer
    │
    ├─→ getDatabase() [context.ts]
    │       │
    │       ├─→ initDb() if needed [index.ts]
    │       │       │
    │       │       └─→ Pool.connect()
    │       │
    │       └─→ returns drizzle(pool)
    │
    └─→ db.select().from(table) [repository]
            │
            ├─→ SQL query executed
            │
            └─→ mapDbRowToDomain() [mapper]
                    │
                    └─→ Returns domain model
```

## Database Schema Design

### Core Tables

**invoices** - Central invoice table
- Stores extracted invoice data
- Includes AI extraction metadata
- Tracks approval workflow
- Multi-state support (CA, NY)

**vendors** - Vendor master data
- W9 tracking
- 1099 requirements
- Pause functionality

**pending_vendors** - Vendor approval workflow
- Detected during invoice processing
- Requires admin approval
- Links to originating invoice

**users** - User management
- RBAC roles
- State assignments
- Audit trail

### Metadata Storage Pattern

Invoice fields use a metadata pattern:

```typescript
interface ExtractedField<T> {
  value: T;
  confidence?: number;    // AI confidence score
  reasoning?: string;     // AI reasoning
  bbox?: BoundingBox;     // Location in document
}
```

Database storage:
```sql
CREATE TABLE invoices (
  invoice_number TEXT,
  invoice_number_meta TEXT, -- JSON: {confidence, reasoning, bbox}
  total_amount REAL,
  total_amount_meta TEXT,
  -- ... other fields
);
```

This pattern allows:
1. Easy querying by value
2. Preservation of AI metadata
3. Audit trail of extraction quality
4. Future ML model improvements

## Technology Choices

### Why PostgreSQL?

**Previous**: SQLite (development only)
**Current**: PostgreSQL

**Rationale**:
- **Production-ready**: ACID compliant, battle-tested
- **Scalability**: Handles concurrent connections
- **Features**: Advanced indexing, full-text search, JSON support
- **Ecosystem**: Wide tooling support (Drizzle, pgAdmin, Supabase)
- **Migration path**: Easy cloud deployment (Neon, Supabase, AWS RDS)

### Why Drizzle ORM?

**Alternatives considered**: Prisma, TypeORM, Kysely

**Rationale**:
- **TypeScript-first**: Excellent type inference
- **Lightweight**: Minimal runtime overhead
- **SQL-like**: Familiar query builder
- **Edge-ready**: Works with serverless environments
- **Migrations**: Built-in migration tool (Drizzle Kit)
- **Performance**: Closer to raw SQL than Prisma

### Why Next.js App Router?

**Rationale**:
- **Server Components**: Reduced JavaScript bundle
- **Server Actions**: Type-safe mutations without API routes
- **Streaming**: Progressive rendering
- **Layouts**: Shared UI patterns
- **File-based routing**: Intuitive structure

## Security Considerations

### 1. SQL Injection Prevention

**Method**: Parameterized queries via Drizzle ORM

```typescript
// Safe - parameterized
await db.select().from(invoices).where(eq(invoices.id, userId));

// Unsafe - don't do this
await db.execute(sql`SELECT * FROM invoices WHERE id = ${userId}`);
```

### 2. Input Validation

**Method**: Zod schemas at boundaries

```typescript
const schema = z.object({
  invoiceDataUri: z.string().url(),
  fileName: z.string().min(1).max(255),
});

const validated = schema.parse(input); // Throws if invalid
```

### 3. RBAC (Role-Based Access Control)

**Implementation**: Core RBAC service

```typescript
class RBACService {
  canApproveInvoice(user: User, invoice: Invoice): boolean {
    // Business rules for approval permissions
    if (user.role === 'admin') return true;
    if (user.role === 'director' && invoice.amount < 5000) return true;
    // ... more rules
  }
}
```

### 4. File Upload Security

**Measures**:
- MIME type validation
- File size limits
- Sanitized file names
- Separate storage domain (Firebase or S3)
- Virus scanning (recommended for production)

## Performance Optimizations

### 1. Database Indexes

```sql
CREATE INDEX idx_invoices_status_date ON invoices(status, invoice_date DESC);
CREATE INDEX idx_invoices_vendor_name ON invoices(vendor_name);
CREATE INDEX idx_invoices_state_approval ON invoices(state, approval_status);
CREATE INDEX idx_vendors_name ON vendors(name);
```

### 2. Connection Pooling

```typescript
const pool = new Pool({
  max: 10,                       // Maximum connections
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if pool exhausted
});
```

### 3. Query Optimization

**Avoid N+1 queries**:
```typescript
// Bad - N+1 queries
const invoices = await findAllInvoices();
for (const invoice of invoices) {
  const vendor = await findVendorById(invoice.vendorId); // N queries
}

// Good - Single query with join
const invoicesWithVendors = await db
  .select()
  .from(invoices)
  .leftJoin(vendors, eq(invoices.vendorId, vendors.id));
```

### 4. React Server Components

- Fetch data server-side
- Reduce client JavaScript
- Stream content progressively

## Deployment Architecture

```
┌──────────────────────────────────────────────────────┐
│                    CDN / Edge                         │
│              (Vercel Edge Network)                    │
│  - Static assets                                     │
│  - Image optimization                                │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│                Next.js Application                    │
│              (Vercel Serverless)                      │
│  - Server Components                                 │
│  - Server Actions                                    │
│  - API Routes                                        │
└────────────────┬─────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐   ┌─────▼────────┐
│  PostgreSQL  │   │  Firebase    │
│   (Neon)     │   │  (Storage)   │
│  - Invoices  │   │  - PDF files │
│  - Vendors   │   │  - Images    │
│  - Users     │   │              │
└──────────────┘   └──────────────┘
```

## Error Handling Strategy

### Current State
```typescript
try {
  const result = await operation();
  return { data: result };
} catch (error) {
  console.error('Error:', error);
  return { error: error.message };
}
```

### Recommended (Future)
```typescript
import { AppError, ValidationError, NotFoundError } from '@/lib/errors';

try {
  validateInput(input); // Throws ValidationError
  const result = await operation(); // Throws NotFoundError
  return { success: true, data: result };
} catch (error) {
  if (error instanceof ValidationError) {
    return { success: false, error: { type: 'validation', message: error.message } };
  }
  if (error instanceof NotFoundError) {
    return { success: false, error: { type: 'not_found', message: error.message } };
  }
  // Log unexpected errors
  logger.error('Unexpected error', error);
  return { success: false, error: { type: 'internal', message: 'An error occurred' } };
}
```

## Testing Strategy (Recommended)

### Unit Tests
```typescript
// services/invoice.service.test.ts
describe('InvoiceService', () => {
  it('should detect duplicate invoices', async () => {
    const service = new InvoiceService();
    const result = await service.checkDuplicate({
      invoiceNumber: 'INV-001',
      vendorName: 'Acme Corp',
      date: '2024-01-01',
    });
    expect(result.isDuplicate).toBe(true);
  });
});
```

### Integration Tests
```typescript
// repositories/invoice.repository.test.ts
describe('InvoiceRepository', () => {
  it('should save and retrieve invoice', async () => {
    const invoice = createTestInvoice();
    await upsertInvoice(invoice);
    const retrieved = await findInvoiceById(invoice.id);
    expect(retrieved).toEqual(invoice);
  });
});
```

### E2E Tests
```typescript
// e2e/invoice-processing.spec.ts
test('should process invoice end-to-end', async ({ page }) => {
  await page.goto('/invoices');
  await page.click('button:has-text("Upload Invoice")');
  await page.setInputFiles('input[type="file"]', 'test-invoice.pdf');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

## Monitoring & Observability (Recommended)

### Logging
```typescript
logger.info('Invoice processed', {
  invoiceId: invoice.id,
  vendorName: invoice.vendorName?.value,
  amount: invoice.totalAmount?.value,
  processingTimeMs: Date.now() - startTime,
  confidence: invoice.accuracyScore,
});
```

### Metrics
```typescript
metrics.increment('invoice.processed', {
  status: invoice.status,
  hasAnomaly: invoice.hasAmountAnomaly,
});

metrics.histogram('invoice.processing_time', processingTimeMs);
```

### Tracing
```typescript
const span = tracer.startSpan('processInvoice');
try {
  // ... processing
} finally {
  span.end();
}
```

## Future Architecture Considerations

### Microservices (if needed)
- Invoice Processing Service
- Vendor Management Service
- Analytics Service
- Notification Service

### Event-Driven Architecture
- Use message queue (RabbitMQ, AWS SQS)
- Publish events: InvoiceProcessed, VendorApproved
- Decouple services

### Caching Layer
- Redis for session data
- Query result caching
- Rate limiting

### API Gateway
- Centralized authentication
- Rate limiting
- API versioning
- Request logging

---

**Last Updated**: 2025-12-03
**Version**: 1.0.0
