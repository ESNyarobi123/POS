import { TopBar } from "@/components/shared/TopBar";
import { BackOfficeSidebar } from "@/components/backoffice/BackOfficeSidebar";
import { BackOfficeAuthGate } from "@/components/backoffice/BackOfficeAuthGate";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gulio-bg">
      <TopBar showPosLink showBackOfficeLink={false} />
      <div className="flex min-h-0 flex-1">
        <BackOfficeSidebar />
        <BackOfficeAuthGate>
          <main className="min-w-0 flex-1 overflow-auto">
            <div className="mx-auto max-w-6xl px-5 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </BackOfficeAuthGate>
      </div>
    </div>
  );
}
