import './globals.css';
import GlobalAudioKill from '../components/GlobalAudioKill';
import DebugPerfPanel from '../components/DebugPerfPanel';

export const metadata = {
  title: 'Effexiq - Intelligent Audio Companion',
  description:
    'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    url: 'https://effexiq.vercel.app/',
    title: 'Effexiq - Intelligent Audio Companion',
    description:
      'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
    images: [{ url: 'https://effexiq.vercel.app/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Effexiq - Intelligent Audio Companion',
    description:
      'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
    images: ['https://effexiq.vercel.app/og-image.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#8a2be2',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Howler.js is loaded as an npm package (see engine/Effexiq.js) */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        {/* Global zombie-audio killer — runs on every route, including landing. */}
        <GlobalAudioKill />
        {/* Debug perf panel — only activates with ?debug=1 in the URL. */}
        <DebugPerfPanel />
        {children}
        {/* Toast notification container — rendered at body level so toasts layer over modals */}
        <div id="toastContainer" className="toast-container" aria-live="polite" />
      </body>
    </html>
  );
}
