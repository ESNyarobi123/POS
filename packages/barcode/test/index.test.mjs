import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LABEL_QR_PREFIX,
  buildInternalCode128,
  buildLabelQrPayload,
  parseLabelQrPayload,
} from "../dist/index.js";

describe("buildInternalCode128", () => {
  it("prefixes sanitized SKU with GUL", () => {
    assert.equal(
      buildInternalCode128("apl-ip16-128-blk"),
      "GUL-APL-IP16-128-BLK",
    );
  });

  it("keeps existing GUL- prefix", () => {
    assert.equal(
      buildInternalCode128("GUL-A07-128-BLK-0001"),
      "GUL-A07-128-BLK-0001",
    );
  });

  it("sanitizes non-alphanumeric characters into hyphens", () => {
    assert.equal(buildInternalCode128("iphone 16 / 128"), "GUL-IPHONE-16-128");
  });

  it("collapses multiple hyphens", () => {
    assert.equal(buildInternalCode128("a07--128---blk"), "GUL-A07-128-BLK");
  });

  it("handles empty SKU", () => {
    assert.equal(buildInternalCode128(""), "GUL-UNKNOWN");
    assert.equal(buildInternalCode128("   "), "GUL-UNKNOWN");
    assert.equal(buildInternalCode128("---"), "GUL-UNKNOWN");
  });

  it("supports custom prefix", () => {
    assert.equal(buildInternalCode128("sku-1", "ACM"), "ACM-SKU-1");
  });
});

describe("label QR payload", () => {
  const variantId = "550e8400-e29b-41d4-a716-446655440000";

  it("exposes LABEL_QR_PREFIX", () => {
    assert.equal(LABEL_QR_PREFIX, "gulio:v:");
  });

  it("builds gulio:v payload without price", () => {
    const payload = buildLabelQrPayload(variantId);
    assert.equal(payload, `gulio:v:${variantId}`);
    assert.ok(!payload.toLowerCase().includes("price"));
  });

  it("parses valid gulio:v payload", () => {
    assert.deepEqual(parseLabelQrPayload(`gulio:v:${variantId}`), {
      variantId,
    });
  });

  it("parses legacy /p/{id} payloads", () => {
    assert.deepEqual(parseLabelQrPayload(`/p/${variantId}`), { variantId });
    assert.deepEqual(
      parseLabelQrPayload(`https://guliosmart.com/p/${variantId}?ref=label`),
      { variantId },
    );
  });

  it("rejects invalid payload", () => {
    assert.equal(parseLabelQrPayload("gulio:v:not-a-uuid"), null);
    assert.equal(parseLabelQrPayload("gulio:v:"), null);
    assert.equal(parseLabelQrPayload(""), null);
    assert.equal(parseLabelQrPayload("GUL-APL-IP16"), null);
  });
});
