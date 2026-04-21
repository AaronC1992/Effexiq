'use client';

/**
 * ObsShell — minimal transparent-background component for OBS Browser Source.
 *
 * Renders only the essential DOM elements that the SuiteRhythm engine needs
 * (because it relies on getElementById), plus a visible "currently playing"
 * overlay. Background is transparent so OBS can composite it over a scene.
 */

import { useEffect } from 'react';

export default function ObsShell() {
  useEffect(() => {
    let engineInstance = null;
    let initialized = false;

    async function initObs() {
      if (initialized) return;
      initialized = true;

      if (typeof window !== 'undefined') {
        window.__OBS_MODE = true;
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
        if (backendUrl) window.SuiteRhythm_BACKEND_URL = backendUrl;
        window.__R2_PUBLIC_URL = '/r2-audio';
      }

      try {
        const { initEnhancements } = await import('../lib/integration');
        initEnhancements();
      } catch (_) {}

      try {
        await import('../lib/api');
      } catch (_) {}

      try {
        const { default: SuiteRhythm, initializeMenuToggles } = await import('../engine/SuiteRhythm');
        engineInstance = new SuiteRhythm();
        initializeMenuToggles();
        window.gameInstance = engineInstance;
      } catch (e) {
        console.error('[ObsShell] Engine failed:', e);
      }
    }

    initObs();

    return () => {
      try { engineInstance?.destroy?.(); } catch (_) {}
      window.gameInstance = undefined;
      window.__OBS_MODE = false;
    };
  }, []);

  return (
    <div id="obsContainer" style={{
      background: 'transparent',
      minHeight: '100vh',
      padding: 16,
      fontFamily: 'sans-serif',
      color: '#fff',
    }}>
      {/* Hidden elements the engine needs to find by ID */}
      <div id="appContainer" style={{ display: 'none' }}>
        <div id="platformShell">
          <main id="platformMain">
            <div id="dndAutoDetect" className="app-section">
              <div id="visualizer" style={{ display: 'none' }} />
              <div id="statusText" />
              <div id="transcript" />
              <div id="currentSounds" />
              <div id="activityLog" />
              <div id="scenePresetsBar" />
              <div id="sessionStats">
                <span id="statSounds" /><span id="statTriggers" />
                <span id="statTransitions" /><span id="statKeywords" />
                <span id="statAnalyses" />
              </div>
              <div id="micIndicator" />
              <div id="dndContextInput" />
            </div>
            <div id="settingsSection" className="app-section hidden" />
            <div id="dashboardPanel" className="app-section hidden" />
            <div id="soundLibrarySection" className="app-section hidden">
              <div id="soundLibList" /><div id="soundLibCount" /><div id="soundLibDisabledCount" /><div id="customSoundsList" />
            </div>
            <div id="dndCreateCampaign" className="app-section hidden">
              <div id="scCuesList" /><div id="storiesListContainer" />
            </div>
          </main>
        </div>
      </div>

      {/* Visible OBS overlay */}
      <div id="obsOverlay" style={{
        background: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        padding: '12px 16px',
        maxWidth: 400,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4 }}>SUITERHYTHM LIVE</div>
        <div id="obsStatus" style={{ fontSize: '0.85rem', marginBottom: 8, opacity: 0.8 }}>
          Initializing...
        </div>
        <div id="obsNowPlaying" style={{ fontSize: '0.9rem' }}>
          No sounds playing
        </div>
      </div>
    </div>
  );
}
