"use client";

import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { useSite } from "@/lib/hooks/useSite";
import { isAdminEmail } from "@/lib/admin";
import { useUser } from "@/lib/hooks/useUser";

export default function AdminViewBanner() {
  const { viewAs, clearViewAs } = useSite();
  const { user } = useUser();
  const router = useRouter();

  if (!viewAs || !isAdminEmail(user?.email)) return null;

  const label = [viewAs.brandName, viewAs.domain].filter(Boolean).join(" — ");

  const handleExit = () => {
    clearViewAs();
    router.push("/c/admin");
  };

  return (
    <div className="sticky top-14 lg:top-0 z-30 flex items-center justify-between gap-3 bg-amber-400 px-4 sm:px-6 lg:pl-60 py-2 text-sm font-medium text-amber-950">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 flex-shrink-0" />
        <span>
          Kundvy:{" "}
          <span className="font-semibold">{label || viewAs.userId}</span>
        </span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 rounded-lg bg-amber-500/40 px-3 py-1 text-xs font-semibold hover:bg-amber-500/60 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Avsluta kundvy
      </button>
    </div>
  );
}
