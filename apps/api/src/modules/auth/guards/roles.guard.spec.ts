import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { RolesGuard } from "./roles.guard";

function contextWithUser(roles: string[] | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: roles ? { roles } : undefined,
      }),
    }),
  };
}

describe("RolesGuard", () => {
  it("allows when no roles are required", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(contextWithUser(["CASHIER"]) as never)).toBe(true);
  });

  it("allows OWNER when OWNER is required", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["OWNER"]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(contextWithUser(["owner"]) as never)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it("rejects MANAGER when OWNER is required", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["OWNER"]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(() =>
      guard.canActivate(contextWithUser(["MANAGER"]) as never),
    ).toThrow(ForbiddenException);
  });
});
