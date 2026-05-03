import LegalShell from "@/components/LegalShell";

export const metadata = { title: "Terms of Service — SAMA" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" effective="2026-04-30">
      <h2>1. Agreement</h2>
      <p>
        These Terms govern your access to and use of SAMA, a marketing
        automation product operated by Successifier. By creating an account,
        you accept these Terms.
      </p>

      <h2>2. Subscription and billing</h2>
      <p>
        Plans, prices, and limits are described on the pricing page. Fees are
        billed in advance for the selected period. You may cancel at any time;
        cancellation takes effect at the end of the current billing period.
      </p>

      <h2>3. Acceptable use</h2>
      <p>
        You will not use SAMA to publish illegal content, impersonate others,
        circumvent rate limits, or send spam. We may suspend accounts that
        violate this clause.
      </p>

      <h2>4. Customer content and AI outputs</h2>
      <p>
        You retain ownership of content you provide and AI-generated drafts
        produced for your brand. You are responsible for reviewing AI outputs
        before publishing them. SAMA defaults to a human-approval flow for
        content and social posts (see Approvals).
      </p>

      <h2>5. Service availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted
        service except where an SLA is explicitly stated in your plan.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, our aggregate liability under
        these Terms is limited to fees paid in the 12 months preceding the
        claim.
      </p>

      <h2>7. Termination</h2>
      <p>
        Either party may terminate for material breach with 30 days&apos; written
        notice if the breach is not cured. Upon termination, you may export
        your data for 30 days after which it may be deleted.
      </p>

      <h2>8. Governing law</h2>
      <p>
        These Terms are governed by the laws of Sweden. Disputes shall be
        resolved by the courts of Stockholm.
      </p>
    </LegalShell>
  );
}
