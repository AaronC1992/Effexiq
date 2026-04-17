'use client';

/** Auto Detect section — microphone listening + live transcript + activity feed. */
export default function AutoDetectSection() {
  return (
    <div id="dndAutoDetect" className="app-section hidden">
      <div className="section-header">
        <h2>Auto Detect</h2>
      </div>
      <div className="section-body">
        <p className="section-intro">
          Effexiq will listen and automatically play contextual sounds and music.
        </p>

        {/* Mode Selector */}
        <div className="mode-selector">
          <h3>Mode</h3>
          <div className="mode-buttons">
            {[
              { mode: 'auto', label: 'Auto' },
              { mode: 'dnd', label: 'D&D' },
              { mode: 'horror', label: 'Horror' },
              { mode: 'bedtime', label: 'Bedtime' },
              { mode: 'fairytale', label: 'Fairytale' },
              { mode: 'christmas', label: 'Christmas' },
              { mode: 'halloween', label: 'Halloween' },
              { mode: 'creator', label: 'Creator' },
              { mode: 'sing', label: 'Sing' },
            ].map(({ mode, label }) => (
              <button
                key={mode}
                className={`mode-btn${mode === 'auto' ? ' active' : ''}`}
                data-mode={mode}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scene Presets Bar — populated by Effexiq engine */}
        <div className="scene-presets-bar" id="scenePresetsBar" />

        {/* Sing Mode Panel — shown by the engine when mode === 'sing' via .visualizer-section.mode-sing CSS hook */}
        <section id="singModePanel" className="sing-mode-panel" style={{ display: 'none' }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Sing Mode</h3>
          <p className="info-text" style={{ marginTop: 0 }}>
            Start singing. Effexiq will pick backing music that matches your tempo and energy, and keep it going between verses. Headphones recommended so your mic doesn&apos;t catch the music.
          </p>
          <div className="sing-stats">
            <div className="stat-item">
              <span className="stat-value" id="singBpmReadout">— BPM</span>
              <span className="stat-label">Detected Tempo</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" id="singStateReadout">idle</span>
              <span className="stat-label">State</span>
            </div>
          </div>
          <div className="toggle-row" style={{ marginTop: 8 }}>
            <label htmlFor="singApplauseToggle">Applause on song end</label>
            <label className="switch">
              <input type="checkbox" id="singApplauseToggle" defaultChecked />
              <span className="slider" />
            </label>
          </div>
          <p className="info-text" style={{ fontSize: '0.78rem', marginTop: 0 }}>
            Plays a crowd applause cue after ~6s of silence following a sustained song.
          </p>
          <div className="toggle-row" style={{ marginTop: 8 }}>
            <label htmlFor="singStageFeelToggle">Live stage feel</label>
            <label className="switch">
              <input type="checkbox" id="singStageFeelToggle" />
              <span className="slider" />
            </label>
          </div>
          <p className="info-text" style={{ fontSize: '0.78rem', marginTop: 0 }}>
            Occasional quiet crowd cheers/whistles mid-song, like a live gig. Off = silent audience.
          </p>
        </section>

        <div className="context-input-area">
          <label htmlFor="dndContextInput">Story Context (Optional)</label>
          <textarea
            id="dndContextInput"
            rows="4"
            placeholder="Example: 'A dark medieval dungeon crawl beneath a cursed castle' or 'A tavern scene in a bustling port city'"
          />
          <p className="info-text">
            Describe the setting, genre, or mood to help the AI choose better sounds.
          </p>
        </div>

        {/* Session Stats */}
        <section className="session-stats" id="sessionStats">
          <div className="stat-item">
            <span className="stat-value" id="statSounds">0</span>
            <span className="stat-label">Sounds</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="statTriggers">0</span>
            <span className="stat-label">Triggers</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="statTransitions">0</span>
            <span className="stat-label">Music</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="statKeywords">0</span>
            <span className="stat-label">Keywords</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" id="statAnalyses">0</span>
            <span className="stat-label">AI Calls</span>
          </div>
        </section>

        {/* Audio Visualizer */}
        <section className="visualizer-section" id="visualizerSection">
          <canvas id="visualizer" />
          <div className="status-row">
            <span className="mic-indicator" id="micIndicator" />
            <div id="statusText" className="status-text">Ready to listen...</div>
          </div>
        </section>

        {/* Control Buttons */}
        <section className="controls">
          <button id="testMicBtn" className="btn-test">Test Microphone</button>
          <button id="startBtn" className="btn-start">Start Listening</button>
          <button id="stopBtn" className="btn-stop hidden">Stop Listening</button>
          <button id="stopAudioBtn" className="btn-stop-audio">Stop Audio</button>
          <button id="undoMusicBtn" className="btn-secondary" title="Revert the most recent music change">Undo Music</button>
        </section>

        {/* Bedtime auto fade-out */}
        <section className="bedtime-timer-panel" style={{ margin: '12px 0' }}>
          <label htmlFor="bedtimeTimerSelect" style={{ marginRight: 8 }}>Bedtime fade-out:</label>
          <select id="bedtimeTimerSelect" defaultValue="0">
            <option value="0">Off</option>
            <option value="5">5 min</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
          </select>
          <span className="info-text" style={{ marginLeft: 8 }}>
            Master fades over the final 60s, then stops all audio.
          </span>
        </section>

        {/* Captions feed — mirrored from the microphone transcript */}
        <section id="captionsPanel">
          <h4>Captions</h4>
          <div id="captionsFeed" />
        </section>

        {/* Session Recording (Audio Export) */}
        <section className="session-recording-panel">
          <h3>Session Recording</h3>
          <p className="info-text">
            Record everything — all sounds, music, and ambience — into a single
            downloadable audio file.
          </p>
          <div className="session-rec-controls">
            <button id="recStartBtn" className="btn-primary">Record Session</button>
            <button id="recStopBtn" className="btn-stop hidden">Stop Recording</button>
            <span id="recTimer" className="rec-timer hidden">0:00</span>
            <span id="recIndicator" className="rec-indicator hidden" />
          </div>
          <div id="recDownload" className="rec-download hidden">
            <audio id="recAudio" controls style={{ width: '100%', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button id="recDownloadBtn" className="btn-secondary" style={{ flex: 1 }}>Download Mix</button>
              <button id="recDownloadStemsBtn" className="btn-secondary" style={{ flex: 1 }}>Download Stems</button>
            </div>
          </div>
        </section>

        {/* Audio Controls */}
        <section className="audio-controls-panel">
          <h3 className="audio-controls-title">Audio Controls</h3>
          <div className="audio-controls-grid">
            <div className="audio-control-row">
              <label className="audio-control-label" htmlFor="sfxToggle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                Sound Effects
              </label>
              <label className="toggle-switch">
                <input type="checkbox" id="sfxToggle" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="audio-control-row">
              <label className="audio-control-label" htmlFor="musicToggle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                Music
              </label>
              <label className="toggle-switch">
                <input type="checkbox" id="musicToggle" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="audio-control-row">
              <label className="audio-control-label" htmlFor="ambienceToggle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 2s4.5 3.5 4.5 7a4.5 4.5 0 1 1-9 0C3.5 5.5 8 2 8 2z" />
                  <path d="M16 8s3 2.5 3 5a3 3 0 1 1-6 0c0-2.5 3-5 3-5z" />
                </svg>
                Ambience
              </label>
              <label className="toggle-switch">
                <input type="checkbox" id="ambienceToggle" defaultChecked />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="audio-control-row audio-control-slider-row">
              <label className="audio-control-label" htmlFor="ambientDurationSlider">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Sound Duration
              </label>
              <div className="audio-slider-wrap">
                <input
                  type="range"
                  id="ambientDurationSlider"
                  min="50"
                  max="300"
                  defaultValue="100"
                  className="audio-slider"
                />
                <span id="ambientDurationValue" className="audio-slider-value">1.0x</span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Transcript */}
        <section className="transcript-section">
          <h3>What I&apos;m Hearing</h3>
          <div id="transcript" className="transcript-box">Waiting for audio input...</div>
        </section>

        {/* Currently Playing */}
        <section className="sounds-section">
          <h3>Currently Playing</h3>
          <div id="currentSounds" className="sounds-list">
            <div className="sound-item inactive">No sounds playing</div>
          </div>
        </section>

        {/* AI Activity Feed */}
        <section className="activity-feed-section">
          <h3 id="activityFeedToggle">
            AI Activity <span className="toggle-indicator">&#9660;</span>
          </h3>
          <div id="activityLog" className="activity-log" />
        </section>
      </div>
    </div>
  );
}
