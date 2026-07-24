import { TopBar } from "@/components/shared/TopBar";

export default function PosGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gulio-bg">
      <TopBar />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
