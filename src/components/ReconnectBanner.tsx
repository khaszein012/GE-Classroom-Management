import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Unobtrusive banner that appears when the Supabase realtime channel
 * disconnects (network drop, tab offline). Auto-dismisses on reconnect.
 */
export function ReconnectBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const channel = supabase.channel("conn-monitor");

    channel
      .on("system" as never, { event: "disconnected" as never }, () => setOffline(true))
      .on("system" as never, { event: "connected" as never }, () => setOffline(false))
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") setOffline(false);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setOffline(true);
      });

    const onWindowOffline = () => setOffline(true);
    const onWindowOnline = () => setOffline(false);
    window.addEventListener("offline", onWindowOffline);
    window.addEventListener("online", onWindowOnline);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("offline", onWindowOffline);
      window.removeEventListener("online", onWindowOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-deep-gold px-4 py-2 text-sm font-semibold text-warm-ivory shadow-soft-lg">
      <WifiOff className="h-4 w-4" />
      Reconnecting…
    </div>
  );
}
