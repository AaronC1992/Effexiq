'use client';
/**
 * Engine Bridge — lightweight React ↔ Effexiq integration layer.
 *
 * Provides:
 * 1. EngineProvider / useEngine — React context exposing engine state
 * 2. BroadcastChannel sync — keeps multiple tabs in sync
 *
 * The engine still owns the DOM, but React components can now read
 * isListening, currentMood, activeSoundCount, volume, mode, etc.
 * reactively without touching engine internals.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

// ── State shape ──────────────────────────────────────────────
const DEFAULT_STATE = {
  isListening: false,
  currentMood: 'neutral',
  moodIntensity: 0.5,
  activeSoundCount: 0,
  musicEnabled: true,
  sfxEnabled: true,
  masterVolume: 0.7,
  mode: 'auto',
  connected: false,       // true once engine instance is linked
};

const SYNC_CHANNEL = 'effexiq-sync';

// ── Context ──────────────────────────────────────────────────
const EngineContext = createContext({ state: DEFAULT_STATE, engine: null, dispatch: () => {} });

/**
 * Hook: useEngine()
 * Returns { state, engine, dispatch }
 *   state   – reactive snapshot of engine state
 *   engine  – raw Effexiq instance (may be null during load)
 *   dispatch – send an action: dispatch('toggleListening')
 */
export function useEngine() {
  return useContext(EngineContext);
}

/**
 * Provider: <EngineProvider>
 * Wrap around your app shell. Polls the engine for state changes
 * and broadcasts them to other tabs.
 */
export function EngineProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);
  const engineRef = useRef(null);
  const channelRef = useRef(null);
  const timerRef = useRef(null);

  // ── BroadcastChannel setup ──────────────────────────────
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(SYNC_CHANNEL);
    channelRef.current = ch;

    ch.onmessage = (e) => {
      const msg = e.data;
      if (!msg || msg.source === getTabId()) return; // ignore own echo

      // Apply remote state changes
      if (msg.type === 'state-update') {
        setState(prev => ({ ...prev, ...msg.payload }));
      }

      // Forward actions to local engine
      if (msg.type === 'action' && engineRef.current) {
        applyAction(engineRef.current, msg.action);
      }
    };

    return () => { ch.close(); channelRef.current = null; };
  }, []);

  // ── Poll engine state at low frequency (1 Hz) ───────────
  const syncFromEngine = useCallback(() => {
    const eng = engineRef.current || (typeof window !== 'undefined' && window.gameInstance);
    if (!eng) return;

    // Latch engine ref on first detection
    if (!engineRef.current) {
      engineRef.current = eng;
    }

    const next = {
      isListening: !!eng.isListening,
      currentMood: eng.currentMood?.primary || 'neutral',
      moodIntensity: eng.currentMood?.intensity ?? 0.5,
      activeSoundCount: eng.activeSounds?.size || 0,
      musicEnabled: !!eng.musicEnabled,
      sfxEnabled: !!eng.sfxEnabled,
      masterVolume: eng.maxVolume ?? 0.7,
      mode: eng.currentMode || 'auto',
      connected: true,
    };

    setState(prev => {
      // Only update if something changed (avoid unnecessary re-renders)
      for (const k in next) {
        if (prev[k] !== next[k]) {
          // Broadcast delta to other tabs
          broadcastState(channelRef.current, next);
          return next;
        }
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(syncFromEngine, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [syncFromEngine]);

  // ── Dispatch actions ────────────────────────────────────
  const dispatch = useCallback((action) => {
    if (engineRef.current) {
      applyAction(engineRef.current, action);
    }
    // Broadcast action to other tabs
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'action', action, source: getTabId() });
    }
  }, []);

  return (
    <EngineContext.Provider value={{ state, engine: engineRef.current, dispatch }}>
      {children}
    </EngineContext.Provider>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function applyAction(engine, action) {
  switch (action) {
    case 'toggleListening':
      if (engine.isListening) engine.stopListening?.();
      else engine.startListening?.();
      break;
    case 'toggleMusic':
      engine.musicEnabled = !engine.musicEnabled;
      break;
    case 'toggleSfx':
      engine.sfxEnabled = !engine.sfxEnabled;
      break;
    case 'stopAll':
      engine.stopAllSounds?.();
      break;
    default:
      break;
  }
}

function broadcastState(channel, state) {
  if (!channel) return;
  try {
    channel.postMessage({ type: 'state-update', payload: state, source: getTabId() });
  } catch (_) { /* channel closed */ }
}

let _tabId;
function getTabId() {
  if (!_tabId) _tabId = Math.random().toString(36).slice(2, 10);
  return _tabId;
}
