'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { COUNTRY_CODES, parsePhoneNumber, formatFullPhoneNumber } from '@/lib/phone';

function getFormattedDateForDay(startDate, dayNum) {
  if (!startDate) return '';
  let date;
  if (startDate instanceof Date) {
    date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  } else {
    const parts = String(startDate).substring(0, 10).split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    date = new Date(year, month, day);
  }
  
  date.setDate(date.getDate() + (dayNum - 1));
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function getIsoDateForDay(startDateStr, dayNum) {
  if (!startDateStr) return '';
  const parts = String(startDateStr).substring(0, 10).split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  date.setDate(date.getDate() + (dayNum - 1));
  
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ItineraryBuilder({ params, leadId: propLeadId }) {
  let leadId = propLeadId;
  if (!leadId && params) {
    const unwrapped = typeof params.then === 'function' ? use(params) : params;
    leadId = unwrapped?.leadId;
  }
  const [lead, setLead] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [localPhone, setLocalPhone] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [travelDates, setTravelDates] = useState('');
  const [numTravelers, setNumTravelers] = useState(1);
  const [isEditingGuest, setIsEditingGuest] = useState(false);
  const [guestSaveLoading, setGuestSaveLoading] = useState(false);
  const [itineraryId, setItineraryId] = useState(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('0.00');
  const [totalDays, setTotalDays] = useState(1);
  const [days, setDays] = useState([]);
  
  // Registry listings
  const [hotels, setHotels] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateRegionFilter, setTemplateRegionFilter] = useState('All');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);

  const handleSendNotification = async (channel = 'whatsapp') => {
    const isSms = channel === 'sms';
    if (isSms) setSmsLoading(true);
    else setWhatsappLoading(true);
    
    setError('');
    setSuccess('');
    setIsSimulated(false);
    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, itineraryId, channel })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || `${isSms ? 'SMS' : 'WhatsApp'} message sent directly to traveller!`);
        setIsSimulated(!!data.simulated);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(data.error || `Failed to dispatch ${isSms ? 'SMS' : 'WhatsApp'} message.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError(`Network error sending ${isSms ? 'SMS' : 'WhatsApp'} message.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      if (isSms) setSmsLoading(false);
      else setWhatsappLoading(false);
    }
  };

  const getDriverOptionText = (d, dayNumber) => {
    const defaultText = `${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'})`;
    if (!startDate) return defaultText;
    const dayDateStr = getIsoDateForDay(startDate, dayNumber);
    const booking = d.bookings?.find(b => b.date === dayDateStr && String(b.lead_id) !== String(leadId) && b.lead_status === 'converted');
    if (booking) {
      const displayStatus = booking.lead_status.toUpperCase();
      return `${d.driver_name} (${d.vehicle_model || 'No Vehicle'}) ⚠️ Busy: ${booking.client_name} (${displayStatus})`;
    }
    return defaultText;
  };

  const getDriverOptionTextForEntireJourney = (d, totalDays) => {
    const defaultText = `${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'})`;
    if (!startDate || !totalDays) return defaultText;
    
    const conflictingDates = [];
    for (let i = 1; i <= totalDays; i++) {
      const dayDateStr = getIsoDateForDay(startDate, i);
      const booking = d.bookings?.find(b => b.date === dayDateStr && String(b.lead_id) !== String(leadId) && b.lead_status === 'converted');
      if (booking && !conflictingDates.includes(booking.client_name)) {
        conflictingDates.push(booking.client_name);
      }
    }
    
    if (conflictingDates.length > 0) {
      return `${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'}) ⚠️ Busy: ${conflictingDates.join(', ')}`;
    }
    return defaultText;
  };

  const isDriverFreeOnDate = (d, dayNumber) => {
    if (!startDate) return true;
    const dayDateStr = getIsoDateForDay(startDate, dayNumber);
    const hasConflict = d.bookings?.some(b => b.date === dayDateStr && String(b.lead_id) !== String(leadId) && b.lead_status === 'converted');
    return !hasConflict;
  };

  const isDriverFreeForEntireJourney = (d, totalDays) => {
    if (!startDate || !totalDays) return true;
    for (let i = 1; i <= totalDays; i++) {
      if (!isDriverFreeOnDate(d, i)) {
        return false;
      }
    }
    return true;
  };

  const hasDriverConflicts = () => {
    if (!startDate || !drivers.length) return false;
    return days.some(day => {
      if (!day.driverId) return false;
      const dayDateStr = getIsoDateForDay(startDate, day.dayNumber);
      const d = drivers.find(drv => String(drv.id) === String(day.driverId));
      if (!d) return false;
      return d.bookings?.some(b => b.date === dayDateStr && String(b.lead_id) !== String(leadId));
    });
  };

  const getTodayString = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Fetch itinerary and lead details
        const itinRes = await fetch(`/api/admin/itinerary?leadId=${leadId}`);
        if (!itinRes.ok) {
          if (itinRes.status === 401) {
            router.push('/admin');
            return;
          }
          throw new Error('Failed to load itinerary');
        }
        const itinData = await itinRes.json();
        
        setLead(itinData.lead);
        if (itinData.lead) {
          setClientName(itinData.lead.client_name || '');
          const parsedPhone = parsePhoneNumber(itinData.lead.client_phone);
          setPhoneCountryCode(parsedPhone.countryCode);
          setLocalPhone(parsedPhone.localNumber);
          setClientPhone(itinData.lead.client_phone || '');
          setTravelDates(itinData.lead.travel_dates || '');
          setNumTravelers(itinData.lead.num_travelers || 1);
        }
        if (itinData.lead.start_date) {
          setStartDate(itinData.lead.start_date.substring(0, 10));
        }
        
        if (itinData.itinerary) {
          setItineraryId(itinData.itinerary.id);
          setTitle(itinData.itinerary.title);
          setPrice(itinData.itinerary.price);
          setTotalDays(itinData.itinerary.total_days);
          
          // Map loaded days details
          const loadedDays = itinData.days.map(d => ({
            dayNumber: d.day_number,
            hotelId: d.hotel_id || '',
            driverId: d.driver_id || '',
            description: d.description || '',
            activities: d.activities || ''
          }));
          setDays(loadedDays);
        } else {
          // New itinerary defaults
          setTitle(`Custom Travel Plan for ${itinData.lead.client_name}`);
          setTotalDays(3); // default 3 days
          initializeDays(3);
        }

        // 2. Fetch registries
        const hotelsRes = await fetch('/api/admin/hotels');
        const hotelsData = await hotelsRes.json();
        setHotels(hotelsData.hotels || []);

        const driversRes = await fetch('/api/admin/fleet');
        const driversData = await driversRes.json();
        setDrivers(driversData.fleet || []);

        // 3. Fetch templates
        const templatesRes = await fetch('/api/admin/templates');
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.templates || []);

      } catch (err) {
        console.error('Error loading itinerary data:', err);
        setError('Failed to fetch data from database registries.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [leadId]);

  // Initializing blank days array
  const initializeDays = (count) => {
    const arr = [];
    for (let i = 1; i <= count; i++) {
      arr.push({
        dayNumber: i,
        hotelId: '',
        driverId: '',
        description: '',
        activities: ''
      });
    }
    setDays(arr);
  };

  // Adjust days array when totalDays count changes
  const handleDaysCountChange = (newCount) => {
    const count = parseInt(newCount, 10) || 1;
    setTotalDays(count);
    
    if (count > days.length) {
      // Append new blank days
      const updated = [...days];
      for (let i = days.length + 1; i <= count; i++) {
        updated.push({
          dayNumber: i,
          hotelId: '',
          driverId: '',
          description: '',
          activities: ''
        });
      }
      setDays(updated);
    } else if (count < days.length) {
      // Truncate days
      setDays(days.slice(0, count));
    }
  };

  const handleDayFieldChange = (index, field, value) => {
    const updated = [...days];
    updated[index][field] = value;
    setDays(updated);
  };

  // Overwrite state variables with a selected package blueprint template
  const handleApplyTemplate = (templateId) => {
    if (!templateId) return;
    const selected = templates.find(t => t.id === parseInt(templateId, 10));
    if (selected) {
      setTitle(`${selected.name} for ${lead?.client_name}`);
      setPrice(selected.estimated_price);
      setTotalDays(selected.total_days);
      
      const templateDays = typeof selected.days === 'string' ? JSON.parse(selected.days) : selected.days;
      
      const mappedDays = templateDays.map(d => ({
        dayNumber: d.dayNumber,
        hotelId: '',
        driverId: '',
        description: d.description || '',
        activities: d.activities || ''
      }));
      
      setDays(mappedDays);
      setSelectedTemplateId(''); // reset selection state
      setSuccess(`Loaded preset package "${selected.name}" template. Remember to hit "Save & Publish Itinerary" below to update changes!`);
      setError('');
    }
  };

  const handleSaveGuestDetails = async () => {
    setError('');
    setSuccess('');
    setGuestSaveLoading(true);
    const fullPhone = formatFullPhoneNumber(phoneCountryCode, localPhone);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          clientName,
          clientPhone: fullPhone,
          travelDates,
          numTravelers
        })
      });
      const data = await res.json();
      if (res.ok) {
        setLead(data.lead);
        setClientName(data.lead.client_name || '');
        const parsed = parsePhoneNumber(data.lead.client_phone);
        setPhoneCountryCode(parsed.countryCode);
        setLocalPhone(parsed.localNumber);
        setClientPhone(data.lead.client_phone || '');
        setTravelDates(data.lead.travel_dates || '');
        setNumTravelers(data.lead.num_travelers || 1);
        setIsEditingGuest(false);
        setSuccess(`Guest details updated successfully! Saved mobile number: "${data.lead.client_phone}".`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(data.error || 'Failed to update guest details.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error(err);
      setError('Network error updating guest details.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setGuestSaveLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Journey Start Date validation (no back dates for new/quoted itineraries)
    if (startDate && (!lead || lead.status === 'new' || lead.status === 'quoted')) {
      const parts = startDate.split('-');
      if (parts.length === 3) {
        const selectedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const today = new Date();
        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        if (selectedDate < todayZero) {
          setError('Validation Error: Journey Start Date cannot be in the past (back date). Please select today or a future date.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    // Strict conflict block for confirmed journeys
    if (lead && (lead.status === 'converted' || lead.status === 'completed')) {
      const hasConflict = days.some(day => {
        if (!day.driverId) return false;
        const dayDateStr = getIsoDateForDay(startDate, day.dayNumber);
        const d = drivers.find(drv => String(drv.id) === String(day.driverId));
        if (!d) return false;
        return d.bookings?.some(b => b.date === dayDateStr && String(b.lead_id) !== String(leadId) && b.lead_status === 'converted');
      });

      if (hasConflict) {
        setError('Scheduling Conflict Error: One or more selected drivers are already assigned to other confirmed trips on these dates. Please assign another driver.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setSaving(true);

    try {
      const res = await fetch('/api/admin/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          title,
          price,
          totalDays,
          days,
          startDate // Send the updated start_date too
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Itinerary and travel start date saved & synced successfully.');
        setItineraryId(data.itineraryId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        router.refresh();
      } else {
        setError(data.error || 'Failed to save itinerary.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error(err);
      setError('Network failure while saving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const getWhatsAppLink = () => {
    if (!lead || !itineraryId) return '#';
    const guestItineraryUrl = `${window.location.origin}/itinerary/${itineraryId}`;
    
    // Find if there is an assigned driver in any day
    const assignedDay = days.find(d => d.driverId) || {};
    const driver = drivers.find(drv => String(drv.id) === String(assignedDay.driverId));
    const hasDriver = !!driver;
    
    let text = '';
    
    if ((lead.status === 'converted' || lead.status === 'completed') && hasDriver) {
      const formattedStartDate = startDate 
        ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Flexible';
        
      text = `Hi ${lead.client_name}, your booking with VaniTravels is confirmed! 🚗✨\n\n`;
      text += `*JOURNEY DETAILS:*\n`;
      text += `• Route: ${title}\n`;
      text += `• Start Date: ${formattedStartDate}\n`;
      text += `• Duration: ${totalDays} Days\n`;
      text += `• Overall Price: Rs. ${price}\n\n`;
      text += `*ASSIGNED DRIVER & VEHICLE:*\n`;
      text += `• Driver Name: ${driver.driver_name}\n`;
      text += `• Driver Contact: ${driver.driver_phone}\n`;
      text += `• Vehicle: ${driver.vehicle_model} (${driver.vehicle_number || 'N/A'})\n\n`;
      text += `Please click the link below to view your full day-by-day program, accommodation check-in stays, and updates:\n👉 ${guestItineraryUrl}\n\nThank you for choosing VaniTravels!`;
    } else {
      // Default quotation message
      text = `Hi ${lead.client_name}, this is VaniTravels. We have prepared your custom day-by-day travel plan and itinerary! 🗺️✈️\n\nPlease click this link to view all your hotel stay details, drivers, and activities:\n👉 ${guestItineraryUrl}\n\nLet us know if you want to proceed! Thank you.`;
    }
    
    // Clean phone number (remove all non-digits)
    const cleanPhone = lead.client_phone.replace(/\D/g, '');
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--secondary)'
      }}>
        <div className="text-center">
          <i className="fa-solid fa-compass fa-spin fa-3x" style={{ marginBottom: '1rem' }}></i>
          <p style={{ color: 'var(--text-secondary)' }}>Loading Itinerary Planner...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <header style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '1rem 2.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/admin/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}>
            <i className="fa-solid fa-arrow-left"></i> Dashboard
          </Link>
          <h1 style={{ fontSize: '1.25rem' }}>Itinerary Builder</h1>
        </div>
        <div>
          {itineraryId && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <a 
                href={`/itinerary/${itineraryId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <i className="fa-solid fa-eye" style={{ color: 'var(--primary)' }}></i> Preview Plan
              </a>
              {lead && (lead.status === 'converted' || lead.status === 'completed') && (
                <Link 
                  href={`/admin/invoice/${lead.id}`}
                  className="btn btn-secondary"
                  style={{ 
                    borderColor: '#38bdf8', 
                    color: '#38bdf8', 
                    fontWeight: '600', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    textDecoration: 'none' 
                  }}
                  title="View & Print Tax Bill Invoice"
                >
                  <i className="fa-solid fa-file-invoice-dollar"></i> Bill Invoice
                </Link>
              )}
              <a 
                href={getWhatsAppLink()}
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ borderColor: '#25D366', color: '#25D366', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                title="Open WhatsApp chat with traveler directly from your browser"
              >
                <i className="fa-brands fa-whatsapp"></i> Open WhatsApp Web
              </a>
              {lead && (lead.status === 'converted' || lead.status === 'completed') && days.some(d => d.driverId) ? (
                <>
                  <button 
                    onClick={() => handleSendNotification('whatsapp')}
                    disabled={whatsappLoading || smsLoading}
                    className="btn btn-primary"
                    style={{ background: '#25D366', border: 'none', fontWeight: '700', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 0 12px rgba(37,211,102,0.4)' }}
                  >
                    <i className="fa-brands fa-whatsapp fa-lg"></i> {whatsappLoading ? 'Sending...' : 'Send Details via WhatsApp'}
                  </button>
                  <button 
                    onClick={() => handleSendNotification('sms')}
                    disabled={whatsappLoading || smsLoading}
                    className="btn btn-primary"
                    style={{ background: '#0070f3', border: 'none', fontWeight: '700', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 0 12px rgba(0,112,243,0.4)' }}
                  >
                    <i className="fa-solid fa-envelope"></i> {smsLoading ? 'Sending...' : 'Send Details via SMS'}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => handleSendNotification('whatsapp')}
                    disabled={whatsappLoading || smsLoading}
                    className="btn btn-primary"
                    style={{ background: '#25D366', boxShadow: 'none' }}
                  >
                    <i className="fa-brands fa-whatsapp"></i> {whatsappLoading ? 'Sending...' : 'Send via WhatsApp'}
                  </button>
                  <button 
                    onClick={() => handleSendNotification('sms')}
                    disabled={whatsappLoading || smsLoading}
                    className="btn btn-primary"
                    style={{ background: '#0070f3', boxShadow: 'none' }}
                  >
                    <i className="fa-solid fa-envelope"></i> {smsLoading ? 'Sending...' : 'Send via SMS'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main planner grid */}
      <main className="main-content" style={{ flexGrow: 1, padding: '2rem 2.5rem' }}>
        
        {/* Info alerts */}
        {error && (
          <div className="error-message" style={{ marginBottom: '1.5rem' }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '0.5rem' }}></i>
            {error}
          </div>
        )}

        {success && (
          <div className="success-message" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: '0.5rem', color: '#10B981' }}></i>
              <span>{success}</span>
            </div>
            {isSimulated && (
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ background: '#25D366', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: '600', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '4px', textDecoration: 'none' }}
              >
                <i className="fa-brands fa-whatsapp fa-lg"></i> Open WhatsApp Web (Manual Send)
              </a>
            )}
          </div>
        )}

        {hasDriverConflicts() && (
          <div className="error-message" style={{ marginBottom: '1.5rem', background: 'rgba(245,158,11,0.15)', border: '1px solid var(--accent-orange)', color: '#FBBF24' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.5rem' }}></i>
            <strong>Scheduling Conflict Warning:</strong> One or more selected drivers are already booked on the scheduled dates for other trips. Please verify driver availability.
          </div>
        )}

        <div className="grid-2" style={{ alignItems: 'flex-start', gridTemplateColumns: '320px 1fr' }}>
          {/* Left panel: Lead Info & Quick tools */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>
                  Guest Details
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => setIsEditingGuest(!isEditingGuest)}
                >
                  <i className={`fa-solid ${isEditingGuest ? 'fa-xmark' : 'fa-pen-to-square'}`} style={{ color: 'var(--primary)' }}></i>
                  {isEditingGuest ? 'Cancel Edit' : 'Edit Info'}
                </button>
              </div>

              {isEditingGuest ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>GUEST NAME</label>
                    <input
                      type="text"
                      className="form-control"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Guest full name"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>PHONE / WHATSAPP NUMBER</label>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <select
                        className="form-control"
                        style={{ width: '95px', padding: '0.35rem 0.2rem', fontSize: '0.8rem', flexShrink: 0, background: 'var(--bg-surface-elevated)', color: '#FFF' }}
                        value={phoneCountryCode}
                        onChange={(e) => setPhoneCountryCode(e.target.value)}
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        className="form-control"
                        value={localPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('+')) {
                            const parsed = parsePhoneNumber(val);
                            setPhoneCountryCode(parsed.countryCode);
                            setLocalPhone(parsed.localNumber);
                          } else {
                            setLocalPhone(val.replace(/\D/g, ''));
                          }
                        }}
                        placeholder="10-digit mobile number"
                        style={{ flexGrow: 1, padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                      Full number preview: <strong style={{ color: 'var(--accent-teal)' }}>{formatFullPhoneNumber(phoneCountryCode, localPhone) || 'None'}</strong>
                    </span>
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>TRAVEL DATES ESTIMATE</label>
                    <input
                      type="text"
                      className="form-control"
                      value={travelDates}
                      onChange={(e) => setTravelDates(e.target.value)}
                      placeholder="e.g. Flexible / July 1 - July 5"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>GUEST SIZE (PASSENGERS)</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={numTravelers}
                      onChange={(e) => setNumTravelers(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                    onClick={handleSaveGuestDetails}
                    disabled={guestSaveLoading}
                  >
                    {guestSaveLoading ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>
                    ) : (
                      <><i className="fa-solid fa-floppy-disk"></i> Save Guest Details</>
                    )}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>NAME</label>
                    <strong style={{ color: '#FFF' }}>{lead?.client_name}</strong>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>PHONE / WHATSAPP</label>
                    <strong style={{ color: 'var(--accent-teal)' }}>{lead?.client_phone}</strong>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>TRAVEL DATES TEXT</label>
                    <strong>{lead?.travel_dates || 'Flexible'}</strong>
                  </div>
                  
                  {/* Real Journey Start Date Input */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <label style={{ color: 'var(--primary)', display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      JOURNEY START DATE *
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={getTodayString()}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                      Required to track driver/vehicle availability calendar today.
                    </span>
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>GUEST SIZE</label>
                    <strong>{lead?.num_travelers} travelers</strong>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>SOURCE</label>
                    {lead?.partner_name ? (
                      <span className="badge badge-converted">Referral: {lead.partner_name}</span>
                    ) : (
                      <span className="badge badge-new">B2C Direct Lead</span>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Instructions
              </h3>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>Confirm or update the <strong>Journey Start Date</strong> so vehicle availability updates.</li>
                <li>Load a regional preset package template to pre-populate details quickly.</li>
                <li>Assign hotels from the registered accommodations list.</li>
                <li>Assign drivers to manage logistics and secure vehicles.</li>
                <li>Save the itinerary first to unlock the WhatsApp sending tool.</li>
              </ul>
            </section>
          </aside>

          {/* Right panel: Itinerary editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Quick Template Applicator Card */}
            <section className="glass-card" style={{ borderLeft: '4px solid var(--accent-teal)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: '#FFF' }}>Apply Preset Region / Route Template</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                    Overwrites the current form with predefined sightseeing logs & base prices (e.g. North Tour).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: '340px', flexWrap: 'wrap', flexGrow: 1, justifyContent: 'flex-end' }}>
                  <select
                    className="form-control"
                    value={templateRegionFilter}
                    onChange={(e) => setTemplateRegionFilter(e.target.value)}
                    style={{ width: '130px', border: '1px solid var(--accent-teal)' }}
                  >
                    <option value="All">All Regions</option>
                    <option value="North">North</option>
                    <option value="South">South</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                    <option value="Central">Central</option>
                  </select>
                  <select
                    className="form-control"
                    value={selectedTemplateId}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value);
                      handleApplyTemplate(e.target.value);
                    }}
                    style={{ maxWidth: '280px', border: '1px solid var(--accent-teal)' }}
                  >
                    <option value="">-- Select template to load --</option>
                    {templates
                      .filter(t => templateRegionFilter === 'All' || t.region.toLowerCase() === templateRegionFilter.toLowerCase())
                      .map(t => (
                        <option key={t.id} value={t.id}>[{t.region}] {t.name} (Rs. {t.estimated_price})</option>
                      ))
                    }
                  </select>
                </div>
              </div>
            </section>

            <form onSubmit={handleSave} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h2 style={{ fontSize: '1.3rem' }}>Configure Travel Itinerary</h2>
              
              {/* Header config inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="title">Itinerary Program Title</label>
                  <input
                    type="text"
                    id="title"
                    className="form-control"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="totalDays">Total Program Days</label>
                  <input
                    type="number"
                    id="totalDays"
                    className="form-control"
                    min="1"
                    max="30"
                    value={totalDays}
                    onChange={(e) => handleDaysCountChange(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="price">Overall Price (Rs.)</label>
                  <input
                    type="text"
                    id="price"
                    className="form-control"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Days editor details */}
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--accent-teal)' }}>
                  Day-by-Day Activities & Logistics
                </h3>

                {/* Quick Assignment Controls */}
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--border-radius-md)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <strong style={{ color: '#FFF', fontSize: '0.9rem' }}>Quick Assignment Tool</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assign a single driver/vehicle or hotel to all program days instantly.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <select
                      className="form-control"
                      style={{ width: '220px', fontSize: '0.85rem', padding: '0.4rem' }}
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const updated = days.map(d => ({ ...d, driverId: val }));
                          setDays(updated);
                          setSuccess('Quick assigned driver/vehicle to all days of the itinerary.');
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">-- Quick Assign Driver --</option>
                      {drivers
                        .filter(d => isDriverFreeForEntireJourney(d, days.length))
                        .map(d => (
                          <option key={d.id} value={d.id}>
                            {d.driver_name} ({d.vehicle_model || 'No Vehicle'} - {d.vehicle_number || 'N/A'})
                          </option>
                        ))
                      }
                    </select>
                    
                    <select
                      className="form-control"
                      style={{ width: '220px', fontSize: '0.85rem', padding: '0.4rem' }}
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const updated = days.map(d => ({ ...d, hotelId: val }));
                          setDays(updated);
                          setSuccess('Quick assigned accommodation stay to all days of the itinerary.');
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">-- Quick Assign Hotel --</option>
                      {hotels.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.location || 'No Loc'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {days.map((day, idx) => (
                    <div key={idx} style={{
                      padding: '1.25rem',
                      background: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--border-radius-md)',
                      border: '1px solid var(--border)'
                    }}>
                      <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#FFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          Day {day.dayNumber} Details
                          {startDate && (
                            <span className="badge badge-completed" style={{ textTransform: 'none', fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                              {getFormattedDateForDay(startDate, day.dayNumber)}
                            </span>
                          )}
                        </span>
                        <span className="badge badge-new" style={{ textTransform: 'none' }}>Day {day.dayNumber}</span>
                      </h4>

                      {/* Hotel and Driver options */}
                      <div className="form-row" style={{ marginBottom: '1rem' }}>
                        <div className="form-group">
                          <label>Accommodation Check-in</label>
                          <select
                            className="form-control"
                            value={day.hotelId}
                            onChange={(e) => handleDayFieldChange(idx, 'hotelId', e.target.value)}
                          >
                            <option value="">-- No stay assigned --</option>
                            {hotels.map(h => (
                              <option key={h.id} value={h.id}>{h.name} ({h.location || 'No Loc'})</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Transport Driver & Vehicle</label>
                          <select
                            className="form-control"
                            value={day.driverId}
                            onChange={(e) => handleDayFieldChange(idx, 'driverId', e.target.value)}
                          >
                            <option value="">-- No driver/vehicle assigned --</option>
                            {drivers
                              .filter(d => isDriverFreeOnDate(d, day.dayNumber) || String(d.id) === String(day.driverId))
                              .map(d => (
                                <option key={d.id} value={d.id}>
                                  {getDriverOptionText(d, day.dayNumber)}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>

                      {/* Day Description */}
                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>Activities Description</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="Write detailed schedule, sightseeing routes, and timeline events..."
                          value={day.description}
                          onChange={(e) => handleDayFieldChange(idx, 'description', e.target.value)}
                        ></textarea>
                      </div>

                      {/* Key Activities tags */}
                      <div className="form-group">
                        <label>Core Keywords / Inclusions</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Boating, Sunrise view, Trekking, Lunch included"
                          value={day.activities}
                          onChange={(e) => handleDayFieldChange(idx, 'activities', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '1rem', marginTop: '1rem', background: 'linear-gradient(135deg, var(--secondary), var(--accent-teal))' }}
                disabled={saving}
                id="itinerary-save-btn"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Saving Itinerary Program...
                  </>
                ) : (
                  <>
                    Save & Publish Itinerary <i className="fa-solid fa-circle-check"></i>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
