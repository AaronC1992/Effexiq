import Link from 'next/link';

export default function Home() {
  return (
    <div className="landing">
      {/* Hero */}
      <header className="landing-hero">
        <nav className="landing-nav">
          <span className="landing-brand">SuiteRhythm</span>
          <Link href="/dashboard" className="landing-nav-cta">
            Open App
          </Link>
        </nav>
        <div className="landing-hero-content">
          <h1 className="landing-h1">
            Reactive Sound Design<br />for Storytellers
          </h1>
          <p className="landing-tagline">
            SuiteRhythm listens to your voice and layers music, ambience, and sound
            effects in real time — no mixing board required.
          </p>
          <div className="landing-hero-actions">
            <Link href="/dashboard" className="landing-btn-primary">
              Launch SuiteRhythm
            </Link>
            <a href="#features" className="landing-btn-secondary">
              See How It Works
            </a>
          </div>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="landing-features">
        <h2 className="landing-section-title">Everything You Need</h2>
        <div className="landing-feature-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h3>Voice-Driven</h3>
            <p>
              Speak naturally and SuiteRhythm detects mood, setting, and action from
              your words in real time.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <h3>Scene Listener</h3>
            <p>
              Context-aware scene understanding picks the perfect sounds for
              every moment of your story.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3>Rich Sound Library</h3>
            <p>
              Hundreds of curated music tracks, SFX, and ambient loops covering
              fantasy, horror, sci-fi, and more.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3>9 Themed Modes</h3>
            <p>
              D&amp;D, horror, fairytale, bedtime, creator, and more — each
              with tailored rules and curated sound palettes.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <h3>OBS Integration</h3>
            <p>
              A dedicated browser source overlay lets streamers add live
              reactive audio to any broadcast.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="landing-feature-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <h3>Session Recording</h3>
            <p>
              Record your entire audio session — all layers mixed — and export
              it as a single file or individual stems.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-how">
        <h2 className="landing-section-title">How It Works</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <span className="landing-step-num">1</span>
            <h3>Pick a Mode</h3>
            <p>Choose D&amp;D, horror, fairytale, or let Auto mode figure it out.</p>
          </div>
          <div className="landing-step">
            <span className="landing-step-num">2</span>
            <h3>Start Talking</h3>
            <p>Read your story aloud or type it in. SuiteRhythm listens through your mic.</p>
          </div>
          <div className="landing-step">
            <span className="landing-step-num">3</span>
            <h3>Hear the Magic</h3>
            <p>Music, ambience, and effects play automatically, perfectly synced to your narrative.</p>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="landing-usecases">
        <h2 className="landing-section-title">Built For</h2>
        <div className="landing-usecase-grid">
          <div className="landing-usecase">
            <h3>Dungeon Masters</h3>
            <p>Build a custom soundboard or let SuiteRhythm score your campaign in real time.</p>
          </div>
          <div className="landing-usecase">
            <h3>Storytellers &amp; Authors</h3>
            <p>Write and narrate your stories with a cinematic audio backdrop.</p>
          </div>
          <div className="landing-usecase">
            <h3>Streamers &amp; Podcasters</h3>
            <p>Add reactive soundscapes to your live content with zero setup.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="landing-pricing">
        <h2 className="landing-section-title">Simple Pricing</h2>
        <div className="landing-pricing-grid">
          <div className="landing-pricing-card">
            <h3>Free</h3>
            <div className="landing-pricing-price">$0</div>
            <ul className="landing-pricing-features">
              <li>Core auto-detect mode</li>
              <li>Limited sound library</li>
              <li>Basic scene presets</li>
            </ul>
            <Link href="/dashboard" className="landing-btn-secondary">
              Get Started
            </Link>
          </div>
          <div className="landing-pricing-card featured">
            <span className="landing-pricing-badge">Most Popular</span>
            <h3>Pro</h3>
            <div className="landing-pricing-price">$10<span>/mo</span></div>
            <ul className="landing-pricing-features">
              <li>Full 450+ sound library</li>
              <li>Story mode &amp; editor</li>
              <li>Custom sound uploads</li>
              <li>Priority AI analysis</li>
              <li>OBS overlay</li>
            </ul>
            <Link href="/dashboard" className="landing-btn-primary">
              Start Free Trial
            </Link>
          </div>
          <div className="landing-pricing-card">
            <h3>Table License</h3>
            <div className="landing-pricing-price">$20<span>/mo</span></div>
            <ul className="landing-pricing-features">
              <li>Everything in Pro</li>
              <li>Multi-device sync</li>
              <li>Shared sessions</li>
              <li>Commercial use</li>
            </ul>
            <Link href="/dashboard" className="landing-btn-secondary">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Waitlist / Email Capture */}
      <section className="landing-waitlist">
        <h2 className="landing-section-title">Join the Waitlist</h2>
        <p className="landing-waitlist-sub">
          Be the first to know when we launch on Kickstarter. No spam, just one
          email when it&apos;s live.
        </p>
        <form
          className="landing-waitlist-form"
          action="https://formspree.io/f/mgorzzaj"
          method="POST"
        >
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            className="landing-waitlist-input"
          />
          <button type="submit" className="landing-btn-primary">
            Notify Me
          </button>
        </form>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <h2>Ready to bring your stories to life?</h2>
        <Link href="/dashboard" className="landing-btn-primary">
          Launch SuiteRhythm — Free
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
        <span>&copy; {new Date().getFullYear()} SuiteRhythm</span>
      </footer>
    </div>
  );
}
