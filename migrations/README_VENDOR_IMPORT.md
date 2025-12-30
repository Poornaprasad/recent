# Vendor Import from CSV

This guide explains how to import vendor data from `merged_contacts_final.csv` into the vendor database.

## Prerequisites

1. Database must be initialized and running
2. CSV file must be located at `data/merged_contacts_final.csv`

## Steps

### 1. Ensure Database Schema is Up to Date

The `unique_contact_id` column is included in the production schema. Ensure your database is up to date:

```bash
# Run all migrations (includes schema and foreign keys):
npm run db:migrate

# Or if resetting the database:
npm run db:reset
npm run db:apply-fks
```

### 2. Import Vendors

Run the import script:

```bash
npm run db:import-vendors
```

## What the Import Does

The import script will:

1. **Parse the CSV file** - Reads `data/merged_contacts_final.csv`
2. **Map CSV columns to vendor fields**:
   - `Vendor` → `name`
   - `Phone numbers` → `phone`
   - `Email` → `email`
   - `Billing address` → `address`
   - `Track 1099` → `requires1099` and `requiresW9`
   - `contactType` or `extracted category` → `vendorType`
   - `uniqueContactId` → `uniqueContactId` (most important for CRM linking)
3. **Create vendor types** - Automatically creates vendor types if they don't exist
4. **Handle duplicates** - Updates existing vendors if found by `uniqueContactId` or name
5. **Set 1099 flags** - Sets `requires1099` and `requiresW9` based on "Track 1099" column

## Important Notes

- **uniqueContactId is critical** - This field links vendors to the CRM system. Vendors with this ID will be linked properly.
- **Vendor IDs** - If a vendor has a `uniqueContactId`, the vendor ID will be `vendor-crm-{uniqueContactId}`. Otherwise, a generated ID is used.
- **Updates vs Inserts** - The script uses upsert logic:
  - If a vendor exists with the same `uniqueContactId`, it will be updated
  - If a vendor exists with the same name (case-insensitive), it will be updated
  - Otherwise, a new vendor will be created

## CSV Column Mapping

| CSV Column | Vendor Field | Notes |
|------------|--------------|-------|
| Vendor | name | Required |
| Phone numbers | phone | Parsed to remove "Phone:" prefix |
| Email | email | |
| Billing address | address | |
| Track 1099 | requires1099, requiresW9 | "Yes" = true |
| uniqueContactId | uniqueContactId | **Most important** - CRM link |
| contactType | vendorType | Creates vendor type if needed |
| extracted category | vendorType | Fallback if contactType is empty |

## Troubleshooting

### Error: CSV file not found
- Ensure the file is at `data/merged_contacts_final.csv` relative to project root

### Error: Database connection failed
- Check your `DATABASE_URL` environment variable
- Ensure the database is running

### Import is slow
- The script processes records in batches and shows progress every 100 records
- Large CSV files may take several minutes

### Duplicate vendors
- The script handles duplicates by updating existing records
- Check the import summary for counts of imported vs updated records

