
import { z } from "zod";

export const invoiceReviewSchema = z.object({
  invoiceNumber: z
    .string()
    .min(1, { message: "Invoice number is required." }),
  invoiceDate: z.string().min(1, { message: "Invoice date is required." }),
  vendorName: z.string().min(1, { message: "Vendor name is required." }),
  customerName: z.string().min(1, { message: "Customer name is required." }),
  totalAmount: z.coerce
    .number({ invalid_type_error: "Total amount must be a number." })
    .positive({ message: "Total amount must be positive." }),
});

export type InvoiceReviewData = z.infer<typeof invoiceReviewSchema>;

const BoundingBoxSchema = z.array(z.object({
  x: z.number(),
  y: z.number()
})).nullable().describe('Bounding box polygon of the extracted text.');

export const ExtractedFieldSchema = z.object({
  value: z.any().describe('The extracted value.'),
  confidence: z.number().min(0).max(1).describe('The confidence score, from 0.0 to 1.0.'),
  reasoning: z.string().describe('A brief explanation for the assigned confidence score.'),
  bbox: BoundingBoxSchema,
}).nullable();


export const DocumentTypeSchema = z.enum(['Invoice', 'Receipt', 'Per Diem', 'Estate', 'Other Document', 'Reimbursement', 'Office Credit Card Bill']).describe('The type of document: Invoice, Receipt, Per Diem, Estate, Other Document, Reimbursement, or Office Credit Card Bill.');

export const ExtractInvoiceDataOutputSchema = z.object({
  documentType: z.object({
    value: DocumentTypeSchema,
    confidence: z.number().min(0).max(1).describe('Confidence score for document type classification.'),
    reasoning: z.string().describe('Explanation for why this document is classified as Invoice or Receipt.'),
    bbox: BoundingBoxSchema,
  }).nullable().describe('The type of document (Invoice or Receipt).'),
  invoiceNumber: ExtractedFieldSchema,
  invoiceDate: ExtractedFieldSchema,
  vendorName: ExtractedFieldSchema,
  vendorAddress: ExtractedFieldSchema,
  // Primary fields (new naming)
  amount: ExtractedFieldSchema,
  clientName: ExtractedFieldSchema,
  description: ExtractedFieldSchema.optional(),
  dueDate: ExtractedFieldSchema.optional(),
  // Legacy fields (optional for backward compatibility)
  customerName: ExtractedFieldSchema.optional(),
  totalAmount: ExtractedFieldSchema.optional(),
}).describe('The extracted invoice or receipt data.');


export enum CrmInvoiceStatus {
    Associated = 'Associated',
    Draft = 'Draft',
    NotFound = 'Not Found',
    Duplicate = 'Duplicate',
}

export enum QuickBooksInvoiceStatus {
    Paid = 'Paid',
    Sent = 'Sent',
    Draft = 'Draft',
    Voided = 'Voided',
}

    