'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function InvoiceView({ leadId: propLeadId, params }) {
  let targetLeadId = propLeadId;
  if (!targetLeadId && params) {
    const unwrapped = typeof params.then === 'function' ? use(params) : params;
    targetLeadId = unwrapped?.leadId;
  }

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taxRate, setTaxRate] = useState(5);
  const [discount, setDiscount] = useState(0);

  const router = useRouter();

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!targetLeadId) return;
      try {
        const res = await fetch(`/api/admin/invoice/${targetLeadId}`);
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/admin');
            return;
          }
          throw new Error('Failed to load invoice');
        }
        const data = await res.json();
        setInvoice(data.invoice);
        if (data.invoice?.billing) {
          setTaxRate(data.invoice.billing.gstRate || 5);
          setDiscount(data.invoice.billing.discount || 0);
        }
      } catch (err) {
        console.error('Invoice load error:', err);
        setError('Could not retrieve invoice details.');
      } finally {
        setLoading(false);
      }
    };

    if (targetLeadId) {
      fetchInvoice();
    }
  }, [targetLeadId, router]);

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
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-spinner fa-spin fa-3x" style={{ marginBottom: '1rem' }}></i>
          <p style={{ color: 'var(--text-secondary)' }}>Generating Tax & Bill Invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#FFF' }}>
        <i className="fa-solid fa-triangle-exclamation fa-3x" style={{ color: 'var(--accent-orange)', marginBottom: '1rem' }}></i>
        <h2>Invoice Generation Error</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{error || 'Invoice not found.'}</p>
        <Link href="/admin/dashboard" className="btn btn-secondary" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
          <i className="fa-solid fa-arrow-left"></i> Back to Dashboard
        </Link>
      </div>
    );
  }

  const basePrice = invoice.billing?.basePrice || 0;
  const computedGst = Math.round(basePrice * (taxRate / 100) * 100) / 100;
  const computedTotal = Math.max(0, Math.round((basePrice + computedGst - (parseFloat(discount) || 0)) * 100) / 100);

  const handlePrint = () => {
    window.print();
  };

  const getWhatsAppShareUrl = () => {
    const clientPhone = invoice.client.phone.replace(/\D/g, '');
    let msg = `Hi ${invoice.client.name}, here is your official Tax & Bill Invoice from Sandesh Travels ✨\n\n`;
    msg += `🧾 *Invoice No:* ${invoice.invoiceNumber}\n`;
    msg += `📅 *Invoice Date:* ${invoice.invoiceDate}\n`;
    msg += `🗺️ *Journey:* ${invoice.itinerary?.title || 'Tour Package'}\n`;
    msg += `👥 *Guests:* ${invoice.client.numTravelers}\n`;
    msg += `🗓️ *Travel Dates:* ${invoice.client.travelDates}\n`;
    msg += `💰 *Base Package:* ₹${basePrice.toLocaleString('en-IN')}\n`;
    if (taxRate > 0) {
      msg += `🏛️ *GST (${taxRate}%):* ₹${computedGst.toLocaleString('en-IN')}\n`;
    }
    if (discount > 0) {
      msg += `🏷️ *Discount:* ₹${parseFloat(discount).toLocaleString('en-IN')}\n`;
    }
    msg += `✅ *Total Amount Paid:* ₹${computedTotal.toLocaleString('en-IN')}\n\n`;
    msg += `Thank you for choosing Sandesh Travels for your journey! 🚗 Wish you all the best.`;

    return `https://api.whatsapp.com/send?phone=${clientPhone}&text=${encodeURIComponent(msg)}`;
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '2rem 1rem' }}>
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-paper {
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .invoice-paper * {
            color: #0f172a !important;
          }
          .badge-print {
            border: 1px solid #0f172a !important;
            background: #f1f5f9 !important;
            color: #0f172a !important;
          }
          .invoice-table th {
            background: #f1f5f9 !important;
            color: #0f172a !important;
          }
          .invoice-table td, .invoice-table th {
            border-bottom: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>

      {/* Control Top Bar (Hidden when printing) */}
      <div className="no-print" style={{
        maxWidth: '900px',
        margin: '0 auto 1.5rem auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'rgba(30, 41, 59, 0.8)',
        backdropFilter: 'blur(10px)',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/admin/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}>
            <i className="fa-solid fa-arrow-left"></i> Dashboard
          </Link>
          <span style={{ fontWeight: '600', color: '#94a3b8', fontSize: '0.9rem' }}>
            Invoice ID: <span style={{ color: '#38bdf8' }}>{invoice.invoiceNumber}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* GST & Discount live editor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
            <label>GST (%):</label>
            <input 
              type="number" 
              value={taxRate} 
              onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{ width: '55px', padding: '0.25rem 0.4rem', borderRadius: '4px', border: '1px solid #475569', background: '#0f172a', color: '#FFF' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
            <label>Disc (₹):</label>
            <input 
              type="number" 
              value={discount} 
              onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              style={{ width: '70px', padding: '0.25rem 0.4rem', borderRadius: '4px', border: '1px solid #475569', background: '#0f172a', color: '#FFF' }}
            />
          </div>

          <a 
            href={getWhatsAppShareUrl()} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-primary"
            style={{ background: '#25D366', border: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#FFF', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <i className="fa-brands fa-whatsapp"></i> Share via WhatsApp
          </a>

          <button 
            onClick={handlePrint} 
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #0284c7, #0d9488)', border: 'none', padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
          >
            <i className="fa-solid fa-print"></i> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div className="invoice-paper" style={{
        maxWidth: '920px',
        margin: '0 auto',
        background: '#ffffff',
        color: '#0f172a',
        borderRadius: '16px',
        padding: '3rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif"
      }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.75rem', marginBottom: '2rem' }}>
          <div style={{ flex: '1 1 540px', maxWidth: '540px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ background: '#0f172a', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                <img src="/logo.png" alt="Sandesh Travels" style={{ height: '48px', objectFit: 'contain' }} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>{invoice.agency.name || 'M/s Sandesh Travels'}</h1>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{invoice.agency.tagline || 'Tours & Travel Company'}</p>
              </div>
            </div>

            <div style={{ fontSize: '0.83rem', color: '#334155', lineHeight: '1.6', marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <i className="fa-solid fa-location-dot" style={{ color: '#0284c7', width: '14px', marginTop: '3px', flexShrink: 0 }}></i>
                <span style={{ color: '#334155', fontWeight: '500' }}>{invoice.agency.address}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                <span><i className="fa-solid fa-phone" style={{ color: '#0284c7', width: '14px' }}></i> {invoice.agency.phone}</span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span><i className="fa-solid fa-envelope" style={{ color: '#0284c7', width: '14px' }}></i> {invoice.agency.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <span><i className="fa-solid fa-globe" style={{ color: '#0284c7', width: '14px' }}></i> {invoice.agency.website || 'www.sandeshtravels.in'}</span>
              </div>
              <div style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem', color: '#1e293b', lineHeight: '1.5', maxWidth: '520px' }}>
                <div><strong>PAN:</strong> {invoice.agency.pan || 'AXXPR3863J'}</div>
                <div><strong>Reg:</strong> TTD:1667/DoT &CAv/Gtk/24/TA &nbsp;|&nbsp; <strong>TL:</strong> EOG/AHY/0282</div>
              </div>
            </div>
          </div>

          <div style={{ flex: '0 0 auto', textAlign: 'right', minWidth: '200px' }}>
            <div className="badge-print" style={{
              display: 'inline-block',
              background: '#0f172a',
              color: '#ffffff',
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              fontWeight: '800',
              fontSize: '0.85rem',
              letterSpacing: '0.08em',
              marginBottom: '0.75rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              TAX BILL / INVOICE
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>{invoice.invoiceNumber}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem', fontWeight: '500' }}>Date: <strong>{invoice.invoiceDate}</strong></div>
            <div style={{ marginTop: '0.6rem' }}>
              <span className="badge-print" style={{
                background: invoice.client.status === 'completed' ? '#dcfce7' : '#fef9c3',
                color: invoice.client.status === 'completed' ? '#15803d' : '#a16207',
                border: `1px solid ${invoice.client.status === 'completed' ? '#86efac' : '#fde047'}`,
                padding: '0.35rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: '700'
              }}>
                <i className={`fa-solid ${invoice.client.status === 'completed' ? 'fa-circle-check' : 'fa-clock'}`} style={{ marginRight: '0.35rem' }}></i>
                {invoice.billing.paymentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To & Journey Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #0284c7',
            borderRadius: '8px',
            padding: '1.25rem'
          }}>
            <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.5rem', fontWeight: '700' }}>
              Billed To (Traveler / Guest)
            </h3>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>{invoice.client.name}</div>
            <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.3rem' }}>
              <i className="fa-solid fa-phone" style={{ marginRight: '0.4rem', color: '#0284c7' }}></i> {invoice.client.phone}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.2rem' }}>
              <i className="fa-solid fa-user-group" style={{ marginRight: '0.4rem', color: '#0284c7' }}></i> {invoice.client.numTravelers} Passenger(s)
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #0f172a',
            borderRadius: '8px',
            padding: '1.25rem'
          }}>
            <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: '0.5rem', fontWeight: '700' }}>
              Tour Package & Schedule
            </h3>
            <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
              {invoice.itinerary?.title || 'Custom Travel Service'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.3rem' }}>
              <i className="fa-solid fa-calendar-days" style={{ marginRight: '0.4rem', color: '#0f172a' }}></i> {invoice.client.travelDates}
            </div>
            {invoice.itinerary?.totalDays && (
              <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.2rem' }}>
                <i className="fa-solid fa-stopwatch" style={{ marginRight: '0.4rem', color: '#0f172a' }}></i> Duration: {invoice.itinerary.totalDays} Days Journey
              </div>
            )}
          </div>
        </div>

        {/* Day-by-Day Service Breakdown Table */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fa-solid fa-list-check" style={{ color: '#0284c7' }}></i> Executed Service & Logistics Summary
          </h3>

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <table className="invoice-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem 1rem', width: '80px', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Day</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Itinerary Program & Sightseeing</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dispatched Vehicle & Driver</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hotel Check-in</th>
                </tr>
              </thead>
              <tbody>
                {invoice.days && invoice.days.length > 0 ? (
                  invoice.days.map((d, idx) => (
                    <tr key={d.id || d.day_number} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '700', color: '#0284c7' }}>Day {d.day_number}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#334155', lineHeight: '1.5' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{d.description || 'Full day tour schedule'}</div>
                        {d.activities && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>{d.activities}</div>}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                        {d.driver_name ? (
                          <div>
                            <strong style={{ color: '#0f172a' }}>{d.driver_name}</strong>
                            <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', fontWeight: '600' }}>
                              {d.vehicle_model} {d.vehicle_number ? `(${d.vehicle_number})` : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Standard Transport</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                        {d.hotel_name ? (
                          <div>
                            <strong style={{ color: '#0f172a' }}>{d.hotel_name}</strong>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{d.hotel_location}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Night Transit / Return</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b' }}>
                      Standard All-inclusive Travel Package & Fleet Services
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Calculation Summary */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2.5rem' }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '1.25rem',
            fontSize: '0.9rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#475569' }}>
              <span>Base Package Amount:</span>
              <strong style={{ color: '#0f172a' }}>₹{basePrice.toLocaleString('en-IN')}</strong>
            </div>

            {taxRate > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#475569' }}>
                <span>GST ({taxRate}%):</span>
                <strong style={{ color: '#0f172a' }}>₹{computedGst.toLocaleString('en-IN')}</strong>
              </div>
            )}

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#15803d' }}>
                <span>Applied Discount:</span>
                <strong>- ₹{parseFloat(discount).toLocaleString('en-IN')}</strong>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#0f172a',
              color: '#ffffff',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              marginTop: '0.8rem',
              fontSize: '1.1rem'
            }}>
              <span style={{ fontWeight: '700' }}>Total Amount Paid:</span>
              <strong style={{ color: '#38bdf8', fontSize: '1.3rem', fontWeight: '800' }}>₹{computedTotal.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        {/* Footer / Signatures Block */}
        <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          <div>
            <h4 style={{ color: '#0f172a', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '700' }}>Terms & Conditions:</h4>
            <p style={{ margin: 0, lineHeight: '1.5' }}>• This is an official computer-generated tax invoice issued by Sandesh Travels.</p>
            <p style={{ margin: 0, lineHeight: '1.5' }}>• All package inclusions, driver fuel, and toll charges are settled as per agreement.</p>
            <p style={{ margin: 0, lineHeight: '1.5', marginTop: '0.2rem', color: '#0284c7', fontWeight: '600' }}>• Thank you for traveling with Sandesh Travels!</p>
          </div>

          <div style={{ textAlign: 'center', minWidth: '200px' }}>
            <div style={{ height: '50px', borderBottom: '1px dashed #94a3b8', marginBottom: '0.4rem' }}></div>
            <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.85rem' }}>Authorized Signatory</span>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>Sandesh Travels Management</div>
          </div>
        </div>
      </div>
    </div>
  );
}
