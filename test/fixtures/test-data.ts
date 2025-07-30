// Test fixtures and sample data

export const testUsers = [
  {
    id: 'user-1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    organizationId: 'org-1',
    twoFactorEnabled: false,
    isSuperAdmin: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'user-2',
    email: 'jane.smith@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    organizationId: 'org-1',
    twoFactorEnabled: true,
    isSuperAdmin: false,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 'super-admin',
    email: 'admin@example.com',
    firstName: 'Super',
    lastName: 'Admin',
    organizationId: null,
    twoFactorEnabled: true,
    isSuperAdmin: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

export const testOrganizations = [
  {
    id: 'org-1',
    name: 'Acme Corporation',
    slug: 'acme',
    domain: 'acme.example.com',
    settings: { theme: 'blue' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'org-2',
    name: 'Beta Company',
    slug: 'beta',
    domain: 'beta.example.com',
    settings: { theme: 'green' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

export const testRoles = [
  {
    id: 'role-admin',
    organizationId: 'org-1',
    name: 'Administrator',
    slug: 'admin',
    description: 'Full access to organization',
    isDefault: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'role-manager',
    organizationId: 'org-1',
    name: 'Manager',
    slug: 'manager',
    description: 'Management access',
    isDefault: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'role-user',
    organizationId: 'org-1',
    name: 'User',
    slug: 'user',
    description: 'Basic user access',
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

export const testPermissions = [
  {
    id: 'perm-users-manage',
    name: 'Manage Users',
    slug: 'users.manage',
    description: 'Create, update, delete users',
    resource: 'users',
    action: 'manage',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'perm-users-view',
    name: 'View Users',
    slug: 'users.view',
    description: 'View users list',
    resource: 'users',
    action: 'view',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'perm-posts-create',
    name: 'Create Posts',
    slug: 'posts.create',
    description: 'Create new posts',
    resource: 'posts',
    action: 'create',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'perm-posts-manage',
    name: 'Manage Posts',
    slug: 'posts.manage',
    description: 'Full post management',
    resource: 'posts',
    action: 'manage',
    createdAt: new Date('2024-01-01'),
  },
]

export const testRoleAssignments = [
  { userId: 'user-1', roleId: 'role-admin' },
  { userId: 'user-2', roleId: 'role-user' },
]

export const testRolePermissions = [
  { roleId: 'role-admin', permissionId: 'perm-users-manage' },
  { roleId: 'role-admin', permissionId: 'perm-users-view' },
  { roleId: 'role-admin', permissionId: 'perm-posts-manage' },
  { roleId: 'role-manager', permissionId: 'perm-users-view' },
  { roleId: 'role-manager', permissionId: 'perm-posts-manage' },
  { roleId: 'role-user', permissionId: 'perm-posts-create' },
]

export const testAuditLogs = [
  {
    id: 'audit-1',
    organizationId: 'org-1',
    userId: 'user-1',
    action: 'CREATE',
    resource: 'user',
    resourceId: 'user-2',
    details: { email: 'jane.smith@example.com' },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    createdAt: new Date('2024-01-02T10:00:00Z'),
  },
  {
    id: 'audit-2',
    organizationId: 'org-1',
    userId: 'user-1',
    action: 'LOGIN',
    resource: 'session',
    resourceId: null,
    details: { method: 'oauth-google' },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    createdAt: new Date('2024-01-02T09:00:00Z'),
  },
]

export const testRecoveryCodes = [
  {
    id: 'recovery-1',
    userId: 'user-2',
    code: 'ABCD1234',
    used: false,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'recovery-2',
    userId: 'user-2',
    code: 'EFGH5678',
    used: false,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'recovery-3',
    userId: 'user-2',
    code: 'IJKL9012',
    used: true,
    usedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
  },
]

export const testTOTPSecrets = {
  user2: {
    secret: 'JBSWY3DPEHPK3PXP',
    uri: 'otpauth://totp/Test%20App:jane.smith@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test%20App',
    qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  },
}

export const testPasswords = {
  weak: [
    'password',
    '123456',
    'qwerty',
    'abc123',
  ],
  strong: [
    'MyStrongPassword123!',
    'C0mpl3x_P@ssw0rd',
    'SecureP@ss2024!',
  ],
  hashes: {
    'test123': 'scrypt-hashed-test123',
    'password': 'scrypt-hashed-password',
    'MyStrongPassword123!': 'scrypt-hashed-MyStrongPassword123!',
  },
}

export const testEnvironmentVariables = {
  complete: {
    NUXT_DATABASE_URL: 'sqlite:./test.db',
    NUXT_SESSION_PASSWORD: 'super-secret-session-password-32-chars',
    NUXT_SUPER_ADMIN_LOGIN: 'admin@test.com',
    NUXT_SUPER_ADMIN_PASSWORD: 'SuperSecurePassword123!',
    NUXT_MULTI_TENANT_MODE: 'true',
    NUXT_TENANT_STRATEGY: 'subdomain',
    NUXT_TOTP_ISSUER: 'Test Application',
    NUXT_RBAC_ENABLED: 'true',
    NUXT_UI_ENABLED: 'true',
  },
  minimal: {
    NUXT_SESSION_PASSWORD: 'super-secret-session-password-32-chars',
  },
}
