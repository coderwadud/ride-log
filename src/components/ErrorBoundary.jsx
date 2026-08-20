import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RideLog BD App Error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#0b0f19',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '8px' }}>
            অ্যাপ চালু করতে সমস্যা হয়েছে
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: '320px', marginBottom: '16px' }}>
            ক্যাশ বা পুরনো ডাটার কারণে সমস্যা দেখা দিয়েছে। নিচে বাটনে ট্যাপ করে ক্যাশ রিসেট করুন।
          </p>
          {this.state.error && (
            <div style={{
              maxWidth: '90%',
              margin: '0 auto 20px',
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '0.78rem',
              textAlign: 'left',
              fontFamily: 'monospace',
              overflowX: 'auto',
              maxHeight: '180px'
            }}>
              <strong>Error:</strong> {this.state.error?.message || String(this.state.error)}
              {this.state.error?.stack && (
                <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', fontSize: '0.7rem' }}>
                  {this.state.error.stack}
                </pre>
              )}
            </div>
          )}
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 24px',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}
          >
            🔄 রিসেট ও পুনরায় চেষ্টা করুন
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
