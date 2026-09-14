"use client";

import { HeroUIProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { ToastProvider } from "@/components/shared/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <ToastProvider>{children}</ToastProvider>
    </HeroUIProvider>
  );
}
