"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PermissionGate } from "@/components/backoffice/PermissionGate";
import { PermissionCode } from "@/lib/permissions";

/** Legacy route — opens the smart create popup on the products list. */
export default function NewProductPage() {
  return (
    <PermissionGate permission={PermissionCode.CATALOG_MANAGE}>
      <RedirectToCreatePopup />
    </PermissionGate>
  );
}

function RedirectToCreatePopup() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/products?create=1");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gulio-muted">
      Opening new product…
    </div>
  );
}
