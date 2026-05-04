import { ImageResponse } from "next/og";
import { loadPublicAudit } from "@/lib/public-audit-store";

export const runtime = "nodejs";
export const alt = "AI-synlighetsrapport";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadPublicAudit(id);
  const domain = result?.domain ?? "din-sajt.se";
  const score = result?.audit.scores.overall ?? 0;
  const grade = score >= 80 ? "Stark" : score >= 60 ? "OK" : score >= 40 ? "Svag" : "Kritisk";
  const ringColor = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

  // Donut: stroke-dasharray with circumference 2πr ≈ 502 for r=80
  const r = 80;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #faf5ff 0%, #ffffff 50%, #eff6ff 100%)",
          padding: "60px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 12,
              background: "linear-gradient(135deg, #8b5cf6, #2563eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 28, fontWeight: 700,
            }}
          >
            ✦
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>Sama AI-audit</div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", marginTop: 30, gap: 56 }}>
          {/* Donut */}
          <div style={{ position: "relative", width: 220, height: 220, display: "flex" }}>
            <svg width="220" height="220" viewBox="0 0 220 220">
              <circle cx="110" cy="110" r={r} fill="none" stroke="#e2e8f0" strokeWidth="16" />
              <circle
                cx="110" cy="110" r={r}
                fill="none" stroke={ringColor} strokeWidth="16"
                strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
                transform="rotate(-90 110 110)"
              />
            </svg>
            <div
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 64, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 18, color: "#64748b", marginTop: 4 }}>/ 100</div>
            </div>
          </div>

          {/* Text */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: 22, color: "#7c3aed", fontWeight: 600, textTransform: "uppercase", letterSpacing: 2 }}>
              AI-synlighetsrapport
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, color: "#0f172a", marginTop: 12, lineHeight: 1.1 }}>
              {domain}
            </div>
            <div style={{ fontSize: 32, color: ringColor, fontWeight: 700, marginTop: 18 }}>
              {grade} · {score}/100
            </div>
            <div style={{ fontSize: 22, color: "#475569", marginTop: 22, maxWidth: 620 }}>
              Hur syns sajten i ChatGPT, Perplexity & Google AI?
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: "1px solid #e2e8f0", paddingTop: 24, fontSize: 20, color: "#64748b",
          }}
        >
          <span>Kör din egen gratis audit på 30 sekunder</span>
          <span style={{ fontWeight: 600, color: "#0f172a" }}>sama-ai → /c/audit</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
