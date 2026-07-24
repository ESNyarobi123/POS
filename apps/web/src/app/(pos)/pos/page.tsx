"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type {
  ProductListItemDto,
  ProductListResponse,
  SerialUnitDto,
  VariantLookupResponse,
  VariantSummaryDto,
} from "@gulio/contracts";
import { PosCartPanel } from "@/components/pos/PosCartPanel";
import { PosCustomerModal } from "@/components/pos/PosCustomerModal";
import { PosDiscountModal } from "@/components/pos/PosDiscountModal";
import { PosHeldSalesModal } from "@/components/pos/PosHeldSalesModal";
import { PosImeiModal } from "@/components/pos/PosImeiModal";
import {
  PosProductCard,
  type PosProductCardData,
} from "@/components/pos/PosProductCard";
import { PosSearchBar } from "@/components/pos/PosSearchBar";
import {
  PosShortcutBar,
  type ShortcutAction,
} from "@/components/pos/PosShortcutBar";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { sumLines, type DecimalString } from "@/lib/money";
import {
  clearActiveSale,
  heldSaleLabel,
  loadCart,
  loadCustomer,
  loadDiscountAmount,
  loadHeldSales,
  loadLastSaleId,
  saveCart,
  saveCustomer,
  saveDiscountAmount,
  saveHeldSales,
  setPendingPaymentMethod,
  type HeldSale,
  type PendingPaymentMethod,
  type PosCartCustomer,
  type PosCartLine,
} from "@/lib/pos-cart";

type CatalogCard = PosProductCardData;

type SerialPickState = {
  variant: VariantSummaryDto;
  productName: string;
  imageUrl: string | null;
  serials: SerialUnitDto[];
};

type ModalKind = "imei" | "discount" | "customer" | "held" | null;

function resolveImageUrl(
  product: ProductListItemDto,
  variant: VariantSummaryDto,
): string | null {
  return variant.imageUrl ?? product.imageUrl ?? null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function isPosSearchInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement &&
    target.dataset.posSearch === "true"
  );
}

export default function PosPage() {
  const router = useRouter();
  const { ready, token, shift, online } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<ProductListItemDto[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [customer, setCustomer] = useState<PosCartCustomer | null>(null);
  const [discountAmount, setDiscountAmount] = useState<DecimalString>("0");
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [serialPick, setSerialPick] = useState<SerialPickState | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [pressedShortcut, setPressedShortcut] = useState<
    ShortcutAction["id"] | null
  >(null);

  const flashShortcut = useCallback((id: ShortcutAction["id"]) => {
    setPressedShortcut(id);
    window.setTimeout(() => {
      setPressedShortcut((cur) => (cur === id ? null : cur));
    }, 160);
  }, []);

  const showBanner = useCallback((msg: string) => {
    setBanner(msg);
    window.setTimeout(() => {
      setBanner((cur) => (cur === msg ? null : cur));
    }, 2800);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!shift?.sessionId) {
      router.replace("/shift/open");
      return;
    }
    setCart(loadCart());
    setCustomer(loadCustomer());
    setDiscountAmount(loadDiscountAmount());
    setHeldSales(loadHeldSales());
  }, [ready, token, shift, router]);

  useEffect(() => {
    if (!ready || !token || !shift) return;
    let cancelled = false;
    setLoading(true);
    void apiFetch<ProductListResponse>("/catalog/products?limit=100")
      .then((res) => {
        if (!cancelled) setProducts(res.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load catalog",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, token, shift]);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  useEffect(() => {
    saveCustomer(customer);
  }, [customer]);

  useEffect(() => {
    saveDiscountAmount(discountAmount);
  }, [discountAmount]);

  useEffect(() => {
    saveHeldSales(heldSales);
  }, [heldSales]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const p of products) {
      if (p.category?.name) names.add(p.category.name);
    }
    return ["All", ...Array.from(names).sort()];
  }, [products]);

  const cards = useMemo(() => {
    const out: CatalogCard[] = [];
    for (const p of products) {
      if (!p.isActive) continue;
      if (
        categoryFilter !== "All" &&
        p.category?.name !== categoryFilter
      ) {
        continue;
      }
      for (const v of p.variants) {
        if (!v.isActive) continue;
        out.push({
          productId: p.id,
          productName: p.name,
          categoryName: p.category?.name ?? null,
          imageUrl: resolveImageUrl(p, v),
          variant: v,
        });
      }
    }
    const q = query.trim().toLowerCase();
    if (!q) return out;
    return out.filter(
      (c) =>
        c.productName.toLowerCase().includes(q) ||
        c.variant.name.toLowerCase().includes(q) ||
        c.variant.sku.toLowerCase().includes(q) ||
        (c.variant.primaryBarcode ?? "").toLowerCase().includes(q),
    );
  }, [products, categoryFilter, query]);

  const total = sumLines(cart);

  const topModal = useMemo((): ModalKind => {
    if (serialPick) return "imei";
    if (discountOpen) return "discount";
    if (customerOpen) return "customer";
    if (heldOpen) return "held";
    return null;
  }, [serialPick, discountOpen, customerOpen, heldOpen]);

  const addLine = useCallback((line: PosCartLine) => {
    setCart((prev) => {
      if (line.requiresSerial) {
        return [...prev, line];
      }
      const idx = prev.findIndex(
        (l) => l.variantId === line.variantId && !l.requiresSerial,
      );
      if (idx === -1) return [...prev, line];
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        quantity: next[idx].quantity + line.quantity,
        imageUrl: next[idx].imageUrl ?? line.imageUrl ?? null,
      };
      return next;
    });
  }, []);

  async function promptSerialAndAdd(
    variant: VariantSummaryDto,
    productName: string,
    imageUrl: string | null = null,
  ) {
    if (!shift?.warehouseId) {
      setError("No warehouse on shift");
      return;
    }
    setError(null);
    try {
      const serials = await apiFetch<SerialUnitDto[]>(
        `/inventory/serials?variantId=${encodeURIComponent(variant.id)}&warehouseId=${encodeURIComponent(shift.warehouseId)}`,
      );
      if (serials.length === 0) {
        setError(`No IN_STOCK serials for ${variant.sku}`);
        return;
      }
      setSerialPick({
        variant,
        productName,
        imageUrl: imageUrl ?? variant.imageUrl ?? null,
        serials,
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load serials",
      );
    }
  }

  function confirmSerial(serial: SerialUnitDto) {
    if (!serialPick) return;
    const { variant, productName, imageUrl } = serialPick;
    addLine({
      variantId: variant.id,
      productName,
      variantName: variant.name,
      sku: variant.sku,
      quantity: 1,
      unitPrice: variant.sellPrice,
      requiresSerial: true,
      imageUrl,
      serialUnitIds: [serial.id],
      serialNumbers: [serial.serialNumber],
    });
    setSerialPick(null);
  }

  async function addVariantCard(card: CatalogCard) {
    const { variant, productName, imageUrl } = card;
    if (variant.requiresSerial) {
      await promptSerialAndAdd(variant, productName, imageUrl);
      return;
    }
    addLine({
      variantId: variant.id,
      productName,
      variantName: variant.name,
      sku: variant.sku,
      quantity: 1,
      unitPrice: variant.sellPrice,
      requiresSerial: false,
      imageUrl,
    });
  }

  async function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const code = query.trim();
    if (!code || !shift) return;
    setLookupBusy(true);
    setError(null);
    try {
      const wh = shift.warehouseId
        ? `&warehouseId=${encodeURIComponent(shift.warehouseId)}`
        : "";
      const res = await apiFetch<VariantLookupResponse>(
        `/catalog/variants/lookup?code=${encodeURIComponent(code)}${wh}`,
      );
      const v = res.variant;
      const lookupImage = v.product.imageUrl ?? null;
      const summary: VariantSummaryDto = {
        id: v.id,
        sku: v.sku,
        name: v.name,
        attributes: v.attributes,
        sellPrice: v.sellPrice,
        requiresSerial: v.requiresSerial,
        isActive: v.isActive,
        imageUrl: lookupImage,
        primaryBarcode:
          v.barcodes.find((b) => b.isPrimary)?.value ??
          v.barcodes[0]?.value ??
          null,
      };
      if (summary.requiresSerial) {
        await promptSerialAndAdd(summary, v.product.name, lookupImage);
      } else {
        addLine({
          variantId: summary.id,
          productName: v.product.name,
          variantName: summary.name,
          sku: summary.sku,
          quantity: 1,
          unitPrice: summary.sellPrice,
          requiresSerial: false,
          imageUrl: lookupImage,
        });
      }
      setQuery("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Lookup failed",
      );
    } finally {
      setLookupBusy(false);
    }
  }

  const goPay = useCallback(
    (method: PendingPaymentMethod) => {
      if (cart.length === 0) {
        setError("Cart is empty");
        return;
      }
      setPendingPaymentMethod(method);
      saveCart(cart);
      saveCustomer(customer);
      saveDiscountAmount(discountAmount);
      router.push(`/pos/payment?method=${method}`);
    },
    [cart, customer, discountAmount, router],
  );

  const openCustomer = useCallback(() => {
    setCustomerOpen(true);
  }, []);

  const openDiscount = useCallback(() => {
    if (cart.length === 0) {
      setError("Add items before applying a discount");
      return;
    }
    setDiscountOpen(true);
  }, [cart.length]);

  const openHeldList = useCallback(() => {
    setHeldOpen(true);
  }, []);

  const holdSale = useCallback(() => {
    if (cart.length === 0) {
      openHeldList();
      return;
    }
    const held: HeldSale = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      cart: [...cart],
      customer,
      discountAmount,
      label: heldSaleLabel(cart, customer),
    };
    setHeldSales((prev) => [held, ...prev]);
    setCart([]);
    setCustomer(null);
    setDiscountAmount("0");
    clearActiveSale();
    setError(null);
    showBanner("Sale held");
  }, [cart, customer, discountAmount, openHeldList, showBanner]);

  const openLastReceipt = useCallback(() => {
    const saleId = loadLastSaleId();
    if (!saleId) {
      showBanner("No last receipt");
      setError("No last receipt");
      return;
    }
    setError(null);
    router.push(`/pos/receipt?saleId=${encodeURIComponent(saleId)}`);
  }, [router, showBanner]);

  const closeTopModal = useCallback(() => {
    if (serialPick) {
      setSerialPick(null);
      return true;
    }
    if (discountOpen) {
      setDiscountOpen(false);
      return true;
    }
    if (customerOpen) {
      setCustomerOpen(false);
      return true;
    }
    if (heldOpen) {
      setHeldOpen(false);
      return true;
    }
    return false;
  }, [serialPick, discountOpen, customerOpen, heldOpen]);

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = isEditableTarget(e.target);
      const inSearch = isPosSearchInput(e.target);

      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        flashShortcut("Ctrl+P");
        openLastReceipt();
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        flashShortcut("F2");
        focusSearch();
        return;
      }

      if (e.key === "F9") {
        e.preventDefault();
        flashShortcut("F9");
        goPay("cash");
        return;
      }

      if (e.key === "Escape") {
        if (topModal) {
          e.preventDefault();
          flashShortcut("Esc");
          closeTopModal();
        }
        return;
      }

      if (e.key === "F4") {
        if (typing && !inSearch) return;
        e.preventDefault();
        flashShortcut("F4");
        openCustomer();
        return;
      }

      if (e.key === "F6") {
        if (typing && !inSearch) return;
        e.preventDefault();
        flashShortcut("F6");
        openDiscount();
        return;
      }

      if (e.key === "F8") {
        if (typing && !inSearch) return;
        e.preventDefault();
        flashShortcut("F8");
        holdSale();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    topModal,
    closeTopModal,
    focusSearch,
    flashShortcut,
    goPay,
    openCustomer,
    openDiscount,
    holdSale,
    openLastReceipt,
  ]);

  const shortcutActions: ShortcutAction[] = useMemo(
    () => [
      {
        id: "F2",
        label: "Search",
        onAction: () => {
          flashShortcut("F2");
          focusSearch();
        },
      },
      {
        id: "F4",
        label: "Customer",
        onAction: () => {
          flashShortcut("F4");
          openCustomer();
        },
      },
      {
        id: "F6",
        label: "Discount",
        disabled: cart.length === 0,
        onAction: () => {
          flashShortcut("F6");
          openDiscount();
        },
      },
      {
        id: "F8",
        label: cart.length === 0 ? "Held sales" : "Hold",
        onAction: () => {
          flashShortcut("F8");
          holdSale();
        },
      },
      {
        id: "F9",
        label: "Payment",
        disabled: cart.length === 0,
        onAction: () => {
          flashShortcut("F9");
          goPay("cash");
        },
      },
      {
        id: "Ctrl+P",
        label: "Last receipt",
        onAction: () => {
          flashShortcut("Ctrl+P");
          openLastReceipt();
        },
      },
      {
        id: "Esc",
        label: "Close",
        disabled: !topModal,
        onAction: () => {
          flashShortcut("Esc");
          closeTopModal();
        },
      },
    ],
    [
      cart.length,
      topModal,
      flashShortcut,
      focusSearch,
      openCustomer,
      openDiscount,
      holdSale,
      goPay,
      openLastReceipt,
      closeTopModal,
    ],
  );

  function resumeHeld(held: HeldSale) {
    if (cart.length > 0) {
      setError("Clear or hold the current cart before resuming");
      return;
    }
    setCart(held.cart);
    setCustomer(held.customer);
    setDiscountAmount(held.discountAmount || "0");
    setHeldSales((prev) => prev.filter((h) => h.id !== held.id));
    setHeldOpen(false);
    setError(null);
    showBanner("Sale resumed");
  }

  function discardHeld(id: string) {
    setHeldSales((prev) => prev.filter((h) => h.id !== id));
  }

  if (!ready || !token || !shift) {
    return (
      <div className="p-8 text-sm text-gulio-muted">Loading register…</div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <PosSearchBar
          searchRef={searchRef}
          query={query}
          onQueryChange={setQuery}
          onSubmit={onSearchSubmit}
          disabled={lookupBusy}
          categories={categories}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          error={error}
        />

        {banner && (
          <div
            role="status"
            className="mx-3 mt-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900"
          >
            {banner}
          </div>
        )}

        <div className="grid flex-1 auto-rows-min grid-cols-2 content-start items-start gap-3 overflow-auto p-3 lg:grid-cols-3 xl:grid-cols-4">
          {loading && (
            <p className="col-span-full py-8 text-center text-sm text-gulio-muted">
              Loading catalog…
            </p>
          )}
          {!loading && cards.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-gulio-muted">
              No products match.
            </p>
          )}
          {cards.map((c) => (
            <PosProductCard
              key={c.variant.id}
              card={c}
              onAdd={(card) => void addVariantCard(card)}
            />
          ))}
        </div>

        <PosShortcutBar actions={shortcutActions} pressedId={pressedShortcut} />
      </section>

      <PosCartPanel
        cart={cart}
        total={total}
        online={online}
        customer={customer}
        discountAmount={discountAmount}
        heldCount={heldSales.length}
        onClear={() => {
          setCart([]);
          setCustomer(null);
          setDiscountAmount("0");
          clearActiveSale();
        }}
        onRemove={(index) =>
          setCart((prev) => prev.filter((_, idx) => idx !== index))
        }
        onQtyChange={(index, quantity) =>
          setCart((prev) =>
            prev.map((l, idx) => (idx === index ? { ...l, quantity } : l)),
          )
        }
        onPay={goPay}
        onOpenCustomer={openCustomer}
        onOpenDiscount={openDiscount}
        onOpenHeld={openHeldList}
        onClearCustomer={() => setCustomer(null)}
        onClearDiscount={() => setDiscountAmount("0")}
      />

      {serialPick && (
        <PosImeiModal
          productName={serialPick.productName}
          variant={serialPick.variant}
          serials={serialPick.serials}
          onSelect={confirmSerial}
          onClose={() => setSerialPick(null)}
        />
      )}

      {customerOpen && (
        <PosCustomerModal
          selected={customer}
          onSelect={(c) => {
            setCustomer(c);
            setCustomerOpen(false);
          }}
          onClear={() => setCustomer(null)}
          onClose={() => setCustomerOpen(false)}
        />
      )}

      {discountOpen && (
        <PosDiscountModal
          subtotal={total}
          discountAmount={discountAmount}
          onApply={(amount) => setDiscountAmount(amount)}
          onClear={() => setDiscountAmount("0")}
          onClose={() => setDiscountOpen(false)}
        />
      )}

      {heldOpen && (
        <PosHeldSalesModal
          heldSales={heldSales}
          onResume={resumeHeld}
          onDiscard={discardHeld}
          onClose={() => setHeldOpen(false)}
        />
      )}
    </div>
  );
}
