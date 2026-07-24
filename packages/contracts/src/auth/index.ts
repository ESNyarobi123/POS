export type {
  AssignableRoleCode,
  CreateUserRequest,
  UpdateUserRequest,
  OrgUserDto,
  OrgUserListResponse,
  UserPermissionsResponse,
  ReplaceUserPermissionsRequest,
  AuditLogDto,
  AuditLogListResponse,
} from "./users";

/** Permission codes used by backend guards and seed roles. */
export const PermissionCode = {
  ORG_MANAGE: "org.manage",
  REGISTERS_MANAGE: "registers.manage",
  USERS_MANAGE: "users.manage",
  AUDIT_VIEW: "audit.view",
  SHIFT_OPEN_OWN: "shift.open_own",
  SHIFT_OPEN_ANY: "shift.open_any",
  POS_SELL: "pos.sell",
  POS_DISCOUNT: "pos.discount",
  POS_PRICE_OVERRIDE: "pos.price_override",
  POS_HOLD: "pos.hold",
  POS_VOID: "pos.void",
  POS_RETURN: "pos.return",
  POS_LARGE_REFUND: "pos.large_refund",
  POS_DRAWER_OPEN: "pos.drawer_open",
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",
  CATALOG_IMPORT: "catalog.import",
  LABELS_PRINT: "labels.print",
  STOCK_VIEW: "stock.view",
  STOCK_ADJUST: "stock.adjust",
  STOCK_SERIAL_FIX: "stock.serial_fix",
  STOCK_COUNT: "stock.count",
  CUSTOMERS_MANAGE: "customers.manage",
  REPORTS_VIEW: "reports.view",
  SETTINGS_MANAGE: "settings.manage",
} as const;

export type PermissionCode =
  (typeof PermissionCode)[keyof typeof PermissionCode];

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthUserDto = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  branchIds: string[];
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUserDto;
};

export type MeResponse = {
  user: AuthUserDto;
  organization: {
    id: string;
    name: string;
    slug: string;
    currencyCode: string;
    timezone: string;
  };
  branches: Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  }>;
  permissions: string[];
};

export type OrganizationContextResponse = {
  organization: {
    id: string;
    name: string;
    slug: string;
    currencyCode: string;
    timezone: string;
  };
  branches: Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  }>;
  warehouses: Array<{
    id: string;
    branchId: string;
    name: string;
    isDefault: boolean;
  }>;
  registers: Array<{
    id: string;
    branchId: string;
    name: string;
    code: string;
    isActive: boolean;
  }>;
};
