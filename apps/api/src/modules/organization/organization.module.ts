import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuthModule],
  controllers: [OrganizationController, UsersController],
  providers: [OrganizationService, UsersService],
  exports: [OrganizationService, UsersService],
})
export class OrganizationModule {}
