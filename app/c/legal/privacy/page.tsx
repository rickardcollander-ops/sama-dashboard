import LegalShell from "@/components/LegalShell";

export const metadata = { title: "Privacy Policy — SAMA" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" effective="2026-04-30">
      <h2>1. Who we are</h2>
      <p>
        Successifier (the &quot;data controller&quot;) provides SAMA. Contact:{" "}
        <a href="mailto:privacy@successifier.com">privacy@successifier.com</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, organisation.</li>
        <li><strong>Brand context:</strong> brand name, domain, target audience, USP, competitors, queries — provided by you.</li>
        <li><strong>Integration credentials:</strong> OAuth tokens for Google Search Console, Google Analytics, Meta Ads, etc., when you connect them.</li>
        <li><strong>Usage telemetry:</strong> agent runs, errors, request counts. Used for support and billing.</li>
        <li><strong>Cookies:</strong> session and CSRF cookies only. No third-party trackers run in the dashboard.</li>
      </ul>

      <h2>3. Why we process it</h2>
      <p>
        To deliver the service, secure your account, bill correctly, and
        improve product quality. We rely on contract performance (Art. 6(1)(b)
        GDPR) and legitimate interest (Art. 6(1)(f)) for product analytics.
      </p>

      <h2>4. AI sub-processors</h2>
      <p>
        SAMA sends prompts and brand context to model providers (Anthropic,
        OpenAI, Perplexity) to generate marketing assets. Inputs may include
        your brand description, queries, and competitor list — never customer
        passwords or payment data. See our DPA for the full list of
        sub-processors.
      </p>

      <h2>5. Data retention</h2>
      <p>
        Account data is retained while your subscription is active and for 30
        days thereafter to permit reactivation. You can request earlier
        deletion at any time.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You can access, correct, export, or delete your personal data via
        Settings → Account, or by emailing us. If you are in the EU/EEA, you
        also have the right to lodge a complaint with your local data
        protection authority.
      </p>

      <h2>7. Security</h2>
      <p>
        Data is encrypted in transit (TLS 1.2+) and at rest. Access to
        production systems is restricted to authorised personnel. We log
        privileged actions for audit.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Some sub-processors are based in the US. Transfers rely on Standard
        Contractual Clauses where applicable.
      </p>

      <h2>9. Changes</h2>
      <p>
        We will post material changes to this policy and notify you by email
        at least 30 days before they take effect.
      </p>
    </LegalShell>
  );
}
