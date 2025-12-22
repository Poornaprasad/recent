/**
 * RBAC Types and Enums
 * Shared types that can be used in both client and server components
 */

export enum UserRole {
  ADMIN = 'admin',
  DIRECTOR = 'director',
  MANAGER = 'manager',
  SENIOR_ACCOUNTANT = 'senior_accountant',
  NY_ACCOUNTANT = 'ny_accountant',
  CA_ACCOUNTANT = 'ca_accountant',
}

export enum Permission {
  // Invoice permissions
  VIEW_INVOICES = 'view_invoices',
  EDIT_INVOICES = 'edit_invoices',
  DELETE_INVOICES = 'delete_invoices',
  APPROVE_INVOICES = 'approve_invoices',
  
  // User management
  VIEW_USERS = 'view_users',
  EDIT_USERS = 'edit_users',
  DELETE_USERS = 'delete_users',
  
  // Configuration
  VIEW_SETTINGS = 'view_settings',
  EDIT_SETTINGS = 'edit_settings',
  
  // Audit
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  
  // Export
  EXPORT_DATA = 'export_data',
  
  // Dashboard
  VIEW_DASHBOARD = 'view_dashboard',
  VIEW_ALL_DASHBOARDS = 'view_all_dashboards',
  
  // Vendor & W9 Management
  MANAGE_W9_STATUS = 'manage_w9_status',
  VIEW_VENDORS = 'view_vendors',
  EDIT_VENDORS = 'edit_vendors',
}
