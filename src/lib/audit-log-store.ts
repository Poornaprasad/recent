import { createStore, type BaseEntity } from './store-base';

export type AuditLog = BaseEntity & {
    timestamp: string;
    user: string;
    action: string;
    resource: string;
    details: string;
    ipAddress: string;
    severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
};

const initialAuditLogs: AuditLog[] = [
    { 
        id: '1', 
        timestamp: 'Jan 15, 2024, 02:30:00 PM', 
        user: 'John Smith', 
        action: 'USER_IMPERSONATION', 
        resource: 'User: Sarah Johnson', 
        details: 'Started impersonation session for troubleshooting', 
        ipAddress: '192.168.1.100', 
        severity: 'WARNING' 
    },
    { 
        id: '2', 
        timestamp: 'Jan 15, 2024, 02:15:00 PM', 
        user: 'John Smith', 
        action: 'ROLE_PERMISSION_CHANGE', 
        resource: 'Role: OCR Reviewer', 
        details: 'Added permission: reports.export', 
        ipAddress: '192.168.1.100', 
        severity: 'WARNING' 
    },
    { 
        id: '3', 
        timestamp: 'Jan 15, 2024, 01:45:00 PM', 
        user: 'System', 
        action: 'PASSWORD_RESET', 
        resource: 'User: Mika Chen', 
        details: 'Password reset requested via email', 
        ipAddress: '192.168.1.45', 
        severity: 'INFO' 
    },
    { 
        id: '4', 
        timestamp: 'Jan 15, 2024, 01:30:00 PM', 
        user: 'Lisa Wong', 
        action: 'HIGH_VALUE_APPROVAL', 
        resource: 'Invoice: #INV-2024-003', 
        details: 'Approved invoice for $15,000', 
        ipAddress: '192.168.1.78', 
        severity: 'INFO' 
    },
    { 
        id: '5', 
        timestamp: 'Jan 15, 2024, 01:00:00 PM', 
        user: 'System', 
        action: 'FAILED_LOGIN_ATTEMPT', 
        resource: 'User: tom.wilson@company.com', 
        details: '3 failed login attempts detected', 
        ipAddress: '192.168.1.92', 
        severity: 'ERROR' 
    },
    { 
        id: '6', 
        timestamp: 'Jan 15, 2024, 12:45:00 PM', 
        user: 'John Smith', 
        action: 'USER_DELETION', 
        resource: 'User: temp.user@company.com', 
        details: 'Permanently deleted user account', 
        ipAddress: '192.168.1.108', 
        severity: 'CRITICAL' 
    },
    { 
        id: '7', 
        timestamp: 'Jan 15, 2024, 12:00:00 PM', 
        user: 'System', 
        action: 'SECURITY_ALERT', 
        resource: 'System', 
        details: 'Unusual activity pattern detected from IP 192.168.1.200', 
        ipAddress: '192.168.1.200', 
        severity: 'CRITICAL' 
    },
    { 
        id: '8', 
        timestamp: 'Jan 15, 2024, 11:30:00 AM', 
        user: 'Sarah Johnson', 
        action: 'DATA_EXPORT', 
        resource: 'Reports', 
        details: 'Exported user activity report (500 records)', 
        ipAddress: '192.168.1.56', 
        severity: 'INFO' 
    }
];

const [, store] = createStore(initialAuditLogs);

export function getAuditLogs(): AuditLog[] {
    return store.getAll().sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}
