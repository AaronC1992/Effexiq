'use client';

/**
 * AppShell — the main "use client" component for SoundGoblin.
 *
 * ARCHITECTURE DECISION:
 * The SoundGoblin audio engine (engine/SoundGoblin.js) is a 7,000+ line class
 * that orchestrates audio playback, speech recognition, and UI state through
 * direct DOM manipulation (getElementById, addEventListener, classList).
 * A full conversion to React state/hooks would be a multi-month rewrite with
 * high regression risk. Instead, this component:
 *   1. Renders the full DOM scaffold as JSX (all sections are always in the DOM,
 *      hidden via CSS, exactly as the original HTML — so SoundGoblin can find
 *      elements by ID at any time).
 *   2. Dynamically imports and instantiates SoundGoblin in useEffect after mount,
 *      exactly replicating the original DOMContentLoaded init sequence.
 *   3. Cleans up on unmount.
 *
 * Future path: individual sections can be progressively converted to manage their
 * own state via React as the engine is refactored incrementally.
 */

import { useEffect } from 'react';
import Sidebar from './Sidebar';
import DashboardSection from './sections/DashboardSection';
import AutoDetectSection from './sections/AutoDetectSection';
import StoryEditorSection from './sections/StoryEditorSection';
import ControlBoardSection from './sections/ControlBoardSection';
import SoundLibrarySection from './sections/SoundLibrarySection';
import SettingsSection from './sections/SettingsSection';
import {
  TutorialModal,
  FeedbackModal,
  LoadingOverlay,
  StoryContextModal,
  StoryOverlay,
  DemoSelectorOverlay,
} from './modals/Modals';

export default function AppShell() {
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
          window.SoundGoblin_BACKEND_URL = backendUrl;
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
        // 3. Import and instantiate the SoundGoblin engine. Dynamic import keeps it
        //    out of the server bundle entirely (ssr:false on the dashboard page gives
        //    a second layer of protection, but being explicit here is safer).
        const { default: SoundGoblin, initializeMenuToggles } = await import('../engine/SoundGoblin');
        engineInstance = new SoundGoblin();
        window.gameInstance = engineInstance;

        // 4. Wire up settings accordion toggles (was a standalone function in game.js)
        initializeMenuToggles();
      } catch (e) {
        console.error('[AppShell] SoundGoblin engine failed to start:', e);
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
    <>
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
            <span className="mobile-brand">SoundGoblin</span>
            <span id="noKeyBannerMobile" className="mobile-no-key hidden">No subscription</span>
          </header>

          {/* Mobile sidebar overlay */}
          <div id="sidebarBackdrop" className="sidebar-backdrop hidden" />

          {/* ===== MAIN CONTENT ===== */}
          <main id="platformMain">
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
                does not support the Web Speech API used by SoundGoblin.
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
          </main>
        </div>
      </div>

      {/* Body-level modals and overlays */}
      <TutorialModal />
      <FeedbackModal />
      <LoadingOverlay />
      <StoryContextModal />
      <StoryOverlay />
      <DemoSelectorOverlay />
    </>
  );
}
