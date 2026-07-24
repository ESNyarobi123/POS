/**
 * Customer CRM contracts — Phase 1 list + detail.
 * Loyalty / store credit / warranty devices come in later phases.
 */

export type CustomerDto = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  /** ISO-8601 */
  createdAt: string;
  /** ISO-8601 */
  updatedAt: string;
};

export type CustomerListResponse = {
  items: CustomerDto[];
};

export type CustomerDetailDto = CustomerDto;

export type ListCustomersQuery = {
  q?: string;
  limit?: number;
};
