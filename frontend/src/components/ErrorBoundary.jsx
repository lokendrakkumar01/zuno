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
                        <div style={{ 
                              padding: '3rem 2rem', 
                              textAlign: 'center', 
                              fontFamily: 'var(--font-family)', 
                              minHeight: '100vh', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              background: 'var(--color-bg-primary)',
                              color: 'var(--color-text-primary)'
                        }}>
                              <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>✨</div>
                              <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem' }}>Something unexpected happened</h1>
                              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2.5rem', maxWidth: '500px', fontSize: '1.1rem' }}>
                                    ZUNO encountered a temporary issue. We've logged the error and our team will look into it. 
                                    Try refreshing the page to continue your journey.
                              </p>
                              <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                          onClick={() => {
                                                this.setState({ hasError: false, error: null, errorInfo: null });
                                                window.location.reload();
                                          }}
                                          style={{
                                                padding: '1rem 2.5rem',
                                                background: 'var(--color-accent-primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 'var(--radius-lg)',
                                                fontSize: '1.1rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                boxShadow: 'var(--shadow-md)'
                                          }}
                                    >
                                          Refresh Page
                                    </button>
                                    <button
                                          onClick={() => window.location.href = '/'}
                                          style={{
                                                padding: '1rem 2.5rem',
                                                background: 'transparent',
                                                color: 'var(--color-text-primary)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 'var(--radius-lg)',
                                                fontSize: '1.1rem',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                          }}
                                    >
                                          Go to Home
                                    </button>
                              </div>
                        </div>
                  );
            }

            return this.props.children;
      }
}

export default ErrorBoundary;
