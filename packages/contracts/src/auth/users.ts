/** Roles an owner can assign when creating or editing employees. */
export type AssignableRoleCode = "CASHIER" | "MANAGER" | "OWNER";

export type CreateUserRequest = {
  email: string;
  fullName: string;
  password: string;
  roleCode: AssignableRoleCode;
  /** Optional 4-digit manager PIN for approvals. */
  pin?: string;
};

export type UpdateUserRequest = {
  email?: string;
  fullName?: string;
  roleCode?: AssignableRoleCode;
  /** Omit or empty to keep the current password. */
  password?: string;
  /** Omit or empty to keep the current PIN. */
  pin?: string;
};

export type OrgUserDto = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  hasPin: boolean;
  roles: string[];
  branchIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type OrgUserListResponse = {
  users: OrgUserDto[];
};

export type UserPermissionsResponse = {
  rolePermissions: string[];
  grants: string[];
  denies: string[];
  /** rolePermissions ∪ grants − denies */
  effective: string[];
};

export type ReplaceUserPermissionsRequest = {
  grants: string[];
  denies: string[];
};

export type AuditLogDto = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  beforeJson: unknown | null;
  afterJson: unknown | null;
  createdAt: string;
};

export type AuditLogListResponse = {
  logs: AuditLogDto[];
  limit: number;
};
