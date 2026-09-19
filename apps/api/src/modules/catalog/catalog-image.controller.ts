import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { FastifyReply } from "fastify";
import { PermissionCode } from "@gulio/contracts";
import type {
  UploadCatalogImageRequest,
  UploadCatalogImageResponse,
} from "@gulio/contracts";
import { randomUUID } from "node:crypto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import type { RequestUser } from "../auth/types/request-user";
import { publicMediaUrl } from "./catalog-image";
import { CatalogService } from "./catalog.service";
import { MediaService } from "./media.service";

@Controller("catalog")
export class CatalogImageController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly media: MediaService,
  ) {}

  @Post("media")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PermissionCode.CATALOG_MANAGE)
  async upload(
    @CurrentUser() _user: RequestUser,
    @Body() body: UploadCatalogImageRequest,
  ): Promise<UploadCatalogImageResponse> {
    const image = body?.image?.trim();
    if (!image) {
      throw new BadRequestException("image is required");
    }
    const id = randomUUID();
    const key = `media/${id}.webp`;
    try {
      const source = await this.media.loadSource(image);
      const webp = await this.media.toWebp(source);
      await this.media.putCached(key, webp);
    } catch {
      throw new BadRequestException("Could not read that image");
    }
    return { url: publicMediaUrl(id) };
  }

  @SkipThrottle()
  @Get("media/:id")
  async getMedia(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const cached = await this.media.getCached(`media/${id}.webp`);
    if (!cached) {
      throw new NotFoundException("Image not found");
    }
    return this.file(reply, cached);
  }

  @SkipThrottle()
  @Get("products/:id/image")
  async productImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const prepared = await this.catalog.streamProductImage(id);
    return this.file(reply, prepared.buffer);
  }

  @SkipThrottle()
  @Get("variants/:id/image")
  async variantImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const prepared = await this.catalog.streamVariantImage(id);
    return this.file(reply, prepared.buffer);
  }

  private file(reply: FastifyReply, buffer: Buffer): StreamableFile {
    reply.header(
      "Cache-Control",
      "public, max-age=604800, stale-while-revalidate=86400",
    );
    reply.header("Cross-Origin-Resource-Policy", "cross-origin");
    return new StreamableFile(buffer, {
      type: "image/webp",
      disposition: "inline",
    });
  }
}
