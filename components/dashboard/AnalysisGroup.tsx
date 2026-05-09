"use client";

import AnalysisRow from "./AnalysisRow";
import type { AnalysisDef, AnalysisStatusInputs, RequirementChecks } from "@/lib/analyses";
import type { ActiveRun, AgentKey } from "@/lib/hooks/useActiveRuns";

interface AnalysisGroupProps {
  title: string;
  description: string;
  items: AnalysisDef[];
  runs: ActiveRun[];
  statusInputs: AnalysisStatusInputs;
  requirementChecks: RequirementChecks;
  onTrigger: (agent: AgentKey, endpoint: string) => void;
}

export default function AnalysisGroup({
  title,
  description,
  items,
  runs,
  statusInputs,
  requirementChecks,
  onTrigger,
}: AnalysisGroupProps) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </header>
      <ul className="divide-y divide-slate-100">
        {items.map((def) => (
          <AnalysisRow
            key={def.id}
            def={def}
            runs={runs}
            statusInputs={statusInputs}
            requirementChecks={requirementChecks}
            onTrigger={onTrigger}
          />
        ))}
      </ul>
    </section>
  );
}
