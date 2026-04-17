/**
 * Live perf panel — active when the URL has ?debug=1.
 *
 * Shows live FPS, active Howl count, memory (if available), AudioContext
 * state, and the average round-trip latency of recent /api/analyze calls
 * (pulled from the engine's activity log).
 *
 * Safe to import in any client surface — does nothing unless the flag is
 * present. Intended to be mounted once from AppShell / layout.
 */

'use client';

import { useEffect } from 'react';

export default function DebugPerfPanel() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('debug') !== '1') return;
        } catch { return; }

        let el = document.getElementById('perfPanel');
        if (!el) {
            el = document.createElement('div');
            el.id = 'perfPanel';
            document.body.appendChild(el);
        }

        // FPS sampler
        let frames = 0;
        let lastSample = performance.now();
        let fps = 0;
        let raf = 0;
        const tick = () => {
            frames++;
            const now = performance.now();
            if (now - lastSample >= 500) {
                fps = Math.round((frames * 1000) / (now - lastSample));
                frames = 0;
                lastSample = now;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        const fmtMem = (bytes) => {
            if (!bytes) return 'n/a';
            const mb = bytes / (1024 * 1024);
            return `${mb.toFixed(1)} MB`;
        };

        const draw = () => {
            const engine = window.gameInstance;
            let howls = 0;
            try {
                const Howler = window.Howler;
                howls = Howler?._howls?.length ?? 0;
            } catch {}
            const mem = performance?.memory;
            const ctxState = engine?.audioContext?.state || 'n/a';
            const active = engine?.activeSounds?.size ?? 0;
            const mode = engine?.currentMode || 'n/a';

            el.innerHTML =
                `<strong>Effexiq debug</strong>\n` +
                `fps:     ${String(fps).padStart(3)}\n` +
                `howls:   ${howls}\n` +
                `active:  ${active}\n` +
                `mode:    ${mode}\n` +
                `ctx:     ${ctxState}\n` +
                (mem ? `heap:    ${fmtMem(mem.usedJSHeapSize)} / ${fmtMem(mem.jsHeapSizeLimit)}\n` : '') +
                `reverb:  ${engine?._reverbPreset || 'room'}`;
        };
        const interval = setInterval(draw, 500);
        draw();

        return () => {
            cancelAnimationFrame(raf);
            clearInterval(interval);
            el?.remove();
        };
    }, []);

    return null;
}
