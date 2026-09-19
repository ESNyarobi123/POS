import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard, RolesGuard],
})
export class AuthModule {}
