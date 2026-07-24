import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CustomerDetailDto,
  CustomerDto,
  CustomerListResponse,
} from "@gulio/contracts";
import { Prisma } from "@gulio/database";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapCustomer(row: CustomerRow): CustomerDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(
    organizationId: string,
    query: { q?: string; limit?: number },
  ): Promise<CustomerListResponse> {
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const q = query.q?.trim();

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
    });

    return { items: rows.map(mapCustomer) };
  }

  async getCustomerById(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerDetailDto> {
    const row = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!row) {
      throw new NotFoundException("Customer not found");
    }
    return mapCustomer(row);
  }
}
