'use client';

/**
 * Sidebar — platform navigation.
 * All button clicks (section switching) are handled by the Effexiq
 * engine's setupEventListeners() which queries the DOM by data-section
 * attributes. React only renders the markup; the engine wires event listeners.
 */
export default function Sidebar() {
  return (
    <aside id="platformSidebar" aria-label="Platform navigation">
      <div className="sidebar-brand">
        <span className="sidebar-logo-text">Effexiq</span>
        <span className="sidebar-tagline">AI Sound Design</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <button className="sidebar-nav-item" data-section="dashboardPanel" aria-label="Home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Home
        </button>

        <div className="sidebar-nav-group-label">Tools</div>

        <button className="sidebar-nav-item" data-section="dndAutoDetect" aria-label="Auto Detect">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          Auto Detect
        </button>

        <button className="sidebar-nav-item" data-section="dndCreateCampaign" aria-label="Story Editor">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Story Editor
        </button>

        <button className="sidebar-nav-item" data-section="dndControlBoard" aria-label="Control Board">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Control Board
        </button>

        <div className="sidebar-nav-group-label">Library</div>

        <button className="sidebar-nav-item" data-section="soundLibrarySection" aria-label="Sound Library">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          Sound Library
        </button>

        <div className="sidebar-nav-group-label">System</div>

        <button className="sidebar-nav-item" data-section="settingsSection" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-api-row">
          <span id="openaiStatus" className="api-status" aria-label="Subscription status" />
          <button id="manageSubscriptionBtn" className="sidebar-reset-key">Manage</button>
        </div>
        <div className="sidebar-footer-actions">
          <button id="tutorialBtn" className="sidebar-action-btn">How to Use</button>
          <button id="feedbackBtn" className="sidebar-action-btn">Feedback</button>
        </div>
        <p className="version">v3.0.0 | Effexiq &copy; 2026</p>
      </div>
    </aside>
  );
}
