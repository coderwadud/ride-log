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
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: '320px', marginBottom: '24px' }}>
            ক্যাশ বা পুরনো ডাটার কারণে সমস্যা দেখা দিয়েছে। নিচে বাটনে ট্যাপ করে ক্যাশ রিসেট করুন।
          </p>
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
