/**
 * Import vendors from CSV file
 * This script imports vendor data from merged_contacts_final.csv into the vendors table
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { getDb, initDb, closeDb } from '../src/lib/db/script';
import { vendors, vendorTypes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

interface CsvRow {
  'Unique ID': string;
  'Vendor': string;
  'Phone numbers': string;
  'Email': string;
  'Billing address': string;
  'Track 1099': string;
  'Full name': string;
  'First name': string;
  'Last name': string;
  'Tax ID': string;
  'Source': string;
  'tax id exists': string;
  'uniqueContactId': string;
  'contactType': string;
  'extracted category': string;
  'extracted company': string;
}

function parsePhoneNumber(phone: string): string | undefined {
  if (!phone || phone.trim() === '' || phone === 'NULL' || phone === 'Phone:NULL') {
    return undefined;
  }
  // Remove "Phone:" prefix if present
  return phone.replace(/^Phone:/i, '').trim() || undefined;
}

function parseBoolean(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'yes' || normalized === 'true' || normalized === '1';
}

function cleanString(value: string): string | undefined {
  if (!value || value.trim() === '' || value === 'NULL') {
    return undefined;
  }
  // Clean up newlines and extra whitespace
  return value.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() || undefined;
}

// Helper function to parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  return result;
}

async function ensureVendorType(db: any, typeName: string): Promise<void> {
  if (!typeName || typeName.trim() === '') return;
  
  const existing = await db
    .select()
    .from(vendorTypes)
    .where(eq(vendorTypes.name, typeName))
    .limit(1);
  
  if (existing.length === 0) {
    const id = `vt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    await db.insert(vendorTypes).values({
      id,
      name: typeName,
      description: null,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function importVendors() {
  console.log('Starting vendor import from CSV...');
  
  // Initialize database connection
  await initDb();
  const db = getDb();
  
  const csvPath = path.join(process.cwd(), 'data', 'merged_contacts_final.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV handling multi-line quoted fields
  const records: CsvRow[] = [];
  let currentLine = '';
  let inQuotes = false;
  const lines: string[] = [];
  
  // First pass: reconstruct lines handling multi-line quoted fields
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentLine += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if (char === '\n' && !inQuotes) {
      // End of line (only if not in quotes)
      lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  
  // Add last line
  if (currentLine.trim() !== '') {
    lines.push(currentLine);
  }
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    records.push(record as CsvRow);
  }
  
  console.log(`Found ${records.length} records in CSV`);
  
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; vendor: string; error: string }> = [];
  
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    
    try {
      // Skip rows without vendor name
      if (!row.Vendor || row.Vendor.trim() === '') {
        skipped++;
        continue;
      }
      
      const vendorName = cleanString(row.Vendor);
      if (!vendorName) {
        skipped++;
        continue;
      }
      
      // Use uniqueContactId as primary key if available, otherwise generate one
      const vendorId = row.uniqueContactId && row.uniqueContactId.trim() !== ''
        ? `vendor-crm-${row.uniqueContactId.trim()}`
        : `vendor-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Parse vendor type from contactType or extracted category
      const vendorTypeName = cleanString(row.contactType) || cleanString(row['extracted category']);
      
      // Ensure vendor type exists
      if (vendorTypeName) {
        await ensureVendorType(db, vendorTypeName);
      }
      
      // Check if vendor already exists (by uniqueContactId or name)
      let existingVendor = null;
      
      if (row.uniqueContactId && row.uniqueContactId.trim() !== '') {
        const existing = await db
          .select()
          .from(vendors)
          .where(eq(vendors.uniqueContactId, row.uniqueContactId.trim()))
          .limit(1);
        
        if (existing.length > 0) {
          existingVendor = existing[0];
        }
      }
      
      // If not found by uniqueContactId, check by name (case-insensitive)
      if (!existingVendor) {
        const allVendors = await db.select().from(vendors);
        existingVendor = allVendors.find((v: any) => 
          v.name && v.name.toLowerCase() === vendorName.toLowerCase()
        );
      }
      
      const now = new Date();
      const requires1099 = parseBoolean(row['Track 1099']);
      const taxId = cleanString(row['Tax ID']);
      const taxIdExists = parseBoolean(row['tax id exists']);
      
      // If tax ID exists, W9 is already received
      const hasTaxId = (taxId && taxId.trim() !== '') || taxIdExists;
      const w9Status = hasTaxId 
        ? 'Received' as const 
        : (requires1099 ? 'Required' as const : 'Not Required' as const);
      const w9ReceivedDate = hasTaxId ? now : undefined;
      
      const vendorData = {
        id: existingVendor?.id || vendorId,
        name: vendorName,
        email: cleanString(row.Email),
        phone: parsePhoneNumber(row['Phone numbers']),
        address: cleanString(row['Billing address']),
        vendorType: vendorTypeName || undefined,
        uniqueContactId: row.uniqueContactId && row.uniqueContactId.trim() !== '' 
          ? row.uniqueContactId.trim() 
          : undefined,
        taxId: taxId || undefined,
        requires1099: requires1099 ? 1 : 0,
        requiresW9: requires1099 ? 1 : 0, // Set requiresW9 if requires1099
        w9Status: w9Status,
        w9ReceivedDate: w9ReceivedDate,
        form1099Status: requires1099 ? 'Required' as const : 'Not Required' as const,
        status: 'Active' as const,
        createdAt: existingVendor?.createdAt || now,
        updatedAt: now,
      };
      
      await db
        .insert(vendors)
        .values(vendorData)
        .onConflictDoUpdate({
          target: vendors.id,
          set: {
            name: vendorData.name,
            email: vendorData.email,
            phone: vendorData.phone,
            address: vendorData.address,
            vendorType: vendorData.vendorType,
            uniqueContactId: vendorData.uniqueContactId,
            taxId: vendorData.taxId,
            requires1099: vendorData.requires1099,
            requiresW9: vendorData.requiresW9,
            w9Status: vendorData.w9Status,
            w9ReceivedDate: vendorData.w9ReceivedDate,
            form1099Status: vendorData.form1099Status,
            updatedAt: vendorData.updatedAt,
          },
        });
      
      if (existingVendor) {
        updated++;
      } else {
        imported++;
      }
      
      if ((i + 1) % 100 === 0) {
        console.log(`Processed ${i + 1}/${records.length} records...`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({
        row: i + 2, // +2 because CSV has header and 0-indexed
        vendor: row.Vendor || 'Unknown',
        error: errorMsg,
      });
      console.error(`Error processing row ${i + 2} (${row.Vendor}):`, errorMsg);
    }
  }
  
  console.log('\n=== Import Summary ===');
  console.log(`Total records processed: ${records.length}`);
  console.log(`Imported: ${imported}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.slice(0, 20).forEach(err => {
      console.log(`Row ${err.row} (${err.vendor}): ${err.error}`);
    });
    if (errors.length > 20) {
      console.log(`... and ${errors.length - 20} more errors`);
    }
  }
  
  console.log('\nImport completed!');
  
  // Close database connection
  await closeDb();
}

// Run the import
importVendors()
  .then(() => {
    console.log('Import script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import script failed:', error);
    process.exit(1);
  });

