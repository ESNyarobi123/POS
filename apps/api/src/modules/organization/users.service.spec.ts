import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { RequestUser } from "../auth/types/request-user";
import { UsersService } from "./users.service";

jest.mock("@gulio/auth", () => ({
  hashPassword: jest.fn(async (value: string) => `hashed:${value}`),
}));

const ORG = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "22222222-2222-2222-2222-222222222222";
const CASHIER_ID = "33333333-3333-3333-3333-333333333333";
const MANAGER_ID = "44444444-4444-4444-4444-444444444444";
const ROLE_CASHIER = "55555555-5555-5555-5555-555555555555";
const ROLE_OWNER = "66666666-6666-6666-6666-666666666666";

function actor(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    userId: OWNER_ID,
    organizationId: ORG,
    email: "owner@guliosmart.local",
    roles: ["OWNER"],
    permissions: ["users.manage"],
    branchIds: ["b1"],
    ...overrides,
  };
}

function userRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-09-19T12:00:00.000Z");
  return {
    id: CASHIER_ID,
    organizationId: ORG,
    email: "cashier@guliosmart.local",
    fullName: "Cashier One",
    isActive: true,
    deletedAt: null,
    pinHash: null,
    createdAt: now,
    updatedAt: now,
    userRoles: [{ role: { code: "CASHIER" } }],
    userBranches: [{ branchId: "b1" }],
    ...overrides,
  };
}

describe("UsersService", () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: { findUnique: jest.fn() },
    branch: { findMany: jest.fn() },
    userRole: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    permission: { findMany: jest.fn() },
    userPermission: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const audit = { log: jest.fn() };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    service = new UsersService(
      prisma as never,
      audit as never,
    );
  });

  it("lists only non-deleted users", async () => {
    prisma.user.findMany.mockResolvedValue([userRow()]);
    const res = await service.list(actor());
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, deletedAt: null },
      }),
    );
    expect(res.users[0]).toMatchObject({
      email: "cashier@guliosmart.local",
      hasPin: false,
      roles: ["CASHIER"],
    });
  });

  it("returns one employee for view", async () => {
    prisma.user.findFirst.mockResolvedValue(userRow());
    const row = await service.getOne(actor(), CASHIER_ID);
    expect(row.id).toBe(CASHIER_ID);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CASHIER_ID, organizationId: ORG, deletedAt: null },
      }),
    );
  });

  it("lets an owner create another owner", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: ROLE_OWNER });
    prisma.user.create.mockResolvedValue(
      userRow({
        id: "77777777-7777-7777-7777-777777777777",
        email: "new.owner@guliosmart.local",
        fullName: "New Owner",
        userRoles: [{ role: { code: "OWNER" } }],
      }),
    );

    const created = await service.create(actor(), {
      email: "new.owner@guliosmart.local",
      fullName: "New Owner",
      password: "Password123!",
      roleCode: "OWNER",
    });

    expect(created.roles).toEqual(["OWNER"]);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new.owner@guliosmart.local",
          passwordHash: "hashed:Password123!",
        }),
      }),
    );
  });

  it("blocks a manager from assigning OWNER", async () => {
    await expect(
      service.create(
        actor({
          userId: MANAGER_ID,
          roles: ["MANAGER"],
          email: "manager@guliosmart.local",
        }),
        {
          email: "x@guliosmart.local",
          fullName: "X",
          password: "Password123!",
          roleCode: "OWNER",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects invalid role codes", async () => {
    await expect(
      service.create(actor(), {
        email: "x@guliosmart.local",
        fullName: "X",
        password: "Password123!",
        roleCode: "ADMIN" as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updates password and role on an employee", async () => {
    prisma.user.findFirst.mockResolvedValue(userRow());
    prisma.user.update.mockResolvedValue(
      userRow({ fullName: "Cashier Updated" }),
    );
    prisma.role.findUnique.mockResolvedValue({ id: ROLE_CASHIER });
    prisma.user.findUniqueOrThrow.mockResolvedValue(
      userRow({
        fullName: "Cashier Updated",
        userRoles: [{ role: { code: "MANAGER" } }],
      }),
    );

    const updated = await service.update(actor(), CASHIER_ID, {
      fullName: "Cashier Updated",
      password: "Newpass12",
      roleCode: "MANAGER",
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fullName: "Cashier Updated",
          passwordHash: "hashed:Newpass12",
        }),
      }),
    );
    expect(updated.roles).toEqual(["MANAGER"]);
  });

  it("conflicts when creating a duplicate email", async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    await expect(
      service.create(actor(), {
        email: "cashier@guliosmart.local",
        fullName: "Dup",
        password: "Password123!",
        roleCode: "CASHIER",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses to disable the last owner", async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRow({
        id: OWNER_ID,
        email: "owner@guliosmart.local",
        userRoles: [{ role: { code: "OWNER" } }],
      }),
    );
    prisma.userRole.findMany.mockResolvedValue([{ userId: OWNER_ID }]);

    await expect(
      service.lock(actor({ userId: "other-owner" }), OWNER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("soft-deletes a cashier and rewrites the email", async () => {
    prisma.user.findFirst.mockResolvedValue(userRow());
    prisma.user.update.mockResolvedValue(
      userRow({
        isActive: false,
        deletedAt: new Date(),
        email: `${CASHIER_ID.replace(/-/g, "")}@deleted.guliosmart.invalid`,
      }),
    );

    const deleted = await service.remove(actor(), CASHIER_ID);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
          email: `${CASHIER_ID.replace(/-/g, "")}@deleted.guliosmart.invalid`,
        }),
      }),
    );
    expect(deleted.isActive).toBe(false);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.delete" }),
    );
  });

  it("cannot delete your own account", async () => {
    await expect(service.remove(actor(), OWNER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("returns 404 for deleted users", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.lock(actor(), CASHIER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
