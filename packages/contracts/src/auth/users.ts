/** Assignable employee roles via users.manage APIs (not OWNER create). */
export type AssignableRoleCode = "CASHIER" | "MANAGER";

export type CreateUserRequest = {
  email: string;
  fullName: string;
  password: string;
  roleCode: AssignableRoleCode;
};

export type UpdateUserRequest = {
  email?: string;
  fullName?: string;
  roleCode?: AssignableRoleCode;
};

export type OrgUserDto = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
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
