import {
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { OpticEdgeChannelDto } from "@gulio/contracts";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  OpticEdgeClient,
  type OpticEdgeCashInRequest,
  type OpticEdgeCashInResult,
} from "./opticedge.client";
import {
  isOpticEdgeConfigured,
  parseStoredOpticEdgeSettings,
  type StoredOpticEdgeSettings,
} from "./opticedge.settings";

@Injectable()
export class OpticEdgeService {
  constructor(private readonly prisma: PrismaService) {}

  async loadStored(organizationId: string): Promise<StoredOpticEdgeSettings> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    return parseStoredOpticEdgeSettings(org?.settings);
  }

  requireLive(stored: StoredOpticEdgeSettings): void {
    if (!stored.enabled || !isOpticEdgeConfigured(stored)) {
      throw new ServiceUnavailableException({
        code: "OPTICEDGE_NOT_CONFIGURED",
        message:
          "Save OpticEdge APIs in Settings, then cashiers can pick a payment channel.",
      });
    }
  }

  client(stored: StoredOpticEdgeSettings): OpticEdgeClient {
    return new OpticEdgeClient({
      baseUrl: stored.baseUrl,
      apiToken: stored.apiToken,
    });
  }

  async listChannels(organizationId: string): Promise<OpticEdgeChannelDto[]> {
    const stored = await this.loadStored(organizationId);
    this.requireLive(stored);
    return this.client(stored).listChannels();
  }

  async createCashIn(
    stored: StoredOpticEdgeSettings,
    input: OpticEdgeCashInRequest,
  ): Promise<OpticEdgeCashInResult> {
    this.requireLive(stored);
    return this.client(stored).createCashIn(input);
  }
}
