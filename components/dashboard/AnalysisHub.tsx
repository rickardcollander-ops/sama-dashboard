"use client";

import AnalysisGroup from "./AnalysisGroup";
import NextSteps, { type NextStepsInput } from "./NextSteps";
import { ANALYSES_BY_CATEGORY, type AnalysisStatusInputs, type RequirementChecks } from "@/lib/analyses";
import type { ActiveRun, AgentKey } from "@/lib/hooks/useActiveRuns";
import { useLanguage } from "@/lib/hooks/useLanguage";

interface AnalysisHubProps {
  runs: ActiveRun[];
  onTrigger: (agent: AgentKey, endpoint: string) => void;
  statusInputs: AnalysisStatusInputs;
  requirementChecks: RequirementChecks;
  nextStepsInput: NextStepsInput;
}

export default function AnalysisHub({
  runs,
  onTrigger,
  statusInputs,
  requirementChecks,
  nextStepsInput,
}: AnalysisHubProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <NextSteps input={nextStepsInput} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysisGroup
          title={t.analyses.recurringTitle}
          description={t.analyses.recurringDescription}
          items={ANALYSES_BY_CATEGORY.recurring}
          runs={runs}
          statusInputs={statusInputs}
          requirementChecks={requirementChecks}
          onTrigger={onTrigger}
        />
        <AnalysisGroup
          title={t.analyses.channelTitle}
          description={t.analyses.channelDescription}
          items={ANALYSES_BY_CATEGORY.channel}
          runs={runs}
          statusInputs={statusInputs}
          requirementChecks={requirementChecks}
          onTrigger={onTrigger}
        />
      </div>

      <AnalysisGroup
        title={t.analyses.deepTitle}
        description={t.analyses.deepDescription}
        items={ANALYSES_BY_CATEGORY.deep}
        runs={runs}
        statusInputs={statusInputs}
        requirementChecks={requirementChecks}
        onTrigger={onTrigger}
      />
    </div>
  );
}
