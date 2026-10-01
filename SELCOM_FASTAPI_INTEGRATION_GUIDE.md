# Selcom Integration Guide for Python FastAPI

> **Scope:** Collections (Checkout + C2B), mobile-wallet payouts, bank payouts (Qwiksend), balance checks, callbacks/webhooks, payment-status queries, authentication, security, idempotency, reconciliation, and production readiness.
>
> **Verified against:** Selcom public documentation and official/public GitHub repositories on **2026-09-13**.

## 1. Executive recommendation

For a WiFi billing platform such as WoteFy or Lubfy, use this primary flow:

1. Create a local payment record with a unique `order_id`.
2. Call `POST /v1/checkout/create-order-minimal`.
3. For an in-app mobile-money prompt, call `POST /v1/checkout/wallet-payment` using the same `order_id`.
4. Keep the local transaction as `PENDING`; a successful push response only means the prompt was initiated.
5. Confirm payment from the signed Checkout webhook.
6. If the webhook is missing, query `GET /v1/checkout/order-status`.
7. Activate the WiFi package only after Selcom reports `payment_status=COMPLETED` and your server verifies `order_id`, currency, and amount.

For payouts:

- Mobile wallets: `POST /v1/walletcashin/process`.
- Bank accounts: `POST /v1/qwiksend/process`.
- Always perform name/account lookup where the destination supports it.
- Store a payout request before calling Selcom, use a unique `transid`, and never automatically repeat an uncertain payout.
- Query unresolved payouts after Selcom's recommended waiting interval.

## 2. Important findings from the documentation and repositories

### 2.1 Two Selcom GitHub organizations appear in the sources

The GitHub organization supplied for this review, [`selcom-developers`](https://github.com/selcom-developers), currently exposes these relevant public repositories:

- [`node-selcom`](https://github.com/selcom-developers/node-selcom)
- [`selcom-developers.github.io`](https://github.com/selcom-developers/selcom-developers.github.io)
- `laravel-selcom`
- `demo-laravel-selcom`

The current Selcom API reference links its Python package to another Selcom organization:

- [`selcompaytechltd/selcom-apigw-client-python`](https://github.com/selcompaytechltd/selcom-apigw-client-python)

The Python package can be installed with:

```bash
pip install selcom_apigw_client
```

### 2.2 Use the current API reference as the authority

There is a conflict in old sample code: `node-selcom/app.ts` converts the API key to **hex**, while the current API reference and official Python client use:

```text
Authorization: SELCOM <Base64(API_KEY)>
```

Use Base64. Do not copy the hex authorization line from the old Node example.

### 2.3 Selcom does not publish the real base URL in the public examples

The public reference uses `http://example.com`. Obtain the exact sandbox/UAT and production base URLs from Selcom during onboarding. Never guess them.

Ask Selcom for:

- Sandbox/UAT base URL
- Production base URL
- API key and API secret
- Merchant/vendor ID
- Float account vendor and PIN for payout products
- Enabled payment methods and wallet operators
- Checkout webhook configuration requirements
- C2B callback Bearer token
- Source IP ranges, if Selcom supports IP allowlisting
- Minimum/maximum amounts, fees, settlement schedule, and payout limits
- Products enabled on your merchant profile: Checkout, C2B Push USSD, Wallet Cashin, Qwiksend, and Float Balance

Public documentation directs merchants to contact Selcom for credentials. Relevant addresses shown in the documentation are `support@selcom.net`, `info@selcom.net`, and `helpdesk@selcom.net`.

### 2.4 The exact link supplied is not the Checkout status endpoint

The `#query-payment-status` anchor supplied for this review belongs to Selcom's **Utility Payments/Bill Pay** product. It documents:

```text
GET /v1/utilitypayment/query?transid=<TRANSID>
```

That endpoint queries payments your business sends to a utility/biller such as electricity or TV. It does **not** query a customer's WiFi-package collection. For a WiFi-package Checkout order, use:

```text
GET /v1/checkout/order-status?order_id=<ORDER_ID>
```

For a direct C2B collection, use:

```text
GET /v1/c2b/query-status
```

## 3. Product map

| Business need | Selcom product | Endpoint(s) | Direction |
| --- | --- | --- | --- |
| Create hosted/mobile-money order | Checkout | `/v1/checkout/create-order-minimal` | Your API → Selcom |
| Create full checkout, including card support | Checkout | `/v1/checkout/create-order` | Your API → Selcom |
| Trigger mobile-wallet prompt for an order | Checkout | `/v1/checkout/wallet-payment` | Your API → Selcom |
| Query checkout order | Checkout | `/v1/checkout/order-status` | Your API → Selcom |
| Receive successful Checkout result | Checkout webhook | Your HTTPS webhook URL | Selcom → Your API |
| Direct wallet prompt/C2B collection | C2B | `/v1/wallet/pushussd` | Your API → Selcom |
| Query direct C2B collection | C2B | `/v1/c2b/query-status` | Your API → Selcom |
| Validate/receive C2B payment | C2B callbacks | `/lookup`, `/validation`, `/notification` on your API | Selcom → Your API |
| Pay a mobile wallet | Wallet Cashin | `/v1/walletcashin/process` | Your API → Selcom |
| Resolve wallet holder name | Wallet Cashin | `/v1/walletcashin/namelookup` | Your API → Selcom |
| Query wallet payout | Wallet Cashin | `/v1/walletcashin/query` | Your API → Selcom |
| Pay a bank account | Qwiksend | `/v1/qwiksend/process` | Your API → Selcom |
| Resolve bank account name | Qwiksend | `/v1/qwiksend/lookup` | Your API → Selcom |
| Query bank payout | Qwiksend | `/v1/qwiksend/query` | Your API → Selcom |
| Check payout float | Float Account | `/v1/vendor/balance` | Your API → Selcom |

## 4. Authentication for outbound API calls

Every outbound request must include:

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |
| `Authorization` | `SELCOM <Base64(API_KEY)>` |
| `Digest-Method` | `HS256` for HMAC-SHA256 |
| `Digest` | Base64-encoded HMAC-SHA256 signature |
| `Timestamp` | ISO 8601 timestamp used in the signature |
| `Signed-Fields` | Comma-separated field names, in signing order |

### 4.1 Signing algorithm

Given the timestamp and ordered signed fields, create:

```text
timestamp=<TIMESTAMP>&field1=<value1>&field2=<value2>
```

Then compute:

```text
Digest = Base64(HMAC_SHA256(signing_string, API_SECRET))
```

Rules:

- `timestamp` is always first and is not included in `Signed-Fields`.
- Field order must exactly match `Signed-Fields`.
- Field names and values are case-sensitive.
- Do not add spaces or URL-encode the signing string.
- Values in the signing string must match values sent in the request.
- Do not alphabetically reorder fields unless the payload and `Signed-Fields` are intentionally created in that order.
- Keep the server clock synchronized with NTP.

## 5. FastAPI project setup

### 5.1 Dependencies

```text
fastapi>=0.115
uvicorn[standard]>=0.30
httpx>=0.27
pydantic>=2.8
pydantic-settings>=2.4
python-dotenv>=1.0
```

Install:

```bash
pip install fastapi 'uvicorn[standard]' httpx pydantic pydantic-settings python-dotenv
```

### 5.2 Environment variables

```dotenv
# Selcom supplies this URL. Public docs intentionally show a placeholder.
SELCOM_BASE_URL=https://SELcom-sandbox-or-production-host

SELCOM_API_KEY=replace_me
SELCOM_API_SECRET=replace_me
SELCOM_MERCHANT_ID=replace_me

# Required only for products that debit a payout/utility float account.
SELCOM_FLOAT_VENDOR=replace_me
SELCOM_FLOAT_PIN=replace_me

# A strong random token agreed/configured for inbound C2B callbacks.
SELCOM_C2B_BEARER_TOKEN=replace_with_at_least_32_random_bytes

SELCOM_WEBHOOK_URL=https://api.example.com/api/v1/selcom/webhooks/checkout
SELCOM_REDIRECT_URL=https://example.com/payments/success
SELCOM_CANCEL_URL=https://example.com/payments/cancel
```

Security rules:

- Never commit `.env` or credentials to Git.
- Store secrets in the deployment secret manager.
- Do not log the API secret, float PIN, full authorization header, digest, or customer PIN.
- Use separate sandbox and production credentials.

## 6. Async Selcom client for FastAPI

The client below implements the current HS256 rules without depending on the synchronous official package. It is suitable for FastAPI because it uses `httpx.AsyncClient`.

```python
# app/integrations/selcom/client.py
from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable, Mapping

import httpx


EAT = timezone(timedelta(hours=3))


class SelcomTransportError(RuntimeError):
    """Network, timeout, invalid JSON, or HTTP-level failure."""


class SelcomBusinessError(RuntimeError):
    """Definite business rejection returned by Selcom."""

    def __init__(self, response: dict[str, Any]):
        self.response = response
        super().__init__(response.get("message") or "Selcom request failed")


def _selcom_string(value: Any) -> str:
    if isinstance(value, Decimal):
        # Avoid scientific notation and an unnecessary trailing decimal point.
        return format(value, "f")
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


class SelcomClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        api_secret: str,
        timeout_seconds: float = 30.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.api_secret = api_secret
        self.timeout = httpx.Timeout(timeout_seconds, connect=10.0)

    def _headers(
        self,
        payload: Mapping[str, Any],
        signed_fields: Iterable[str],
        *,
        timestamp: str | None = None,
    ) -> dict[str, str]:
        fields = list(signed_fields)
        timestamp = timestamp or datetime.now(EAT).isoformat(timespec="seconds")

        missing = [field for field in fields if field not in payload]
        if missing:
            raise ValueError(f"Missing signed fields: {missing}")

        signing_string = "timestamp=" + timestamp
        for field in fields:
            signing_string += f"&{field}={_selcom_string(payload[field])}"

        digest = base64.b64encode(
            hmac.new(
                self.api_secret.encode("utf-8"),
                signing_string.encode("utf-8"),
                hashlib.sha256,
            ).digest()
        ).decode("ascii")

        encoded_key = base64.b64encode(
            self.api_key.encode("ascii")
        ).decode("ascii")

        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"SELCOM {encoded_key}",
            "Digest-Method": "HS256",
            "Digest": digest,
            "Timestamp": timestamp,
            "Signed-Fields": ",".join(fields),
        }

    async def request(
        self,
        method: str,
        path: str,
        payload: Mapping[str, Any],
        signed_fields: Iterable[str] | None = None,
    ) -> dict[str, Any]:
        # Explicit field lists are recommended. Dict order is used only as fallback.
        fields = list(signed_fields or payload.keys())
        headers = self._headers(payload, fields)
        url = f"{self.base_url}{path}"

        kwargs: dict[str, Any] = {"headers": headers}
        if method.upper() in {"GET", "DELETE"}:
            kwargs["params"] = payload
        else:
            kwargs["json"] = payload

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(method.upper(), url, **kwargs)
                response.raise_for_status()
                body = response.json()
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            # Outcome can be unknown. Do not blindly repeat POST payout requests.
            raise SelcomTransportError("Selcom request outcome is unknown") from exc
        except httpx.HTTPStatusError as exc:
            raise SelcomTransportError(
                f"Selcom HTTP error: {exc.response.status_code}"
            ) from exc
        except ValueError as exc:
            raise SelcomTransportError("Selcom returned invalid JSON") from exc

        if not isinstance(body, dict):
            raise SelcomTransportError("Unexpected Selcom response shape")
        return body

    # ---------- Checkout collections ----------

    async def create_minimal_order(self, data: Mapping[str, Any]) -> dict[str, Any]:
        fields = [
            "vendor", "order_id", "buyer_email", "buyer_name", "buyer_phone",
            "amount", "currency", "redirect_url", "cancel_url", "webhook",
            "buyer_remarks", "merchant_remarks", "no_of_items",
        ]
        # Colour fields may be added at the end and included in fields when used.
        return await self.request(
            "POST", "/v1/checkout/create-order-minimal", data, fields
        )

    async def wallet_payment(
        self, *, transid: str, order_id: str, msisdn: str
    ) -> dict[str, Any]:
        data = {"transid": transid, "order_id": order_id, "msisdn": msisdn}
        return await self.request(
            "POST",
            "/v1/checkout/wallet-payment",
            data,
            ["transid", "order_id", "msisdn"],
        )

    async def order_status(self, order_id: str) -> dict[str, Any]:
        data = {"order_id": order_id}
        return await self.request(
            "GET", "/v1/checkout/order-status", data, ["order_id"]
        )

    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        data = {"order_id": order_id}
        return await self.request(
            "DELETE", "/v1/checkout/cancel-order", data, ["order_id"]
        )

    # ---------- Direct C2B collection ----------

    async def push_ussd(
        self,
        *,
        transid: str,
        utilityref: str,
        amount: int | Decimal,
        vendor: str,
        msisdn: str,
    ) -> dict[str, Any]:
        data = {
            "transid": transid,
            "utilityref": utilityref,
            "amount": amount,
            "vendor": vendor,
            "msisdn": msisdn,
        }
        return await self.request(
            "POST",
            "/v1/wallet/pushussd",
            data,
            ["transid", "utilityref", "amount", "vendor", "msisdn"],
        )

    async def c2b_status(
        self, *, transid: str | None = None, reference: str | None = None
    ) -> dict[str, Any]:
        if bool(transid) == bool(reference):
            raise ValueError("Provide exactly one of transid or reference")
        data = {"transid": transid} if transid else {"reference": reference}
        return await self.request("GET", "/v1/c2b/query-status", data)

    # ---------- Mobile-wallet payouts ----------

    async def wallet_name_lookup(
        self, *, utilitycode: str, utilityref: str, transid: str
    ) -> dict[str, Any]:
        data = {
            "utilitycode": utilitycode,
            "utilityref": utilityref,
            "transid": transid,
        }
        return await self.request(
            "GET",
            "/v1/walletcashin/namelookup",
            data,
            ["utilitycode", "utilityref", "transid"],
        )

    async def wallet_payout(
        self,
        *,
        transid: str,
        utilitycode: str,
        utilityref: str,
        amount: int | Decimal,
        vendor: str,
        pin: str,
        msisdn: str | None = None,
    ) -> dict[str, Any]:
        data: dict[str, Any] = {
            "transid": transid,
            "utilitycode": utilitycode,
            "utilityref": utilityref,
            "amount": amount,
            "vendor": vendor,
            "pin": pin,
        }
        fields = [
            "transid", "utilitycode", "utilityref", "amount", "vendor", "pin"
        ]
        if msisdn:
            data["msisdn"] = msisdn
            fields.append("msisdn")

        return await self.request(
            "POST", "/v1/walletcashin/process", data, fields
        )

    async def wallet_payout_status(self, transid: str) -> dict[str, Any]:
        data = {"transid": transid}
        return await self.request(
            "GET", "/v1/walletcashin/query", data, ["transid"]
        )

    # ---------- Bank payouts / Qwiksend ----------

    async def bank_name_lookup(
        self, *, bank: str, account: str, transid: str
    ) -> dict[str, Any]:
        data = {"bank": bank, "account": account, "transid": transid}
        return await self.request(
            "GET",
            "/v1/qwiksend/lookup",
            data,
            ["bank", "account", "transid"],
        )

    async def bank_payout(
        self,
        *,
        transid: str,
        recipient_fi_code: str,
        recipient_account: str,
        recipient_name: str,
        sender_account: str,
        sender_name: str,
        amount: int | Decimal,
        vendor: str,
        pin: str,
        msisdn: str,
        purpose: str,
        remarks: str | None = None,
    ) -> dict[str, Any]:
        data: dict[str, Any] = {
            "transid": transid,
            "recipientFiCode": recipient_fi_code,
            "recipientAccount": recipient_account,
            "recipientName": recipient_name,
            "senderAccount": sender_account,
            "senderName": sender_name,
            "amount": amount,
            "vendor": vendor,
            "pin": pin,
            "msisdn": msisdn,
            "purpose": purpose,
        }
        fields = [
            "transid", "recipientFiCode", "recipientAccount", "recipientName",
            "senderAccount", "senderName", "amount", "vendor", "pin", "msisdn",
            "purpose",
        ]
        if remarks is not None:
            data["remarks"] = remarks
            fields.append("remarks")

        return await self.request("POST", "/v1/qwiksend/process", data, fields)

    async def bank_payout_status(self, transid: str) -> dict[str, Any]:
        data = {"transid": transid}
        return await self.request(
            "GET", "/v1/qwiksend/query", data, ["transid"]
        )

    # ---------- Float ----------

    async def float_balance(
        self, *, vendor: str, pin: str, transid: str
    ) -> dict[str, Any]:
        data = {"vendor": vendor, "pin": pin, "transid": transid}
        # The current docs label this as POST, despite an old SDK sample using GET.
        return await self.request(
            "POST", "/v1/vendor/balance", data, ["vendor", "pin", "transid"]
        )

    # ---------- Optional utility/bill payments ----------

    async def utility_lookup(
        self, *, utilitycode: str, utilityref: str, transid: str
    ) -> dict[str, Any]:
        data = {
            "utilitycode": utilitycode,
            "utilityref": utilityref,
            "transid": transid,
        }
        return await self.request(
            "GET",
            "/v1/utilitypayment/lookup",
            data,
            ["utilitycode", "utilityref", "transid"],
        )

    async def utility_payment(
        self,
        *,
        transid: str,
        utilitycode: str,
        utilityref: str,
        amount: int | Decimal,
        vendor: str,
        pin: str,
        msisdn: str | None = None,
    ) -> dict[str, Any]:
        data: dict[str, Any] = {
            "transid": transid,
            "utilitycode": utilitycode,
            "utilityref": utilityref,
            "amount": amount,
            "vendor": vendor,
            "pin": pin,
        }
        fields = [
            "transid", "utilitycode", "utilityref", "amount", "vendor", "pin"
        ]
        if msisdn:
            data["msisdn"] = msisdn
            fields.append("msisdn")
        return await self.request(
            "POST", "/v1/utilitypayment/process", data, fields
        )

    async def utility_payment_status(self, transid: str) -> dict[str, Any]:
        data = {"transid": transid}
        return await self.request(
            "GET", "/v1/utilitypayment/query", data, ["transid"]
        )
```

### 6.1 Why the field lists are explicit

The Selcom signature depends on field order. Explicit lists make the signed order visible during code review and prevent an innocent refactor from changing the digest.

The public Qwiksend curl example contains an apparent typo, `srecipientFiCode`. The payload table and language examples consistently use `recipientFiCode`; this guide uses `recipientFiCode`. Confirm the signed-field list with Selcom during UAT.

## 7. Configuration and dependency injection

```python
# app/config.py
from functools import lru_cache

from pydantic import AnyHttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    selcom_base_url: AnyHttpUrl
    selcom_api_key: SecretStr
    selcom_api_secret: SecretStr
    selcom_merchant_id: str
    selcom_float_vendor: str | None = None
    selcom_float_pin: SecretStr | None = None
    selcom_c2b_bearer_token: SecretStr
    selcom_webhook_url: AnyHttpUrl
    selcom_redirect_url: AnyHttpUrl
    selcom_cancel_url: AnyHttpUrl


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

```python
# app/integrations/selcom/dependencies.py
from app.config import get_settings
from app.integrations.selcom.client import SelcomClient


def get_selcom_client() -> SelcomClient:
    settings = get_settings()
    return SelcomClient(
        base_url=str(settings.selcom_base_url).rstrip("/"),
        api_key=settings.selcom_api_key.get_secret_value(),
        api_secret=settings.selcom_api_secret.get_secret_value(),
    )
```

## 8. Utility helpers

### 8.1 Normalize Tanzanian phone numbers

```python
import re


def normalize_tz_msisdn(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if digits.startswith("0") and len(digits) == 10:
        digits = "255" + digits[1:]
    elif digits.startswith("255") and len(digits) == 12:
        pass
    else:
        raise ValueError("Use a valid Tanzanian number, e.g. 0712345678")
    return digits
```

Do not select a payout operator only from the visible phone prefix because mobile-number portability may make it wrong. If Selcom has enabled automatic routing, `CASHIN` is documented as the generic wallet cashin utility code.

### 8.2 Base64-encode Checkout URLs

Selcom states that Checkout URLs in the request and response are Base64-encoded.

```python
import base64


def b64_url(url: str) -> str:
    return base64.b64encode(url.encode("utf-8")).decode("ascii")


def decode_b64_url(value: str) -> str:
    return base64.b64decode(value).decode("utf-8")
```

## 9. Collection flow A: Checkout Minimal + Wallet Pull

This is the recommended app/payment-page flow for WiFi packages because the order has a stable `order_id` and Checkout provides a dedicated status endpoint.

### 9.1 Request models

```python
# app/api/schemas/payments.py
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field


class StartPaymentRequest(BaseModel):
    package_id: str
    phone: str
    buyer_name: str = Field(min_length=2, max_length=120)
    buyer_email: EmailStr


class StartPaymentResponse(BaseModel):
    order_id: str
    status: str
    message: str
```

### 9.2 Start the payment

The price must be loaded from your database. Never accept the amount sent by a browser as authoritative.

```python
# app/api/routes/selcom_payments.py
from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import Settings, get_settings
from app.integrations.selcom.client import SelcomClient, SelcomTransportError
from app.integrations.selcom.dependencies import get_selcom_client


router = APIRouter(prefix="/api/v1/payments/selcom", tags=["Selcom"])


@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
async def start_payment(
    body: StartPaymentRequest,
    selcom: SelcomClient = Depends(get_selcom_client),
    settings: Settings = Depends(get_settings),
):
    phone = normalize_tz_msisdn(body.phone)

    # Replace this with a SELECT from your package table.
    package = await package_repo.get_active(body.package_id)
    if package is None:
        raise HTTPException(404, "Package not found")

    amount = Decimal(package.price_tzs)
    if amount <= 0:
        raise HTTPException(422, "Invalid package amount")

    order_id = f"WFY-{uuid4().hex[:20].upper()}"
    push_transid = f"PUSH-{uuid4().hex[:18].upper()}"

    # Persist before the external request. order_id and push_transid need UNIQUE indexes.
    await payment_repo.create_pending(
        order_id=order_id,
        push_transid=push_transid,
        package_id=package.id,
        phone=phone,
        amount=amount,
        currency="TZS",
    )

    order_payload = {
        "vendor": settings.selcom_merchant_id,
        "order_id": order_id,
        "buyer_email": str(body.buyer_email),
        "buyer_name": body.buyer_name,
        "buyer_phone": phone,
        "amount": amount,
        "currency": "TZS",
        "redirect_url": b64_url(str(settings.selcom_redirect_url)),
        "cancel_url": b64_url(str(settings.selcom_cancel_url)),
        "webhook": b64_url(str(settings.selcom_webhook_url)),
        "buyer_remarks": f"WiFi package {package.name}",
        "merchant_remarks": f"Package {package.id}",
        "no_of_items": 1,
    }

    try:
        order_response = await selcom.create_minimal_order(order_payload)
        await payment_repo.record_provider_response(order_id, "create", order_response)

        if order_response.get("resultcode") != "000":
            await payment_repo.mark_failed(order_id, order_response)
            raise HTTPException(502, order_response.get("message", "Order rejected"))

        push_response = await selcom.wallet_payment(
            transid=push_transid,
            order_id=order_id,
            msisdn=phone,
        )
        await payment_repo.record_provider_response(order_id, "push", push_response)
    except SelcomTransportError:
        # The outcome can be unknown. Reconciliation must query the order.
        await payment_repo.mark_reconciliation_required(order_id)
        return {
            "order_id": order_id,
            "status": "PENDING",
            "message": "Payment request submitted; checking status",
        }

    # resultcode 111 commonly means the request is in progress.
    return {
        "order_id": order_id,
        "status": "PENDING",
        "message": push_response.get("message", "Approve payment on your phone"),
    }
```

### 9.3 Do not activate service from the redirect URL

The browser redirect is only UX. A malicious user can open it manually. Activate a WiFi package only after your backend has confirmed a `COMPLETED` payment through a verified webhook or a signed status-query response.

## 10. Checkout webhook in FastAPI

Selcom's Checkout documentation shows an HMAC-signed callback and notes that the Checkout webhook is sent only for successful transactions. Therefore:

- Verify its signature.
- Make processing idempotent.
- Query pending orders to discover cancelled, rejected, or missing callbacks.
- Return quickly after durably storing the callback.

### 10.1 Verify the Checkout webhook signature

```python
# app/integrations/selcom/webhook_security.py
from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any, Mapping

from app.integrations.selcom.client import _selcom_string


ALLOWED_CHECKOUT_SIGNED_FIELDS = {
    "transid",
    "order_id",
    "reference",
    "result",
    "resultcode",
    "payment_status",
    "channel",
    "amount",
    "phone",
}


def verify_selcom_hmac(
    *,
    payload: Mapping[str, Any],
    api_secret: str,
    timestamp: str,
    digest: str,
    signed_fields_header: str,
    max_age_seconds: int = 300,
) -> bool:
    fields = [part.strip() for part in signed_fields_header.split(",") if part.strip()]
    if not fields or len(fields) != len(set(fields)):
        return False
    if not set(fields).issubset(ALLOWED_CHECKOUT_SIGNED_FIELDS):
        return False
    if any(field not in payload for field in fields):
        return False

    try:
        parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return False
        age = abs((datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds())
        if age > max_age_seconds:
            return False
    except ValueError:
        return False

    signing_string = "timestamp=" + timestamp
    for field in fields:
        signing_string += f"&{field}={_selcom_string(payload[field])}"

    expected = base64.b64encode(
        hmac.new(
            api_secret.encode("utf-8"),
            signing_string.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    ).decode("ascii")

    return hmac.compare_digest(expected, digest)
```

If Selcom provides a callback-specific secret or a different UAT signature rule, use the credential/rule confirmed during onboarding rather than assuming the outbound API secret.

### 10.2 Webhook endpoint

```python
import base64
import hmac
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, Request


@router.post("/webhooks/checkout")
async def checkout_webhook(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    digest: Annotated[str | None, Header()] = None,
    timestamp: Annotated[str | None, Header()] = None,
    signed_fields: Annotated[str | None, Header(alias="Signed-Fields")] = None,
):
    settings = get_settings()

    try:
        payload: dict[str, Any] = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON") from exc

    required_headers = [authorization, digest, timestamp, signed_fields]
    if any(value is None for value in required_headers):
        raise HTTPException(401, "Missing Selcom signature headers")

    expected_auth = "SELCOM " + base64.b64encode(
        settings.selcom_api_key.get_secret_value().encode("ascii")
    ).decode("ascii")
    if not hmac.compare_digest(authorization, expected_auth):
        raise HTTPException(401, "Invalid authorization")

    valid = verify_selcom_hmac(
        payload=payload,
        api_secret=settings.selcom_api_secret.get_secret_value(),
        timestamp=timestamp,
        digest=digest,
        signed_fields_header=signed_fields,
    )
    if not valid:
        raise HTTPException(401, "Invalid signature")

    order_id = str(payload.get("order_id", ""))
    reference = str(payload.get("reference", ""))
    if not order_id or not reference:
        raise HTTPException(422, "Missing transaction identity")

    # Atomic insert with UNIQUE(provider, reference) and UNIQUE(provider, order_id,
    # event_type). A duplicate callback should return 200 without double fulfillment.
    inserted = await webhook_repo.insert_once(
        provider="selcom",
        external_event_id=reference,
        event_type="checkout.payment",
        payload=payload,
    )
    if not inserted:
        return {"resultcode": "000", "result": "SUCCESS", "message": "Duplicate accepted"}

    payment = await payment_repo.get_for_update(order_id)
    if payment is None:
        await webhook_repo.flag_unmatched(reference)
        # Return success to stop a retry storm; alert operations for reconciliation.
        return {"resultcode": "000", "result": "SUCCESS", "message": "Accepted"}

    if Decimal(str(payload.get("amount"))) != payment.amount:
        await webhook_repo.flag_amount_mismatch(reference)
        raise HTTPException(409, "Amount mismatch")

    if payload.get("payment_status") == "COMPLETED" and payload.get("resultcode") == "000":
        changed = await payment_repo.mark_completed_once(
            order_id=order_id,
            provider_reference=reference,
            provider_transid=str(payload.get("transid", "")),
            channel=str(payload.get("channel", "")),
        )
        if changed:
            # Put fulfillment on an outbox/queue. It must also be idempotent.
            await outbox_repo.enqueue_once(
                key=f"activate-package:{order_id}",
                event_type="wifi.package.activate",
                payload={"order_id": order_id},
            )

    return {"resultcode": "000", "result": "SUCCESS", "message": "Accepted"}
```

Production improvement: persist and acknowledge the webhook in one short database transaction; let a worker validate business details and activate service from an outbox. This prevents Selcom timeouts from causing duplicate delivery.

## 11. Reconcile Checkout orders

Selcom documents these Checkout `payment_status` values:

- `PENDING`
- `COMPLETED`
- `CANCELLED`
- `USERCANCELLED`
- `REJECTED`
- `INPROGRESS`

Example worker logic:

```python
async def reconcile_checkout_order(payment, selcom: SelcomClient) -> None:
    response = await selcom.order_status(payment.order_id)
    await payment_repo.record_provider_response(payment.order_id, "query", response)

    if response.get("resultcode") != "000":
        # A failed status API call does not prove the payment failed.
        await payment_repo.schedule_next_query(payment.order_id)
        return

    rows = response.get("data") or []
    if not rows:
        await payment_repo.schedule_next_query(payment.order_id)
        return

    item = rows[0]
    status = item.get("payment_status")

    if status == "COMPLETED":
        if Decimal(str(item["amount"])) != payment.amount:
            await payment_repo.flag_manual_review(payment.order_id, "amount_mismatch")
            return
        await payment_repo.mark_completed_once(
            order_id=payment.order_id,
            provider_reference=str(item.get("reference") or ""),
            provider_transid=str(item.get("transid") or ""),
            channel=str(item.get("channel") or ""),
        )
    elif status in {"CANCELLED", "USERCANCELLED", "REJECTED"}:
        await payment_repo.mark_terminal_failure(payment.order_id, status)
    else:
        await payment_repo.schedule_next_query(payment.order_id)
```

Recommended schedule:

- Do not immediately repeat a transaction when Selcom returns `INPROGRESS`, result codes `111`/`927`, or `AMBIGUOUS`/`999`.
- Selcom recommends waiting **3 minutes** and then querying status.
- Continue querying every 3 minutes for a bounded window.
- Move old unresolved transactions to manual review instead of creating a new debit attempt.

## 12. Collection flow B: direct C2B Push USSD

### 12.1 Initiate the prompt

`POST /v1/wallet/pushussd` fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `transid` | Yes | Your unique transaction ID |
| `utilityref` | Yes | Your invoice/account/payment reference |
| `amount` | Yes | Amount to collect |
| `vendor` | Yes | Selcom-provided vendor/float identifier |
| `msisdn` | Yes | Customer mobile wallet number |

A `SUCCESS` response only confirms that the wallet provider accepted the push request. It does not mean the customer was debited.

### 12.2 Your inbound C2B endpoints

Selcom calls these endpoints on your server:

- `POST /lookup`
- `POST /validation`
- `POST /notification`

These inbound calls use a shared Bearer token, not the outbound HS256 mechanism:

```text
Authorization: Bearer <shared-token>
```

Suggested FastAPI router:

```python
from decimal import Decimal
import hmac

from fastapi import APIRouter, Depends, Header, HTTPException


c2b_router = APIRouter(prefix="/api/v1/selcom/c2b", tags=["Selcom C2B"])


def require_c2b_token(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    expected = "Bearer " + settings.selcom_c2b_bearer_token.get_secret_value()
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(401, "Invalid C2B token")


def c2b_reply(reference: str, code: str, message: str, **extra):
    return {
        "reference": reference,
        "resultcode": code,
        "result": "SUCCESS" if code == "000" else "FAILED",
        "message": message,
        **extra,
    }


@c2b_router.post("/lookup", dependencies=[Depends(require_c2b_token)])
async def lookup(payload: dict):
    invoice = await invoice_repo.get_by_reference(str(payload.get("utilityref", "")))
    reference = str(payload.get("reference", ""))
    if invoice is None:
        return c2b_reply(reference, "010", "Invalid payment reference")
    return c2b_reply(
        reference,
        "000",
        "Account found",
        name=invoice.customer_name,
        amount=str(invoice.balance_due),
    )


@c2b_router.post("/validation", dependencies=[Depends(require_c2b_token)])
async def validation(payload: dict):
    reference = str(payload.get("reference", ""))
    invoice = await invoice_repo.get_by_reference(str(payload.get("utilityref", "")))
    if invoice is None:
        return c2b_reply(reference, "010", "Invalid payment reference")

    amount = Decimal(str(payload.get("amount", "0")))
    if amount <= 0:
        return c2b_reply(reference, "012", "Invalid amount")
    if amount != invoice.balance_due:
        return c2b_reply(reference, "012", "Amount does not match invoice")

    return c2b_reply(reference, "000", "Payment validated", name=invoice.customer_name)


@c2b_router.post("/notification", dependencies=[Depends(require_c2b_token)])
async def notification(payload: dict):
    reference = str(payload.get("reference", ""))
    utilityref = str(payload.get("utilityref", ""))

    # Insert notification once using Selcom reference as a UNIQUE key.
    inserted = await c2b_repo.insert_notification_once(reference, payload)
    if not inserted:
        return c2b_reply(reference, "000", "Duplicate accepted")

    payment = await payment_repo.complete_c2b_once(
        utilityref=utilityref,
        provider_reference=reference,
        provider_transid=str(payload.get("transid", "")),
        amount=Decimal(str(payload.get("amount", "0"))),
        phone=str(payload.get("msisdn", "")),
    )
    if payment:
        await outbox_repo.enqueue_once(
            key=f"activate-package:{payment.order_id}",
            event_type="wifi.package.activate",
            payload={"order_id": payment.order_id},
        )

    return c2b_reply(reference, "000", "Payment received")
```

Documented response codes your C2B endpoints should use:

| Code | Meaning |
| --- | --- |
| `000` | Success |
| `010` | Invalid account/payment reference |
| `012` | Invalid amount |
| `014` | Amount too high |
| `015` | Amount too low |
| `4XX` | Other business failure from your system |

Important behavior:

- A timeout/failure from `/validation` can cause the source payment to be reversed.
- A timeout/no response from `/notification` does not automatically reverse the funds; it may lead to ambiguous/manual reconciliation.
- Keep these endpoints fast and highly available.

## 13. Query direct C2B status

Use:

```text
GET /v1/c2b/query-status
```

Provide exactly one of:

- `transid`
- `reference`

This endpoint is important when a transaction validated successfully but your `/notification` callback did not arrive.

## 14. Mobile-wallet payouts

### 14.1 Utility codes

| Wallet | `utilitycode` | Name lookup documented |
| --- | --- | --- |
| Vodacom M-Pesa | `VMCASHIN` | No |
| Airtel Money | `AMCASHIN` | Yes |
| Mixx by Yas | `TPCASHIN` | Yes |
| EzyPesa | `EZCASHIN` | Yes |
| HaloPesa | `HPCASHIN` | Yes |
| TTCL Pesa | `TTCASHIN` | Yes |
| Auto-route wallet | `CASHIN` | Yes; Selcom documents MNP-based routing |

Confirm the available utility codes on your merchant profile during onboarding; product availability can differ by contract.

### 14.2 Name lookup

```text
GET /v1/walletcashin/namelookup
```

Fields:

- `utilitycode`
- `utilityref` — recipient phone number
- `transid` — unique lookup/transaction correlation ID

For supported destinations, show the resolved name to an admin and require confirmation before sending a payout.

### 14.3 Send payout

```text
POST /v1/walletcashin/process
```

Fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `transid` | Yes | Your unique payout ID |
| `utilitycode` | Yes | Destination wallet code |
| `utilityref` | Yes | Recipient wallet phone number |
| `amount` | Yes | Payout amount |
| `vendor` | Yes | Float account identifier |
| `pin` | Yes | Float account PIN |
| `msisdn` | No | Sender/initiator phone |

### 14.4 Query payout

```text
GET /v1/walletcashin/query?transid=<YOUR_TRANSID>
```

Receipt data is available only for successful transactions and depends on the destination financial institution.

### 14.5 Selcom Pesa-specific payout

Selcom also documents:

- `POST /v1/selcompesa/cashin`
- `GET /v1/selcompesa/namelookup`
- `GET /v1/selcompesa/query`

Use this only when paying a Selcom Pesa account/mobile number and the product is enabled for your merchant.

## 15. Bank payouts with Qwiksend

### 15.1 Lookup the account first

```text
GET /v1/qwiksend/lookup?bank=<SHORTCODE>&account=<ACCOUNT>&transid=<TRANSID>
```

Fields:

- `bank`
- `account`
- `transid`

Do not trust a recipient name typed by an admin if lookup is available. Compare/store the provider-resolved name.

### 15.2 Send bank payout

```text
POST /v1/qwiksend/process
```

Fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `transid` | Yes | Your unique payout ID |
| `recipientFiCode` | Yes | Destination bank shortcode |
| `recipientAccount` | Yes | Destination account number |
| `recipientName` | Yes | Recipient account holder name |
| `senderAccount` | Yes | Your source account/internal sender identifier |
| `senderName` | Yes | Sender account holder/business name |
| `amount` | Yes | Amount |
| `vendor` | Yes | Float account identifier |
| `pin` | Yes | Float account PIN |
| `msisdn` | Yes | Sender mobile number |
| `purpose` | Yes | Transfer purpose, e.g. `GIFT` if approved for the use case |
| `remarks` | No | Payment description |

### 15.3 Query bank payout

```text
GET /v1/qwiksend/query?transid=<YOUR_TRANSID>
```

Query instead of creating another payout after a timeout or ambiguous result.

### 15.4 Bank shortcodes currently shown in the public reference

| Bank | Code |
| --- | --- |
| ABSA Bank | `ABSA` |
| Selcom Microfinance Bank / Selcom Pesa | `SPSCASHIN` |
| Akiba Commercial Bank | `AKIBA` |
| Amana Bank | `AMANABANK` |
| Azania Bank | `AZANIA` |
| Access Bank Tanzania | `BANCABC` |
| Bank of Africa Tanzania | `BOA` |
| Bank of Baroda Tanzania | `BANKOFBARODA` |
| Bank of India Tanzania | `BANKOFINDIA` |
| China Dasheng Bank | `CHINADASHENG` |
| Citibank Tanzania | `CITIBANK` |
| CRDB Bank | `CRDBBANK` |
| DCB Commercial Bank | `DCBBANK` |
| Diamond Trust Bank | `DTB` |
| Ecobank Tanzania | `ECOBANK` |
| Equity Bank Tanzania | `EQUITYBANK` |
| Exim Bank | `EXIMBANK` |
| FINCA Microfinance Bank | `FINCA` |
| Guaranty Trust Bank Tanzania | `GTBANK` |
| Habib African Bank | `HABIBBANK` |
| I&M Bank Tanzania | `IMBANK` |
| International Commercial Bank Tanzania | `ICB` |
| KCB Bank Tanzania | `KCB` |
| Coop Bank Tanzania | `KILIMANJARO` |
| Letshego Bank Tanzania | `LETSHEGO` |
| Maendeleo Bank | `MAENDELEO` |
| Mkombozi Commercial Bank | `MKOMBOZI` |
| Mwalimu Commercial Bank | `MWALIMU` |
| Mwanga Hakika Microfinance Bank | `MWANGA` |
| NMB | `NMB` |
| NBC | `NBC` |
| NCBA Bank Tanzania | `NCBA` |
| People's Bank of Zanzibar | `PBZ` |
| Stanbic Bank Tanzania | `STANBIC` |
| Tanzania Commercial Bank | `TCB` |
| Uchumi Commercial Bank | `UCHUMI` |
| United Bank for Africa | `UBA` |

Treat this list as configuration, not permanent application code. Bank availability and codes can change; confirm the production list with Selcom.

## 16. Float balance

Use:

```text
POST /v1/vendor/balance
```

Payload:

```json
{
  "vendor": "YOUR_FLOAT_VENDOR",
  "pin": "YOUR_FLOAT_PIN",
  "transid": "BAL-UNIQUE-ID"
}
```

Do not expose the PIN to a mobile app or frontend. Only the backend should call this endpoint.

## 17. Response and status handling

Selcom's common response envelope contains:

```json
{
  "reference": "0289999288",
  "transid": "YOUR-ID",
  "resultcode": "000",
  "result": "SUCCESS",
  "message": "...",
  "data": []
}
```

Common result interpretation:

| Result | Code | Meaning | Your action |
| --- | --- | --- | --- |
| `SUCCESS` | `000` | Successful result for that API operation | Still check payment-specific final state |
| `INPROGRESS` | `111`, `927` | Transaction is processing | Wait 3 minutes, query status |
| `AMBIGUOUS`/`AMBIGOUS` | `999` | Outcome unknown | Do not repeat debit/payout; query and reconcile |
| `FAIL` | Other codes | Definite failure, unless transport outcome is unknown | Store exact response; map to safe user message |

Do not depend only on `message` text. Use structured fields and keep the raw response for audits.

### 17.1 Suggested internal state machine

```text
CREATED
  -> SUBMITTED
  -> PENDING / INPROGRESS / AMBIGUOUS
  -> COMPLETED
  -> FAILED / CANCELLED / REJECTED
  -> MANUAL_REVIEW
```

Terminal states must not move backward. `COMPLETED` fulfillment must be guarded by an atomic compare-and-set operation.

## 18. Database design

Minimum `payments` fields:

```text
id UUID PRIMARY KEY
provider VARCHAR NOT NULL DEFAULT 'selcom'
order_id VARCHAR UNIQUE
transid VARCHAR UNIQUE
provider_reference VARCHAR UNIQUE NULL
direction VARCHAR CHECK (direction IN ('COLLECTION', 'PAYOUT'))
rail VARCHAR  -- CHECKOUT, C2B, WALLET_CASHIN, QWIKSEND
amount DECIMAL(18,2)
currency CHAR(3)
phone VARCHAR NULL
destination_account_encrypted TEXT NULL
status VARCHAR
result_code VARCHAR NULL
last_provider_status VARCHAR NULL
attempt_count INTEGER DEFAULT 0
next_query_at TIMESTAMP WITH TIME ZONE NULL
completed_at TIMESTAMP WITH TIME ZONE NULL
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE
```

Minimum `provider_events` fields:

```text
id UUID PRIMARY KEY
provider VARCHAR
external_event_id VARCHAR
event_type VARCHAR
payload JSONB
signature_valid BOOLEAN
received_at TIMESTAMP WITH TIME ZONE
processed_at TIMESTAMP WITH TIME ZONE NULL
processing_error TEXT NULL
UNIQUE(provider, external_event_id, event_type)
```

Minimum `outbox_events` fields:

```text
id UUID PRIMARY KEY
idempotency_key VARCHAR UNIQUE
event_type VARCHAR
payload JSONB
published_at TIMESTAMP WITH TIME ZONE NULL
created_at TIMESTAMP WITH TIME ZONE
```

For payouts, add:

- approval state and approver ID
- recipient name returned by lookup
- encrypted/masked recipient account
- immutable audit log
- ledger entry IDs
- maker-checker fields for larger amounts

## 19. Idempotency and duplicate protection

Selcom's public API does not document a separate `Idempotency-Key` header. Use transaction identity and database constraints:

- Generate `order_id` and `transid` on the server.
- Never reuse one ID for two different business operations.
- Retry a status query, not the original payout/debit request, when the first call may have reached Selcom.
- Put UNIQUE constraints on `order_id`, `transid`, and provider reference.
- Treat duplicate callbacks as success and return HTTP 200.
- Fulfillment must use `UPDATE ... WHERE status != 'COMPLETED'` or an equivalent row lock.
- Use an outbox to ensure payment completion and package activation cannot become inconsistent.

## 20. Payout safety workflow

Recommended admin flow:

1. User requests withdrawal.
2. Backend calculates withdrawable balance from your ledger, not a frontend value.
3. Create payout row as `REQUESTED`.
4. Resolve recipient name through Selcom if supported.
5. Show masked destination and resolved name to the approver.
6. Approver confirms; lock the ledger amount.
7. Generate a unique `transid` and set `SUBMITTING` in one transaction.
8. Call Selcom once.
9. If definite success, mark completed and post final ledger entries.
10. If in progress/ambiguous/timeout, mark `RECONCILIATION_REQUIRED` and query later.
11. If definite failure, release the locked balance.

Never release a locked balance merely because your HTTP request timed out. The provider may have processed it.

## 21. Test the signature implementation

```python
# tests/test_selcom_signing.py
import base64
import hashlib
import hmac


def test_selcom_hs256_header():
    client = SelcomClient(
        base_url="https://selcom.test",
        api_key="test-key",
        api_secret="test-secret",
    )
    payload = {
        "transid": "TX-1",
        "amount": 1000,
        "msisdn": "255712345678",
    }
    timestamp = "2026-09-13T10:00:00+03:00"
    fields = ["transid", "amount", "msisdn"]

    headers = client._headers(payload, fields, timestamp=timestamp)

    signing_string = (
        "timestamp=2026-09-13T10:00:00+03:00"
        "&transid=TX-1&amount=1000&msisdn=255712345678"
    )
    expected_digest = base64.b64encode(
        hmac.new(
            b"test-secret",
            signing_string.encode(),
            hashlib.sha256,
        ).digest()
    ).decode()

    assert headers["Authorization"] == "SELCOM dGVzdC1rZXk="
    assert headers["Signed-Fields"] == "transid,amount,msisdn"
    assert headers["Digest"] == expected_digest
```

Integration/UAT test matrix:

| Test | Expected result |
| --- | --- |
| Valid mobile-money payment | Webhook/query completes once; one package activation |
| Customer rejects prompt | No activation; query reaches terminal non-success |
| Customer does nothing | Remains pending then expires/manual policy |
| Duplicate webhook | HTTP 200; no duplicate package or ledger entry |
| Wrong webhook digest | HTTP 401; event not processed |
| Wrong amount | No activation; manual review alert |
| Selcom request timeout | Original `transid` retained; status query used |
| `111`/`927` response | Wait then query; do not create another debit |
| `999` response | Manual/reconciliation path; never repeat payout blindly |
| Duplicate payout click | Database constraint returns existing payout |
| Insufficient internal balance | Reject before calling Selcom |
| Insufficient Selcom float | Definite failure/manual top-up workflow |

## 22. Observability

Log safe correlation data:

- `order_id`
- `transid`
- Selcom `reference`
- endpoint/product
- HTTP status
- Selcom `resultcode`
- internal transaction state
- request latency

Never log:

- API secret
- float PIN
- unmasked bank account where unnecessary
- full webhook `Authorization`/`Digest`
- customer PIN or OTP

Recommended alerts:

- growing `AMBIGUOUS`/`INPROGRESS` queue
- unsigned/invalid callback spike
- amount mismatch
- callback for unknown `order_id`
- payout float below threshold
- old pending collection/payout
- webhook processing failures

## 23. Production checklist

- [ ] Selcom has confirmed sandbox and production base URLs.
- [ ] Checkout, C2B, Wallet Cashin, Qwiksend, and Balance products needed by the project are enabled.
- [ ] Sandbox and production credentials are separate.
- [ ] Server time is synchronized.
- [ ] All IDs are server-generated and unique.
- [ ] HTTPS callback URLs use a valid public certificate.
- [ ] Checkout webhook signature is verified.
- [ ] C2B callbacks require the shared Bearer token.
- [ ] Callback endpoints are rate-limited carefully without blocking Selcom.
- [ ] Raw callback/provider responses are stored securely.
- [ ] Duplicate callbacks cannot duplicate fulfillment.
- [ ] Redirect URLs cannot activate service.
- [ ] Amount, currency, order, and destination are verified server-side.
- [ ] Pending/ambiguous transactions are queried after the documented delay.
- [ ] POST payouts are never blindly retried.
- [ ] Payout destinations use name lookup where available.
- [ ] Admin payouts have approval/audit controls.
- [ ] Float balance monitoring is configured.
- [ ] Logs mask secrets and personal financial data.
- [ ] UAT includes duplicate, timeout, rejection, cancellation, and mismatch tests.
- [ ] Selcom has approved the go-live test cases.

## 24. Endpoint appendix

### Checkout

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/checkout/create-order` | Full checkout; required when card payments/billing details are needed |
| POST | `/v1/checkout/create-order-minimal` | Non-card order; appropriate for mobile wallet/manual payment |
| DELETE | `/v1/checkout/cancel-order` | Cancel an order |
| GET | `/v1/checkout/order-status` | Get order status |
| GET | `/v1/checkout/list-orders` | List orders by date range |
| POST | `/v1/checkout/wallet-payment` | Trigger wallet pull for an order |
| POST | `/v1/checkout/selcompesa-payment` | Trigger Selcom Pesa payment for an order |
| POST | `/v1/checkout/create-till-alias` | Create a linked Till/Lipa alias |

The Checkout reference also documents stored-card and direct card-payment operations. Do not implement direct card handling until Selcom confirms PCI-DSS scope and the exact merchant permissions. For WiFi mobile-money payments, Checkout Minimal avoids unnecessary card-data complexity.

### C2B collections

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/wallet/pushussd` | Initiate direct wallet prompt |
| GET | `/v1/c2b/query-status` | Query collection status |
| POST | Your `/lookup` | Selcom checks payment reference |
| POST | Your `/validation` | Selcom validates the incoming collection |
| POST | Your `/notification` | Selcom confirms the incoming collection |

### Mobile-wallet payouts

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/walletcashin/namelookup` | Resolve wallet name where available |
| POST | `/v1/walletcashin/process` | Send funds to wallet |
| GET | `/v1/walletcashin/query` | Query wallet payout |

### Bank payouts

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/qwiksend/lookup` | Resolve bank account name |
| POST | `/v1/qwiksend/process` | Send bank payout |
| GET | `/v1/qwiksend/query` | Query bank payout |

### Float

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/vendor/balance` | Check float balance |

### Optional utility/bill payments

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/utilitypayment/lookup` | Validate a utility/biller reference |
| POST | `/v1/utilitypayment/process` | Pay a utility/biller from the configured float |
| GET | `/v1/utilitypayment/query` | Query that utility payment by `transid` |

These endpoints pay third-party utilities and are not customer collection endpoints.

## 25. Source links

- [Selcom current API reference](https://developers.selcommobile.com/)
- [Query payment status section](https://developers.selcommobile.com/#query-payment-status)
- [Selcom Developers GitHub organization](https://github.com/selcom-developers)
- [Legacy/community Node Selcom repository reviewed](https://github.com/selcom-developers/node-selcom)
- [Official Python API gateway client repository](https://github.com/selcompaytechltd/selcom-apigw-client-python)
- [Official Python client signing implementation](https://github.com/selcompaytechltd/selcom-apigw-client-python/blob/main/src/selcom_apigw_client/apigwClient.py)

## 26. Final implementation decision for WoteFy/Lubfy

Use **Checkout Minimal + Wallet Pull** for customer package payments. Keep **direct C2B** for Till/Lipa-number or contract-specific collection flows. Use **Wallet Cashin** for reseller mobile-wallet withdrawals and **Qwiksend** for bank withdrawals. Put every final money movement behind a local transaction state machine, durable provider-event storage, idempotent ledger writes, and reconciliation queries.

Before production deployment, replace only the environment configuration with the exact base URLs and product credentials supplied by Selcom; do not change the signing rules unless Selcom confirms a merchant-specific variation during UAT.
