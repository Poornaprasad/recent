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

/**
 * Contact email from SmartAdvocate API
 */
export interface SmartAdvocateEmail {
  emailID: number;
  name: string;
  primary: boolean;
  preventAutoContact?: boolean;
  createdDate?: string;
  modifiedDate?: string;
}

/**
 * Contact phone from SmartAdvocate API
 */
export interface SmartAdvocatePhone {
  phoneID: number;
  name: string;
  phoneNumber: string;
  primary: boolean;
  useForTexting?: boolean;
  preventAutoContact?: boolean;
  createdDate?: string;
  modifiedDate?: string;
}

/**
 * Contact address from SmartAdvocate API
 */
export interface SmartAdvocateAddress {
  addressID: number;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  country?: string;
  primary: boolean;
  residence?: boolean;
  current?: boolean;
  addressType?: string;
  mailing?: boolean;
  createdDate?: string;
  modifiedDate?: string;
}

/**
 * Contact details from SmartAdvocate API
 */
export interface SmartAdvocateContact {
  contactId: number;
  contactCtg?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  name?: string; // For company contacts
  prefix?: string;
  suffix?: string;
  nickName?: string;
  maidenName?: string;
  contactTypeId?: number;
  contactSubCtgID?: number;
  contactType?: string;
  contactSubCtg?: string;
  comments?: string;
  dateOfBirth?: string;
  genderID?: number;
  birthPlace?: string;
  occupation?: string;
  spouse?: string;
  einNo?: string;
  ssnNo?: string;
  primaryLanguage?: string;
  secondaryLanguage?: string;
  licenseNo?: string;
  licenseStateID?: number;
  noSSN?: boolean;
  active?: boolean;
  preventAutoContact?: boolean;
  preventMailing?: boolean;
  locked?: boolean;
  addresses?: SmartAdvocateAddress[];
  emails?: SmartAdvocateEmail[];
  phones?: SmartAdvocatePhone[];
  createdDate?: string;
  modifiedDate?: string;
  [key: string]: unknown;
}

/**
 * Plaintiff from SmartAdvocate API
 */
export interface SmartAdvocatePlaintiff {
  id: number;
  name: string;
  roleID?: number;
  role?: string;
  contactID?: number;
  primary: boolean;
  primaryContact?: boolean;
  comments?: string;
  missing?: boolean;
  markedAsRemoved?: boolean;
  client?: boolean;
  group?: number;
  contact?: SmartAdvocateContact;
  tableType?: string;
  [key: string]: unknown;
}

/**
 * Case response from SmartAdvocate API
 * Based on actual API response structure
 */
export interface SmartAdvocateCase {
  caseID: number;
  caseNumber: string;
  caseName?: string;
  caseGroupID?: number;
  caseGroup?: string;
  caseTypeID?: number;
  caseType?: string;
  caseStatusID?: number;
  caseStatus?: string;
  caseStatusFrom?: string;
  caseOpenedDate?: string;
  wantedAcceptedDate?: string;
  officeID?: number;
  officeName?: string;
  plaintiffs?: SmartAdvocatePlaintiff[];
  defendant?: Array<{
    id: number;
    name: string;
    [key: string]: unknown;
  }>;
  caseStaff?: Array<{
    uniqueContactId?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    phone?: string;
    userID?: number;
    [key: string]: unknown;
  }>;
  createdDate?: string;
  modifiedDate?: string;
  [key: string]: unknown;
}

/**
 * Parameters for fetching case info
 */
export interface GetCaseInfoParams {
  caseNumber: string;
  addContactInfo?: boolean;
}

/**
 * Extracted plaintiff info from case lookup
 */
export interface PlaintiffInfo {
  name: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

/**
 * Disbursement type/status option from SmartAdvocate API
 */
export interface DisbursementOption {
  id: number;
  description: string;
}

/**
 * Contact lookup result from SmartAdvocate API
 */
export interface ContactLookupResult {
  contactId: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  contactType?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: unknown;
}

/**
 * Parameters for contact lookup
 */
export interface ContactLookupParams {
  name?: string;
  firstName?: string;
  lastName?: string;
  firstPage?: number;
  rowLimit?: number;
}
