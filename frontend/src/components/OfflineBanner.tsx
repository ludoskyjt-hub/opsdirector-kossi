import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  if (!isOffline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white"
      style={{ background: "oklch(0.55 0.15 60)" }}>
      <WifiOff className="w-4 h-4" />
      Mode hors ligne — données en cache affichées
    </div>
  );
}
