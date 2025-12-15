/**
 * SmartAdvocate CRM Types
 * Type definitions for SmartAdvocate API interactions
 */

export interface SmartAdvocateConfig {
  SA_API_BASE_URL: string;
  SA_API_KEY?: string;
  SA_USERNAME?: string;
  SA_PASSWORD?: string;
}

export interface SmartAdvocateCase {
  caseID?: string | number;
  caseNumber?: string;
  caseName?: string;
  caseType?: string;
  caseStatus?: string;
  plaintiffs?: Array<{
    id?: number;
    name?: string;
    roleID?: number;
    role?: string;
    contactID?: number;
    primary?: boolean;
  }>;
  defendant?: Array<{
    id?: number;
    name?: string;
    roleID?: number;
    role?: string;
    contactID?: number;
    primary?: boolean;
  }>;
  caseStaff?: Array<{
    uniqueContactId?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  }>;
  [key: string]: unknown;
}

/**
 * Case Info response structure from SmartAdvocate API
 */
export interface CaseInfo {
  CaseNumber?: string;
  PlaintiffName?: string;
  Plaintiff?: string;
  ClientName?: string;
  CustomerName?: string;
  [key: string]: unknown; // Allow for other fields
}

/**
 * Parameters for fetching case info
 */
export interface GetCaseInfoParams {
  caseNumber: string;
  addContactInfo?: boolean;
}

