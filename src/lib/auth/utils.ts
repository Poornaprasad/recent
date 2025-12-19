import type { AccountStatus, Role } from '../types';

/**
 * Authentication constants
 */
export const AUTH_CONSTANTS = {
  STORAGE_KEY: 'auth-storage',
  TOKEN_EXPIRY_HOURS: 12,
  MILLISECONDS_PER_HOUR: 60 * 60 * 1000,
  MIN_PASSWORD_LENGTH: 6,
  MAX_EMAIL_LENGTH: 255,
} as const;

/**
 * Valid roles in the system
 */
export const VALID_ROLES = ['administrator', 'officeManager', 'seniorTranscriptionist', 'transcriptionist'] as const;

/**
 * Valid account statuses
 */
export const VALID_STATUSES = ['pending', 'active', 'rejected', 'disabled'] as const;

/**
 * Account status error messages
 */
export const ACCOUNT_STATUS_MESSAGES: Record<AccountStatus, string> = {
  pending: 'Your account is still pending approval',
  rejected: 'Your account registration has been rejected. Please contact an administrator.',
  disabled: 'Your account has been disabled. Please contact an administrator.',
  active: '', // No error message for active status
};

/**
 * Check if token is expired
 * @param tokenExpiry - Token expiry timestamp in milliseconds
 * @returns true if token is expired or missing
 */
export function isTokenExpired(tokenExpiry: number | null | undefined): boolean {
  if (!tokenExpiry) return true;
  return Date.now() >= tokenExpiry;
}

/**
 * Calculate token expiry timestamp (24 hours from now)
 * @returns Expiry timestamp in milliseconds
 */
export function calculateTokenExpiry(): number {
  return Date.now() + (AUTH_CONSTANTS.TOKEN_EXPIRY_HOURS * AUTH_CONSTANTS.MILLISECONDS_PER_HOUR);
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns true if email is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > AUTH_CONSTANTS.MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate password format
 * @param password - Password to validate
 * @returns true if password meets minimum requirements
 */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= AUTH_CONSTANTS.MIN_PASSWORD_LENGTH;
}

/**
 * Normalize email address (trim and lowercase)
 * @param email - Email address to normalize
 * @returns Normalized email address
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Get account status error message
 * @param status - Account status
 * @returns Error message for the status, or default message
 */
export function getAccountStatusMessage(status: AccountStatus | undefined | null): string {
  if (!status || status === 'active') {
    return 'Your account is not active. Please contact an administrator.';
  }
  return ACCOUNT_STATUS_MESSAGES[status] || 'Your account is not active. Please contact an administrator.';
}

/**
 * Validate role
 * @param role - Role to validate
 * @returns true if role is valid
 */
export function isValidRole(role: unknown): role is Role {
  return typeof role === 'string' && VALID_ROLES.includes(role as Role);
}

/**
 * Validate name format
 * @param name - Name to validate
 * @returns true if name is valid (at least 2 characters after trimming)
 */
export function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 2;
}

