'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Redirect to admin dashboard
        router.push('/admin/dashboard');
        router.refresh();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Admin login submit error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card animate-fade-in" id="admin-login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Sandesh Travels" style={{ height: '70px', objectFit: 'contain', background: '#fff', borderRadius: '10px', padding: '4px 10px', marginBottom: '0.75rem' }} />
          <h1 id="admin-login-title">Sandesh Travels</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Travel Agency Owner Portal
          </p>
        </div>

        {error && (
          <div className="error-message" id="admin-login-error-msg">
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.5rem' }}></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="admin-login-form">
          <div className="form-group">
            <label htmlFor="username">Admin Username</label>
            <input
              type="text"
              id="username"
              className="form-control"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', background: 'linear-gradient(135deg, var(--secondary), var(--accent-teal))', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)' }}
            disabled={loading}
            id="admin-login-submit-btn"
          >
            {loading ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i> Authenticating...
              </>
            ) : (
              <>
                Admin Access <i className="fa-solid fa-unlock-keyhole"></i>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <p>Restricted area. Unauthorized access attempts are monitored.</p>
        </div>
      </div>
    </div>
  );
}
