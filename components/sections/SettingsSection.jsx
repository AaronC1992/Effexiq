'use client';

/** Settings section — volume, playback options, scene presets, custom triggers. */
export default function SettingsSection() {
  return (
    <div id="settingsSection" className="app-section hidden">
      <div className="section-header">
        <h2>Settings</h2>
      </div>
      <div className="section-body">
        <p className="section-intro">Adjust volume, playback options, and performance settings.</p>

        {/* Appearance / Theme */}
        <section className="menu-section">
          <button className="menu-toggle" id="appearanceMenuToggle">
            Appearance
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="appearanceMenuContent">
            <h3>Theme</h3>
            <div className="theme-picker" id="themePicker">
              <button className="theme-card active" data-theme-value="dark" type="button">
                <div className="theme-card-preview dark-preview" />
                <div className="theme-card-label">Dark</div>
              </button>
              <button className="theme-card" data-theme-value="light" type="button">
                <div className="theme-card-preview light-preview" />
                <div className="theme-card-label">Light</div>
              </button>
            </div>
          </div>
        </section>

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

        {/* Audio Source (Pixabay) */}
        <section className="menu-section">
          <button className="menu-toggle" id="audioSourceMenuToggle">
            Audio Source
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="audioSourceMenuContent">
            <p className="info-text" style={{ marginBottom: 8 }}>
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
              <label className="toggle-switch">
                <input type="checkbox" id="toggleMusic" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="toggle-row">
              <label htmlFor="toggleSfx">Sound Effects</label>
              <label className="toggle-switch">
                <input type="checkbox" id="toggleSfx" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="toggle-row">
              <label htmlFor="togglePrediction">Auto Scene Detection</label>
              <label className="toggle-switch">
                <input type="checkbox" id="togglePrediction" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>

            <h3 style={{ marginTop: 20 }}>Creator Tools</h3>
            <div className="toggle-row">
              <label htmlFor="voiceDuckToggle">Voice Ducking</label>
              <label className="toggle-switch">
                <input type="checkbox" id="voiceDuckToggle" />
                <span className="toggle-slider" />
              </label>
            </div>
            <p className="info-text" style={{ marginTop: -4, marginBottom: 12 }}>
              Automatically lower music &amp; ambience when your voice is detected, then restore during pauses.
            </p>
            <div className="toggle-row">
              <label htmlFor="creatorModeToggle">Live Streamer Mode</label>
              <label className="toggle-switch">
                <input type="checkbox" id="creatorModeToggle" />
                <span className="toggle-slider" />
              </label>
            </div>
            <p className="info-text" style={{ marginTop: -4, marginBottom: 12 }}>
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
              <label className="toggle-switch">
                <input type="checkbox" id="lowLatencyMode" />
                <span className="toggle-slider" />
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

        {/* Bedtime Timer */}
        <section className="menu-section">
          <button className="menu-toggle" id="bedtimeMenuToggle">
            Bedtime Timer
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="bedtimeMenuContent">
            <p className="info-text">
              Automatically fade out all audio after a set time. The master volume fades over the
              final 60 seconds, then stops all audio.
            </p>
            <div className="slider-container">
              <label htmlFor="bedtimeTimerSelect">Fade-out after:</label>
              <select id="bedtimeTimerSelect" defaultValue="0">
                <option value="0">Off</option>
                <option value="5">5 min</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>
        </section>

        {/* Session Recording */}
        <section className="menu-section">
          <button className="menu-toggle" id="sessionRecMenuToggle">
            Session Recording
            <span className="toggle-indicator">&#9660;</span>
          </button>
          <div className="menu-content hidden" id="sessionRecMenuContent">
            <p className="info-text">
              Record everything — all sounds, music, and ambience — into a single downloadable
              audio file.
            </p>
            <div className="session-rec-controls">
              <button id="recStartBtn" className="btn-primary">Record Session</button>
              <button id="recStopBtn" className="btn-stop hidden">Stop Recording</button>
              <span id="recTimer" className="rec-timer hidden">0:00</span>
              <span id="recIndicator" className="rec-indicator hidden" />
            </div>
            <div id="recDownload" className="rec-download hidden">
              <audio id="recAudio" controls style={{ width: '100%', marginBottom: 8 }} />
              <div className="rec-download-actions">
                <button id="recDownloadBtn" className="btn-secondary">Download Mix</button>
                <button id="recDownloadStemsBtn" className="btn-secondary">Download Stems</button>
              </div>
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
