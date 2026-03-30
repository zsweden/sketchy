import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '1rem',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        color: '#E5E5E5',
        background: '#1E1E1E',
      }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ fontSize: '0.875rem', color: '#A0A0A0', textAlign: 'center', maxWidth: '28rem' }}>
          An unexpected error occurred. Your diagram is saved in session storage and will be restored when you reload.
        </p>
        <pre style={{
          fontSize: '0.75rem',
          color: '#F56565',
          background: '#2D2D2D',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          maxWidth: '32rem',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {this.state.error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '9999px',
            border: 'none',
            background: '#0C8CE9',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
