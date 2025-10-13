import { users_role as UserRole } from '@prisma/client';

export enum Permission {
  // User Management
  USERS_VIEW = 'users:view',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  USERS_MANAGE_ROLES = 'users:manage_roles',

  // Student Management
  STUDENTS_VIEW = 'students:view',
  STUDENTS_CREATE = 'students:create',
  STUDENTS_UPDATE = 'students:update',
  STUDENTS_DELETE = 'students:delete',
  STUDENTS_EXPORT = 'students:export',

  // Book Management
  BOOKS_VIEW = 'books:view',
  BOOKS_CREATE = 'books:create',
  BOOKS_UPDATE = 'books:update',
  BOOKS_DELETE = 'books:delete',
  BOOKS_CHECKOUT = 'books:checkout',
  BOOKS_RETURN = 'books:return',
  BOOKS_EXPORT = 'books:export',

  // Equipment Management
  EQUIPMENT_VIEW = 'equipment:view',
  EQUIPMENT_CREATE = 'equipment:create',
  EQUIPMENT_UPDATE = 'equipment:update',
  EQUIPMENT_DELETE = 'equipment:delete',
  EQUIPMENT_ASSIGN = 'equipment:assign',

  // Activity Tracking
  ACTIVITIES_VIEW = 'activities:view',
  ACTIVITIES_CREATE = 'activities:create',
  ACTIVITIES_UPDATE = 'activities:update',
  ACTIVITIES_DELETE = 'activities:delete',
  ACTIVITIES_EXPORT = 'activities:export',

  // Fines Management
  FINES_VIEW = 'fines:view',
  FINES_CREATE = 'fines:create',
  FINES_UPDATE = 'fines:update',
  FINES_DELETE = 'fines:delete',
  FINES_WAIVE = 'fines:waive',

  // Reports
  REPORTS_VIEW = 'reports:view',
  REPORTS_GENERATE = 'reports:generate',
  REPORTS_EXPORT = 'reports:export',
  REPORTS_ADVANCED = 'reports:advanced',

  // Analytics
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_ADVANCED = 'analytics:advanced',

  // System Settings
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_UPDATE = 'settings:update',
  SETTINGS_SYSTEM = 'settings:system',

  // Automation
  AUTOMATION_VIEW = 'automation:view',
  AUTOMATION_MANAGE = 'automation:manage',

  // Backups
  BACKUP_VIEW = 'backup:view',
  BACKUP_CREATE = 'backup:create',
  BACKUP_RESTORE = 'backup:restore',
  BACKUP_DELETE = 'backup:delete',

  // Notifications
  NOTIFICATIONS_VIEW = 'notifications:view',
  NOTIFICATIONS_SEND = 'notifications:send',
  NOTIFICATIONS_MANAGE = 'notifications:manage',

  // Audit Logs
  AUDIT_LOGS_VIEW = 'audit_logs:view',
  AUDIT_LOGS_EXPORT = 'audit_logs:export',

  // Import/Export
  DATA_IMPORT = 'data:import',
  DATA_EXPORT = 'data:export',

  // QR/Barcode
  BARCODE_GENERATE = 'barcode:generate',
  BARCODE_MANAGE = 'barcode:manage',

  // Security Management
  SECURITY_INCIDENT_VIEW = 'security:incident_view',
  SECURITY_INCIDENT_MANAGE = 'security:incident_manage',
  SECURITY_THREAT_INTEL = 'security:threat_intel',
  SECURITY_POLICY_MANAGE = 'security:policy_manage',
  SECURITY_VULNERABILITY_SCAN = 'security:vulnerability_scan',
  SECURITY_SESSION_MONITOR = 'security:session_monitor',
  SECURITY_IP_BLOCKING = 'security:ip_blocking',
  SECURITY_AUDIT_TRAIL = 'security:audit_trail',

  // Session Management
  SESSION_VIEW_ALL = 'session:view_all',
  SESSION_TERMINATE = 'session:terminate',
  SESSION_ANALYZE = 'session:analyze',
  SESSION_IMPERSONATE = 'session:impersonate',

  // Multi-Factor Authentication
  MFA_MANAGE = 'mfa:manage',
  MFA_ENFORCE = 'mfa:enforce',
  MFA_BYPASS = 'mfa:bypass',
  MFA_RECOVERY = 'mfa:recovery',

  // Advanced API Access
  API_ADMIN = 'api:admin',
  API_KEYS_MANAGE = 'api:keys_manage',
  API_RATE_LIMITING = 'api:rate_limiting',
  API_WEBHOOK_MANAGE = 'api:webhook_manage',

  // Compliance and Governance
  COMPLIANCE_MANAGE = 'compliance:manage',
  COMPLIANCE_REPORT = 'compliance:report',
  COMPLIANCE_AUDIT = 'compliance:audit',

  // Emergency Access
  EMERGENCY_ACCESS = 'emergency:access',
  EMERGENCY_OVERRIDE = 'emergency:override',
  DISASTER_RECOVERY = 'disaster:recovery',

  // Development and Debugging
  DEVELOPER_ACCESS = 'developer:access',
  DEBUG_MODE = 'debug:mode',
  SYSTEM_DEBUG = 'system:debug',

  // Data Protection
  DATA_ENCRYPTION_MANAGE = 'data:encryption_manage',
  DATA_MASKING = 'data:masking',
  DATA_PRIVACY_MANAGE = 'data:privacy_manage',

  // Network Security
  NETWORK_ACCESS_CONTROL = 'network:access_control',
  NETWORK_MONITORING = 'network:monitoring',
  FIREWALL_MANAGE = 'firewall:manage',

  // Advanced Analytics
  ANALYTICS_REAL_TIME = 'analytics:real_time',
  ANALYTICS_PREDICTIVE = 'analytics:predictive',
  ANALYTICS_BEHAVIORAL = 'analytics:behavioral',

  // Bulk Operations
  BULK_OPERATIONS = 'bulk:operations',
  BULK_IMPORT = 'bulk:import',
  BULK_EXPORT = 'bulk:export',
  BULK_DELETE = 'bulk:delete',

  // Advanced User Management
  USER_IMPERSONATE = 'user:impersonate',
  USER_SESSION_MANAGE = 'user:session_manage',
  USER_PERMISSIONS_GRANT = 'user:permissions_grant',
  USER_ROLES_MANAGE = 'user:roles_manage',
}

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // All permissions including security and advanced features
    ...Object.values(Permission),
  ],

  [UserRole.ADMIN]: [
    // User Management (except role management)
    Permission.USERS_VIEW,
    Permission.USERS_CREATE,
    Permission.USERS_UPDATE,
    Permission.USERS_DELETE,

    // Full Student Management
    Permission.STUDENTS_VIEW,
    Permission.STUDENTS_CREATE,
    Permission.STUDENTS_UPDATE,
    Permission.STUDENTS_DELETE,
    Permission.STUDENTS_EXPORT,

    // Full Book Management
    Permission.BOOKS_VIEW,
    Permission.BOOKS_CREATE,
    Permission.BOOKS_UPDATE,
    Permission.BOOKS_DELETE,
    Permission.BOOKS_CHECKOUT,
    Permission.BOOKS_RETURN,
    Permission.BOOKS_EXPORT,

    // Full Equipment Management
    Permission.EQUIPMENT_VIEW,
    Permission.EQUIPMENT_CREATE,
    Permission.EQUIPMENT_UPDATE,
    Permission.EQUIPMENT_DELETE,
    Permission.EQUIPMENT_ASSIGN,

    // Full Activity Management
    Permission.ACTIVITIES_VIEW,
    Permission.ACTIVITIES_CREATE,
    Permission.ACTIVITIES_UPDATE,
    Permission.ACTIVITIES_DELETE,
    Permission.ACTIVITIES_EXPORT,

    // Full Fines Management
    Permission.FINES_VIEW,
    Permission.FINES_CREATE,
    Permission.FINES_UPDATE,
    Permission.FINES_DELETE,
    Permission.FINES_WAIVE,

    // Full Reports & Analytics
    Permission.REPORTS_VIEW,
    Permission.REPORTS_GENERATE,
    Permission.REPORTS_EXPORT,
    Permission.REPORTS_ADVANCED,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_ADVANCED,

    // Settings
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_UPDATE,
    Permission.SETTINGS_SYSTEM,

    // Automation
    Permission.AUTOMATION_VIEW,
    Permission.AUTOMATION_MANAGE,

    // Backups
    Permission.BACKUP_VIEW,
    Permission.BACKUP_CREATE,
    Permission.BACKUP_RESTORE,
    Permission.BACKUP_DELETE,

    // Notifications
    Permission.NOTIFICATIONS_VIEW,
    Permission.NOTIFICATIONS_SEND,
    Permission.NOTIFICATIONS_MANAGE,

    // Audit Logs
    Permission.AUDIT_LOGS_VIEW,
    Permission.AUDIT_LOGS_EXPORT,

    // Import/Export
    Permission.DATA_IMPORT,
    Permission.DATA_EXPORT,

    // Barcode
    Permission.BARCODE_GENERATE,
    Permission.BARCODE_MANAGE,

    // Security (limited)
    Permission.SECURITY_INCIDENT_VIEW,
    Permission.SECURITY_SESSION_MONITOR,
    Permission.SECURITY_AUDIT_TRAIL,

    // Session Management
    Permission.SESSION_VIEW_ALL,
    Permission.SESSION_TERMINATE,
    Permission.SESSION_ANALYZE,

    // MFA Management
    Permission.MFA_MANAGE,
    Permission.MFA_ENFORCE,

    // Compliance
    Permission.COMPLIANCE_MANAGE,
    Permission.COMPLIANCE_REPORT,

    // Bulk Operations
    Permission.BULK_OPERATIONS,
    Permission.BULK_IMPORT,
    Permission.BULK_EXPORT,

    // Advanced User Management
    Permission.USER_SESSION_MANAGE,
    Permission.USER_ROLES_MANAGE,
  ],

  [UserRole.LIBRARIAN]: [
    // User Management (view only)
    Permission.USERS_VIEW,

    // Full Student Management
    Permission.STUDENTS_VIEW,
    Permission.STUDENTS_CREATE,
    Permission.STUDENTS_UPDATE,
    Permission.STUDENTS_EXPORT,

    // Full Book Management
    Permission.BOOKS_VIEW,
    Permission.BOOKS_CREATE,
    Permission.BOOKS_UPDATE,
    Permission.BOOKS_CHECKOUT,
    Permission.BOOKS_RETURN,
    Permission.BOOKS_EXPORT,

    // Equipment Management
    Permission.EQUIPMENT_VIEW,
    Permission.EQUIPMENT_ASSIGN,

    // Activity Management
    Permission.ACTIVITIES_VIEW,
    Permission.ACTIVITIES_CREATE,
    Permission.ACTIVITIES_UPDATE,
    Permission.ACTIVITIES_EXPORT,

    // Fines Management
    Permission.FINES_VIEW,
    Permission.FINES_CREATE,
    Permission.FINES_UPDATE,

    // Reports
    Permission.REPORTS_VIEW,
    Permission.REPORTS_GENERATE,
    Permission.REPORTS_EXPORT,
    Permission.ANALYTICS_VIEW,

    // Settings (view only)
    Permission.SETTINGS_VIEW,

    // Automation (view only)
    Permission.AUTOMATION_VIEW,

    // Notifications
    Permission.NOTIFICATIONS_VIEW,
    Permission.NOTIFICATIONS_SEND,

    // Import/Export
    Permission.DATA_IMPORT,
    Permission.DATA_EXPORT,

    // Barcode
    Permission.BARCODE_GENERATE,
  ],

  [UserRole.ASSISTANT]: [
    // Students (limited)
    Permission.STUDENTS_VIEW,
    Permission.STUDENTS_UPDATE,

    // Books (basic operations)
    Permission.BOOKS_VIEW,
    Permission.BOOKS_CHECKOUT,
    Permission.BOOKS_RETURN,

    // Equipment (view and assign)
    Permission.EQUIPMENT_VIEW,
    Permission.EQUIPMENT_ASSIGN,

    // Activities
    Permission.ACTIVITIES_VIEW,
    Permission.ACTIVITIES_CREATE,

    // Fines (view and create)
    Permission.FINES_VIEW,
    Permission.FINES_CREATE,

    // Reports (basic)
    Permission.REPORTS_VIEW,
    Permission.REPORTS_GENERATE,

    // Notifications (view only)
    Permission.NOTIFICATIONS_VIEW,

    // Barcode
    Permission.BARCODE_GENERATE,
  ],

  [UserRole.TEACHER]: [
    // Students (view only)
    Permission.STUDENTS_VIEW,

    // Books (view only)
    Permission.BOOKS_VIEW,

    // Equipment (view only)
    Permission.EQUIPMENT_VIEW,

    // Activities (view only)
    Permission.ACTIVITIES_VIEW,

    // Fines (view only)
    Permission.FINES_VIEW,

    // Reports (full access)
    Permission.REPORTS_VIEW,
    Permission.REPORTS_GENERATE,
    Permission.REPORTS_EXPORT,
    Permission.REPORTS_ADVANCED,

    // Analytics
    Permission.ANALYTICS_VIEW,

    // Notifications (view only)
    Permission.NOTIFICATIONS_VIEW,
  ],

  [UserRole.VIEWER]: [
    // Students (view only)
    Permission.STUDENTS_VIEW,

    // Books (view only)
    Permission.BOOKS_VIEW,

    // Equipment (view only)
    Permission.EQUIPMENT_VIEW,

    // Activities (view only)
    Permission.ACTIVITIES_VIEW,

    // Fines (view only)
    Permission.FINES_VIEW,

    // Reports (view and generate)
    Permission.REPORTS_VIEW,
    Permission.REPORTS_GENERATE,

    // Analytics (view only)
    Permission.ANALYTICS_VIEW,

    // Notifications (view only)
    Permission.NOTIFICATIONS_VIEW,
  ],
};

// Helper function to check if a role has a specific permission
export function hasPermission(
  role: UserRole,
  permission: Permission,
  customPermissions?: string[],
): boolean {
  // Check custom permissions first (if any)
  if (customPermissions && customPermissions.includes(permission)) {
    return true;
  }

  // Check role-based permissions
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Helper function to get all permissions for a role
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Helper function to check multiple permissions (requires all)
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[],
  customPermissions?: string[],
): boolean {
  return permissions.every(permission =>
    hasPermission(role, permission, customPermissions),
  );
}

// Helper function to check multiple permissions (requires any)
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[],
  customPermissions?: string[],
): boolean {
  return permissions.some(permission =>
    hasPermission(role, permission, customPermissions),
  );
}

// Resource-based permission helpers
export const ResourcePermissions = {
  canRead: (resource: string) => `${resource}:view` as Permission,
  canCreate: (resource: string) => `${resource}:create` as Permission,
  canUpdate: (resource: string) => `${resource}:update` as Permission,
  canDelete: (resource: string) => `${resource}:delete` as Permission,
};
