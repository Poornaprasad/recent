# Database Migrations

## Overview

This directory contains consolidated database migrations for the TBF ReconX application. All migrations have been consolidated into a single production-ready migration file.

## Migration Files

### `0000_consolidated_production_schema.sql`
**Status**: Active  
**Purpose**: Consolidated production schema with all tables, indexes, and data migrations

This migration includes:
- All core tables (invoices, users, vendors, etc.)
- Audit and tracking tables
- Disbursement and financial tables
- W9 & 1099 tracking tables
- Approval and authorization tables
- Document and sync tables
- System and configuration tables
- All necessary indexes for performance
- Data migrations for existing records
- Table and column comments for documentation

### `0002_add_foreign_keys.sql`
**Status**: Active  
**Purpose**: Adds enterprise-grade foreign key constraints and data validation

This migration includes:
- 23 foreign key relationships
- CHECK constraints for data validation
- UNIQUE constraints preventing duplicates
- Additional indexes on foreign keys


## Running Migrations

### Development
```bash
# Push schema directly (for development)
npm run db:push
```

### Production
```bash
# Generate migrations from schema changes
npm run db:generate

# Run migrations
npm run db:migrate
```

## Migration History

All previous migrations from the `migrations/` directory have been consolidated:

- ✅ `add_1099_status_columns.sql` - Consolidated
- ✅ `add_crm_status_column.sql` - Consolidated
- ✅ `add_disbursement_response_column.sql` - Consolidated
- ✅ `add_document_hash_column.sql` - Consolidated
- ✅ `add_document_id_column.sql` - Consolidated
- ✅ `add_document_sync_errors_table.sql` - Consolidated
- ✅ `add_plaintiff_name_column.sql` - Consolidated
- ✅ `add_smartadvocate_fields_to_sync_errors.sql` - Consolidated
- ✅ `add_smartadvocate_metadata.sql` - Consolidated
- ✅ `add_tax_id_column.sql` - Consolidated
- ✅ `add_unique_contact_id.sql` - Consolidated
- ✅ `rename_disbursement_type_to_contact_type.sql` - Consolidated
- ✅ `0001_update_audit_logs.sql` - Consolidated

## Important Notes

1. **Idempotency**: All migrations use `IF NOT EXISTS` and `IF EXISTS` checks to ensure they can be run multiple times safely.

2. **Data Safety**: Data migrations are wrapped in `DO $$` blocks with existence checks to prevent data loss.

3. **Indexes**: All indexes use `IF NOT EXISTS` to prevent errors on re-runs.

4. **Production Ready**: The consolidated migration is production-ready and includes:
   - Proper constraints and checks
   - Indexes for performance
   - Comments for documentation
   - Safe data migrations

## Future Migrations

When adding new migrations:

1. **For schema changes**: Update `src/lib/db/schema.ts` and run `npm run db:generate`
2. **For manual SQL**: Add to a new numbered migration file (e.g., `0002_new_feature.sql`)
3. **Always test**: Test migrations on a development database before deploying to production

## Rollback

If you need to rollback a migration:

1. Create a new migration file with the reverse operations
2. Test thoroughly in development
3. Document the rollback in the migration file

## Verification

After running migrations, verify the schema:

```bash
# Open Drizzle Studio
npm run db:studio

# Or connect with psql
psql $DATABASE_URL
\dt  # List tables
\d table_name  # Describe table
```

