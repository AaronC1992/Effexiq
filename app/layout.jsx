import './globals.css';

export const metadata = {
  title: 'SoundGoblin - Intelligent Audio Companion',
  description:
    'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    url: 'https://soundgoblin.vercel.app/',
    title: 'SoundGoblin - Intelligent Audio Companion',
    description:
      'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
    images: [{ url: 'https://soundgoblin.vercel.app/icon.svg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SoundGoblin - Intelligent Audio Companion',
    description:
      'AI-powered ambient sound designer that listens to conversations and automatically plays contextually-appropriate music and sound effects',
    images: ['https://soundgoblin.vercel.app/icon.svg'],
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
        {/* Howler.js is loaded as an npm package (see engine/SoundGoblin.js) */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        {children}
        {/* Toast notification container — rendered at body level so toasts layer over modals */}
        <div id="toastContainer" className="toast-container" aria-live="polite" />
      </body>
    </html>
  );
}
