import LegalShell from "@/components/LegalShell";

export const metadata = { title: "Data Processing Agreement — SAMA" };

export default function DPAPage() {
  return (
    <LegalShell title="Data Processing Agreement" effective="2026-04-30">
      <h2>1. Roles</h2>
      <p>
        For personal data uploaded by you to SAMA, you (Customer) are the
        controller and Successifier (Provider) is the processor. This DPA
        forms part of the Terms of Service.
      </p>

      <h2>2. Subject matter and duration</h2>
      <p>
        Provider processes Customer personal data only to deliver SAMA, for
        the duration of the subscription plus any retention period stated in
        the Privacy Policy.
      </p>

      <h2>3. Categories of data and data subjects</h2>
      <ul>
        <li>Customer&apos;s end-users that interact with Customer&apos;s site/CMS (where SAMA reads analytics).</li>
        <li>Customer&apos;s employees/contractors with dashboard access.</li>
        <li>Customer&apos;s leads and prospects (when Customer chooses to import them).</li>
      </ul>

      <h2>4. Sub-processors</h2>
      <p>
        Provider engages the following sub-processors. Customer authorises
        their use as part of accepting this DPA. Provider will give 30 days&apos;
        notice before adding new sub-processors.
      </p>
      <ul>
        <li>Supabase (hosting, database) — EU/US</li>
        <li>Vercel (web hosting) — global edge</li>
        <li>Railway (backend hosting) — US</li>
        <li>Anthropic (LLM) — US</li>
        <li>OpenAI (LLM) — US</li>
        <li>Perplexity (search) — US</li>
        <li>ValueSERP (Google SERP data) — global</li>
        <li>Brevo (transactional email) — EU</li>
      </ul>

      <h2>5. Provider obligations</h2>
      <ul>
        <li>Process personal data only on documented Customer instructions.</li>
        <li>Ensure persons authorised to process are bound by confidentiality.</li>
        <li>Implement appropriate technical and organisational security measures (Art. 32 GDPR).</li>
        <li>Assist Customer with data subject requests and security incident response.</li>
        <li>Notify Customer of personal data breaches without undue delay (within 72 hours).</li>
      </ul>

      <h2>6. International transfers</h2>
      <p>
        Where personal data is transferred outside the EU/EEA, transfers rely
        on the EU Standard Contractual Clauses (Module 2: controller to
        processor) which are incorporated by reference into this DPA.
      </p>

      <h2>7. Audit rights</h2>
      <p>
        Provider will make available information necessary to demonstrate
        compliance and contribute to audits. For security reasons, on-site
        audits are coordinated through written request and may be satisfied
        with third-party audit reports (e.g. SOC 2) where available.
      </p>

      <h2>8. Return and deletion</h2>
      <p>
        Upon termination Customer may export all personal data within 30 days.
        After that, Provider will delete or anonymise the data unless
        retention is required by law.
      </p>

      <p>
        To countersign this DPA for your organisation, email{" "}
        <a href="mailto:dpa@successifier.com">dpa@successifier.com</a> with
        your legal entity details.
      </p>
    </LegalShell>
  );
}
