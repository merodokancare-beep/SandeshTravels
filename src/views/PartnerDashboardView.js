'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PartnerDashboard() {
  const [partner, setPartner] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form fields
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [travelDates, setTravelDates] = useState('');
  const [numTravelers, setNumTravelers] = useState(1);

  const router = useRouter();

  const fetchData = async () => {
    try {
      const res = await fetch('/api/partner/leads');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/partner');
          return;
        }
        throw new Error('Failed to load dashboard data');
      }
      const data = await res.json();
      setLeads(data.leads || []);
      setPartner(data.partner || {});
    } catch (err) {
      console.error('Fetch dashboard error:', err);
      setError('Could not retrieve dashboard details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/partner/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/partner');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/partner/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName,
          clientPhone,
          travelDates,
          numTravelers
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Guest lead for ${clientName} submitted successfully!`);
        // Clear fields
        setClientName('');
        setClientPhone('');
        setTravelDates('');
        setNumTravelers(1);
        // Refresh leads list
        fetchData();
      } else {
        setError(data.error || 'Failed to submit guest lead.');
      }
    } catch (err) {
      console.error('Lead submission error:', err);
      setError('An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--primary)'
      }}>
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin fa-3x" style={{ marginBottom: '1rem' }}></i>
          <p style={{ color: 'var(--text-secondary)' }}>Loading Partner Dashboard...</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalLeads = leads.length;
  const convertedLeads = leads.filter(l => l.status === 'converted' || l.status === 'completed').length;
  const activeLeads = leads.filter(l => l.status === 'new' || l.status === 'quoted').length;

  return (
    <div className="dashboard-container" id="partner-dashboard-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div>
          <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.png" alt="Sandesh Travels" style={{ height: '38px', objectFit: 'contain', background: '#fff', borderRadius: '6px', padding: '2px 6px' }} />
            <div>
              <div className="brand-name" style={{ fontSize: '1.1rem', fontWeight: 800 }}>Sandesh Travels</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Partner Portal</div>
            </div>
          </div>
          <nav className="nav-menu">
            <a className="nav-link active">
              <i className="fa-solid fa-chart-line"></i> Dashboard
            </a>
          </nav>
        </div>
        <div>
          <div style={{
            padding: '1rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.85rem'
          }}>
            <p style={{ color: 'var(--text-muted)' }}>Logged in Partner:</p>
            <p style={{ fontWeight: '600', color: '#FFF', marginTop: '0.2rem' }}>{partner?.hotel_name}</p>
            <p style={{ color: 'var(--primary)', marginTop: '0.2rem' }}>Rate: {partner?.commission_rate}% Comm</p>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            id="partner-logout-btn"
          >
            <i className="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>Partner Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Welcome back, refer new hotel guests and track their travel itineraries.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="badge badge-converted" style={{ padding: '0.5rem 1rem' }}>
              <i className="fa-solid fa-award" style={{ marginRight: '0.5rem' }}></i>
              Active B2B Referrer
            </span>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="stats-grid" id="partner-stats-grid">
          <div className="glass-card stat-card">
            <div className="stat-icon">
              <i className="fa-solid fa-users"></i>
            </div>
            <div className="stat-info">
              <div className="stat-value">{totalLeads}</div>
              <div className="stat-label">Total Referrals</div>
            </div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ color: 'var(--accent-teal)' }}>
              <i className="fa-solid fa-route"></i>
            </div>
            <div className="stat-info">
              <div className="stat-value">{activeLeads}</div>
              <div className="stat-label">Active Leads</div>
            </div>
          </div>
          <div className="glass-card stat-card">
            <div className="stat-icon" style={{ color: 'var(--primary)' }}>
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <div className="stat-info">
              <div className="stat-value">{convertedLeads}</div>
              <div className="stat-label">Confirmed Trips</div>
            </div>
          </div>
        </section>

        {/* Form and List Grid */}
        <div className="grid-2">
          {/* Referral Form */}
          <section className="glass-card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              <i className="fa-solid fa-paper-plane" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
              Refer New Guest Lead
            </h2>

            {error && (
              <div className="error-message" id="submit-error-msg">
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.5rem' }}></i>
                {error}
              </div>
            )}

            {success && (
              <div className="success-message" id="submit-success-msg">
                <i className="fa-solid fa-circle-check" style={{ marginRight: '0.5rem' }}></i>
                {success}
              </div>
            )}

            <form onSubmit={handleLeadSubmit} id="lead-submission-form">
              <div className="form-group">
                <label htmlFor="clientName">Guest Full Name</label>
                <input
                  type="text"
                  id="clientName"
                  className="form-control"
                  placeholder="e.g. John Doe"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="clientPhone">Guest Phone / WhatsApp Number</label>
                <input
                  type="tel"
                  id="clientPhone"
                  className="form-control"
                  placeholder="e.g. +91 98765 43210"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="travelDates">Travel Dates (Estimate)</label>
                  <input
                    type="text"
                    id="travelDates"
                    className="form-control"
                    placeholder="e.g. July 1 - July 7"
                    value={travelDates}
                    onChange={(e) => setTravelDates(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="numTravelers">No. of Guests</label>
                  <input
                    type="number"
                    id="numTravelers"
                    className="form-control"
                    min="1"
                    value={numTravelers}
                    onChange={(e) => setNumTravelers(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem' }}
                disabled={submitting}
                id="lead-submit-btn"
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Submitting...
                  </>
                ) : (
                  <>
                    Submit Referral <i className="fa-solid fa-circle-plus"></i>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Referral Tracking List */}
          <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              <i className="fa-solid fa-history" style={{ color: 'var(--secondary)', marginRight: '0.5rem' }}></i>
              Referral Status Logs
            </h2>

            {leads.length === 0 ? (
              <div style={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'var(--text-muted)',
                padding: '3rem 1rem',
                textAlign: 'center'
              }}>
                <i className="fa-regular fa-folder-open fa-3x" style={{ marginBottom: '1rem' }}></i>
                <p>No referrals submitted yet.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Use the referral form to send guest leads to Sandesh Travels admin.</p>
              </div>
            ) : (
              <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Guest Details</th>
                      <th>Dates & Size</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <div style={{ fontWeight: '600', color: '#FFF' }}>{lead.client_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.client_phone}</div>
                        </td>
                        <td>
                          <div>{lead.travel_dates || 'Not specified'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {lead.num_travelers} guest(s)
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${lead.status}`}>
                            {lead.status === 'converted' ? 'CONFIRMED' : lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
