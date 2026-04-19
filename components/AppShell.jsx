'use client';

/**
 * AppShell — the main "use client" component for SuiteRhythm.
 *
 * ARCHITECTURE DECISION:
 * The SuiteRhythm audio engine (engine/SuiteRhythm.js) is a 7,000+ line class
 * that orchestrates audio playback, speech recognition, and UI state through
 * direct DOM manipulation (getElementById, addEventListener, classList).
 * A full conversion to React state/hooks would be a multi-month rewrite with
 * high regression risk. Instead, this component:
 *   1. Renders the full DOM scaffold as JSX (all sections are always in the DOM,
 *      hidden via CSS, exactly as the original HTML — so SuiteRhythm can find
 *      elements by ID at any time).
 *   2. Dynamically imports and instantiates SuiteRhythm in useEffect after mount,
 *      exactly replicating the original DOMContentLoaded init sequence.
 *   3. Cleans up on unmount.
 *
 * Future path: individual sections can be progressively converted to manage their
 * own state via React as the engine is refactored incrementally.
 */

import { useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { EngineProvider } from '../lib/engine-bridge';
import Sidebar from './Sidebar';
import NowPlayingStrip from './NowPlayingStrip';
import DashboardSection from './sections/DashboardSection';
import AutoDetectSection from './sections/AutoDetectSection';
import StoryEditorSection from './sections/StoryEditorSection';
import ControlBoardSection from './sections/ControlBoardSection';
import SoundLibrarySection from './sections/SoundLibrarySection';
import SettingsSection from './sections/SettingsSection';
import {
  SubscribeModal,
  TutorialModal,
  FeedbackModal,
  LoadingOverlay,
  StoryContextModal,
  StoryOverlay,
  DemoSelectorOverlay,
} from './modals/Modals';

export default function AppShell() {
  useEffect(() => {
    // Register service worker for offline caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
    }
  }, []);
  useEffect(() => {
    let engineInstance = null;
    let initialized = false;

    async function initApp() {
      if (initialized) return;
      initialized = true;

      // Set backend URL before anything else (mirrors the inline script in old index.html)
      if (typeof window !== 'undefined') {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
        if (backendUrl) {
          window.SuiteRhythm_BACKEND_URL = backendUrl;
        }
        // R2 audio proxy path (avoids CORS issues with pub-*.r2.dev)
        window.__R2_PUBLIC_URL = '/r2-audio';
      }

      try {
        // 1. Initialize enhancement modules (performance, memory, accessibility, offline detection)
        const { initEnhancements } = await import('../lib/integration');
        initEnhancements();
      } catch (e) {
        console.warn('[AppShell] Integration module init failed:', e);
      }

      try {
        // 2. Prime the API module so it sets window.fetchSounds / window.analyzeTranscript globals
        //    that the engine still uses during the transition period.
        await import('../lib/api');
      } catch (e) {
        console.warn('[AppShell] API module init failed:', e);
      }

      try {
        // 3. Import and instantiate the SuiteRhythm engine. Dynamic import keeps it
        //    out of the server bundle entirely (ssr:false on the dashboard page gives
        //    a second layer of protection, but being explicit here is safer).
        const { default: SuiteRhythm, initializeMenuToggles } = await import('../engine/SuiteRhythm');
        engineInstance = new SuiteRhythm();
        window.gameInstance = engineInstance;

        // 4. Wire up settings accordion toggles (was a standalone function in game.js)
        initializeMenuToggles();
      } catch (e) {
        console.error('[AppShell] SuiteRhythm engine failed to start:', e);
        // Show user-visible error if the engine fails to initialize
        const app = document.getElementById('appContainer');
        if (app) {
          const banner = document.createElement('div');
          banner.className = 'no-key-banner';
          banner.style.cssText = 'background:rgba(255,60,60,0.12);border-color:#ff4444;margin:12px;border-radius:8px;padding:12px 16px;';
          banner.innerHTML = '<strong>Engine failed to start.</strong> Try reloading the page. If the problem persists, clear your browser cache.';
          app.prepend(banner);
        }
      }

      // 5. Safety net: if the app container ended up hidden for any reason, force it visible
      const app = document.getElementById('appContainer');
      if (app && app.classList.contains('hidden')) {
        console.warn('[AppShell] appContainer hidden after init — forcing visible');
        app.classList.remove('hidden');
        app.style.display = 'block';
      }
    }

    initApp();

    // Cleanup on unmount (navigating away from /dashboard)
    return () => {
      try {
        engineInstance?.destroy?.();
      } catch (_) {}
      window.gameInstance = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <EngineProvider>
      {/* Skip link for accessibility */}
      <a className="skip-link" href="#appContainer">
        Skip to main content
      </a>

      {/* ===== MAIN APPLICATION ===== */}
      <div id="appContainer" role="main">
        <div id="platformShell">
          {/* Left sidebar navigation */}
          <Sidebar />

          {/* Mobile top bar */}
          <header id="mobileTopbar" className="mobile-topbar">
            <button
              id="sidebarToggle"
              className="sidebar-toggle-btn"
              aria-label="Toggle navigation menu"
              aria-expanded="false"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="mobile-brand">SuiteRhythm</span>
            <span id="noKeyBannerMobile" className="mobile-no-key hidden">No subscription</span>
          </header>

          {/* Mobile sidebar overlay */}
          <div id="sidebarBackdrop" className="sidebar-backdrop hidden" />

          {/* ===== MAIN CONTENT ===== */}
          <main id="platformMain">
            {/* Live engine status bar — reactive via useEngine() */}
            <NowPlayingStrip />

            {/* Persona tab bar — only visible in persona-tabs layout */}
            <div id="personaTabBar" className="persona-tab-bar">
              <button className="persona-tab active" data-persona-filter="all">All</button>
              <button className="persona-tab" data-persona-filter="streamer">Content Creator</button>
              <button className="persona-tab" data-persona-filter="tabletop">Tabletop RPG</button>
              <button className="persona-tab" data-persona-filter="storyteller">Storyteller</button>
            </div>

            {/* Spotlight back button — only visible in spotlight layout when a section is open */}
            <button id="spotlightBack" className="spotlight-back" aria-label="Back to overview">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>

            {/* Carousel nav — only visible in carousel layout */}
            <div id="carouselNav" className="carousel-nav">
              <button id="carouselPrev" className="carousel-arrow carousel-prev" aria-label="Previous section">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div id="carouselDots" className="carousel-dots" />
              <button id="carouselNext" className="carousel-arrow carousel-next" aria-label="Next section">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Split screen panel selectors — only visible in split-screen layout */}
            <div id="splitControls" className="split-controls">
              <select id="splitLeftSelect" className="split-select" aria-label="Left panel section">
                <option value="dashboardPanel">Home</option>
                <option value="dndAutoDetect">Auto Detect</option>
                <option value="dndCreateCampaign">Story Editor</option>
                <option value="dndControlBoard">Control Board</option>
                <option value="soundLibrarySection">Sound Library</option>
                <option value="settingsSection">Settings</option>
              </select>
              <span className="split-divider-label">|</span>
              <select id="splitRightSelect" className="split-select" aria-label="Right panel section">
                <option value="dndAutoDetect">Auto Detect</option>
                <option value="dashboardPanel">Home</option>
                <option value="dndCreateCampaign">Story Editor</option>
                <option value="dndControlBoard">Control Board</option>
                <option value="soundLibrarySection">Sound Library</option>
                <option value="settingsSection">Settings</option>
              </select>
            </div>

            {/* Firefox compatibility warning — shown only in Firefox by the engine */}
            <div
              id="firefoxWarning"
              className="no-key-banner hidden"
              style={{
                background: 'rgba(255,140,0,0.12)',
                borderColor: 'darkorange',
                margin: 12,
                borderRadius: 8,
              }}
            >
              <span>
                Auto Detect and Story modes require Chrome or Edge for microphone access. Firefox
                does not support the Web Speech API used by SuiteRhythm.
              </span>
              <button
                onClick={(e) => e.currentTarget.closest('#firefoxWarning')?.classList.add('hidden')}
              >
                Dismiss
              </button>
            </div>

            {/* All app sections — always rendered, shown/hidden by engine via CSS class */}
            <DashboardSection />
            <StoryEditorSection />
            <SoundLibrarySection />
            <SettingsSection />
            <AutoDetectSection />
            <ControlBoardSection />

            {/* Focus-mode bottom dock — only visible in focus layout */}
            <nav id="focusDock" className="focus-dock" aria-label="Section dock">
              <button className="focus-dock-btn" data-section="dashboardPanel" aria-label="Home">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </button>
              <button className="focus-dock-btn" data-section="dndAutoDetect" aria-label="Auto Detect">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
              <button className="focus-dock-btn" data-section="dndCreateCampaign" aria-label="Story Editor">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button className="focus-dock-btn" data-section="dndControlBoard" aria-label="Control Board">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
              <button className="focus-dock-btn" data-section="soundLibrarySection" aria-label="Sound Library">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </button>
              <button className="focus-dock-btn" data-section="settingsSection" aria-label="Settings">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
            </nav>
          </main>
        </div>
      </div>

      {/* Body-level modals and overlays */}
      <SubscribeModal />
      <TutorialModal />
      <FeedbackModal />
      <LoadingOverlay />
      <StoryContextModal />
      <StoryOverlay />
      <DemoSelectorOverlay />
      </EngineProvider>
    </ErrorBoundary>
  );
}
