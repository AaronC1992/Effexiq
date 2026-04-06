'use client';

/** Dashboard / Home section — use-case cards and "How It Works" intro. */
export default function DashboardSection() {
  return (
    <div id="dashboardPanel" className="app-section">
      <div className="dashboard-hero">
        <h1 className="dashboard-title">SoundGoblin</h1>
        <p className="dashboard-sub">
          AI-powered sound design for storytellers, dungeon masters, and creators.
        </p>
        <button id="demoBtn" className="hub-hero-cta" data-section="demoMode">
          Watch It In Action
        </button>
      </div>

      <div id="noKeyBanner" className="no-key-banner hidden">
        <span>
          Running without AI — instant keyword triggers active. Subscribe for full AI analysis.
        </span>
        <button id="showSubscribeModal">Subscribe</button>
      </div>

      {/* Use Case Cards */}
      <div className="use-case-grid">
        <div className="use-case-card" data-section="dndControlBoard" data-context="dnd">
          <div className="use-case-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h3 className="use-case-title">D&amp;D Campaign</h3>
          <p className="use-case-desc">
            Build a custom soundboard for your tabletop sessions. Manually trigger music, ambience,
            and SFX scene by scene as your campaign unfolds.
          </p>
          <span className="use-case-cta">Open Control Board →</span>
        </div>

        <div className="use-case-card" data-section="dndCreateCampaign" data-context="storytelling">
          <div className="use-case-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="8" y1="7" x2="16" y2="7" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <h3 className="use-case-title">Storytelling</h3>
          <p className="use-case-desc">
            Write or load a story and read it aloud. SoundGoblin follows your words and layers
            music, ambience, and sound effects in real time.
          </p>
          <span className="use-case-cta">Open Story Editor →</span>
        </div>

        <div className="use-case-card" data-section="dndAutoDetect" data-context="content">
          <div className="use-case-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
          </div>
          <h3 className="use-case-title">Content Creator</h3>
          <p className="use-case-desc">
            Let SoundGoblin listen to your stream, podcast, or recording and automatically play
            contextual sounds that match your live content.
          </p>
          <span className="use-case-cta">Start Listening →</span>
        </div>
      </div>

      {/* How It Works */}
      <section className="hub-how-it-works">
        <h2 className="hub-hiw-title">How It Works</h2>
        <div className="hub-hiw-steps">
          <div className="hub-hiw-step">
            <div className="hub-hiw-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h3>Speak or Write</h3>
            <p>Read your story aloud or type it in the editor.</p>
          </div>
          <div className="hub-hiw-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="hub-hiw-step">
            <div className="hub-hiw-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <h3>AI Analyzes Context</h3>
            <p>SoundGoblin detects mood, setting, and action in real time.</p>
          </div>
          <div className="hub-hiw-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="hub-hiw-step">
            <div className="hub-hiw-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3>Sounds Play Instantly</h3>
            <p>Music, SFX, and ambience play perfectly in sync.</p>
          </div>
          <div className="hub-hiw-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </div>
          <div className="hub-hiw-step">
            <div className="hub-hiw-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h3>Full Immersion</h3>
            <p>Your audience is transported into the story.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
