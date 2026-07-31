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
    let msg = `Hi ${invoice.client.name}, here is your official Tax & Bill Invoice from Vani Travels ✨\n\n`;
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
    msg += `Thank you for choosing Vani Travels for your journey! 🚗 Wish you all the best.`;

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
        maxWidth: '900px',
        margin: '0 auto',
        background: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7, #0d9488)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                color: '#FFF',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}>
                <i className="fa-solid fa-route"></i>
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '700', letterSpacing: '-0.5px' }}>{invoice.agency.name}</h1>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>{invoice.agency.tagline}</p>
              </div>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              <div><i className="fa-solid fa-location-dot" style={{ width: '16px', color: '#38bdf8' }}></i> {invoice.agency.address}</div>
              <div><i className="fa-solid fa-phone" style={{ width: '16px', color: '#38bdf8' }}></i> {invoice.agency.phone} | <i className="fa-solid fa-envelope" style={{ color: '#38bdf8' }}></i> {invoice.agency.email}</div>
              <div><i className="fa-solid fa-file-invoice" style={{ width: '16px', color: '#38bdf8' }}></i> GSTIN: <strong>{invoice.agency.gstin}</strong></div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className="badge-print" style={{
              display: 'inline-block',
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              padding: '0.35rem 0.8rem',
              borderRadius: '6px',
              fontWeight: '700',
              fontSize: '0.85rem',
              marginBottom: '0.75rem'
            }}>
              TAX BILL / INVOICE
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc' }}>{invoice.invoiceNumber}</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>Date: {invoice.invoiceDate}</div>
            <div style={{ marginTop: '0.5rem' }}>
              <span className="badge-print" style={{
                background: invoice.client.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                color: invoice.client.status === 'completed' ? '#4ade80' : '#fde047',
                border: `1px solid ${invoice.client.status === 'completed' ? '#22c55e' : '#eab308'}`,
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                <i className={`fa-solid ${invoice.client.status === 'completed' ? 'fa-circle-check' : 'fa-clock'}`} style={{ marginRight: '0.3rem' }}></i>
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
          marginBottom: '2rem',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '1.25rem'
        }}>
          <div>
            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Billed To (Traveler / Guest)
            </h3>
            <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#FFF' }}>{invoice.client.name}</div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
              <i className="fa-solid fa-phone" style={{ marginRight: '0.4rem', color: '#38bdf8' }}></i> {invoice.client.phone}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
              <i className="fa-solid fa-user-group" style={{ marginRight: '0.4rem', color: '#38bdf8' }}></i> {invoice.client.numTravelers} Passenger(s)
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Tour Package & Schedule
            </h3>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#FFF' }}>
              {invoice.itinerary?.title || 'Custom Travel Service'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
              <i className="fa-solid fa-calendar-days" style={{ marginRight: '0.4rem', color: '#38bdf8' }}></i> {invoice.client.travelDates}
            </div>
            {invoice.itinerary?.totalDays && (
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                <i className="fa-solid fa-stopwatch" style={{ marginRight: '0.4rem', color: '#38bdf8' }}></i> Duration: {invoice.itinerary.totalDays} Days Journey
              </div>
            )}
          </div>
        </div>

        {/* Day-by-Day Service Breakdown Table */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <i className="fa-solid fa-list-check"></i> Executed Service & Logistics Summary
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table className="invoice-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(51, 65, 85, 0.5)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', width: '75px' }}>Day</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Itinerary Program & Sightseeing</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Dispatched Vehicle & Driver</th>
                  <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Hotel Check-in</th>
                </tr>
              </thead>
              <tbody>
                {invoice.days && invoice.days.length > 0 ? (
                  invoice.days.map((d) => (
                    <tr key={d.id || d.day_number} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#38bdf8' }}>Day {d.day_number}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                        <div>{d.description || 'Full day tour schedule'}</div>
                        {d.activities && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>{d.activities}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                        {d.driver_name ? (
                          <div>
                            <strong style={{ color: '#FFF' }}>{d.driver_name}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.vehicle_model} ({d.vehicle_number || 'N/A'})</div>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b' }}>Standard Transport</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                        {d.hotel_name ? (
                          <div>
                            <strong style={{ color: '#FFF' }}>{d.hotel_name}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.hotel_location}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b' }}>Night Transit / Return</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
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
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.25rem',
            fontSize: '0.9rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#cbd5e1' }}>
              <span>Base Package Amount:</span>
              <strong style={{ color: '#FFF' }}>₹{basePrice.toLocaleString('en-IN')}</strong>
            </div>

            {taxRate > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#cbd5e1' }}>
                <span>GST ({taxRate}%):</span>
                <strong style={{ color: '#FFF' }}>₹{computedGst.toLocaleString('en-IN')}</strong>
              </div>
            )}

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#4ade80' }}>
                <span>Applied Discount:</span>
                <strong>- ₹{parseFloat(discount).toLocaleString('en-IN')}</strong>
              </div>
            )}

            <div style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              borderTop: '2px dashed rgba(255, 255, 255, 0.15)',
              paddingTop: '0.8rem',
              marginTop: '0.6rem',
              fontSize: '1.15rem'
            }}>
              <span style={{ fontWeight: '700', color: '#FFF' }}>Total Payable / Paid:</span>
              <strong style={{ color: '#38bdf8', fontSize: '1.3rem' }}>₹{computedTotal.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        {/* Footer / Signatures Block */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          <div>
            <h4 style={{ color: '#cbd5e1', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Terms & Notes:</h4>
            <p style={{ margin: 0, lineHeight: '1.4' }}>• This is a computer-generated tax invoice for travel & fleet operations.</p>
            <p style={{ margin: 0, lineHeight: '1.4' }}>• All package inclusions, driver fuel, and toll charges are settled as per agreement.</p>
          </div>

          <div style={{ textAlign: 'center', minWidth: '180px' }}>
            <div style={{ height: '40px', borderBottom: '1px solid #475569', marginBottom: '0.3rem' }}></div>
            <span style={{ fontWeight: '600', color: '#cbd5e1' }}>Authorized Signatory</span>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Vani Travels Management</div>
          </div>
        </div>
      </div>
    </div>
  );
}
