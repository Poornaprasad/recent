/**
 * Debug script to check invoice properties
 * Run: tsx src/lib/db/debug-invoice.ts 2818-23
 */

import 'dotenv/config';
import { initDb, closeDb } from './script';
import { getDb } from './script';
import { eq, sql, or, like } from 'drizzle-orm';
import { invoices } from './schema';

async function debugInvoice(invoiceId: string) {
  try {
    console.log(`🔍 Debugging invoice: ${invoiceId}\n`);
    
    await initDb();
    const db = getDb();
    
    // Try to find the invoice by ID
    const invoiceById = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
      .then(rows => rows[0]);
    
    // Try to find by invoice number
    const invoiceByNumber = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceId))
      .limit(1)
      .then(rows => rows[0]);
    
    // Try partial match on ID
    const invoicePartial = await db
      .select()
      .from(invoices)
      .where(like(invoices.id, `%${invoiceId}%`))
      .limit(5);
    
    console.log('📋 Search Results:');
    console.log(`  - By exact ID: ${invoiceById ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`  - By invoice number: ${invoiceByNumber ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`  - Partial matches: ${invoicePartial.length} found\n`);
    
    const invoice = invoiceById || invoiceByNumber;
    
    if (invoice) {
      console.log('📄 Invoice Details:');
      console.log(`  ID: ${invoice.id}`);
      console.log(`  Invoice Number: ${invoice.invoiceNumber || 'N/A'}`);
      console.log(`  Status: ${invoice.status || 'N/A'}`);
      console.log(`  Document Type: ${invoice.documentType || 'N/A'}`);
      console.log(`  State: ${invoice.state || 'NULL/UNDEFINED'}`);
      console.log(`  Vendor Name: ${invoice.vendorName || 'N/A'}`);
      console.log(`  Approval Status: ${invoice.approvalStatus || 'N/A'}`);
      console.log(`  Created At: ${invoice.createdAt || 'N/A'}`);
      console.log(`  Updated At: ${invoice.updatedAt || 'N/A'}`);
      
      console.log('\n🔍 Filter Analysis:');
      console.log(`  Would show in invoices list? ${invoice.status !== 'Draft' ? '✅ YES' : '❌ NO (Draft status)'}`);
      console.log(`  Has state? ${invoice.state ? `✅ YES (${invoice.state})` : '❌ NO (null/undefined)'}`);
      console.log(`  Document type: ${invoice.documentType || 'NULL'}`);
      
      // Check if it would be filtered by state
      if (!invoice.state) {
        console.log(`  ⚠️  Invoice has no state - may be filtered out if state filter is active`);
      }
      
      if (invoice.status === 'Draft') {
        console.log(`  ⚠️  Invoice is Draft - was previously filtered out`);
      }
    } else {
      console.log('❌ Invoice not found in database');
      console.log('\n🔍 Trying partial matches...');
      if (invoicePartial.length > 0) {
        console.log(`Found ${invoicePartial.length} invoices with similar IDs:`);
        invoicePartial.forEach((inv, idx) => {
          console.log(`  ${idx + 1}. ID: ${inv.id}, Invoice #: ${inv.invoiceNumber || 'N/A'}, Status: ${inv.status}`);
        });
      }
    }
    
    // Get total invoice count
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .then(rows => rows[0]?.count || 0);
    
    // Get count by status
    const statusCounts = await db
      .select({
        status: invoices.status,
        count: sql<number>`count(*)`
      })
      .from(invoices)
      .groupBy(invoices.status);
    
    // Get count by state
    const stateCounts = await db
      .select({
        state: invoices.state,
        count: sql<number>`count(*)`
      })
      .from(invoices)
      .groupBy(invoices.state);
    
    console.log('\n📊 Database Statistics:');
    console.log(`  Total invoices: ${totalCount}`);
    console.log(`  By status:`);
    statusCounts.forEach(({ status, count }) => {
      console.log(`    - ${status || 'NULL'}: ${count}`);
    });
    console.log(`  By state:`);
    stateCounts.forEach(({ state, count }) => {
      console.log(`    - ${state || 'NULL/UNDEFINED'}: ${count}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await closeDb();
    process.exit(0);
  }
}

// Get invoice ID from command line args
const invoiceId = process.argv[2];
if (!invoiceId) {
  console.error('❌ Please provide an invoice ID');
  console.log('Usage: tsx src/lib/db/debug-invoice.ts <invoice-id>');
  process.exit(1);
}

debugInvoice(invoiceId);

