"use client";

import { Users } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import TeamManagementPanel from "@/components/TeamManagementPanel";
import { useSite } from "@/lib/hooks/useSite";

export default function TeamSettingsPage() {
  const { activeAccountId, accounts } = useSite();
  const activeAccount = accounts.find((a) => a.account_id === activeAccountId);
  const accountLabel =
    activeAccount?.brand_name ||
    activeAccount?.domain ||
    activeAccount?.owner_email ||
    "the account";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900">
            <Users className="h-7 w-7 text-blue-600" />
            Team
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage who has access to {accountLabel}.
          </p>
        </div>

        <TeamManagementPanel />
      </main>
    </div>
  );
}
