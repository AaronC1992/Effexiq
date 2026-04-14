export const metadata = {
  title: 'Terms of Service - Effexiq',
};

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', color: '#e0e0e0', fontFamily: 'sans-serif', lineHeight: 1.7 }}>
      <h1 style={{ color: '#bb86fc' }}>Terms of Service</h1>
      <p><em>Last updated: April 2026</em></p>

      <h2>1. Acceptance</h2>
      <p>
        By accessing or using Effexiq (&ldquo;the Service&rdquo;), you agree to be bound by these
        Terms of Service. If you do not agree, do not use the Service.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        Effexiq is an AI-powered ambient sound design platform for tabletop RPG sessions,
        storytelling, and content creation. The Service analyses spoken audio via your microphone
        (with your permission) and plays contextual music and sound effects.
      </p>

      <h2>3. User Responsibilities</h2>
      <ul>
        <li>You must be at least 13 years old to use the Service.</li>
        <li>You are responsible for all activity under your account.</li>
        <li>You agree not to misuse, reverse-engineer, or abuse the Service or its APIs.</li>
      </ul>

      <h2>4. Subscriptions &amp; Payments</h2>
      <p>
        Some features require a paid subscription processed through Stripe. Subscriptions renew
        automatically unless cancelled. Refund requests are handled on a case-by-case basis.
      </p>

      <h2>5. Intellectual Property</h2>
      <p>
        All sounds, code, and branding are owned by Effexiq or licensed from third parties.
        You may not redistribute the sound library or recordings derived from it.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranty of any kind. Effexiq is not
        liable for any indirect, incidental, or consequential damages arising from use of the
        Service.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update these terms at any time. Continued use after changes constitutes acceptance.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions? Email <a href="mailto:aaroncue92@gmail.com" style={{ color: '#bb86fc' }}>aaroncue92@gmail.com</a>.
      </p>

      <p style={{ marginTop: 40 }}>
        <a href="/dashboard" style={{ color: '#bb86fc' }}>&larr; Back to Effexiq</a>
      </p>
    </main>
  );
}
