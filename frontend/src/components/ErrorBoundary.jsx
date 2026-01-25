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
                        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
                              <h1>Something went wrong.</h1>
                              <p>Please refresh the page. If the issue persists, contact support.</p>
                              <div style={{
                                    marginTop: '1rem',
                                    padding: '1rem',
                                    background: '#f8f9fa',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    textAlign: 'left',
                                    overflow: 'auto',
                                    maxHeight: '400px',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '0.8rem',
                                    color: '#d32f2f'
                              }}>
                                    <strong>Error:</strong> {this.state.error && this.state.error.toString()}
                                    <br />
                                    <br />
                                    <strong>Stack Trace:</strong>
                                    <br />
                                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                              </div>
                        </div>
                  );
            }

            return this.props.children;
      }
}

export default ErrorBoundary;
