'use client';

/**
 * Collection of all overlay/modal components.
 * Grouped in one file to keep imports clean in AppShell.
 * Each modal is always rendered in the DOM (hidden via CSS class) so the
 * SoundGoblin engine can show/hide them via classList manipulation.
 */

export function SubscribeModal() {
  return (
    <div
      id="subscribeModal"
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribeModalTitle"
    >
      <div className="modal-content">
        <h2 id="subscribeModalTitle">Welcome to SoundGoblin</h2>
        <p><strong>AI-Powered Sound Design Platform</strong></p>
        <p className="info-text">
          Get unlimited AI sound analysis for storytelling, D&amp;D, and content creation &mdash;
          $10/month.
        </p>

        <div className="provider-info" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-2)', margin: '16px 0' }}>
            $10 / month
          </p>
          <button
            id="subscribeBtn"
            className="btn-primary"
            style={{ width: '100%', padding: 14, fontSize: '1.05rem' }}
          >
            Subscribe &mdash; $10/month
          </button>
          <button
            id="enterTokenBtn"
            className="btn-secondary"
            style={{ width: '100%', marginTop: 8 }}
          >
            I have an access token
          </button>
        </div>

        <div id="enterTokenForm" className="hidden" style={{ marginTop: 12 }}>
          <input
            type="password"
            id="accessTokenInput"
            placeholder="Paste your access token..."
            autoComplete="off"
            style={{ marginTop: 6 }}
          />
          <button
            id="saveTokenBtn"
            className="btn-primary"
            style={{ width: '100%', marginTop: 8 }}
          >
            Activate Token
          </button>
        </div>

        <button
          id="skipApiKey"
          className="btn-secondary"
          style={{ width: '100%', marginTop: 8 }}
        >
          Try Without AI
        </button>

        <p className="info-text" style={{ marginTop: 14, fontSize: '0.8rem', textAlign: 'center' }}>
          {/* TODO: create /terms and /privacy Next.js routes */}
          <a href="/terms" target="_blank">Terms of Service</a>
          &nbsp;&nbsp;&middot;&nbsp;&nbsp;
          <a href="/privacy" target="_blank">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}

export function TutorialModal() {
  return (
    <div
      id="tutorialModal"
      className="modal hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorialModalTitle"
    >
      <div className="modal-content tutorial-content">
        <button id="closeTutorial" className="close-btn">✕</button>
        <h2 id="tutorialModalTitle">SoundGoblin Tutorial</h2>
        <p className="tutorial-intro">
          Welcome to SoundGoblin! Here&apos;s everything you need to know to get started.
        </p>

        <div className="tutorial-section">
          <h3>Volume Controls</h3>
          <p><strong>Min/Max Volume:</strong> Set the range for automatic volume adjustments.</p>
          <p><strong>Music Level:</strong> Control background music volume independently (0-100%).</p>
          <p><strong>Sound Effects Level:</strong> Control SFX volume independently (0-100%).</p>
          <p>
            <strong>Mood/Intensity:</strong> Bias audio choices from calm (0%) to intense (100%).
            Higher values = louder music, deeper ducking, more dramatic effects.
          </p>
        </div>

        <div className="tutorial-section">
          <h3>Performance</h3>
          <p>
            <strong>Low Latency Mode:</strong> When enabled, SoundGoblin preloads more sounds in
            parallel and responds faster. Best on strong networks and modern devices; may use more
            bandwidth and battery.
          </p>
        </div>

        <div className="tutorial-section">
          <h3>Playback Options</h3>
          <p><strong>Music Toggle:</strong> Turn background music on/off.</p>
          <p><strong>SFX Toggle:</strong> Turn sound effects on/off.</p>
          <p>
            <strong>AI Predictions:</strong> When enabled, SoundGoblin analyzes what you say and
            auto-plays matching music/SFX. Default is off. Turn off to prevent any automatic sounds;
            instant keyword triggers (e.g., &quot;bang&quot;, &quot;knock&quot;, &quot;bark&quot;)
            still work.
          </p>
          <p className="info-text">Tip: Turn one off to have the AI play only music or only SFX.</p>
        </div>

        <div className="tutorial-section">
          <h3>Voice Commands</h3>
          <p>Control SoundGoblin hands-free while listening:</p>
          <ul>
            <li><strong>&quot;Skip track&quot;</strong> or <strong>&quot;Next song&quot;</strong> - Change the music</li>
            <li><strong>&quot;Quieter music&quot;</strong> or <strong>&quot;Louder music&quot;</strong> - Adjust music volume by 10%</li>
            <li><strong>&quot;Mute music&quot;</strong> or <strong>&quot;Unmute music&quot;</strong> - Toggle music on/off</li>
            <li><strong>&quot;Mute sound effects&quot;</strong> or <strong>&quot;Unmute SFX&quot;</strong> - Toggle SFX on/off</li>
          </ul>
        </div>

        <div className="tutorial-section">
          <h3>Audio Features</h3>
          <p><strong>Music Ducking:</strong> Music automatically lowers when sound effects play, then returns smoothly.</p>
          <p><strong>Spatial Audio:</strong> SFX are positioned in stereo for immersive depth.</p>
          <p><strong>Loudness Normalization:</strong> All sounds are balanced to consistent volume.</p>
          <p><strong>Crossfades:</strong> Music transitions smoothly without abrupt cuts.</p>
          <p>
            <strong>Stingers:</strong> Periodic ambient sounds play every 20-45 seconds for variety
            (only when <em>AI Predictions</em> is enabled).
          </p>
        </div>

        <div className="tutorial-section">
          <h3>Tips</h3>
          <ul>
            <li>Speak clearly and close to your microphone for best results</li>
            <li>Instant triggers: Words like &quot;bang&quot;, &quot;crash&quot;, &quot;knock&quot;, &quot;bark&quot; play sounds immediately</li>
            <li>Use the Mood slider to match your story&apos;s intensity</li>
            <li>Enable Low Latency Mode for split-second reactions</li>
            <li>The AI learns context over time - keep talking for better sound matching</li>
          </ul>
        </div>

        <button id="closeTutorialBtn" className="btn-primary" style={{ marginTop: 20 }}>
          Got It!
        </button>
      </div>
    </div>
  );
}

export function FeedbackModal() {
  return (
    <div
      id="feedbackModal"
      className="modal hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedbackModalTitle"
    >
      <div className="modal-content">
        <h2 id="feedbackModalTitle">Feedback / Suggestion</h2>
        <p className="info-text">
          This opens your email app or Gmail with a prefilled message to Aaron. You&apos;ll need to
          press Send to deliver it.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <select id="feedbackType" className="mode-dropdown" style={{ flex: 0.6 }}>
            <option value="Bug Report">Bug Report</option>
            <option value="Suggestion">Suggestion</option>
            <option value="Question">Question</option>
          </select>
          <input type="text" id="feedbackSubject" placeholder="Subject (optional)" style={{ flex: 1 }} />
        </div>

        <textarea
          id="feedbackText"
          rows="6"
          placeholder="Describe the bug, suggestion, or question..."
          style={{ marginTop: 12, width: '100%', resize: 'vertical' }}
        />

        <p className="info-text">
          Recipient: <strong>aaroncue92@gmail.com</strong>
        </p>

        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 15 }}
        >
          <button id="sendFeedbackBtn" className="btn-primary">Open Email App</button>
          <button id="openGmailBtn" className="btn-secondary">Open in Gmail</button>
          <button id="copyFeedbackBtn" className="btn-secondary">Copy Details</button>
          <button id="cancelFeedback" className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function LoadingOverlay() {
  return (
    <div id="loadingOverlay" className="overlay hidden" aria-live="polite" aria-busy="true">
      <div className="overlay-content">
        <div className="spinner" aria-hidden="true" />
        <div id="loadingMessage">Preparing sounds...</div>
        <div className="preload-progress">
          <div className="preload-bar-track">
            <div id="preloadBarFill" className="preload-bar-fill" style={{ width: '0%' }} />
          </div>
          <div id="preloadText" className="preload-text" />
        </div>
      </div>
    </div>
  );
}

export function StoryContextModal() {
  return (
    <div
      id="storyContextModal"
      className="modal hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storyContextModalTitle"
    >
      <div className="modal-content">
        <h2 id="storyContextModalTitle">Set the Scene</h2>
        <p className="info-text">
          Give the AI some context about your story to help it choose better sounds and music!
        </p>

        <div className="story-context-body">
          <label htmlFor="storyContextInput" className="story-context-label">
            Story Context (Optional)
          </label>
          <textarea
            id="storyContextInput"
            rows="5"
            className="story-context-input"
            placeholder="Example: 'A dark medieval fantasy adventure in a haunted castle' or 'A cheerful children's story in a magical forest'"
          />
          <p className="info-text story-context-tip">
            Tip: Mention the setting, genre, mood, or time period. The AI will use this to better
            understand your story and choose appropriate sounds.
          </p>
        </div>

        <div className="story-context-actions">
          <button id="startWithContext" className="btn-primary">Start Listening</button>
          <button id="skipContext" className="btn-secondary">Skip &amp; Start</button>
        </div>
      </div>
    </div>
  );
}

export function StoryOverlay() {
  return (
    <div id="storyOverlay" className="story-overlay hidden">
      <div className="story-header">
        <button id="closeStory" className="close-btn" aria-label="Close story">✕</button>
        <h2 id="storyTitle" className="story-title" />
      </div>
      <div id="storyContent" className="story-content" tabIndex={0} />
      {/* Demo controls shown inside the story overlay when demo mode is active */}
      <div id="demoControls" className="demo-controls hidden">
        <span id="demoStatusText" className="demo-status-text" />
        <div className="demo-controls-buttons">
          <button id="demoStartListening" className="btn-primary demo-start-btn">Start Listening</button>
          <button id="demoAutoReadBtn" className="btn-secondary">Auto Read</button>
          <button id="demoStopBtn" className="btn-secondary demo-stop-btn hidden">Stop</button>
        </div>
      </div>
    </div>
  );
}

export function DemoSelectorOverlay() {
  return (
    <div id="demoSelectorOverlay" className="overlay hidden">
      <div className="overlay-content" style={{ flexDirection: 'column', maxWidth: 600, width: '90%' }}>
        <button id="demoSelectorClose" className="close-btn" aria-label="Close" style={{ alignSelf: 'flex-end' }}>✕</button>
        <h2 style={{ margin: 0 }}>Choose a Demo Story</h2>
        <div id="demoStoryList" className="demo-story-list" />
      </div>
    </div>
  );
}
