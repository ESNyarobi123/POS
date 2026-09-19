import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatalogController } from "./catalog.controller";
import { CatalogImageController } from "./catalog-image.controller";
import { CatalogService } from "./catalog.service";
import { MediaService } from "./media.service";

@Module({
  imports: [AuthModule],
  controllers: [CatalogImageController, CatalogController],
  providers: [CatalogService, MediaService],
  exports: [CatalogService],
})
export class CatalogModule {}
