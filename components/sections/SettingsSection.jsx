'use client';

/** Settings section — volume, playback options, scene presets, custom triggers. */
export default function SettingsSection() {
  return (
    <div id="settingsSection" className="app-section hidden" data-persona="all">
      <div className="section-header">
        <h2>Settings</h2>
      </div>
      <div className="section-body">
        <p className="section-intro">Adjust volume, playback options, and performance settings.</p>

        {/* Subscription Management */}
        <section className="menu-section">
          <button className="menu-toggle" id="subscriptionMenuToggle">
            Subscription
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="subscriptionMenuContent">
            <div id="subscriptionStatus" className="info-text" style={{ marginBottom: 10 }}>
              Checking subscription status...
            </div>
            <button id="refreshTokenBtn" className="btn-secondary" style={{ width: '100%', marginTop: 4 }}>
              Refresh Access Token
            </button>
            {/* TODO: Replace href with env-variable so billing URL is configurable */}
            <button
              id="manageSubscriptionBtn2"
              className="btn-secondary"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => window.open('https://billing.stripe.com/p/login/', '_blank')}
            >
              Manage Billing
            </button>
            <button id="subscribeBtn2" className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
              Subscribe &mdash; $10/month
            </button>
            <p className="info-text" style={{ marginTop: 12, fontSize: '0.8rem' }}>
              <a href="/terms" target="_blank">Terms of Service</a>
              &nbsp;&nbsp;&middot;&nbsp;&nbsp;
              <a href="/privacy" target="_blank">Privacy Policy</a>
            </p>
          </div>
        </section>

        {/* Appearance — Theme + Layout */}
        <section className="menu-section">
          <button className="menu-toggle" id="themeMenuToggle">
            Appearance
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="themeMenuContent">
            {/* Color Theme */}
            <h3>Color Theme</h3>
            <p className="info-text" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              Choose a color palette for the interface.
            </p>
            <div className="theme-picker-grid" id="themePicker">
              <button className="theme-card active" data-theme-value="" aria-label="Nightshade theme">
                <div className="theme-card-name">Nightshade</div>
                <div className="theme-card-swatches">
                  <span className="theme-swatch" style={{ background: '#8a2be2' }} />
                  <span className="theme-swatch" style={{ background: '#bb86fc' }} />
                  <span className="theme-swatch" style={{ background: '#03dac6' }} />
                  <span className="theme-swatch" style={{ background: '#0a0a0a' }} />
                </div>
              </button>
              <button className="theme-card" data-theme-value="ember-forge" aria-label="Ember Forge theme">
                <div className="theme-card-name">Ember Forge</div>
                <div className="theme-card-swatches">
                  <span className="theme-swatch" style={{ background: '#e65100' }} />
                  <span className="theme-swatch" style={{ background: '#ff9800' }} />
                  <span className="theme-swatch" style={{ background: '#ffab40' }} />
                  <span className="theme-swatch" style={{ background: '#0d0907' }} />
                </div>
              </button>
              <button className="theme-card" data-theme-value="arctic-depths" aria-label="Arctic Depths theme">
                <div className="theme-card-name">Arctic Depths</div>
                <div className="theme-card-swatches">
                  <span className="theme-swatch" style={{ background: '#0277bd' }} />
                  <span className="theme-swatch" style={{ background: '#4fc3f7' }} />
                  <span className="theme-swatch" style={{ background: '#00e5ff' }} />
                  <span className="theme-swatch" style={{ background: '#060a10' }} />
                </div>
              </button>
              <button className="theme-card" data-theme-value="verdant-grove" aria-label="Verdant Grove theme">
                <div className="theme-card-name">Verdant Grove</div>
                <div className="theme-card-swatches">
                  <span className="theme-swatch" style={{ background: '#2e7d32' }} />
                  <span className="theme-swatch" style={{ background: '#66bb6a' }} />
                  <span className="theme-swatch" style={{ background: '#00e676' }} />
                  <span className="theme-swatch" style={{ background: '#070a07' }} />
                </div>
              </button>
              <button className="theme-card" data-theme-value="crimson-night" aria-label="Crimson Night theme">
                <div className="theme-card-name">Crimson Night</div>
                <div className="theme-card-swatches">
                  <span className="theme-swatch" style={{ background: '#c62828' }} />
                  <span className="theme-swatch" style={{ background: '#ef5350' }} />
                  <span className="theme-swatch" style={{ background: '#ff80ab' }} />
                  <span className="theme-swatch" style={{ background: '#0a0608' }} />
                </div>
              </button>
              <button className="theme-card" data-theme-value="sunlit-studio" aria-label="Sunlit Studio theme">
                <div className="theme-card-name">Sunlit Studio</div>
                <div className="theme-card-swatches">
                  <span className="theme-swatch" style={{ background: '#6200ea' }} />
                  <span className="theme-swatch" style={{ background: '#7c4dff' }} />
                  <span className="theme-swatch" style={{ background: '#00bfa5' }} />
                  <span className="theme-swatch" style={{ background: '#f5f5f5' }} />
                </div>
              </button>
            </div>

            {/* Layout Mode */}
            <h3 style={{ marginTop: 24 }}>Layout</h3>
            <p className="info-text" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              Change how the interface is arranged.
            </p>
            <div className="layout-picker-grid" id="layoutPicker">
              <button className="layout-card active" data-layout-value="" aria-label="Classic layout">
                <div className="layout-card-preview layout-preview-classic">
                  <div className="lp-sidebar" />
                  <div className="lp-main">
                    <div className="lp-strip" />
                    <div className="lp-content" />
                  </div>
                </div>
                <div className="layout-card-name">Classic</div>
                <div className="layout-card-desc">Sidebar + wide content area</div>
              </button>
              <button className="layout-card" data-layout-value="compact" aria-label="Compact layout">
                <div className="layout-card-preview layout-preview-compact">
                  <div className="lp-topbar" />
                  <div className="lp-body">
                    <div className="lp-strip" />
                    <div className="lp-content lp-narrow" />
                  </div>
                </div>
                <div className="layout-card-name">Compact</div>
                <div className="layout-card-desc">Top nav, narrow centered content</div>
              </button>
              <button className="layout-card" data-layout-value="cinematic" aria-label="Cinematic layout">
                <div className="layout-card-preview layout-preview-cinematic">
                  <div className="lp-sidebar lp-thin" />
                  <div className="lp-main">
                    <div className="lp-content lp-full" />
                    <div className="lp-strip lp-bottom" />
                  </div>
                </div>
                <div className="layout-card-name">Cinematic</div>
                <div className="layout-card-desc">Slim icon sidebar, full-width sections, bar at bottom</div>
              </button>
              <button className="layout-card" data-layout-value="cozy" aria-label="Cozy layout">
                <div className="layout-card-preview layout-preview-cozy">
                  <div className="lp-sidebar" />
                  <div className="lp-main">
                    <div className="lp-strip" />
                    <div className="lp-content lp-rounded" />
                  </div>
                </div>
                <div className="layout-card-name">Cozy</div>
                <div className="layout-card-desc">Larger text, rounded cards, extra spacing</div>
              </button>
              <button className="layout-card" data-layout-value="streamer" aria-label="Streamer layout">
                <div className="layout-card-preview layout-preview-streamer">
                  <div className="lp-sidebar lp-thin" />
                  <div className="lp-main">
                    <div className="lp-strip lp-accent" />
                    <div className="lp-content lp-dense" />
                  </div>
                </div>
                <div className="layout-card-name">Streamer</div>
                <div className="layout-card-desc">Dense info, minimal chrome, fast scanning</div>
              </button>
              <button className="layout-card" data-layout-value="persona-tabs" aria-label="Persona Tabs layout">
                <div className="layout-card-preview layout-preview-persona">
                  <div className="lp-topbar" style={{ display: 'flex', gap: 2, padding: '0 2px' }}>
                    <span style={{ flex: 1, background: 'var(--primary, #8a2be2)', opacity: 0.5, borderRadius: 1 }} />
                    <span style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
                    <span style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
                  </div>
                  <div className="lp-body">
                    <div className="lp-content" />
                  </div>
                </div>
                <div className="layout-card-name">Persona Tabs</div>
                <div className="layout-card-desc">Top tabs for Streamer / Tabletop / Storyteller</div>
              </button>
              <button className="layout-card" data-layout-value="command-center" aria-label="Command Center layout">
                <div className="layout-card-preview layout-preview-command" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 3 }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 2 }} />
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 2 }} />
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 2 }} />
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 2 }} />
                </div>
                <div className="layout-card-name">Command Center</div>
                <div className="layout-card-desc">All sections visible in a multi-panel grid</div>
              </button>
              <button className="layout-card" data-layout-value="focus" aria-label="Focus layout">
                <div className="layout-card-preview layout-preview-focus" style={{ flexDirection: 'column' }}>
                  <div className="lp-strip" style={{ margin: 3, marginBottom: 0 }} />
                  <div className="lp-content lp-full" style={{ margin: 3, flex: 1 }} />
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 4, alignItems: 'center', padding: '0 8px' }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary, #8a2be2)', opacity: 0.6 }} />
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                  </div>
                </div>
                <div className="layout-card-name">Focus</div>
                <div className="layout-card-desc">Full-screen sections, bottom dock, zero distractions</div>
              </button>
              <button className="layout-card" data-layout-value="spotlight" aria-label="Spotlight layout">
                <div className="layout-card-preview layout-preview-spotlight" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, padding: 4 }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(transparent, var(--bg, #0a0a0a))' }} />
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(transparent, var(--bg, #0a0a0a))' }} />
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(transparent, var(--bg, #0a0a0a))' }} />
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(transparent, var(--bg, #0a0a0a))' }} />
                  </div>
                </div>
                <div className="layout-card-name">Spotlight</div>
                <div className="layout-card-desc">Card overview of all sections, click to expand</div>
              </button>

              {/* ── Single Page ── */}
              <button className="layout-card" data-layout-value="single-page" aria-label="Single Page layout">
                <div className="layout-card-preview" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
                  <div style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 3, height: 8 }} />
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 8 }} />
                  <div style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 3, height: 8 }} />
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 8 }} />
                  <div style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 3, height: 8 }} />
                </div>
                <div className="layout-card-name">Single Page</div>
                <div className="layout-card-desc">Everything on one continuous scroll</div>
              </button>

              {/* ── Carousel ── */}
              <button className="layout-card" data-layout-value="carousel" aria-label="Carousel layout">
                <div className="layout-card-preview" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.10)', borderRadius: 4, height: 28 }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                </div>
                <div className="layout-card-name">Carousel</div>
                <div className="layout-card-desc">Full-screen slides with arrow navigation</div>
              </button>

              {/* ── Split Screen ── */}
              <button className="layout-card" data-layout-value="split-screen" aria-label="Split Screen layout">
                <div className="layout-card-preview" style={{ display: 'flex', gap: 2, padding: 4 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.10)', borderRadius: 3 }} />
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
                </div>
                <div className="layout-card-name">Split Screen</div>
                <div className="layout-card-desc">Two sections side-by-side with selectors</div>
              </button>

              {/* ── Accordion ── */}
              <button className="layout-card" data-layout-value="accordion" aria-label="Accordion layout">
                <div className="layout-card-preview" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
                  <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 3, height: 5 }} />
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, height: 14, marginBottom: 2 }} />
                  <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 3, height: 5 }} />
                  <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 3, height: 5 }} />
                  <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 3, height: 5 }} />
                </div>
                <div className="layout-card-name">Accordion</div>
                <div className="layout-card-desc">Collapsible rows, one section open at a time</div>
              </button>

              {/* ── Top Tabs ── */}
              <button className="layout-card" data-layout-value="top-tabs" aria-label="Top Tabs layout">
                <div className="layout-card-preview" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--primary, #8a2be2)', opacity: 0.7 }} />
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
                </div>
                <div className="layout-card-name">Top Tabs</div>
                <div className="layout-card-desc">Horizontal tab bar across the top</div>
              </button>

              {/* ── Bottom Nav ── */}
              <button className="layout-card" data-layout-value="bottom-nav" aria-label="Bottom Nav layout">
                <div className="layout-card-preview" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', paddingTop: 3 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary, #8a2be2)', opacity: 0.7 }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
                  </div>
                </div>
                <div className="layout-card-name">Bottom Nav</div>
                <div className="layout-card-desc">Mobile-app style bottom tab bar</div>
              </button>

              {/* ── Floating / Zen ── */}
              <button className="layout-card" data-layout-value="floating" aria-label="Floating Zen layout">
                <div className="layout-card-preview" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 4, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary, #8a2be2)', opacity: 0.8, zIndex: 1 }} />
                </div>
                <div className="layout-card-name">Floating</div>
                <div className="layout-card-desc">Zero chrome, floating menu button</div>
              </button>
            </div>

            {/* Logo Variant */}
            <h3 style={{ marginTop: 24 }}>Logo Style</h3>
            <p className="info-text" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              Change the sidebar logo appearance.
            </p>
            <div className="logo-picker-grid" id="logoPicker">
              <button className="logo-card active" data-logo-value="" aria-label="Wordmark logo">
                <div className="logo-card-preview" style={{ fontSize: '0.8rem', fontWeight: 700 }}>SuiteRhythm</div>
                <div className="logo-card-name">Wordmark</div>
              </button>
              <button className="logo-card" data-logo-value="icon-text" aria-label="Icon + Text logo">
                <div className="logo-card-preview">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  <span style={{ marginLeft: 4 }}>Aa</span>
                </div>
                <div className="logo-card-name">Icon + Text</div>
              </button>
              <button className="logo-card" data-logo-value="minimal" aria-label="Minimal icon logo">
                <div className="logo-card-preview">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
                <div className="logo-card-name">Minimal</div>
              </button>
              <button className="logo-card" data-logo-value="stacked" aria-label="Stacked logo">
                <div className="logo-card-preview" style={{ flexDirection: 'column', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  <span style={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: 1 }}>SR</span>
                </div>
                <div className="logo-card-name">Stacked</div>
              </button>
              <button className="logo-card" data-logo-value="monogram" aria-label="Monogram logo">
                <div className="logo-card-preview">
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6rem', fontWeight: 800 }}>SR</span>
                </div>
                <div className="logo-card-name">Monogram</div>
              </button>
            </div>

            {/* Font Preset */}
            <h3 style={{ marginTop: 24 }}>Font</h3>
            <p className="info-text" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              Change the typeface used across the interface.
            </p>
            <div className="font-picker-grid" id="fontPicker">
              <button className="font-card active" data-font-value="" aria-label="System font">
                <div className="font-card-preview">Aa Bb Cc</div>
                <div className="font-card-name">System</div>
                <div className="font-card-desc">Default OS font</div>
              </button>
              <button className="font-card" data-font-value="mono" aria-label="Mono font">
                <div className="font-card-preview">Aa Bb Cc</div>
                <div className="font-card-name">Mono</div>
                <div className="font-card-desc">Techy / code</div>
              </button>
              <button className="font-card" data-font-value="rounded" aria-label="Rounded font">
                <div className="font-card-preview">Aa Bb Cc</div>
                <div className="font-card-name">Rounded</div>
                <div className="font-card-desc">Friendly / soft</div>
              </button>
              <button className="font-card" data-font-value="serif" aria-label="Serif font">
                <div className="font-card-preview">Aa Bb Cc</div>
                <div className="font-card-name">Serif</div>
                <div className="font-card-desc">Editorial / classic</div>
              </button>
              <button className="font-card" data-font-value="clean" aria-label="Clean font">
                <div className="font-card-preview">Aa Bb Cc</div>
                <div className="font-card-name">Clean</div>
                <div className="font-card-desc">Geometric / modern</div>
              </button>
            </div>

            {/* Corner Style */}
            <h3 style={{ marginTop: 24 }}>Corners</h3>
            <p className="info-text" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              Change the roundness of buttons, cards, and panels.
            </p>
            <div className="corner-picker-grid" id="cornerPicker">
              <button className="corner-card" data-corners-value="sharp" aria-label="Sharp corners">
                <div className="corner-card-preview" />
                <div className="corner-card-name">Sharp</div>
              </button>
              <button className="corner-card active" data-corners-value="" aria-label="Rounded corners">
                <div className="corner-card-preview" />
                <div className="corner-card-name">Rounded</div>
              </button>
              <button className="corner-card" data-corners-value="pill" aria-label="Pill corners">
                <div className="corner-card-preview" />
                <div className="corner-card-name">Pill</div>
              </button>
            </div>

            {/* Animation Level */}
            <h3 style={{ marginTop: 24 }}>Animation</h3>
            <p className="info-text" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              Control how much motion the interface uses.
            </p>
            <div className="anim-picker-grid" id="animPicker">
              <button className="anim-card" data-anim-value="none" aria-label="No animations">
                <div className="anim-card-preview" />
                <div className="anim-card-name">None</div>
                <div className="anim-card-desc">No motion</div>
              </button>
              <button className="anim-card active" data-anim-value="" aria-label="Subtle animations">
                <div className="anim-card-preview" />
                <div className="anim-card-name">Subtle</div>
                <div className="anim-card-desc">Default transitions</div>
              </button>
              <button className="anim-card" data-anim-value="full" aria-label="Full animations">
                <div className="anim-card-preview" />
                <div className="anim-card-name">Full</div>
                <div className="anim-card-desc">Extra motion</div>
              </button>
            </div>
          </div>
        </section>

        {/* Audio Source (Pixabay) */}
        <section className="menu-section">
          <button className="menu-toggle" id="audioSourceMenuToggle">
            Audio Source
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="audioSourceMenuContent">
            <p className="info-text" style={{ marginBottom: 8, fontSize: '0.85rem' }}>
              Add a <a href="https://pixabay.com/api/docs/" target="_blank" rel="noopener noreferrer">Pixabay API key</a> for additional high-quality sounds beyond the built-in library.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="pixabayKeyInput"
                type="password"
                placeholder="Pixabay API key"
                className="input-field"
                style={{ flex: 1 }}
                autoComplete="off"
              />
              <button id="saveAudioKeys" className="btn-secondary">Save</button>
            </div>
            <div id="pixabayKeyStatus" className="info-text" style={{ marginTop: 6, fontSize: '0.8rem' }} />
          </div>
        </section>

        {/* Volume Control */}
        <section className="menu-section">
          <button className="menu-toggle" id="volumeMenuToggle">
            Volume Control
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="volumeMenuContent">
            <h3>Volume Range</h3>
            <div className="slider-container">
              <label>Minimum: <span id="minVolumeValue">20</span>%</label>
              <input type="range" id="minVolume" min="0" max="100" defaultValue="20" />
            </div>
            <div className="slider-container">
              <label>Maximum: <span id="maxVolumeValue">70</span>%</label>
              <input type="range" id="maxVolume" min="0" max="100" defaultValue="70" />
            </div>
            <h3 style={{ marginTop: 20 }}>Mixer</h3>
            <div className="slider-container">
              <label>Music Level: <span id="musicLevelValue">50</span>%</label>
              <input type="range" id="musicLevel" min="0" max="100" defaultValue="50" />
            </div>
            <div className="slider-container">
              <label>Sound Effects Level: <span id="sfxLevelValue">90</span>%</label>
              <input type="range" id="sfxLevel" min="0" max="100" defaultValue="90" />
            </div>
            <button id="testSoundBtn" className="btn-secondary" style={{ marginTop: 8, width: '100%', fontSize: '0.85rem' }}>
              Test Sound
            </button>
            <h3 style={{ marginTop: 20 }}>Mood</h3>
            <div className="slider-container">
              <label>Mood/Intensity: <span id="moodBiasValue">50</span>%</label>
              <input type="range" id="moodBias" min="0" max="100" defaultValue="50" />
            </div>
          </div>
        </section>

        {/* Playback Options */}
        <section className="menu-section">
          <button className="menu-toggle" id="settingsMenuToggle">
            Settings
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="settingsMenuContent">
            <h3>Playback Options</h3>
            <div className="toggle-row">
              <label htmlFor="toggleMusic">Music</label>
              <label className="switch">
                <input type="checkbox" id="toggleMusic" defaultChecked />
                <span className="slider" />
              </label>
            </div>
            <div className="toggle-row">
              <label htmlFor="toggleSfx">Sound Effects</label>
              <label className="switch">
                <input type="checkbox" id="toggleSfx" defaultChecked />
                <span className="slider" />
              </label>
            </div>
            <div className="toggle-row">
              <label htmlFor="togglePrediction">Auto Scene Detection</label>
              <label className="switch">
                <input type="checkbox" id="togglePrediction" defaultChecked />
                <span className="slider" />
              </label>
            </div>

            <h3 style={{ marginTop: 20 }}>Creator Tools</h3>
            <div className="toggle-row">
              <label htmlFor="voiceDuckToggle">Voice Ducking</label>
              <label className="switch">
                <input type="checkbox" id="voiceDuckToggle" />
                <span className="slider" />
              </label>
            </div>
            <p className="info-text" style={{ fontSize: '0.78rem', marginTop: -4, marginBottom: 12 }}>
              Automatically lower music &amp; ambience when your voice is detected, then restore during pauses.
            </p>
            <div className="toggle-row">
              <label htmlFor="creatorModeToggle">Live Streamer Mode</label>
              <label className="switch">
                <input type="checkbox" id="creatorModeToggle" />
                <span className="slider" />
              </label>
            </div>
            <p className="info-text" style={{ fontSize: '0.78rem', marginTop: -4, marginBottom: 12 }}>
              Shorter cooldowns and snappier SFX triggering for live streams. Leave off for story narration.
            </p>

            <h3 style={{ marginTop: 20 }}>Performance</h3>
            <div className="toggle-row">
              <label
                htmlFor="lowLatencyMode"
                id="lowLatencyTooltip"
                className="tooltip"
                aria-describedby="lowLatencyTip"
              >
                Low Latency Mode
                <button
                  type="button"
                  id="lowLatencyHelp"
                  className="tooltip-icon"
                  aria-label="What is Low Latency Mode?"
                  aria-describedby="lowLatencyTip"
                >
                  ?
                </button>
                <span id="lowLatencyTip" role="tooltip" className="tooltip-content">
                  Preloads more sounds in parallel for faster reactions. Best on strong networks.
                </span>
              </label>
              <label className="switch">
                <input type="checkbox" id="lowLatencyMode" />
                <span className="slider" />
              </label>
            </div>
          </div>
        </section>

        {/* Trigger Cooldown */}
        <section className="menu-section">
          <button className="menu-toggle" id="triggerCooldownToggle">
            Trigger Cooldown
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="triggerCooldownContent">
            <p className="info-text">
              How long to wait before the same keyword can trigger a sound again. Lower = more
              responsive, Higher = less repetitive.
            </p>
            <div className="slider-container">
              <label>Cooldown: <span id="keywordCooldownValue">3</span>s</label>
              <input type="range" id="keywordCooldown" min="1" max="30" step="1" defaultValue="3" />
            </div>
          </div>
        </section>

        {/* Scene Presets */}
        <section className="menu-section">
          <button className="menu-toggle" id="scenePresetsToggle">
            Scene Presets
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="scenePresetsContent">
            <p className="info-text">
              Quick-switch scene buttons shown in Auto Detect. Click a preset to instantly set the
              mood and context. Double-click a preset name above to rename it.
            </p>
            <div id="scenePresetsList" />
            <button id="addScenePresetBtn" className="btn-secondary" style={{ marginTop: 12, width: '100%', fontSize: '0.85rem' }}>
              Add Preset
            </button>
          </div>
        </section>

        {/* Custom Phrase Triggers */}
        <section className="menu-section">
          <button className="menu-toggle" id="customPhrasesToggle">
            Custom Phrase Triggers
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="customPhrasesContent">
            <p className="info-text">
              Add phrases that trigger a specific sound when spoken aloud. The phrase is matched as
              a substring — multiple variants can share one sound.
            </p>
            <div id="customPhrasesList" />
            <div
              className="custom-phrase-add-row"
              style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
            >
              <input
                id="customPhraseInput"
                type="text"
                placeholder='e.g. "draws his blade"'
                style={{ flex: 2, minWidth: 120 }}
              />
              <input
                id="customPhraseQuery"
                type="text"
                placeholder="Sound query, e.g. sword draw"
                style={{ flex: 2, minWidth: 120 }}
              />
              <input
                id="customPhraseVolume"
                type="number"
                min="0"
                max="1"
                step="0.05"
                defaultValue="0.8"
                style={{ flex: '0 0 auto', minWidth: 55 }}
              />
              <button id="addCustomPhraseBtn" className="btn-secondary" style={{ flex: '0 0 auto' }}>
                Add
              </button>
            </div>
          </div>
        </section>

        {/* OBS WebSocket Integration */}
        <section className="menu-section">
          <button className="menu-toggle" id="obsSettingsToggle">
            OBS Integration
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="obsSettingsContent">
            <p className="info-text">
              Connect to OBS Studio via WebSocket to auto-switch scenes based on mood changes.
              Requires OBS with the obs-websocket plugin (v5) enabled.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <input
                id="obsHost"
                type="text"
                placeholder="Host (localhost)"
                defaultValue="localhost"
                style={{ flex: 2, minWidth: 100 }}
              />
              <input
                id="obsPort"
                type="number"
                placeholder="Port"
                defaultValue="4455"
                style={{ flex: '0 0 auto', width: 80 }}
              />
            </div>
            <input
              id="obsPassword"
              type="password"
              placeholder="Password (optional)"
              autoComplete="off"
              style={{ width: '100%', marginTop: 8 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button id="obsConnectBtn" className="btn-primary" style={{ flex: 1 }}>
                Connect
              </button>
              <button id="obsDisconnectBtn" className="btn-secondary" style={{ flex: 1 }}>
                Disconnect
              </button>
            </div>
            <div id="obsConnectionStatus" className="info-text" style={{ marginTop: 8 }}>
              Not connected
            </div>
            <h3 style={{ marginTop: 16 }}>Scene Mapping</h3>
            <p className="info-text">
              Map moods to OBS scene names. When SuiteRhythm detects a mood change, OBS will switch
              automatically.
            </p>
            <div id="obsSceneMapList" style={{ marginTop: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input
                id="obsMapMood"
                type="text"
                placeholder="Mood (e.g. combat)"
                style={{ flex: 1, minWidth: 100 }}
              />
              <input
                id="obsMapScene"
                type="text"
                placeholder="OBS Scene name"
                style={{ flex: 1, minWidth: 100 }}
              />
              <button id="obsAddMapping" className="btn-secondary" style={{ flex: '0 0 auto' }}>
                Add
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
