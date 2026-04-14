'use client';

/** Control Board section — drag-and-drop soundboard with scene tabs. */
export default function ControlBoardSection() {
  return (
    <div id="dndControlBoard" className="app-section hidden">
      <div className="section-header">
        <h2>Control Board</h2>
        <div className="cb-header-actions">
          <button id="cbListenToggle" className="btn-secondary cb-btn-sm" title="Toggle live speech detection">
            Listen
          </button>
          <button id="cbAddBtn" className="btn-primary cb-btn-sm">Add Sound</button>
          <button id="cbSaveBtn" className="btn-secondary cb-btn-sm">Save Board</button>
          <button id="cbLoadBtn" className="btn-secondary cb-btn-sm">Load Board</button>
          <button id="cbUndoBtn" className="btn-secondary cb-btn-sm">Undo</button>
          <button id="cbStopAllBtn" className="btn-secondary cb-btn-sm cb-btn-danger">Stop All</button>
        </div>
      </div>
      <div className="section-body cb-body">
        <p className="section-intro">
          Build your custom soundboard. Tabs = scenes. Drag to move, resize handles to scale.
          Music loops until toggled off, SFX plays once.
        </p>
        {/* Scene Tabs — populated by engine */}
        <div className="cb-tabs-bar" id="cbTabsBar" />
        {/* Listen Mode Status */}
        <div className="cb-listen-status hidden" id="cbListenStatus">
          <span className="cb-listen-dot" />
          <span id="cbListenText">Listening for keywords...</span>
        </div>
        <div id="cbCanvas" className="cb-canvas">
          <div className="cb-empty-state">
            <p>No sounds added yet. Click &quot;Add Sound&quot; to build your board.</p>
          </div>
        </div>
      </div>

      {/* Add Sound Modal */}
      <div id="cbAddModal" className="modal hidden">
        <div className="modal-content">
          <h2>Add Sound Button</h2>
          <div className="cb-add-form">
            <input type="text" id="cbSoundLabel" placeholder="Button Label (e.g. Battle Theme)" />
            <select id="cbSoundType" className="mode-dropdown">
              <option value="music">Music (loops)</option>
              <option value="sfx">Sound Effect (plays once)</option>
            </select>
            <select id="cbSoundGroup" className="mode-dropdown">
              <option value="">No Group</option>
              <option value="combat">Combat</option>
              <option value="ambience">Ambience</option>
              <option value="music">Music</option>
              <option value="npc">NPC / Dialogue</option>
              <option value="custom">Custom</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" id="cbSoundSearch" placeholder="Search sounds..." className="cb-search-input" style={{ flex: 1 }} />
              <select id="cbSoundCategoryFilter" className="mode-dropdown" style={{ flex: '0 0 auto', minWidth: 100 }}>
                <option value="">All Types</option>
                <option value="music">Music</option>
                <option value="sfx">SFX</option>
              </select>
            </div>
            <div id="cbSoundResults" className="cb-sound-results" />
            <input type="hidden" id="cbSoundFile" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center' }}>
            <button id="cbAddConfirm" className="btn-primary">Add to Board</button>
            <button id="cbAddCancel" className="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>

      {/* Load Board Modal */}
      <div id="cbLoadModal" className="modal hidden">
        <div className="modal-content">
          <h2>Load Soundboard</h2>
          <div id="cbSavedBoards" className="cb-saved-boards" />
          <button id="cbLoadCancel" className="btn-secondary" style={{ marginTop: 16 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
