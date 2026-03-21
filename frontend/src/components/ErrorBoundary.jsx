import React from 'react';

class ErrorBoundary extends React.Component {
      constructor(props) {
            super(props);
            this.state = { hasError: false, error: null, errorInfo: null };
      }

      static getDerivedStateFromError(error) {
            return { hasError: true };
      }

      componentDidCatch(error, errorInfo) {
            this.setState({ error, errorInfo });
            console.error("Uncaught error:", error, errorInfo);
      }

      render() {
            if (this.state.hasError) {
                  return (
                        <div style={{ padding: '3rem 2rem', textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😔</div>
                              <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary, #1a1a2e)' }}>Something went wrong</h1>
                              <p style={{ color: 'var(--text-muted, #6b7280)', marginBottom: '1.5rem', maxWidth: '400px' }}>
                                    Don't worry! Just tap the button below to get back on track.
                              </p>
                              <button
                                    onClick={() => {
                                          this.setState({ hasError: false, error: null, errorInfo: null });
                                          window.location.reload();
                                    }}
                                    style={{
                                          padding: '12px 32px',
                                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '12px',
                                          fontSize: '1rem',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                                    }}
                              >
                                    🔄 Reload App
                              </button>
                        </div>
                  );
            }

            return this.props.children;
      }
}

export default ErrorBoundary;
