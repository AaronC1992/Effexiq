'use client';

import dynamic from 'next/dynamic';

/**
 * Dashboard page — the main Effexiq application experience.
 *
 * AppShell is loaded with `ssr: false` because the Effexiq audio
 * engine uses browser-only APIs (AudioContext, SpeechRecognition, Howler,
 * localStorage) that can't run during server-side rendering.
 *
 * TODO: Add auth guard here — check session cookie/token and redirect to
 * the landing page if the user isn't authenticated.
 */
const AppShell = dynamic(() => import('../../components/AppShell'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#8a2be2',
        fontFamily: 'sans-serif',
        fontSize: '1.1rem',
      }}
    >
      Loading Effexiq…
    </div>
  ),
});

export default function DashboardPage() {
  return <AppShell />;
}
