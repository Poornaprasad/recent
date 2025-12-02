
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
        
        return await checkForDuplicateInvoice(
            input.invoiceNumber,
            input.vendorName,
            input.invoiceDate
        );
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


const extractInvoiceDataPrompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: BaseExtractInvoiceDataOutputSchema.extend({paymentTerms: ExtractedFieldSchema.optional()})},
  prompt: `You are an expert document data extractor. Your goal is to extract key information from the provided document (which could be an Invoice, Receipt, Reimbursement, or Office Credit Card Bill).

FIRST, determine the document type:
- **Invoice**: A document requesting payment for goods or services provided. Typically includes terms like "Net 30", payment due dates, itemized line items, and is sent BEFORE payment.
- **Receipt**: A document confirming payment has been made. Typically includes "Paid" status, payment method, transaction date, and is issued AFTER payment.
- **Reimbursement**: A document requesting reimbursement for expenses incurred. Typically includes expense categories, employee information, approval signatures, and expense justification. Often includes "Reimbursement Request", "Expense Report", or "Travel Expenses".
- **Office Credit Card Bill**: A credit card statement or bill for office/corporate credit card. Typically includes card number (masked), statement period, transactions list, minimum payment, and credit card company branding (Visa, Mastercard, Amex, etc.).

Then extract the following information:
- Document Type (Invoice, Receipt, Reimbursement, or Office Credit Card Bill) - This is critical and must be determined first
- Invoice/Receipt/Reimbursement/Statement Number
- Document Date
- Vendor Name (or Merchant Name for credit card bills)
- Vendor Address (full address including street, city, state, zip code)
- Customer Name (or Cardholder Name for credit card bills)
- Total Amount
- Line Items (description, quantity, unit price, total) or Transactions (for credit card bills)
- Payment Terms (for invoices) or Payment Method (for receipts) or Expense Categories (for reimbursements)

For each extracted field, provide the value, a confidence score between 0 and 1, a brief reasoning for the score, and the bounding box coordinates for where the value was found in the document.

Key differences to identify document type:
- Invoices: Usually have payment terms, due dates, "Amount Due", "Balance", "Payable to"
- Receipts: Usually have "Paid", "Payment Received", payment method (Cash, Card, etc.), "Thank you for your payment"
- Reimbursements: Usually have "Reimbursement Request", "Expense Report", employee name, expense categories, approval fields
- Office Credit Card Bills: Usually have credit card company logo, card number (masked), statement period, "Minimum Payment Due", transaction list with dates and merchants

Use the following as the source of information about the document.

Document: {{media url=invoiceDataUri}}
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
        customerName: null,
        totalAmount: null,
        lineItems: null,
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
    const customerNameField = extractedData.customerName;
    const totalAmountField = extractedData.totalAmount;

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
    return {
      ...extractedData,
      duplicateCheck: duplicateCheckResult,
      status: statusResult.status,
    };
  }
);
