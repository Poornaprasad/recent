
'use server';

/**
 * @fileOverview Invoice data extraction AI agent.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ExtractInvoiceDataOutputSchema as BaseExtractInvoiceDataOutputSchema, CrmInvoiceStatus, QuickBooksInvoiceStatus, ExtractedFieldSchema } from '@/lib/schemas';
import { differenceInMonths, parseISO } from 'date-fns';
import { checkCrmForInvoice } from '@/services/crm';
import { getQuickBooksInvoiceStatus } from '@/services/quickbooks';


const ExtractInvoiceDataInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "An invoice PDF, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;


const DuplicateCheckResultSchema = z.object({
  isDuplicate: z.boolean(),
  reason: z.string().optional(),
});

const StatusCheckResultSchema = z.object({
    status: z.enum(['Paid', 'Pending', 'Review', 'Draft']),
    quickbooksStatus: z.nativeEnum(QuickBooksInvoiceStatus).nullable(),
    crmStatus: z.nativeEnum(CrmInvoiceStatus).nullable(),
});

const ExtractInvoiceDataOutputSchema = BaseExtractInvoiceDataOutputSchema.extend({
  duplicateCheck: DuplicateCheckResultSchema.optional(),
  status: z.enum(['Paid', 'Pending', 'Review', 'Draft']).optional(),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;


export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

/**
 * Retry plaintiff name extraction with a specific name to search for
 * This is used when the AI-extracted name doesn't match the case name
 */
const RetryPlaintiffNameInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "An invoice PDF, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  caseName: z
    .string()
    .describe("The plaintiff name from the case that we want to search for in the document."),
});

const RetryPlaintiffNameOutputSchema = z.object({
  clientName: ExtractedFieldSchema,
  found: z.boolean().describe("Whether the case name was found in the document."),
});

export async function retryPlaintiffNameExtraction(
  invoiceDataUri: string,
  caseName: string
): Promise<{ clientName?: { value: string | null; confidence: number; reasoning: string; bbox: any }; found: boolean; error?: string }> {
  try {
    // Extract name parts for better matching
    // Case name from CRM is in "Last, First" or "Last, First Middle" format
    const nameParts = caseName.split(',').map(p => p.trim()).filter(p => p);
    const lastName = nameParts[0] || '';
    const firstPart = nameParts[1] || '';
    // Extract first name (first word) and handle middle initial/name
    const firstName = firstPart.split(/\s+/)[0] || '';
    // Get the full first part (including middle initial) for matching
    const firstWithMiddle = firstPart.trim();
    
    // Create both format variations
    const lastFirstFormat = `${lastName}, ${firstName}`; // "Spanos, Theodore"
    const lastFirstMiddleFormat = `${lastName}, ${firstWithMiddle}`; // "Spanos, Theodore W."
    const firstLastFormat = `${firstName} ${lastName}`;   // "Theodore Spanos"
    const firstMiddleLastFormat = `${firstWithMiddle} ${lastName}`; // "Theodore W. Spanos"
    
    // Create prompt dynamically with the case name
    const retryPlaintiffNamePrompt = ai.definePrompt({
      name: 'retryPlaintiffNamePrompt',
      input: { schema: RetryPlaintiffNameInputSchema },
      output: { schema: RetryPlaintiffNameOutputSchema },
      prompt: `
You are an expert document data extractor. Your task is SIMPLE: search the ENTIRE document for the plaintiff name.

**IMPORTANT**: The document may contain multiple pages. If you see multiple pages in the image (pages stacked vertically), make sure to read through ALL pages from top to bottom. Search ALL pages, not just the first page.

## The Name You're Looking For
The plaintiff name from the case is: "${caseName}" (format: Last, First)
- Last name: "${lastName}"
- First name: "${firstName}"

## Your Task
1. Read through the ENTIRE document from top to bottom (including ALL pages if multi-page)
2. Look for BOTH "${lastName}" AND "${firstName}" anywhere in the document
3. Check ALL text in the document, including:

**CRITICAL - Check These Common Fields First:**
- **"Patient Name"** or **"PATIENT"** field - plaintiff names often appear here
- **"Case Name"** or **"CASE NAME"** or **"Case:"** field - very common location
- **"Client Name"** or **"CLIENT"** field
- **"Plaintiff Name"** or **"PLAINTIFF"** field
- **"Patient"** field (without "Name")
- **"Case"** field (without "Name")
- **"Name"** field (standalone)
- Any field with labels like "Name:", "Patient:", "Case:", "Client:", "Plaintiff:"

**Also Check:**
- Headers and footers
- Tables and structured data sections
- Body text
- Invoice details sections
- Anywhere text appears

## What to Look For (ALL FORMATS)
The name might appear in different formats - search for ALL of these:

**Format 1: Last, First (like CRM format)**
- "${lastFirstFormat}" (exact: "${caseName}")
- "${lastFirstFormat.toUpperCase()}" (e.g., "CEPARANO, JOSEPH")
- "${lastFirstFormat.toLowerCase()}" (e.g., "ceparano, joseph")
- As part of longer string: "${lastFirstFormat} V. SOMETHING" or "${lastFirstFormat} vs. SOMETHING"

**Format 2: First Last (common in documents)**
- "${firstLastFormat}" (e.g., "Theodore Spanos")
- "${firstLastFormat.toUpperCase()}" (e.g., "THEODORE SPANOS")
- "${firstLastFormat.toLowerCase()}" (e.g., "theodore spanos")
- As part of longer string: "${firstLastFormat} V. SOMETHING" or "${firstLastFormat} vs. SOMETHING"

**Format 3: First Middle Last (with middle initial/name)**
- "${firstMiddleLastFormat}" (e.g., "Theodore W. Spanos")
- "${firstMiddleLastFormat.toUpperCase()}" (e.g., "THEODORE W. SPANOS")
- "${firstMiddleLastFormat.toLowerCase()}" (e.g., "theodore w. spanos")
- As part of longer string: "${firstMiddleLastFormat} V. SOMETHING" or "${firstMiddleLastFormat} vs. SOMETHING"
- Note: Middle initials/names are common - "Theodore W. Spanos" matches "Spanos, Theodore W."

**Format 4: Just the parts**
- "${lastName}" and "${firstName}" appearing separately (even in different locations)
- "${lastName}" and "${firstName}" as part of longer text
- "${lastName}" and "${firstWithMiddle}" appearing together (e.g., "Theodore W. Spanos" contains both "Spanos" and "Theodore")

## Simple Rule
If you see "${lastName}" (like "Ceparano") AND "${firstName}" (like "Joseph") anywhere in the document - in ANY format, in ANY location, even as part of longer text - the name EXISTS in the document.

## What to Return
1. **clientName**:
   - If you find "${lastFirstMiddleFormat}" or "${firstMiddleLastFormat}" anywhere (e.g., "Spanos, Theodore W." or "Theodore W. Spanos"):
     - Extract the name in "Last, First Middle" format: "${lastFirstMiddleFormat}"
     - Set confidence to 0.95 (high confidence - you found it!)
     - Include bounding box if you can locate where you saw it
   - If you find "${lastFirstFormat}" or "${firstLastFormat}" anywhere:
     - Extract the name in "Last, First" format: "${lastFirstFormat}"
     - Set confidence to 0.95 (high confidence - you found it!)
     - Include bounding box if you can locate where you saw it
   - If you find "${lastName}" and "${firstName}" (or "${firstWithMiddle}") in different order or as part of longer text:
     - Extract in "Last, First Middle" format: "${lastFirstMiddleFormat}" (if middle initial found) or "${lastFirstFormat}" (if no middle)
     - Set confidence to 0.9
     - Include bounding box
   - If you CANNOT find both "${lastName}" AND "${firstName}" anywhere:
     - Set value = null
     - Set confidence = 0.1
     - Set found = false

2. **found**:
   - TRUE if you see "${lastName}" AND "${firstName}" anywhere in the document (in any format, even as part of longer text like "Theodore W. Spanos v. Village of Mineola")
   - TRUE if you see "${lastName}" and "${firstWithMiddle}" together (e.g., "Theodore W. Spanos" contains both "Spanos" and "Theodore")
   - FALSE only if you cannot find both "${lastName}" and "${firstName}" anywhere

## Critical Instructions
- **START by checking common fields**: Look specifically in fields labeled "Patient Name", "Case Name", "Client Name", "Plaintiff Name", "Patient", "Case", etc.
- Read the ENTIRE document carefully, but prioritize these common field locations
- Look for "${lastName}" (like "Ceparano") and "${firstName}" (like "Joseph") in ANY format:
  - "Ceparano, Joseph" (Last, First)
  - "Joseph Ceparano" (First Last)
  - "CEPARANO, JOSEPH" (uppercase)
  - As part of "CEPARANO, JOSEPH V. NEW YORK CITY HOUSING AUTHORITY"
- The name might be in a field like:
  - "PATIENT: DEREK GARRITY" (but you're looking for "${lastName}, ${firstName}")
  - "Case Name: CEPARANO, JOSEPH V. SOMETHING"
  - "Patient Name: Joseph Ceparano"
- Don't overthink it - if you see both parts of the name in ANY field, it EXISTS
- Always extract in "Last, First" format: "${lastFirstFormat}"

## Document Source
Document: {{media url=invoiceDataUri}}

**Search Strategy:**
1. First, check all fields with labels like "Patient Name", "Case Name", "Client Name", "Plaintiff Name", "Patient", "Case"
2. Then search the rest of the document
3. If "${lastName}" and "${firstName}" appear anywhere (in any format, in any field), return found=true and extract the name as "${lastFirstFormat}"
`,
      model: 'openai/gpt-4o',
    });

    const { output } = await retryPlaintiffNamePrompt({
      invoiceDataUri,
      caseName,
    });

    if (!output) {
      return { found: false, error: 'Failed to extract data from document' };
    }

    return {
      clientName: output.clientName,
      found: output.found,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { found: false, error: errorMessage };
  }
}


import { isApprovedAndPushedToCrm } from '@/lib/utils/status-utils';

// Dynamic import for duplicate check (allows script usage)
async function checkForDuplicateInvoiceSafe(
  invoiceNumber: string,
  vendorName: string,
  invoiceDate: string
): Promise<any> {
  try {
    const invoiceRepo = await import('@/lib/repositories/invoice.repository');
    return await invoiceRepo.checkForDuplicateInvoice(invoiceNumber, vendorName, invoiceDate);
  } catch (error) {
    // Check if this is a server-only import error (expected in script mode)
    const isServerOnlyError = error instanceof Error && 
      (error.message.includes('server-only') || 
       error.message.includes('This module cannot be imported from a Client Component'));
    
    // If import fails (e.g., in scripts with 'server-only'), try script-compatible version
    try {
      // Use script-compatible database and mapper
      const { getDb } = await import('@/lib/db/script');
      const { invoices } = await import('@/lib/db/schema');
      const { eq, and, isNull } = await import('drizzle-orm');
      const { mapDbRowToInvoice } = await import('@/lib/repositories/mappers/invoice.mapper');
      
      const db = getDb();
      
      // Need at least invoice number or vendor + date to check duplicates
      if (!invoiceNumber && (!vendorName || !invoiceDate)) {
        return null;
      }
      
      const conditions = [];
      
      if (invoiceNumber) {
        conditions.push(eq(invoices.invoiceNumber, invoiceNumber));
      }
      
      if (vendorName) {
        conditions.push(eq(invoices.vendorName, vendorName));
      }
      
      if (invoiceDate) {
        conditions.push(eq(invoices.invoiceDate, invoiceDate));
      }
      
      // If no caseNumber is provided, only check for duplicates among invoices that also don't have a case number
      conditions.push(isNull(invoices.caseNumber));
      
      const rows = await db
        .select()
        .from(invoices)
        .where(and(...conditions))
        .limit(1);
      
      if (rows.length === 0) return null;
      
      return mapDbRowToInvoice(rows[0]);
    } catch (scriptError) {
      // If script-compatible version also fails, return null (no duplicate)
      // Only log non-server-only errors to avoid noise
      if (!isServerOnlyError) {
        console.warn('Duplicate check unavailable:', error);
      }
      return null;
    }
  }
}

const checkForDuplicatesTool = ai.defineTool(
    {
        name: 'checkForDuplicatesTool',
        description: 'Checks if an invoice with the same vendor and invoice number has been submitted before.',
        inputSchema: z.object({
            invoiceNumber: z.string().describe('The invoice number.'),
            vendorName: z.string().describe('The name of the vendor.'),
            invoiceDate: z.string().describe('The date of the invoice in YYYY-MM-DD format.'),
        }),
        outputSchema: DuplicateCheckResultSchema,
    },
    async (input) => {
        console.log("Checking for duplicates with input: ", input);
        if (!input.invoiceNumber || !input.vendorName || !input.invoiceDate) {
            return { isDuplicate: false };
        }
        
        const duplicate = await checkForDuplicateInvoiceSafe(
            input.invoiceNumber,
            input.vendorName,
            input.invoiceDate
        );
        
        if (!duplicate) {
            return { isDuplicate: false };
        }
        
        // Build a reason for why this is a duplicate
        const reasonParts = [];
        const duplicateInvoiceNumber = typeof duplicate.invoiceNumber === 'object' && duplicate.invoiceNumber !== null 
          ? duplicate.invoiceNumber.value 
          : duplicate.invoiceNumber;
        const duplicateVendorName = typeof duplicate.vendorName === 'object' && duplicate.vendorName !== null 
          ? duplicate.vendorName.value 
          : duplicate.vendorName;
        const duplicateInvoiceDate = typeof duplicate.invoiceDate === 'object' && duplicate.invoiceDate !== null 
          ? duplicate.invoiceDate.value 
          : duplicate.invoiceDate;
        
        if (duplicateInvoiceNumber && duplicateInvoiceNumber === input.invoiceNumber) {
            reasonParts.push(`Invoice number ${duplicateInvoiceNumber}`);
        }
        if (duplicateVendorName && duplicateVendorName === input.vendorName) {
            reasonParts.push(`vendor ${duplicateVendorName}`);
        }
        if (duplicateInvoiceDate && duplicateInvoiceDate === input.invoiceDate) {
            reasonParts.push(`date ${duplicateInvoiceDate}`);
        }
        
        // Check if the original duplicate invoice has been approved and pushed to CRM
        const originalIsApprovedAndPushed = isApprovedAndPushedToCrm(duplicate);
        
        // Check if the duplicate has a case number (to determine if this is a cross-case or same-case duplicate)
        const duplicateHasCaseNumber = duplicate.caseNumber && duplicate.caseNumber.trim().length > 0;
        
        let reason = reasonParts.length > 0 
            ? `Duplicate found: matching ${reasonParts.join(', ')}`
            : 'Duplicate invoice found';
        
        // Add note about case number if duplicate doesn't have one (meaning we're checking among unassigned invoices)
        if (!duplicateHasCaseNumber) {
            reason += ` (among invoices without case number)`;
        }
        
        // Add information about the original invoice status
        if (originalIsApprovedAndPushed) {
            reason += `. Original invoice has been approved and pushed to CRM`;
        } else {
            reason += `. Original invoice is not yet approved/pushed to CRM`;
        }
        
        return { 
            isDuplicate: true,
            reason: reason
        };
    }
);

const checkExternalSystemsTool = ai.defineTool(
    {
        name: 'checkExternalSystemsTool',
        description: 'Checks external systems like QuickBooks and a CRM to determine the invoice status.',
        inputSchema: z.object({
            invoiceNumber: z.string().describe('The invoice number.'),
            customerName: z.string().describe('The name of the customer.'),
            totalAmount: z.number().describe('The total amount of the invoice.'),
        }),
        outputSchema: StatusCheckResultSchema,
    },
    async (input) => {
        const { invoiceNumber, customerName, totalAmount } = input;
        
        const [quickbooksStatus, crmStatus] = await Promise.all([
            getQuickBooksInvoiceStatus(invoiceNumber),
            checkCrmForInvoice(invoiceNumber, customerName, totalAmount),
        ]);

        let finalStatus: 'Paid' | 'Pending' | 'Review' | 'Draft' = 'Review';

        if (quickbooksStatus === 'Paid') {
            finalStatus = 'Paid';
        } else if (crmStatus === 'Associated' && quickbooksStatus === 'Sent') {
            finalStatus = 'Pending';
        } else if (crmStatus === 'Draft') {
            finalStatus = 'Draft';
        }

        return {
            status: finalStatus,
            quickbooksStatus,
            crmStatus,
        };
    }
);


// const extractInvoiceDataPrompt = ai.definePrompt({
//   name: 'extractInvoiceDataPrompt',
//   input: {schema: ExtractInvoiceDataInputSchema},
//   output: {schema: BaseExtractInvoiceDataOutputSchema.extend({paymentTerms: ExtractedFieldSchema.optional()})},
//   prompt: `You are an expert document data extractor. Your goal is to extract key information from the provided document (which could be an Invoice, Receipt, Reimbursement, or Office Credit Card Bill).

// FIRST, determine the document type:
// - **Invoice**: A document requesting payment for goods or services provided. Typically includes terms like "Net 30", payment due dates, itemized line items, and is sent BEFORE payment.
// - **Receipt**: A document confirming payment has been made. Typically includes "Paid" status, payment method, transaction date, and is issued AFTER payment.
// - **Reimbursement**: A document requesting reimbursement for expenses incurred. Typically includes expense categories, employee information, approval signatures, and expense justification. Often includes "Reimbursement Request", "Expense Report", or "Travel Expenses".
// - **Office Credit Card Bill**: A credit card statement or bill for office/corporate credit card. Typically includes card number (masked), statement period, transactions list, minimum payment, and credit card company branding (Visa, Mastercard, Amex, etc.).

// Then extract the following information:
// - Document Type (Invoice, Receipt, Reimbursement, or Office Credit Card Bill) - This is critical and must be determined first
// - Invoice/Receipt/Reimbursement/Statement Number
// - Document Date
// - Vendor Name (or Merchant Name for credit card bills)
// - Vendor Address (full address including street, city, state, zip code)
// - Customer Name (or Cardholder Name for credit card bills)
// - Total Amount
// - Line Items (description, quantity, unit price, total) or Transactions (for credit card bills)
// - Payment Terms (for invoices) or Payment Method (for receipts) or Expense Categories (for reimbursements)

// For each extracted field, provide the value, a confidence score between 0 and 1, a brief reasoning for the score, and the bounding box coordinates for where the value was found in the document.

// IMPORTANT - Bounding Box Format: The bounding box (bbox) must be an array of coordinate objects forming a polygon, where each object has "x" and "y" properties. For example: [{"x": 50, "y": 60}, {"x": 200, "y": 60}, {"x": 200, "y": 80}, {"x": 50, "y": 80}]. If the bounding box cannot be determined, use null. DO NOT use a single coordinate object like {"x": 50, "y": 60} - it must be an array of coordinate objects.

// Key differences to identify document type:
// - Invoices: Usually have payment terms, due dates, "Amount Due", "Balance", "Payable to"
// - Receipts: Usually have "Paid", "Payment Received", payment method (Cash, Card, etc.), "Thank you for your payment"
// - Reimbursements: Usually have "Reimbursement Request", "Expense Report", employee name, expense categories, approval fields
// - Office Credit Card Bills: Usually have credit card company logo, card number (masked), statement period, "Minimum Payment Due", transaction list with dates and merchants

// Use the following as the source of information about the document.

// Document: {{media url=invoiceDataUri}}
// `,
//   model: 'openai/gpt-4o',
// });

const extractInvoiceDataPrompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: { schema: ExtractInvoiceDataInputSchema },
  output: {
    schema: BaseExtractInvoiceDataOutputSchema,
  },
  prompt: `
You are an expert document data extractor. You will be given a single document (image/PDF). The document may be an **Invoice**, **Receipt**, **Reimbursement**, or **Office Credit Card Bill**.

**IMPORTANT**: The document may contain multiple pages. If you see multiple pages in the image (pages stacked vertically), make sure to read through ALL pages from top to bottom. Extract information from ALL pages, not just the first page.

---

## 1. Determine the Document Type
Classify the document as exactly one of:

- **Invoice**  
  A document requesting payment for goods or services. Includes due dates, invoice number, "Amount Due", "Balance Due", etc. This is a bill that needs to be paid.

- **Receipt**  
  A document confirming payment has been made. Includes "Paid", payment method, transaction date, "Thank you", "Payment Received", etc. This confirms a payment was already made.

- **Per Diem**  
  A per diem document (daily allowance for expenses like meals, lodging, travel). May include daily rates, dates, locations, and can be processed as either an invoice (if requesting payment) or receipt (if payment already made). Look for keywords like "per diem", "daily allowance", "meal allowance", "lodging allowance", or travel expense documentation.

- **Estate**  
  Estate-related documents such as probate documents, estate accountings, estate distributions, executor documents, or any document related to estate administration. Look for keywords like "estate", "probate", "executor", "beneficiary", "will", "trust", etc.

- **Other Document**  
  Documents that are not financial documents (invoices/receipts) or are misclassified. This includes non-financial documents like letters, contracts, case files, medical records, or any document that doesn't fit the other categories. Use this when the document is clearly not a financial transaction document.

- **Reimbursement**  
  Includes "Expense Report", employee name, categories (Travel/Meals/etc.), approval signatures, etc.

- **Office Credit Card Bill**  
  Includes masked card number, statement period, "Minimum Payment Due", issuer branding (Visa/Amex), and transaction list.

Return the determined document type using your ExtractedField structure with value, confidence, reasoning, and bbox.

---

## 2. Extract ONLY These Required Fields
Each MUST be returned using your ExtractedField format:  
**value**, **confidence**, **reasoning**, **bbox**

1. **invoiceNumber**  
   - The main invoice/receipt/statement identifier.  
   - For receipts or card bills, map their primary reference/receipt/statement number to invoiceNumber.  
   - If not found, set value = null with low confidence.

2. **amount**  
   - The primary total amount (invoice total, receipt total, reimbursement total, or statement total).  
   - Prefer "Total", "Amount Due", "Balance Due", or equivalent.  
   - Extract as number or string (e.g., 550.80 or "$550.80").  
   - If not found, set value = null with low confidence.

3. **description** (optional)  
   - A high‑level description of what the invoice/receipt is for.  
   - If none exists, set value = null with low confidence.

4. **invoiceDate**  
   - Invoice issue date, receipt transaction date, or statement date.  
   - Format as found in document (e.g., "November 17, 2025" or "2025-11-17").  
   - If not found, set value = null with low confidence.

5. **dueDate** (optional)  
   - If present, extract payment due date.  
   - If missing, set value = null with low confidence.

6. **vendorName**  
   - The issuing entity (company/person).  
   - For credit card bills, use the card issuer name.  
   - If not found, set value = null with low confidence.

7. **vendorAddress**  
   - Full vendor address including street, city, state, postal code.  
   - If not found, set value = null with low confidence.

8. **clientName**  
   - The billed party ("Bill To", "Customer", "Client", "Cardholder Name").  
   - If not present, set value = null with low confidence.

---

## 3. Bounding Box Requirements  
For **every extracted field**, include:

- A polygon bbox = array of coordinate objects:  
  Example format:
  [
    { "x": 50, "y": 60 },
    { "x": 200, "y": 60 },
    { "x": 200, "y": 80 },
    { "x": 50, "y": 80 }
  ]
- If location cannot be determined, set bbox: null.

**NEVER** use a single coordinate object like {"x": 50, "y": 60}.  
**ALWAYS** return an array of coordinate objects forming a polygon.  
**ALWAYS** include value, confidence, reasoning, and bbox for each field.

---

## 4. Missing Fields  
If a field does not exist in the document:

- value = null  
- confidence = low (0.1–0.3)  
- reasoning = "Field not present in document"  
- bbox = null

---

## 5. Document Source  
Use the following as the input document:

Document: {{media url=invoiceDataUri}}

Return ONLY the extracted fields defined above using your ExtractedField schema. No extra commentary or fields not in the schema.
`,
   model: 'openai/gpt-4o',
});

const extractInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async input => {
    // Step 1: Extract the data from the invoice.
    const {output: extractedData} = await extractInvoiceDataPrompt(input);
    
    if (!extractedData) {
      // Return a valid structure with null fields if extraction fails
      return {
        documentType: null,
        invoiceNumber: null,
        invoiceDate: null,
        vendorName: null,
        vendorAddress: null,
        amount: null,
        clientName: null,
        description: null,
        dueDate: null,
        duplicateCheck: { isDuplicate: false },
        status: 'Review' as const,
      };
    }

    let duplicateCheckResult: z.infer<typeof DuplicateCheckResultSchema> = { isDuplicate: false };
    let statusResult: z.infer<typeof StatusCheckResultSchema> = { status: 'Review', quickbooksStatus: null, crmStatus: null };
    
    // Step 2: Check for duplicates and external status in parallel
    const invoiceNumberField = extractedData.invoiceNumber;
    const vendorNameField = extractedData.vendorName;
    const invoiceDateField = extractedData.invoiceDate;
    // Map new field names to old ones for backward compatibility
    const customerNameField = extractedData.clientName || extractedData.customerName;
    const totalAmountField = extractedData.amount || extractedData.totalAmount;

    const promises = [];

    if (invoiceNumberField?.value && vendorNameField?.value && invoiceDateField?.value) {
        promises.push(checkForDuplicatesTool({
            invoiceNumber: invoiceNumberField.value,
            vendorName: vendorNameField.value,
            invoiceDate: invoiceDateField.value,
        }).then(res => duplicateCheckResult = res));
    }

    if (invoiceNumberField?.value && customerNameField?.value && totalAmountField?.value) {
        // Parse totalAmount - it might be a string like "$550.80" or a number
        let totalAmount: number;
        if (typeof totalAmountField.value === 'string') {
            // Remove currency symbols, commas, and whitespace, then parse
            const cleanedAmount = totalAmountField.value.replace(/[$,\s]/g, '');
            totalAmount = parseFloat(cleanedAmount);
            if (isNaN(totalAmount)) {
                console.warn('Could not parse totalAmount:', totalAmountField.value);
                // Skip external systems check if we can't parse the amount
            } else {
                promises.push(checkExternalSystemsTool({
                    invoiceNumber: invoiceNumberField.value,
                    customerName: customerNameField.value,
                    totalAmount: totalAmount
                }).then(res => statusResult = res));
            }
        } else if (typeof totalAmountField.value === 'number') {
            totalAmount = totalAmountField.value;
            promises.push(checkExternalSystemsTool({
                invoiceNumber: invoiceNumberField.value,
                customerName: customerNameField.value,
                totalAmount: totalAmount
            }).then(res => statusResult = res));
        }
    }
    
    await Promise.all(promises);
    
    // Step 3: Combine results and return
    // Map new field names to old ones for backward compatibility
    return {
      ...extractedData,
      // Map amount to totalAmount if amount exists
      totalAmount: extractedData.amount || extractedData.totalAmount,
      // Map clientName to customerName if clientName exists
      customerName: extractedData.clientName || extractedData.customerName,
      duplicateCheck: duplicateCheckResult,
      status: statusResult.status,
    };
  }
);
