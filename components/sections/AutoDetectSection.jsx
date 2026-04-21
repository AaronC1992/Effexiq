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
          SuiteRhythm will listen and automatically play contextual sounds and music.
        </p>

        {/* Scene Presets Bar — populated by SuiteRhythm engine */}
        <div className="scene-presets-bar" id="scenePresetsBar" />

        <div className="context-input-area">
          <label htmlFor="dndContextInput">Story Context (Optional)</label>
          <textarea
            id="dndContextInput"
            rows="4"
            placeholder="Example: 'A dark medieval dungeon crawl beneath a cursed castle' or 'A tavern scene in a bustling port city'"
          />
          <p className="info-text">
            Describe the setting, genre, or mood to help SuiteRhythm choose better sounds.
          </p>
        </div>

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
            Engine Activity <span className="toggle-indicator">&#9660;</span>
          </h3>
          <div id="activityLog" className="activity-log" />
        </section>
      </div>
    </div>
  );
}
