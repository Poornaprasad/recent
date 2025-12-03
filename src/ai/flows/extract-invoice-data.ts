
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
  paymentTerms: ExtractedFieldSchema.optional(),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;


export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}


import { checkForDuplicateInvoice } from '@/lib/repositories/invoice.repository';

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
        
        const duplicate = await checkForDuplicateInvoice(
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
        
        const reason = reasonParts.length > 0 
            ? `Duplicate found: matching ${reasonParts.join(', ')}`
            : 'Duplicate invoice found';
        
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
    schema: BaseExtractInvoiceDataOutputSchema.extend({
      paymentTerms: ExtractedFieldSchema.optional(),
    }),
  },
  prompt: `
You are an expert document data extractor. You will be given a single document (image/PDF). The document may be an **Invoice**, **Receipt**, **Reimbursement**, or **Office Credit Card Bill**.

---

## 1. Determine the Document Type
Classify the document as exactly one of:

- **Invoice**  
  Includes payment terms ("Net 30"), due dates, invoice number, line items, "Amount Due", etc.

- **Receipt**  
  Includes "Paid", payment method, transaction date, "Thank you", etc.

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

9. **lineItems**  
   - For invoices/receipts: array of items with description, quantity, unit price, total.  
   - For credit card bills: array of transactions with merchant, date, amount.  
   - For reimbursements: array of expense items with category, description, amount.  
   - Format as array of objects.  
   - If not found, set value = null with low confidence.

10. **paymentTerms** (optional)  
   - For invoices: "Net 30", "Due on receipt", etc.  
   - For receipts: use payment method instead (e.g. "Visa **** 1234").  
   - For reimbursements: extract expense categories (e.g., ["Meals", "Travel"]).  
   - If none apply, set value = null with low confidence.

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
        lineItems: null,
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
