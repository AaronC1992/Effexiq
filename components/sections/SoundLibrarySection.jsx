'use client';

/** Sound Library section — browse, preview, disable sounds; record custom sounds. */
export default function SoundLibrarySection() {
  return (
    <>
      <div id="soundLibrarySection" className="app-section hidden">
        <div className="section-header">
          <h2>Sound Library</h2>
        </div>
        <div className="section-body">
          <p className="section-intro">
            Browse, preview, and manage all available sounds. Disable any sound you don&apos;t want
            Effexiq to use.
          </p>

          {/* Search & Filters */}
          <div className="sound-lib-controls">
            <input
              type="text"
              id="soundLibSearch"
              className="sound-lib-search"
              placeholder="Search sounds by name or tag..."
            />
            <div className="sound-lib-filters">
              <button className="sound-lib-filter active" data-filter="all">All</button>
              <button className="sound-lib-filter" data-filter="music">Music</button>
              <button className="sound-lib-filter" data-filter="sfx">SFX</button>
              <button className="sound-lib-filter" data-filter="ambience">Ambience</button>
              <button className="sound-lib-filter" data-filter="disabled">Disabled</button>
            </div>
            <div className="sound-lib-stats">
              <span id="soundLibCount">0 sounds</span>
              <span id="soundLibDisabledCount">0 disabled</span>
            </div>
          </div>

          {/* Sound List — populated by engine */}
          <div id="soundLibList" className="sound-lib-list" />

          {/* Custom Sounds */}
          <div className="sound-lib-custom">
            <h3>Custom Sounds</h3>
            <p className="info-text">
              Record your own sounds and assign keyword tags so Effexiq can trigger them.
            </p>
            <button id="recordSoundBtn" className="btn-primary">Record Sound</button>
            <div id="customSoundsList" className="sound-lib-list" />
          </div>
        </div>
      </div>

      {/* Record Sound Modal (lives alongside this section in the original HTML) */}
      <div
        id="recordSoundModal"
        className="modal-overlay hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recordSoundModalTitle"
      >
        <div className="modal-content record-modal">
          <button className="modal-close" id="closeRecordModal">&times;</button>
          <h2 id="recordSoundModalTitle">Record a Sound</h2>
          <div className="record-controls">
            <div className="record-visualizer">
              <canvas id="recordVisualizer" width="300" height="60" />
            </div>
            <div className="record-timer" id="recordTimer">0:00</div>
            <div className="record-btns">
              <button id="recordStartBtn" className="btn-record">Record</button>
              <button id="recordStopBtn" className="btn-record-stop hidden">Stop</button>
            </div>
            <div id="recordPlayback" className="record-playback hidden">
              <audio id="recordAudio" controls />
            </div>
          </div>
          <div className="record-form">
            <input
              type="text"
              id="recordName"
              placeholder="Sound name (e.g. Dragon Roar)"
              className="record-input"
            />
            <input
              type="text"
              id="recordTags"
              placeholder="Tags, comma separated (e.g. dragon, roar, creature)"
              className="record-input"
            />
            <button id="recordSaveBtn" className="btn-primary" disabled>Save Sound</button>
          </div>
        </div>
      </div>
    </>
  );
}
