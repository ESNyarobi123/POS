import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PosController } from "./pos.controller";
import { PosService } from "./pos.service";

@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
