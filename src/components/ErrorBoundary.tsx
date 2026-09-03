import React from 'react';

/**
 * Top-level React error boundary. A render/runtime error in any child must not
 * white-screen the whole app in production — it renders an honest recovery panel
 * (SynOmics palette) with the real error text and a reload action. No fabricated
 * "everything is fine" state.
 */
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Real client-side error log (visible in the browser console / error reporting).
    console.error('[SynOmics] UI error boundary caught:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', background: '#FFFFFF', color: '#0A192F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ maxWidth: 640, width: '100%', background: '#F8F9FA', border: '1px solid #E6E9EE', borderRadius: 16, padding: '2rem' }}>
          <div style={{ height: 4, width: 56, background: '#00B4D8', borderRadius: 4, marginBottom: 16 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#0A192F' }}>Something went wrong in the interface</h1>
          <p style={{ fontSize: 14, color: '#4b5a6e', marginTop: 8 }}>
            A rendering error was caught before it could crash the app. Your analyses and data are unaffected — this is a UI-only fault. The exact error is shown below.
          </p>
          <pre style={{ marginTop: 16, padding: 12, background: '#0A192F', color: '#E8F6FB', borderRadius: 10, fontSize: 12, overflow: 'auto', fontFamily: "'Fira Code','JetBrains Mono',monospace" }}>
            {String(this.state.error?.message || this.state.error || 'Unknown error')}
          </pre>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); }}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0A192F', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#00B4D8', color: '#FFFFFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Reload SynOmics
            </button>
          </div>
        </div>
      </div>
    );
  }
}
