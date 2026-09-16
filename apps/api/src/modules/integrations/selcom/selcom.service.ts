import { Injectable } from "@nestjs/common";
import { Prisma } from "@gulio/database";
import { getEnv } from "@gulio/config";
import {
  encodeSelcomUrl,
  SelcomClient,
  SelcomTransportError,
  type SelcomJson,
} from "./selcom.client";
import {
  isSelcomConfigured,
  parseStoredSelcomSettings,
  type StoredSelcomSettings,
} from "./selcom.settings";

@Injectable()
export class SelcomService {
  clientFor(stored: StoredSelcomSettings): SelcomClient {
    if (!isSelcomConfigured(stored)) {
      throw new Error("Selcom is not configured");
    }
    return new SelcomClient({
      baseUrl: stored.baseUrl,
      apiKey: stored.apiKey,
      apiSecret: stored.apiSecret,
    });
  }

  checkoutUrls(stored: StoredSelcomSettings): {
    webhook: string;
    redirect: string;
    cancel: string;
  } {
    const env = getEnv();
    const api = env.API_URL.replace(/\/$/, "");
    const web = env.WEB_URL.split(",")[0]?.trim().replace(/\/$/, "") || api;
    return {
        webhook:
        stored.webhookUrl ||
        `${api}/payments/selcom/webhooks/checkout`,
      redirect:
        stored.redirectUrl || `${web}/pos/payment?method=mobile`,
      cancel: stored.cancelUrl || `${web}/pos/payment?method=mobile`,
    };
  }

  amountField(amount: Prisma.Decimal): string {
    return amount.toDecimalPlaces(0).toFixed(0);
  }

  async createOrderAndPush(input: {
    stored: StoredSelcomSettings;
    orderId: string;
    pushTransid: string;
    vendor: string;
    msisdn: string;
    amount: Prisma.Decimal;
    currency: string;
    buyerName: string;
    buyerEmail: string;
    itemCount: number;
    buyerRemarks: string;
    merchantRemarks: string;
  }): Promise<{
    order: SelcomJson;
    push: SelcomJson | null;
    transportUnknown: boolean;
  }> {
    const client = this.clientFor(input.stored);
    const urls = this.checkoutUrls(input.stored);
    const orderPayload = {
      vendor: input.vendor,
      order_id: input.orderId,
      buyer_email: input.buyerEmail,
      buyer_name: input.buyerName,
      buyer_phone: input.msisdn,
      amount: Number(this.amountField(input.amount)),
      currency: input.currency,
      redirect_url: encodeSelcomUrl(urls.redirect),
      cancel_url: encodeSelcomUrl(urls.cancel),
      webhook: encodeSelcomUrl(urls.webhook),
      buyer_remarks: input.buyerRemarks,
      merchant_remarks: input.merchantRemarks,
      no_of_items: input.itemCount,
    };

    try {
      const order = await client.createMinimalOrder(orderPayload);
      if (String(order.resultcode) !== "000") {
        return { order, push: null, transportUnknown: false };
      }
      const push = await client.walletPayment({
        transid: input.pushTransid,
        orderId: input.orderId,
        msisdn: input.msisdn,
      });
      return { order, push, transportUnknown: false };
    } catch (err) {
      if (err instanceof SelcomTransportError) {
        return { order: { message: err.message }, push: null, transportUnknown: true };
      }
      throw err;
    }
  }

  async queryOrder(
    stored: StoredSelcomSettings,
    orderId: string,
  ): Promise<SelcomJson> {
    return this.clientFor(stored).orderStatus(orderId);
  }
}

export function parseStoredFromOrgSettings(settings: unknown): StoredSelcomSettings {
  return parseStoredSelcomSettings(settings);
}
