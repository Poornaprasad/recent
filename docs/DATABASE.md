# Database Documentation

This document consolidates all database-related documentation for the TBF ReconX application.

## Quick Links

- [Migration Guide](#migrations)
- [Schema Overview](#schema-overview)
- [Enterprise-Grade Features](#enterprise-grade-features)
- [Database Commands](#database-commands)

## Migrations

### Current Migrations

All database migrations are located in `drizzle/migrations/`:

1. **`0000_production_schema.sql`**
   - Complete database schema with all tables, indexes, and data migrations
   - Idempotent and production-ready
   - Includes all SmartAdvocate metadata fields
   - **Note**: Foreign keys are defined separately in the next migration

2. **`0001_add_foreign_keys.sql`**
   - Adds 23 foreign key relationships ensuring referential integrity
   - Data validation constraints (CHECK constraints for amounts, emails, timestamps)
   - Unique constraints preventing duplicates
   - **Prerequisite**: Must be run after `0000_production_schema.sql`

### Running Migrations

```bash
# Reset database (drops all tables and recreates)
npm run db:reset

# Apply foreign keys (after reset)
npm run db:apply-fks

# Push schema changes (development)
npm run db:push

# Generate new migrations (after schema changes)
npm run db:generate

# Run migrations (production)
npm run db:migrate

# View database in Drizzle Studio
npm run db:studio
```

## Schema Overview

### Tables (19 total)

#### Core Tables
- `invoices` - Main invoice/document storage with SmartAdvocate integration
- `users` - User management with RBAC
- `vendors` - Vendor master data with W9/1099 tracking
- `vendor_types` - Vendor type definitions
- `pending_vendors` - Vendor approval workflow

#### Audit & Tracking
- `audit_logs` - Comprehensive audit trail
- `approval_audit_logs` - Approval-specific audit logs

#### Financial
- `disbursement_types` - Disbursement type definitions
- `disbursement_statuses` - Disbursement status definitions
- `case_vendor_disbursement_types` - Case-vendor contact type mappings
- `bank_accounts` - Bank account information
- `expense_accounts` - Expense account definitions

#### Compliance
- `vendor_w9_status` - W9 tracking

#### Approval & Authorization
- `credit_authorizations` - Credit authorization tracking
- `approval_rules` - Configurable approval thresholds

#### Document & Sync
- `invoice_attachments` - File attachment tracking
- `document_sync_errors` - SmartAdvocate sync error tracking

#### System
- `daily_run_updates` - Daily update tracking
- `permission_matrix` - Role-permission mappings

## Enterprise-Grade Features

### Primary Keys
✅ All 19 tables have proper PRIMARY KEY constraints

### Foreign Keys
✅ 23 foreign key relationships ensuring referential integrity:
- Invoice relationships (5)
- User relationships (15)
- Vendor relationships (2)
- Self-referencing (1)

### Indexes
✅ 30+ indexes covering all critical query paths:
- Status fields
- Foreign key columns
- Search fields (case_number, vendor_name, email)
- Timestamp fields (for sorting)

### Constraints
✅ Comprehensive data validation:
- CHECK constraints for amounts, emails, timestamps
- UNIQUE constraints preventing duplicates
- Enum constraints for status fields

### Cascade Strategies
- **RESTRICT**: Prevents deletion of users with audit logs (preserves audit trail)
- **CASCADE**: Deletes dependent data (attachments, W9 status)
- **SET NULL**: Preserves historical data while allowing parent deletion

## Database Commands

### Development
```bash
# Initialize database connection
npm run db:init

# Clear all data (keeps tables)
npm run db:clear

# Clear all data except vendors
npm run db:clear-except-vendors

# Reset database (drops all, recreates)
npm run db:reset

# Apply foreign keys
npm run db:apply-fks
```

### Production
```bash
# Generate migrations from schema changes
npm run db:generate

# Run migrations
npm run db:migrate

# Verify schema
npm run db:studio
```

## Migration History

All previous migrations have been consolidated:
- ✅ 12 individual migration files → Consolidated into `0000_production_schema.sql`
- ✅ Foreign keys → Added in `0001_add_foreign_keys.sql` (kept separate for maintainability)

Old migrations are archived in `migrations/archive/` for historical reference.

## Important Notes

1. **Idempotency**: All migrations use `IF NOT EXISTS` checks and can be run multiple times safely
2. **Data Safety**: No destructive operations, all changes are additive
3. **Backward Compatibility**: Handles both new and existing databases
4. **Production Ready**: All constraints, indexes, and foreign keys are in place

## Troubleshooting

### Migration Issues
1. Check PostgreSQL version (recommended: 12+)
2. Verify database connection
3. Review error messages for specific conflicts
4. Ensure all dependencies are met

### Schema Verification
```bash
# List all tables
psql $DATABASE_URL -c "\dt"

# Describe a table
psql $DATABASE_URL -c "\d invoices"

# List foreign keys
psql $DATABASE_URL -c "
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public';
"
```

## Status

✅ **PRODUCTION READY**
- Complete referential integrity
- Data validation
- Performance optimization
- Proper cascade strategies
- Audit trail protection

---

**Last Updated**: 2024  
**Maintained By**: TBF ReconX Team

