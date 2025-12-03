# Invoice Management System

A production-ready Next.js application for intelligent invoice processing, vendor management, and approval workflows. Built with modern architecture patterns, AI-powered data extraction, and comprehensive audit trails.

## 🏗️ Architecture Pattern

This application follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│                  (Next.js App Router, React)                 │
│  - Pages (app/)                                             │
│  - Components (src/components/)                             │
│  - Client/Server Components                                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                     Application Layer                        │
│                    (Server Actions)                          │
│  - Invoice Actions (actions/invoice.actions.ts)             │
│  - Vendor Actions (actions/vendor.actions.ts)               │
│  - Dashboard Actions (actions/dashboard.actions.ts)         │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                      Business Logic Layer                    │
│                       (Services)                             │
│  - Invoice Service (services/invoice.service.ts)            │
│  - Vendor Service (services/vendor.service.ts)              │
│  - Dashboard Service (services/dashboard-stats.service.ts)  │
│  - Core Services (core/approval/, core/audit/, etc.)        │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                      Data Access Layer                       │
│                      (Repositories)                          │
│  - Invoice Repository (repositories/invoice.repository.ts)  │
│  - Vendor Repository (repositories/vendor.repository.ts)    │
│  - Mappers (repositories/mappers/*.mapper.ts)               │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                      Infrastructure Layer                    │
│                   (Database, External APIs)                  │
│  - PostgreSQL + Drizzle ORM                                 │
│  - Firebase (File Storage)                                  │
│  - Google AI (Gemini - Invoice Extraction)                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Repository Pattern**: Centralized data access with clean separation from business logic
2. **Mapper Pattern**: Dedicated mapper functions for transforming between domain and database models
3. **Service Layer**: Business logic isolated from presentation and data access
4. **Server Actions**: Type-safe server-side operations with Next.js App Router
5. **Database Context**: Singleton pattern for efficient PostgreSQL connection pooling

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Deployment](#-deployment)
- [Areas for Improvement](#-areas-for-improvement)
- [Contributing](#-contributing)

## ✨ Features

### Core Functionality
- **AI-Powered Invoice Extraction**: Automated data extraction using Google Gemini AI
- **Smart Vendor Management**: Vendor profiles with W9 tracking and 1099 requirements
- **Multi-State Support**: Separate workflows for California (CA) and New York (NY)
- **Approval Workflows**: Configurable approval rules based on amount thresholds and roles
- **Duplicate Detection**: Intelligent duplicate invoice identification
- **Recurring Bill Analysis**: Automatic detection and analysis of recurring bills

### Advanced Features
- **Role-Based Access Control (RBAC)**: Admin, Director, Manager, Account, User roles
- **Audit Logging**: Comprehensive tracking of all user actions and system changes
- **Dashboard Analytics**: Real-time statistics, OCR confidence tracking, invoice urgency matrix
- **Bulk Operations**: Batch upload and processing of invoices
- **Export Capabilities**: Export data to various formats (CSV, PDF)
- **State Detection**: Automatic state determination from invoice metadata

### Security & Compliance
- **Secure File Storage**: Firebase or local storage with access controls
- **Data Validation**: Input validation at all boundaries using Zod schemas
- **SQL Injection Protection**: Parameterized queries via Drizzle ORM
- **CSRF Protection**: Built-in Next.js protections
- **Audit Trail**: Complete history of all invoice modifications and approvals

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15.3.3 (App Router)
- **UI Library**: React 18.3
- **Styling**: Tailwind CSS 3.4
- **Components**: Radix UI + shadcn/ui
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Database**: PostgreSQL 14+
- **ORM**: Drizzle ORM 0.44.7
- **AI/ML**: Google Gemini AI (via Genkit)
- **Authentication**: bcryptjs (Note: Consider upgrading to NextAuth.js)

### DevOps & Tools
- **Package Manager**: npm
- **TypeScript**: 5.x
- **Linting**: ESLint (Next.js config)
- **Database Migrations**: Drizzle Kit
- **PDF Processing**: PDF.js

## 🚀 Getting Started

### Prerequisites

- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher ⚠️ **Required - This app uses PostgreSQL, not SQLite**
- **npm**: 9.x or higher
- **Google AI API Key**: For invoice data extraction

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/invoice-management.git
   cd invoice-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL** ⚠️ **Critical Step**

   ```bash
   # macOS
   brew install postgresql@14
   brew services start postgresql@14

   # Linux (Ubuntu/Debian)
   sudo apt install postgresql-14 postgresql-contrib-14
   sudo systemctl start postgresql

   # Verify PostgreSQL is running
   pg_isready
   # Should output: "accepting connections"
   ```

   **Having issues?** See [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) for detailed troubleshooting.

4. **Create database**
   ```bash
   createdb invoice_management

   # Or using psql
   psql -U postgres
   CREATE DATABASE invoice_management;
   \q
   ```

5. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/invoice_management
   GOOGLE_AI_API_KEY=your_google_ai_api_key_here
   # ... other variables
   ```

6. **Initialize and setup database**
   ```bash
   # Test PostgreSQL connection
   npm run db:init

   # Push schema to database
   npm run db:push

   # (Optional) Open Drizzle Studio to view/edit data
   npm run db:studio
   ```

   **Expected output:**
   ```
   Initializing database...
   [Database] ✓ PostgreSQL connection successful
   [Database] PostgreSQL version: 14.x
   ✓ Database initialized
   ✓ Database health check passed
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```

8. **Open application**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Common Setup Issues

**Issue: PostgreSQL service won't start**
```bash
# macOS fix
brew services stop postgresql@14
pkill -9 postgres
rm -f /usr/local/var/postgresql@14/postmaster.pid
brew services start postgresql@14
```

**Issue: "server-only" import error with db:init**
✅ Already fixed in latest version! Update your code if you see this error.

**For more troubleshooting**, see [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md)

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database - PostgreSQL Connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/invoice_management
DB_POOL_MAX=10

# AI Configuration
GOOGLE_AI_API_KEY=your_google_gemini_api_key_here

# Firebase Configuration (for file storage)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Storage
STORAGE_TYPE=local
# Options: local, firebase, s3

# Security
SESSION_SECRET=your_secret_key_here_min_32_chars

# Feature Flags
ENABLE_AI_EXTRACTION=true
ENABLE_DUPLICATE_DETECTION=true
ENABLE_RECURRING_BILL_ANALYSIS=true

# Logging
LOG_LEVEL=info
```

### Production Environment

For production, ensure you:
1. Use SSL for PostgreSQL connections
2. Set `NODE_ENV=production`
3. Use strong, randomly generated secrets
4. Enable connection pooling with appropriate limits
5. Configure proper CORS and CSP headers

## 💾 Database Setup

### Local Development (PostgreSQL)

```bash
# Install PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb invoice_management

# Initialize and migrate
npm run db:init
npm run db:push
```

### Production Database

For production, consider using:
- **Neon**: Serverless PostgreSQL with auto-scaling
- **Supabase**: PostgreSQL with built-in auth and storage
- **AWS RDS**: Managed PostgreSQL with high availability
- **Google Cloud SQL**: Fully managed PostgreSQL

Update `DATABASE_URL` with your production connection string:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

### Migration Management

```bash
# Generate migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (development only)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## 📁 Project Structure

```
invoice-management/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── (auth)/                   # Auth-related pages
│   │   ├── dashboard/                # Dashboard page
│   │   ├── invoices/                 # Invoice management
│   │   ├── vendors/                  # Vendor management
│   │   ├── approvals/                # Approval workflows
│   │   ├── audit-logs/               # Audit trail viewer
│   │   └── layout.tsx                # Root layout
│   │
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── invoice/                  # Invoice-specific components
│   │   ├── dashboard/                # Dashboard widgets
│   │   └── vendor/                   # Vendor components
│   │
│   ├── lib/                          # Core application code
│   │   ├── actions/                  # Server Actions (Next.js)
│   │   │   ├── invoice.actions.ts
│   │   │   ├── vendor.actions.ts
│   │   │   ├── dashboard.actions.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── services/                 # Business Logic Layer
│   │   │   ├── invoice.service.ts    # Invoice processing logic
│   │   │   ├── vendor.service.ts     # Vendor management logic
│   │   │   ├── dashboard-stats.service.ts
│   │   │   └── recurring-bill.service.ts
│   │   │
│   │   ├── repositories/             # Data Access Layer
│   │   │   ├── mappers/              # Data transformation
│   │   │   │   ├── invoice.mapper.ts
│   │   │   │   ├── vendor.mapper.ts
│   │   │   │   └── pending-vendor.mapper.ts
│   │   │   ├── invoice.repository.ts
│   │   │   ├── vendor.repository.ts
│   │   │   └── pending-vendor.repository.ts
│   │   │
│   │   ├── core/                     # Core domain services
│   │   │   ├── approval/             # Approval workflow
│   │   │   ├── audit/                # Audit logging
│   │   │   ├── auth/                 # RBAC implementation
│   │   │   ├── logging/              # Logger service
│   │   │   ├── payment-type/         # Payment categorization
│   │   │   └── state/                # State detection
│   │   │
│   │   ├── db/                       # Database layer
│   │   │   ├── schema.ts             # Drizzle schema (PostgreSQL)
│   │   │   ├── index.ts              # DB connection & pool
│   │   │   ├── context.ts            # DB context singleton
│   │   │   └── init.ts               # DB initialization script
│   │   │
│   │   ├── config/                   # Configuration
│   │   │   ├── database.ts           # DB config
│   │   │   ├── storage.ts            # File storage config
│   │   │   └── dashboard.config.ts   # Dashboard config
│   │   │
│   │   ├── domain/                   # Domain models & types
│   │   │   ├── types.ts              # TypeScript interfaces
│   │   │   └── constants.ts          # Domain constants
│   │   │
│   │   ├── utils/                    # Utility functions
│   │   │   ├── invoice-utils.ts      # Invoice helpers
│   │   │   ├── status-utils.ts       # Status badge utilities
│   │   │   ├── id-utils.ts           # ID generation/validation
│   │   │   ├── export-utils.ts       # Export helpers
│   │   │   └── utils.ts              # General utilities
│   │   │
│   │   ├── errors/                   # Custom error classes
│   │   │   └── app-errors.ts
│   │   │
│   │   ├── middleware/               # Middleware
│   │   │   └── rbac.middleware.ts    # RBAC checks
│   │   │
│   │   └── storage/                  # File storage
│   │       ├── file-storage.ts       # Storage abstraction
│   │       └── file-utils.ts         # File utilities
│   │
│   ├── ai/                           # AI/ML integration
│   │   ├── genkit.ts                 # Genkit configuration
│   │   ├── dev.ts                    # Development server
│   │   └── flows/
│   │       └── extract-invoice-data.ts  # Invoice extraction flow
│   │
│   ├── hooks/                        # React hooks
│   │   ├── use-toast.ts
│   │   └── use-mobile.tsx
│   │
│   └── services/                     # External service integrations
│       ├── quickbooks.ts             # QuickBooks integration
│       └── crm.ts                    # CRM integration
│
├── public/                           # Static assets
├── drizzle/                          # Drizzle migrations
├── .env.example                      # Environment template
├── drizzle.config.ts                 # Drizzle configuration
├── next.config.ts                    # Next.js configuration
├── tailwind.config.ts                # Tailwind configuration
├── tsconfig.json                     # TypeScript configuration
└── package.json                      # Dependencies & scripts
```

### Key Directories Explained

**`app/`** - Next.js 13+ App Router pages using React Server Components

**`lib/actions/`** - Server Actions for form submissions and mutations

**`lib/services/`** - Business logic layer, isolated from UI and data access

**`lib/repositories/`** - Data access layer with clean separation using repository pattern

**`lib/repositories/mappers/`** - Transform database rows to domain models and vice versa

**`lib/core/`** - Core domain services (approval, audit, RBAC, etc.)

**`lib/db/`** - Database configuration, schema, and connection management

**`ai/`** - AI/ML integration using Google Genkit and Gemini

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server (with Turbopack)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript type checking

# Database
npm run db:init          # Initialize database connection
npm run db:generate      # Generate migrations from schema
npm run db:migrate       # Run migrations
npm run db:push          # Push schema to database (dev only)
npm run db:studio        # Open Drizzle Studio (database GUI)

# AI Development
npm run genkit:dev       # Start Genkit development server
npm run genkit:watch     # Start Genkit with watch mode
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Format code (if Prettier is configured)
npm run format
```

### Testing (Recommended to add)

Currently, the project doesn't include tests. Consider adding:

```bash
# Unit tests (Jest/Vitest)
npm run test

# E2E tests (Playwright/Cypress)
npm run test:e2e

# Coverage
npm run test:coverage
```

## 🚢 Deployment

### Vercel (Recommended for Next.js)

1. **Connect to Vercel**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Set environment variables** in Vercel dashboard

3. **Configure PostgreSQL**
   - Use Neon, Supabase, or Vercel Postgres
   - Update `DATABASE_URL` in environment variables

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Docker (Alternative)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t invoice-management .
docker run -p 3000:3000 --env-file .env invoice-management
```

### Environment-Specific Configuration

**Development**
- SQLite or local PostgreSQL
- Local file storage
- Verbose logging

**Staging**
- PostgreSQL (cloud)
- Cloud file storage (Firebase/S3)
- Standard logging

**Production**
- PostgreSQL with SSL (cloud)
- CDN for static assets
- Cloud file storage with backups
- Minimal logging (errors only)
- Connection pooling
- Rate limiting
- CORS configuration

## 📊 Areas for Improvement

While the current codebase is production-ready with clean architecture, here are prioritized areas for future enhancement:

### 🔴 High Priority

#### 1. Testing Infrastructure
**Status**: Missing
**Impact**: High
**Effort**: High

- **Unit Tests**: Add Jest/Vitest for services, repositories, and utilities
- **Integration Tests**: Test database operations and API endpoints
- **E2E Tests**: Playwright or Cypress for critical user flows
- **Target Coverage**: Minimum 80% code coverage

**Files to Test First**:
- `src/lib/services/invoice.service.ts` (complex business logic)
- `src/lib/repositories/invoice.repository.ts` (data access)
- `src/lib/utils/invoice-utils.ts` (utility functions)

#### 2. Authentication & Authorization
**Status**: Basic implementation
**Impact**: High
**Effort**: Medium

**Current State**:
- Basic bcryptjs password hashing
- No session management
- No JWT tokens
- RBAC service exists but needs integration

**Recommended**:
- Migrate to **NextAuth.js** for production-grade auth
- Implement session management
- Add MFA (Multi-Factor Authentication)
- Integrate with enterprise SSO (SAML, OAuth)

**Priority Actions**:
```typescript
// Implement NextAuth.js
// File: src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
// ... configuration
```

#### 3. Error Handling Standardization
**Status**: Partially implemented
**Impact**: Medium
**Effort**: Medium

**Current Issues**:
- Custom error classes defined but underutilized
- Inconsistent error handling across actions
- Silent failures in some areas

**Example of Current Pattern** (needs improvement):
```typescript
// Current (not optimal)
try {
  const result = await someOperation();
  return { data: result };
} catch (error) {
  console.error('Error:', error);
  return { error: error instanceof Error ? error.message : 'Unknown error' };
}
```

**Recommended Pattern**:
```typescript
// Improved
import { handleServiceError } from '@/lib/errors/error-handler';
import { ValidationError, NotFoundError } from '@/lib/errors/app-errors';

try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  return handleServiceError(error, 'Operation context');
}
```

**Files to Refactor**:
- `src/lib/actions/*.actions.ts` (15+ action files with duplicate error handling)
- `src/lib/services/invoice.service.ts:26-200` (174-line method needs better error handling)

#### 4. Refactor Large Service Methods
**Status**: Needs refactoring
**Impact**: Medium
**Effort**: High

**Specific Issue**: `invoice.service.ts:26-200`
**Method**: `processInvoice` (174 lines)
**Problem**: Mixed concerns (AI extraction, validation, duplicate detection, vendor checking, file storage)

**Current Structure**:
```typescript
async processInvoice(input) {
  // Lines 26-40: File validation
  // Lines 42-53: AI extraction
  // Lines 62-89: High-value determination
  // Lines 96-97: Duplicate detection
  // Lines 103-110: File persistence
  // Lines 115-127: Recurring bill analysis
  // Lines 129-155: Vendor existence checking
  // Lines 183: Database save
}
```

**Recommended Refactoring**:
```typescript
// Split into focused methods
class InvoiceProcessingService {
  async processInvoice(input: ProcessInvoiceInput): Promise<ProcessedInvoice> {
    await this.validateFile(input);
    const extractedData = await this.extractData(input);
    const invoice = await this.buildInvoice(input, extractedData);
    await this.enrichWithAnalytics(invoice);
    await this.handleVendor(invoice);
    return await this.saveInvoice(invoice);
  }

  private async validateFile(input: ProcessInvoiceInput): Promise<void> { }
  private async extractData(input: ProcessInvoiceInput): Promise<ExtractedData> { }
  private async buildInvoice(input, data): Promise<Invoice> { }
  private async enrichWithAnalytics(invoice: Invoice): Promise<void> { }
  private async handleVendor(invoice: Invoice): Promise<void> { }
  private async saveInvoice(invoice: Invoice): Promise<ProcessedInvoice> { }
}
```

### 🟡 Medium Priority

#### 5. Access Control Consolidation
**Status**: Duplicate logic
**Impact**: Medium
**Effort**: Low

**Current Issue**: Access control logic duplicated in:
- `src/lib/services/dashboard.service.ts:73-87, 116-126, 171-181`
- `src/lib/services/dashboard-stats.service.ts:17-47`

**Solution**: Create centralized access control utility:
```typescript
// File: src/lib/services/access-control.ts
export function filterInvoicesByUserAccess(
  invoices: StoredInvoice[],
  userPermissions?: UserPermissions
): StoredInvoice[] {
  if (!userPermissions) return invoices;

  if (rbacService.isElevatedRole(userPermissions.role)) {
    return invoices;
  }

  if (userPermissions.role === 'account' && userPermissions.assignedStates) {
    return invoices.filter(inv =>
      userPermissions.assignedStates?.includes(inv.state as string)
    );
  }

  if (userPermissions.role === 'user') {
    return invoices.filter(inv =>
      inv.createdBy === userPermissions.userId ||
      inv.assignedTo === userPermissions.userId
    );
  }

  return invoices;
}
```

#### 6. Input Validation at Boundaries
**Status**: Partial
**Impact**: Medium
**Effort**: Medium

**Current State**: Zod schemas defined but not consistently used

**Recommendation**:
- Add validation middleware for all server actions
- Validate at API boundaries (server actions, API routes)
- Use Zod for runtime type checking

**Example**:
```typescript
// Define schemas
const processInvoiceSchema = z.object({
  invoiceDataUri: z.string().url(),
  fileName: z.string().min(1),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
});

// Use in action
export async function processInvoiceAction(input: unknown) {
  // Validate input
  const validatedInput = processInvoiceSchema.parse(input);
  // ... proceed with validated data
}
```

#### 7. Performance Optimization
**Status**: Not optimized
**Impact**: Medium
**Effort**: Medium

**Areas to Optimize**:

1. **Database Queries**
   - Add indexes on frequently queried columns
   - Implement query result caching (Redis)
   - Use database views for complex joins
   - Implement pagination for large datasets

2. **File Storage**
   - Implement CDN for invoice images
   - Add image optimization pipeline
   - Use lazy loading for large files

3. **Frontend Performance**
   - Implement React Server Components caching
   - Add route segment caching
   - Optimize bundle size (code splitting)
   - Implement virtual scrolling for large tables

**Example Index Addition**:
```sql
-- Add indexes for common queries
CREATE INDEX idx_invoices_status_date ON invoices(status, invoice_date DESC);
CREATE INDEX idx_invoices_vendor_name ON invoices(vendor_name);
CREATE INDEX idx_invoices_state_approval ON invoices(state, approval_status);
```

#### 8. Monitoring & Observability
**Status**: Minimal logging
**Impact**: Medium
**Effort**: Medium

**Current**: Console.log statements scattered throughout

**Recommended**:
- Implement structured logging (Winston, Pino)
- Add application performance monitoring (APM)
- Set up error tracking (Sentry, LogRocket)
- Add health check endpoints
- Implement metrics collection (Prometheus)

**Example**:
```typescript
// Structured logging
import { logger } from '@/lib/logging/logger';

logger.info('Invoice processed', {
  invoiceId: invoice.id,
  vendorName: invoice.vendorName?.value,
  amount: invoice.totalAmount?.value,
  processingTimeMs: Date.now() - startTime,
});

logger.error('Invoice processing failed', {
  invoiceId: input.fileName,
  error: error.message,
  stack: error.stack,
});
```

### 🟢 Low Priority (Nice to Have)

#### 9. API Documentation
**Status**: Missing
**Impact**: Low
**Effort**: Low

- Add JSDoc comments to all public APIs
- Generate API documentation (TypeDoc)
- Create Swagger/OpenAPI specs for REST endpoints

#### 10. Internationalization (i18n)
**Status**: Not implemented
**Impact**: Low
**Effort**: High

- Add next-intl or react-i18next
- Extract all hardcoded strings
- Support multiple languages
- Implement date/currency formatting per locale

#### 11. Advanced Analytics
**Status**: Basic dashboard
**Impact**: Low
**Effort**: High

- Add predictive analytics for invoice amounts
- Implement anomaly detection improvements
- Create custom report builder
- Add data export to Excel/CSV with advanced filters

#### 12. Real-time Updates
**Status**: Not implemented
**Impact**: Low
**Effort**: High

- Implement WebSockets or Server-Sent Events
- Real-time dashboard updates
- Live collaboration features
- Real-time approval notifications

#### 13. Mobile Application
**Status**: Not implemented
**Impact**: Low
**Effort**: Very High

- React Native mobile app
- Mobile-optimized invoice scanning
- Push notifications for approvals
- Offline-first architecture

### 📋 Implementation Roadmap

**Phase 1: Foundation (Weeks 1-4)**
- Add testing infrastructure
- Implement NextAuth.js
- Standardize error handling
- Add input validation

**Phase 2: Code Quality (Weeks 5-8)**
- Refactor large service methods
- Consolidate access control
- Add comprehensive logging
- Implement monitoring

**Phase 3: Performance (Weeks 9-12)**
- Database optimization
- Caching strategy
- Frontend optimization
- Load testing

**Phase 4: Polish (Weeks 13-16)**
- API documentation
- Advanced analytics
- Real-time features
- Mobile app (if needed)

### 🎯 Quick Wins (Can be done in 1-2 days each)

1. **Add Database Indexes** (1 day)
2. **Consolidate Access Control Logic** (1 day)
3. **Implement Error Logging with Sentry** (1 day)
4. **Add Input Validation to Top 5 Actions** (2 days)
5. **Create Health Check Endpoint** (1 day)
6. **Add JSDoc to Core Services** (2 days)

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run test` (when implemented)
5. Type check: `npm run typecheck`
6. Lint: `npm run lint`
7. Commit: `git commit -m 'Add amazing feature'`
8. Push: `git push origin feature/amazing-feature`
9. Open a Pull Request

### Code Standards

- Follow TypeScript best practices
- Use ESLint configuration
- Write meaningful commit messages
- Add JSDoc comments for public APIs
- Update README for new features

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: Add invoice export feature
fix: Resolve duplicate detection bug
docs: Update API documentation
refactor: Simplify invoice processing logic
test: Add unit tests for vendor service
chore: Update dependencies
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Drizzle ORM for the excellent TypeScript-first ORM
- shadcn/ui for beautiful components
- Google for Gemini AI capabilities

## 📞 Support

For issues, questions, or contributions:
- **Issues**: [GitHub Issues](https://github.com/yourusername/invoice-management/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/invoice-management/discussions)
- **Email**: support@yourcompany.com

---

**Built with ❤️ using Next.js, React, TypeScript, PostgreSQL, and AI**
