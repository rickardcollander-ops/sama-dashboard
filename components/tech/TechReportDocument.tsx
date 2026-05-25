import type { CSSProperties } from "react";
import type {
  AuditCategory,
  AuditSeverity,
  SiteAuditFinding,
  SiteAuditRun,
} from "@/app/c/analysis/audit-types";

/**
 * A code change previewed on the tech page. Structurally a subset of the
 * page's `PreviewResult` — duplicated here so the report component doesn't
 * import from the page module.
 */
export interface ReportCodeChange {
  title: string;
  description: string;
  target_url?: string | null;
  current_snippet?: string | null;
  suggested_snippet?: string | null;
  files: { path: string; content: string }[];
}

const SEVERITY_META: Record<AuditSeverity, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "Critical", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
  warning:  { label: "Warning",  color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  info:     { label: "Info",     color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  success:  { label: "Healthy",  color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
};

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  technical:   "Technical SEO",
  on_page:     "On-page SEO",
  geo:         "GEO readiness",
  links:       "Link health",
  performance: "Performance",
};

const SEV_ORDER: Record<AuditSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };

function scoreColor(score: number): string {
  if (score >= 80) return "#047857";
  if (score >= 50) return "#b45309";
  return "#b91c1c";
}

const label: CSSProperties = {
  fontSize: "0.65rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#64748b",
  marginBottom: "0.35rem",
};

const codeBlock: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.7rem",
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  borderRadius: "0.375rem",
  padding: "0.75rem",
  margin: 0,
};

/**
 * Printable technical SEO report. Rendered inside the page's `#pdf-export`
 * container (hidden on screen, revealed by the print stylesheet). Lists every
 * audit finding, the pages each one affects, and how to fix it — with an
 * optional appendix of proposed code changes the user previewed.
 */
export default function TechReportDocument({
  run,
  codeChanges = [],
  generatedAt,
}: {
  run: SiteAuditRun | null;
  codeChanges?: ReportCodeChange[];
  generatedAt?: Date;
}) {
  const date = generatedAt ?? new Date();

  // "Errors" = everything that isn't a passing check, most severe first.
  const findings: SiteAuditFinding[] = (run?.findings ?? [])
    .filter((f) => f.severity !== "success")
    .slice()
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  const brokenLinks = run?.broken_links ?? [];

  return (
    <div style={{ color: "#0f172a", maxWidth: "780px", margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{ borderBottom: "3px solid #7c3aed", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <p style={{ ...label, color: "#7c3aed", marginBottom: "0.25rem" }}>
              SAMA · Technical SEO report
            </p>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 0.25rem" }}>
              {run?.domain || "Your website"}
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>
              Generated {date.toLocaleDateString()} ·{" "}
              {run?.summary?.pages_analyzed ?? 0} pages analyzed ·{" "}
              {findings.length} {findings.length === 1 ? "issue" : "issues"} found
            </p>
          </div>
          {run && (
            <div
              style={{
                flexShrink: 0,
                width: "76px",
                height: "76px",
                borderRadius: "50%",
                border: `4px solid ${scoreColor(run.scores.overall)}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: scoreColor(run.scores.overall), lineHeight: 1 }}>
                {Math.round(run.scores.overall)}
              </span>
              <span style={{ fontSize: "0.55rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Health
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Summary: issue counts + category scores ────────────── */}
      <section style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <SummaryChip label="Critical" value={counts.critical} meta={SEVERITY_META.critical} />
          <SummaryChip label="Warnings" value={counts.warning} meta={SEVERITY_META.warning} />
          <SummaryChip label="Info" value={counts.info} meta={SEVERITY_META.info} />
        </div>
        {run && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <ScoreChip label="Technical" value={run.scores.technical_seo} />
            <ScoreChip label="On-page" value={run.scores.on_page_seo} />
            <ScoreChip label="GEO" value={run.scores.geo_readiness} />
            <ScoreChip label="Links" value={run.scores.link_health} />
            <ScoreChip label="Performance" value={run.scores.performance} />
          </div>
        )}
      </section>

      {/* ── Findings ───────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem", paddingBottom: "0.35rem", borderBottom: "1px solid #e2e8f0" }}>
          Issues &amp; how to fix them
        </h2>

        {findings.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
            {run
              ? "No issues found on the audited pages — your site looks healthy."
              : "No analysis data available yet. Run a site analysis to populate this report."}
          </p>
        ) : (
          findings.map((f, i) => <FindingBlock key={i} finding={f} index={i + 1} />)
        )}
      </section>

      {/* ── Broken links ───────────────────────────────────────── */}
      {brokenLinks.length > 0 && (
        <section style={{ marginTop: "1.75rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem", paddingBottom: "0.35rem", borderBottom: "1px solid #e2e8f0" }}>
            Broken links ({brokenLinks.length})
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid #e2e8f0" }}>Broken URL</th>
                <th style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid #e2e8f0", width: "60px" }}>Status</th>
                <th style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid #e2e8f0" }}>Found on</th>
              </tr>
            </thead>
            <tbody>
              {brokenLinks.map((b, i) => (
                <tr key={i} style={{ pageBreakInside: "avoid" }}>
                  <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid #f1f5f9", wordBreak: "break-all", color: "#334155" }}>
                    {b.url}
                  </td>
                  <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid #f1f5f9", color: "#b91c1c", fontWeight: 600 }}>
                    {b.status_code || "err"}
                  </td>
                  <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid #f1f5f9", wordBreak: "break-all", color: "#64748b" }}>
                    {b.found_on?.[0] || "—"}
                    {b.found_on && b.found_on.length > 1 ? ` +${b.found_on.length - 1} more` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Appendix: proposed code changes ────────────────────── */}
      {codeChanges.length > 0 && (
        <section style={{ marginTop: "1.75rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem", paddingBottom: "0.35rem", borderBottom: "1px solid #e2e8f0" }}>
            Appendix · Proposed code changes
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.75rem", margin: "0 0 1rem" }}>
            Ready-to-paste code for the changes previewed in the tech agent. Hand these to your developer.
          </p>
          {codeChanges.map((item, i) => (
            <CodeChangeBlock key={i} item={item} index={i + 1} />
          ))}
        </section>
      )}

      <footer style={{ marginTop: "2rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0", color: "#94a3b8", fontSize: "0.7rem" }}>
        Generated by SAMA · {date.toLocaleString()}
      </footer>
    </div>
  );
}

function SummaryChip({ label: name, value, meta }: { label: string; value: number; meta: { color: string; bg: string; border: string } }) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: "110px",
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: "0.5rem",
        padding: "0.6rem 0.75rem",
      }}
    >
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: meta.color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.7rem", color: meta.color, fontWeight: 600, marginTop: "0.15rem" }}>{name}</div>
    </div>
  );
}

function ScoreChip({ label: name, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: "90px",
        border: "1px solid #e2e8f0",
        borderRadius: "0.5rem",
        padding: "0.5rem 0.6rem",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: scoreColor(value) }}>{Math.round(value)}</div>
      <div style={{ fontSize: "0.62rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{name}</div>
    </div>
  );
}

function FindingBlock({ finding: f, index }: { finding: SiteAuditFinding; index: number }) {
  const meta = SEVERITY_META[f.severity];
  // Map example details onto their URL so each affected page can show the
  // concrete measured value (e.g. "title — 3 chars") next to the link.
  const detailByUrl = new Map<string, string>();
  for (const ex of f.examples ?? []) {
    if (ex.url && ex.detail) detailByUrl.set(ex.url, ex.detail);
  }
  const urls = f.affected_urls ?? [];
  const extraPages = (f.affected_pages || urls.length) - urls.length;

  return (
    <article
      style={{
        border: `1px solid ${meta.border}`,
        borderLeft: `4px solid ${meta.color}`,
        borderRadius: "0.5rem",
        padding: "0.9rem 1rem",
        marginBottom: "0.85rem",
        background: "#fff",
        pageBreakInside: "avoid",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
        <span
          style={{
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
            borderRadius: "9999px",
            padding: "0.1rem 0.5rem",
            fontSize: "0.62rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {meta.label}
        </span>
        <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>
          {CATEGORY_LABEL[f.category] ?? f.category}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.35rem" }}>
          {f.impact && <Tag text={`Impact: ${f.impact}`} />}
          {f.effort && <Tag text={`Effort: ${f.effort}`} />}
        </div>
      </div>

      <h3 style={{ fontSize: "0.92rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
        {index}. {f.title}
      </h3>
      {f.description && (
        <p style={{ fontSize: "0.8rem", color: "#475569", margin: "0 0 0.6rem", lineHeight: 1.5 }}>{f.description}</p>
      )}

      {(urls.length > 0 || (f.affected_pages ?? 0) > 0) && (
        <div style={{ marginBottom: f.how_to_fix ? "0.6rem" : 0 }}>
          <p style={label}>
            Affected pages{f.affected_pages ? ` (${f.affected_pages})` : ""}
          </p>
          {urls.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.72rem", color: "#334155" }}>
              {urls.map((u, i) => {
                const detail = detailByUrl.get(u);
                return (
                  <li key={i} style={{ wordBreak: "break-all", marginBottom: "0.1rem" }}>
                    {u}
                    {detail && <span style={{ color: "#64748b" }}> — {detail}</span>}
                  </li>
                );
              })}
              {extraPages > 0 && (
                <li style={{ color: "#94a3b8", listStyle: "none", marginLeft: "-1rem" }}>
                  + {extraPages} more {extraPages === 1 ? "page" : "pages"}
                </li>
              )}
            </ul>
          ) : (
            <p style={{ fontSize: "0.72rem", color: "#64748b", margin: 0 }}>
              {f.affected_pages} {f.affected_pages === 1 ? "page" : "pages"} affected
            </p>
          )}
        </div>
      )}

      {f.how_to_fix && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            padding: "0.6rem 0.75rem",
          }}
        >
          <p style={{ ...label, color: "#047857", marginBottom: "0.25rem" }}>How to fix</p>
          <p style={{ fontSize: "0.75rem", color: "#334155", margin: 0, lineHeight: 1.55, whiteSpace: "pre-line" }}>
            {f.how_to_fix}
          </p>
        </div>
      )}
    </article>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <span
      style={{
        background: "#f1f5f9",
        color: "#475569",
        borderRadius: "9999px",
        padding: "0.1rem 0.45rem",
        fontSize: "0.6rem",
        fontWeight: 600,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function CodeChangeBlock({ item, index }: { item: ReportCodeChange; index: number }) {
  return (
    <div style={{ marginBottom: "1.25rem", pageBreakInside: "avoid" }}>
      <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.2rem" }}>
        {index}. {item.title}
      </h3>
      {item.description && (
        <p style={{ color: "#475569", fontSize: "0.78rem", margin: "0 0 0.4rem" }}>{item.description}</p>
      )}
      {item.target_url && (
        <p style={{ color: "#7c3aed", fontSize: "0.7rem", margin: "0 0 0.6rem", wordBreak: "break-all" }}>
          Page: {item.target_url}
        </p>
      )}
      {item.current_snippet && (
        <div style={{ marginBottom: "0.6rem" }}>
          <p style={{ ...label, color: "#b91c1c" }}>Before (current code)</p>
          <pre style={{ ...codeBlock, background: "#fef2f2", border: "1px solid #fecaca" }}>{item.current_snippet}</pre>
        </div>
      )}
      {item.suggested_snippet && (
        <div style={{ marginBottom: "0.6rem" }}>
          <p style={{ ...label, color: "#047857" }}>After (paste this)</p>
          <pre style={{ ...codeBlock, background: "#ecfdf5", border: "1px solid #a7f3d0" }}>{item.suggested_snippet}</pre>
        </div>
      )}
      {item.files.map((file, fi) => (
        <div key={fi} style={{ marginBottom: "0.6rem" }}>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", color: "#64748b", margin: "0 0 0.25rem" }}>
            {file.path}
          </p>
          <pre style={{ ...codeBlock, background: "#f8fafc", border: "1px solid #e2e8f0" }}>{file.content}</pre>
        </div>
      ))}
    </div>
  );
}
