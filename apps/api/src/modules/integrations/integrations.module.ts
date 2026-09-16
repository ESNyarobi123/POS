import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { OpticEdgeService } from "./opticedge/opticedge.service";
import { SelcomService } from "./selcom/selcom.service";

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, SelcomService, OpticEdgeService],
  exports: [IntegrationsService, SelcomService, OpticEdgeService],
})
export class IntegrationsModule {}
