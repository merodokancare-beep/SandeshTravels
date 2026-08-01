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
  const [isMultiDropdownOpen, setIsMultiDropdownOpen] = useState(false);
  const [selectedMultiTemplateIds, setSelectedMultiTemplateIds] = useState([]);

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
      setSelectedTemplateId(templateId);
      setSuccess(`Loaded preset package "${selected.name}" template. Remember to hit "Save & Publish Itinerary" below to update changes!`);
      setError('');
    }
  };

  // Append a selected region template onto the end of the existing itinerary
  const handleAppendTemplate = (templateId) => {
    if (!templateId) return;
    const selected = templates.find(t => t.id === parseInt(templateId, 10));
    if (!selected) return;

    const templateDays = typeof selected.days === 'string' ? JSON.parse(selected.days) : selected.days;
    const startDayIndex = days.length;
    
    const appendedDays = templateDays.map((d, idx) => ({
      dayNumber: startDayIndex + idx + 1,
      hotelId: '',
      driverId: '',
      description: d.description || '',
      activities: d.activities || ''
    }));

    const newDays = [...days, ...appendedDays];
    setDays(newDays);
    setTotalDays(newDays.length);
    setPrice(prev => (parseFloat(prev) || 0) + (parseFloat(selected.estimated_price) || 0));

    if (!title || title.includes('Custom Travel Plan')) {
      setTitle(`${selected.name} for ${lead?.client_name}`);
    } else {
      if (!title.toLowerCase().includes(selected.region.toLowerCase())) {
        setTitle(`${title} & ${selected.region} Tour`);
      }
    }
    setSuccess(`Appended "${selected.name}" (${selected.total_days} days) to the itinerary.`);
    setError('');
  };

  // Combine multiple selected region templates into one unified itinerary
  const handleCombineMultipleTemplates = (selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) return;
    
    const selectedTemplates = templates.filter(t => selectedIds.includes(String(t.id)));
    if (selectedTemplates.length === 0) return;

    let combinedDays = [];
    let totalPrice = 0;
    let regionNames = [];

    selectedTemplates.forEach(t => {
      if (!regionNames.includes(t.region)) {
        regionNames.push(t.region);
      }
      totalPrice += (parseFloat(t.estimated_price) || 0);

      const templateDays = typeof t.days === 'string' ? JSON.parse(t.days) : t.days;
      templateDays.forEach(d => {
        combinedDays.push({
          dayNumber: combinedDays.length + 1,
          hotelId: '',
          driverId: '',
          description: d.description || '',
          activities: d.activities || ''
        });
      });
    });

    const regionsStr = regionNames.join(' & ');
    setTitle(`${regionsStr} Multi-Region Tour for ${lead?.client_name}`);
    setPrice(totalPrice);
    setTotalDays(combinedDays.length);
    setDays(combinedDays);
    setSuccess(`Combined ${selectedTemplates.length} regional templates (${combinedDays.length} days total) for ${lead?.client_name}!`);
    setError('');
  };

  // Append multiple selected region templates onto end of current itinerary
  const handleAppendMultipleTemplates = (selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) return;
    const selectedTemplates = templates.filter(t => selectedIds.includes(String(t.id)));
    if (selectedTemplates.length === 0) return;

    let currentDays = [...days];
    let totalPrice = parseFloat(price) || 0;
    let addedRegions = [];

    selectedTemplates.forEach(t => {
      if (!addedRegions.includes(t.region)) {
        addedRegions.push(t.region);
      }
      totalPrice += (parseFloat(t.estimated_price) || 0);

      const templateDays = typeof t.days === 'string' ? JSON.parse(t.days) : t.days;
      templateDays.forEach(d => {
        currentDays.push({
          dayNumber: currentDays.length + 1,
          hotelId: '',
          driverId: '',
          description: d.description || '',
          activities: d.activities || ''
        });
      });
    });

    setDays(currentDays);
    setTotalDays(currentDays.length);
    setPrice(totalPrice);

    if (!title || title.includes('Custom Travel Plan')) {
      setTitle(`${addedRegions.join(' & ')} Tour for ${lead?.client_name}`);
    } else {
      setTitle(`${title} + ${addedRegions.join(' & ')}`);
    }
    setSuccess(`Appended ${selectedTemplates.length} regional templates (${currentDays.length} total days) to itinerary.`);
    setError('');
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
    if (lead && (lead.status === 'converted' || lead.status === 'assigned' || lead.status === 'completed')) {
      const hasConflict = days.some(day => {
        if (!day.driverId) return false;
        const dayDateStr = getIsoDateForDay(startDate, day.dayNumber);
        const d = drivers.find(drv => String(drv.id) === String(day.driverId));
        if (!d) return false;
        return d.bookings?.some(b => b.date === dayDateStr && String(b.lead_id) !== String(leadId) && (b.lead_status === 'converted' || b.lead_status === 'assigned'));
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
        
      text = `Hi ${lead.client_name}, your booking with Sandesh Travels is confirmed! 🚗✨\n\n`;
      text += `*JOURNEY DETAILS:*\n`;
      text += `• Route: ${title}\n`;
      text += `• Start Date: ${formattedStartDate}\n`;
      text += `• Duration: ${totalDays} Days\n`;
      text += `• Overall Price: Rs. ${price}\n\n`;
      text += `*ASSIGNED DRIVER & VEHICLE:*\n`;
      text += `• Driver Name: ${driver.driver_name}\n`;
      text += `• Driver Contact: ${driver.driver_phone}\n`;
      text += `• Vehicle: ${driver.vehicle_model} (${driver.vehicle_number || 'N/A'})\n\n`;
      text += `Please click the link below to view your full day-by-day program, accommodation check-in stays, and updates:\n👉 ${guestItineraryUrl}\n\nThank you for choosing Sandesh Travels!`;
    } else {
      // Default quotation message
      text = `Hi ${lead.client_name}, this is Sandesh Travels. We have prepared your custom day-by-day travel plan and itinerary! 🗺️✈️\n\nPlease click this link to view all your hotel stay details, drivers, and activities:\n👉 ${guestItineraryUrl}\n\nLet us know if you want to proceed! Thank you.`;
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
              {lead && (lead.status === 'converted' || lead.status === 'assigned' || lead.status === 'completed') && (
                <Link 
                  href={`/admin/invoice/${lead.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
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
              {lead && (lead.status === 'converted' || lead.status === 'assigned' || lead.status === 'completed') && days.some(d => d.driverId) ? (
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
        
        {/* Lead Status Info Banners */}
        {lead && lead.status === 'converted' && (
          <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#FBBF24', padding: '0.85rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <i className="fa-solid fa-clock fa-xl"></i>
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Lead Status: CONVERTED (Booking Confirmed — Pending Fleet Assignment)</strong>
              <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '0.15rem' }}>Traveler has confirmed the booking. Assign drivers to each day below and click "Save Itinerary" to auto-transition status to <strong>FLEET ASSIGNED</strong>.</div>
            </div>
          </div>
        )}

        {lead && lead.status === 'assigned' && (
          <div style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', padding: '0.85rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <i className="fa-solid fa-circle-check fa-xl"></i>
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Lead Status: FLEET ASSIGNED (Vehicles & Drivers Dispatched)</strong>
              <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '0.15rem' }}>Fleet is assigned and journey details are ready to be shared with traveler via WhatsApp or SMS.</div>
            </div>
          </div>
        )}

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
            
            {/* Quick Multi-Select Checkbox Template Card */}
            <section className="glass-card" style={{ borderLeft: '4px solid var(--accent-teal)', position: 'relative' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="fa-solid fa-map-location-dot" style={{ color: 'var(--accent-teal)' }}></i>
                  Select & Combine Regional Route Templates
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                  Check one or multiple region templates below to build custom multi-region tours for <strong>{lead?.client_name}</strong>.
                </p>
              </div>

              {/* Region Filter Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginRight: '0.25rem' }}>Filter Region:</span>
                {['All', 'North', 'South', 'East', 'West', 'Central'].map(reg => (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => setTemplateRegionFilter(reg)}
                    style={{
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.75rem',
                      borderRadius: '12px',
                      border: templateRegionFilter === reg ? '1px solid #38bdf8' : '1px solid var(--border)',
                      background: templateRegionFilter === reg ? 'rgba(56,189,248,0.15)' : 'var(--bg-surface-elevated)',
                      color: templateRegionFilter === reg ? '#38bdf8' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: templateRegionFilter === reg ? '600' : 'normal'
                    }}
                  >
                    {reg}
                  </button>
                ))}
              </div>

              {/* Multi-Select Checkbox Dropdown Box */}
              <div style={{ position: 'relative', marginTop: '0.85rem' }}>
                <div
                  onClick={() => setIsMultiDropdownOpen(prev => !prev)}
                  className="form-control"
                  style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '0.55rem 0.85rem',
                    border: '1px solid var(--accent-teal)',
                    background: 'var(--bg-surface-elevated)',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <i className="fa-solid fa-square-check" style={{ color: 'var(--accent-teal)' }}></i>
                    {selectedMultiTemplateIds.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-- Click to select one or multiple region templates --</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ color: '#FFF', fontSize: '0.85rem', fontWeight: '600' }}>
                          {selectedMultiTemplateIds.length} Region Template(s) Selected:
                        </span>
                        {templates
                          .filter(t => selectedMultiTemplateIds.includes(String(t.id)))
                          .map(t => (
                            <span key={t.id} className="badge" style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                              [{t.region}] {t.name}
                            </span>
                          ))
                        }
                      </div>
                    )}
                  </div>
                  <i className={`fa-solid fa-chevron-${isMultiDropdownOpen ? 'up' : 'down'}`} style={{ color: 'var(--text-secondary)' }}></i>
                </div>

                {/* Dropdown panel */}
                {isMultiDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '105%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--border-radius-sm)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      padding: '0.75rem',
                      maxHeight: '280px',
                      overflowY: 'auto'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Check templates to combine:</span>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const visibleIds = templates
                              .filter(t => templateRegionFilter === 'All' || t.region.toLowerCase() === templateRegionFilter.toLowerCase())
                              .map(t => String(t.id));
                            setSelectedMultiTemplateIds(visibleIds);
                          }}
                          style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0 }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedMultiTemplateIds([])}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {templates
                        .filter(t => templateRegionFilter === 'All' || t.region.toLowerCase() === templateRegionFilter.toLowerCase())
                        .map(t => {
                          const isChecked = selectedMultiTemplateIds.includes(String(t.id));
                          return (
                            <label
                              key={t.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                background: isChecked ? 'rgba(56,189,248,0.1)' : 'var(--bg-surface)',
                                border: isChecked ? '1px solid rgba(56,189,248,0.3)' : '1px solid var(--border)',
                                cursor: 'pointer',
                                fontSize: '0.82rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMultiTemplateIds(prev => [...prev, String(t.id)]);
                                    } else {
                                      setSelectedMultiTemplateIds(prev => prev.filter(id => id !== String(t.id)));
                                    }
                                  }}
                                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                                />
                                <span style={{ fontWeight: isChecked ? '600' : 'normal', color: '#FFF' }}>
                                  <strong style={{ color: 'var(--accent-teal)', marginRight: '0.4rem' }}>[{t.region}]</strong>
                                  {t.name}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {t.total_days} Days • Rs. {t.estimated_price}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Bar */}
              {selectedMultiTemplateIds.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', flexWrap: 'wrap', gap: '0.75rem', background: 'rgba(56,189,248,0.06)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(56,189,248,0.2)' }}>
                  {(() => {
                    const selectedObjs = templates.filter(t => selectedMultiTemplateIds.includes(String(t.id)));
                    const combinedTotalDays = selectedObjs.reduce((acc, curr) => acc + parseInt(curr.total_days || 1, 10), 0);
                    const combinedTotalPrice = selectedObjs.reduce((acc, curr) => acc + (parseFloat(curr.estimated_price) || 0), 0);

                    return (
                      <>
                        <div style={{ fontSize: '0.82rem' }}>
                          <strong style={{ color: '#FFF' }}>{selectedObjs.length} Templates Selected</strong>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            Total: <strong>{combinedTotalDays} Days</strong> • Price: <strong style={{ color: 'var(--accent-teal)' }}>Rs. {combinedTotalPrice}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              handleCombineMultipleTemplates(selectedMultiTemplateIds);
                              setIsMultiDropdownOpen(false);
                            }}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '600' }}
                            title="Replaces current itinerary with selected region templates"
                          >
                            <i className="fa-solid fa-rotate"></i> Load (Replace)
                          </button>

                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              handleAppendMultipleTemplates(selectedMultiTemplateIds);
                              setIsMultiDropdownOpen(false);
                            }}
                            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '600' }}
                            title="Appends selected region templates onto end of current itinerary"
                          >
                            <i className="fa-solid fa-plus"></i> Append Selected
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
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
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assign a single driver/vehicle or hotel stay to all program days instantly.</p>
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

                      {/* Hotel and Driver options for every single day */}
                      <div className="form-row" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>
                            <i className="fa-solid fa-hotel" style={{ color: 'var(--primary)', marginRight: '0.3rem' }}></i>
                            Accommodation Check-in
                          </label>
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
                          <label style={{ fontWeight: '600' }}>
                            <i className="fa-solid fa-car" style={{ color: 'var(--accent-teal)', marginRight: '0.3rem' }}></i>
                            Transport Driver & Vehicle (Day {day.dayNumber})
                          </label>
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
