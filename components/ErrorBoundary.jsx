'use client';

import { Component } from 'react';

/**
 * ErrorBoundary — catches runtime errors in the Effexiq engine or child
 * components and shows a recovery UI instead of a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            color: '#e0e0e0',
            fontFamily: 'sans-serif',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ color: '#bb86fc', marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ maxWidth: 480, marginBottom: 20, opacity: 0.8 }}>
            The Effexiq engine encountered an error. This is usually temporary.
          </p>
          <pre
            style={{
              background: '#1a1a2e',
              padding: 16,
              borderRadius: 8,
              maxWidth: 600,
              overflow: 'auto',
              fontSize: '0.8rem',
              marginBottom: 20,
              color: '#ff6b6b',
            }}
          >
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={this.handleReload}
            style={{
              background: '#8a2be2',
              color: '#fff',
              border: 'none',
              padding: '12px 32px',
              borderRadius: 8,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Reload Effexiq
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
