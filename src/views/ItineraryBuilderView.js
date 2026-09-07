'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { COUNTRY_CODES, parsePhoneNumber, formatFullPhoneNumber } from '@/lib/phone';
import { ToastContainer } from '@/components/Toast';

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
  const [vehicleCategory, setVehicleCategory] = useState('T');
  const [vehicleCount, setVehicleCount] = useState(1);
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
  const multiDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (multiDropdownRef.current && !multiDropdownRef.current.contains(event.target)) {
        setIsMultiDropdownOpen(false);
      }
    };
    if (isMultiDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMultiDropdownOpen]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 6000, action = null, title = null) => {
    if (!message) return;
    const id = Date.now() + Math.random().toString(36).substr(2, 6);
    setToasts(prev => {
      if (prev.some(t => t.message === message)) return prev;
      return [...prev, { id, type, title, message, duration, action }];
    });
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Trigger error toast
  useEffect(() => {
    if (error) {
      addToast(error, 'error', 8000, null, 'Error Notification');
    }
  }, [error]);

  // Trigger success toast
  useEffect(() => {
    if (success) {
      const whatsappAction = isSimulated ? (
        <a
          href={getWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#25D366',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: '600',
            padding: '0.35rem 0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            borderRadius: '6px',
            textDecoration: 'none',
            marginTop: '0.35rem'
          }}
        >
          <i className="fa-brands fa-whatsapp"></i> Open WhatsApp Web
        </a>
      ) : null;
      addToast(success, 'success', 7000, whatsappAction, 'Success');
    }
  }, [success, isSimulated]);

  // Trigger driver conflict warning toast
  useEffect(() => {
    if (hasDriverConflicts()) {
      addToast(
        'Scheduling Conflict Warning: One or more selected drivers are already booked on the scheduled dates for other trips. Please verify driver availability.',
        'warning',
        10000,
        null,
        'Scheduling Conflict'
      );
    }
  }, [startDate, days, drivers]);

  // Trigger lead status toast on initial load
  useEffect(() => {
    if (!lead) return;
    if (lead.status === 'converted') {
      addToast(
        'Traveler has confirmed the booking. Assign drivers to each day below and click "Save Itinerary" to auto-transition status to FLEET ASSIGNED.',
        'warning',
        8000,
        null,
        'Lead Status: CONVERTED'
      );
    } else if (lead.status === 'assigned') {
      addToast(
        'Fleet is assigned and journey details are ready to be shared with traveler via WhatsApp or SMS.',
        'info',
        8000,
        null,
        'Lead Status: FLEET ASSIGNED'
      );
    }
  }, [lead?.id, lead?.status]);

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
      } else {
        setError(data.error || `Failed to dispatch ${isSms ? 'SMS' : 'WhatsApp'} message.`);
      }
    } catch (err) {
      setError(`Network error sending ${isSms ? 'SMS' : 'WhatsApp'} message.`);
    } finally {
      if (isSms) setSmsLoading(false);
      else setWhatsappLoading(false);
    }
  };

  const isLeadConverted = lead && (lead.status === 'converted' || lead.status === 'assigned' || lead.status === 'completed');
  const missingDays = days.filter(d => !d.dayPrice || parseFloat(d.dayPrice) <= 0);
  const hasMissingDays = days.length === 0 || missingDays.length > 0;

  const getDriverOptionText = (d, dayNumber) => {
    const catTag = d.vehicle_category ? `[${d.vehicle_category}-${d.seating_capacity || (d.vehicle_category === 'J' ? 8 : d.vehicle_category === 'Z' ? 6 : 4)}P] ` : '';
    const defaultText = `${catTag}${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'})`;
    if (!startDate) return defaultText;
    const dayDateStr = getIsoDateForDay(startDate, dayNumber);
    const booking = d.bookings?.find(b => b.date === dayDateStr && String(b.lead_id) !== String(leadId) && b.lead_status === 'converted');
    if (booking) {
      const displayStatus = booking.lead_status.toUpperCase();
      return `${catTag}${d.driver_name} (${d.vehicle_model || 'No Vehicle'}) ⚠️ Busy: ${booking.client_name} (${displayStatus})`;
    }
    return defaultText;
  };

  const getDriverOptionTextForEntireJourney = (d, totalDays) => {
    const catTag = d.vehicle_category ? `[${d.vehicle_category}-${d.seating_capacity || (d.vehicle_category === 'J' ? 8 : d.vehicle_category === 'Z' ? 6 : 4)}P] ` : '';
    const defaultText = `${catTag}${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'})`;
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
      return `${catTag}${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'}) ⚠️ Busy: ${conflictingDates.join(', ')}`;
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
        
        let loadedVCount = 1;
        setLead(itinData.lead);
        if (itinData.lead) {
          setClientName(itinData.lead.client_name || '');
          const parsedPhone = parsePhoneNumber(itinData.lead.client_phone);
          setPhoneCountryCode(parsedPhone.countryCode);
          setLocalPhone(parsedPhone.localNumber);
          setClientPhone(itinData.lead.client_phone || '');
          setTravelDates(itinData.lead.travel_dates || '');
          const travelers = itinData.lead.num_travelers || 1;
          setNumTravelers(travelers);
          const vCat = (itinData.lead.vehicle_category || 'T').toUpperCase();
          setVehicleCategory(vCat);
          const cap = vCat === 'J' ? 8 : vCat === 'Z' ? 6 : 4;
          loadedVCount = itinData.lead.vehicle_count || Math.max(1, Math.ceil(travelers / cap));
          setVehicleCount(loadedVCount);

          if (itinData.lead.start_date) {
            setStartDate(itinData.lead.start_date.substring(0, 10));
          }
        }
        
        if (itinData.itinerary) {
          setItineraryId(itinData.itinerary.id);
          setTitle(itinData.itinerary.title);
          setPrice(itinData.itinerary.price);
          setTotalDays(itinData.itinerary.total_days);
          
          // Map loaded days details
          const currentVCount = loadedVCount || 1;
          const loadedDays = (itinData.days || []).map(d => {
            const total = (d.day_price !== undefined && d.day_price !== null && parseFloat(d.day_price) > 0) ? parseFloat(d.day_price) : 0;
            const perCar = total > 0 ? (total / currentVCount) : 0;
            return {
              dayNumber: d.day_number || d.dayNumber,
              hotelId: d.hotel_id || '',
              driverId: d.driver_id || '',
              description: d.description || '',
              activities: d.activities || '',
              perCarPrice: perCar > 0 ? (Number.isInteger(perCar) ? String(perCar) : perCar.toFixed(2)) : '',
              dayPrice: total > 0 ? String(total) : ''
            };
          });
          setDays(loadedDays);
          const daySum = loadedDays.reduce((acc, d) => acc + (parseFloat(d.dayPrice) || 0), 0);
          if (daySum > 0) {
            setPrice(daySum.toFixed(2));
          } else {
            setPrice(itinData.itinerary.price ? String(itinData.itinerary.price) : '0.00');
          }
        } else {
          // New itinerary defaults
          setTitle(`Custom Travel Plan for ${itinData.lead?.client_name || 'Guest'}`);
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
        const loadedTemplates = templatesData.templates || [];
        setTemplates(loadedTemplates);

        if (itinData.itinerary && itinData.itinerary.title && loadedTemplates.length > 0) {
          const matchedIds = loadedTemplates
            .filter(t => itinData.itinerary.title.toLowerCase().includes(t.region.toLowerCase()) || itinData.itinerary.title.toLowerCase().includes(t.name.toLowerCase()))
            .map(t => String(t.id));
          if (matchedIds.length > 0) {
            setSelectedMultiTemplateIds(matchedIds);
          }
        }

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
        activities: '',
        perCarPrice: '',
        dayPrice: ''
      });
    }
    setDays(arr);
  };

  // Adjust days array when totalDays count changes
  const handleDaysCountChange = (newCount) => {
    const count = parseInt(newCount, 10) || 1;
    setTotalDays(count);
    
    let updated = [...days];
    if (count > days.length) {
      // Append new blank days
      for (let i = days.length + 1; i <= count; i++) {
        updated.push({
          dayNumber: i,
          hotelId: '',
          driverId: '',
          description: '',
          activities: '',
          perCarPrice: '',
          dayPrice: ''
        });
      }
    } else if (count < days.length) {
      // Truncate days
      updated = days.slice(0, count);
    }
    setDays(updated);
    const sum = updated.reduce((acc, d) => acc + (parseFloat(d.dayPrice) || 0), 0);
    if (sum > 0) {
      setPrice(sum.toFixed(2));
    }
  };

  const handleDayFieldChange = (index, field, value) => {
    const updated = [...days];
    updated[index][field] = value;
    setDays(updated);

    if (field === 'dayPrice') {
      const sum = updated.reduce((acc, d) => {
        const p = parseFloat(d.dayPrice);
        return acc + (isNaN(p) ? 0 : p);
      }, 0);
      setPrice(sum > 0 ? sum.toFixed(2) : '0.00');
    }
  };

  // Handle per-single-vehicle rate entry on any program day
  const handleDayPerCarPriceChange = (index, value) => {
    const updated = [...days];
    updated[index].perCarPrice = value;
    const numVal = parseFloat(value);
    const currentVCount = vehicleCount || 1;
    if (!isNaN(numVal) && numVal > 0) {
      updated[index].dayPrice = String(Math.round(numVal * currentVCount));
    } else {
      updated[index].dayPrice = '';
    }
    setDays(updated);

    // Automatically recalculate overall price as sum of all day prices
    const sum = updated.reduce((acc, d) => {
      const p = parseFloat(d.dayPrice);
      return acc + (isNaN(p) ? 0 : p);
    }, 0);
    setPrice(sum > 0 ? sum.toFixed(2) : '0.00');
  };

  // Recalculate all day prices and overall price when fleet count changes
  const handleFleetCountChange = (newCount) => {
    const count = Math.max(1, parseInt(newCount, 10) || 1);
    setVehicleCount(count);

    const updated = days.map(d => {
      const perCar = parseFloat(d.perCarPrice);
      if (!isNaN(perCar) && perCar > 0) {
        return {
          ...d,
          dayPrice: String(Math.round(perCar * count))
        };
      }
      return d;
    });
    setDays(updated);

    const sum = updated.reduce((acc, d) => {
      const p = parseFloat(d.dayPrice);
      return acc + (isNaN(p) ? 0 : p);
    }, 0);
    setPrice(sum > 0 ? sum.toFixed(2) : '0.00');
  };

  // Overwrite state variables with a selected package blueprint template
  const handleApplyTemplate = (templateId) => {
    if (!templateId) return;
    const selected = templates.find(t => t.id === parseInt(templateId, 10));
    if (selected) {
      setTitle(`${selected.name} for ${lead?.client_name}`);
      setTotalDays(selected.total_days);
      
      const templateDays = typeof selected.days === 'string' ? JSON.parse(selected.days) : selected.days;
      
      const currentVCount = vehicleCount || 1;
      const mappedDays = templateDays.map(d => {
        const rawPrice = (d.dayPrice !== undefined && d.dayPrice !== null && parseFloat(d.dayPrice) > 0) ? parseFloat(d.dayPrice) : ((d.day_price !== undefined && d.day_price !== null && parseFloat(d.day_price) > 0) ? parseFloat(d.day_price) : 0);
        return {
          dayNumber: d.dayNumber,
          hotelId: '',
          driverId: '',
          description: d.description || '',
          activities: d.activities || '',
          perCarPrice: rawPrice > 0 ? String(rawPrice) : '',
          dayPrice: rawPrice > 0 ? String(Math.round(rawPrice * currentVCount)) : ''
        };
      });
      
      const sum = mappedDays.reduce((acc, d) => acc + (parseFloat(d.dayPrice) || 0), 0);
      setPrice(sum > 0 ? sum.toFixed(2) : '0.00');
      setDays(mappedDays);
      setSelectedTemplateId(templateId);
      setSuccess(`Loaded preset package "${selected.name}" template. Enter daywise amounts below to calculate price.`);
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
    const currentVCount = vehicleCount || 1;
    
    const appendedDays = templateDays.map((d, idx) => {
      const rawPrice = (d.dayPrice !== undefined && d.dayPrice !== null && parseFloat(d.dayPrice) > 0) ? parseFloat(d.dayPrice) : 0;
      return {
        dayNumber: startDayIndex + idx + 1,
        hotelId: '',
        driverId: '',
        description: d.description || '',
        activities: d.activities || '',
        perCarPrice: rawPrice > 0 ? String(rawPrice) : '',
        dayPrice: rawPrice > 0 ? String(Math.round(rawPrice * currentVCount)) : ''
      };
    });

    const newDays = [...days, ...appendedDays];
    setDays(newDays);
    setTotalDays(newDays.length);
    const sum = newDays.reduce((acc, d) => acc + (parseFloat(d.dayPrice) || 0), 0);
    setPrice(sum > 0 ? sum.toFixed(2) : (parseFloat(price) || 0).toFixed(2));

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
    const ids = selectedIds || [];
    setSelectedMultiTemplateIds(ids);

    if (ids.length === 0) {
      setTitle(`Custom Travel Plan for ${lead?.client_name || 'Guest'}`);
      setPrice('0.00');
      setTotalDays(1);
      initializeDays(1);
      return;
    }
    
    const selectedTemplates = templates.filter(t => ids.includes(String(t.id)));
    if (selectedTemplates.length === 0) return;

    let combinedDays = [];
    let regionNames = [];
    const currentVCount = vehicleCount || 1;

    selectedTemplates.forEach(t => {
      if (!regionNames.includes(t.region)) {
        regionNames.push(t.region);
      }

      const templateDays = typeof t.days === 'string' ? JSON.parse(t.days) : t.days;
      if (Array.isArray(templateDays)) {
        templateDays.forEach(d => {
          const rawPrice = (d.dayPrice !== undefined && d.dayPrice !== null && parseFloat(d.dayPrice) > 0) ? parseFloat(d.dayPrice) : 0;
          combinedDays.push({
            dayNumber: combinedDays.length + 1,
            hotelId: '',
            driverId: '',
            description: d.description || '',
            activities: d.activities || '',
            perCarPrice: rawPrice > 0 ? String(rawPrice) : '',
            dayPrice: rawPrice > 0 ? String(Math.round(rawPrice * currentVCount)) : ''
          });
        });
      }
    });

    const sum = combinedDays.reduce((acc, d) => acc + (parseFloat(d.dayPrice) || 0), 0);
    const regionsStr = regionNames.join(' & ');
    setTitle(`${regionsStr} Multi-Region Tour for ${lead?.client_name || 'Guest'}`);
    setPrice(sum > 0 ? sum.toFixed(2) : '0.00');
    setTotalDays(combinedDays.length);
    setDays(combinedDays);
    setSuccess(`Combined ${selectedTemplates.length} regional template(s) (${combinedDays.length} days total) for ${lead?.client_name || 'Guest'}!`);
    setError('');
  };

  // Append multiple selected region templates onto end of current itinerary
  const handleAppendMultipleTemplates = (selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) return;
    const selectedTemplates = templates.filter(t => selectedIds.includes(String(t.id)));
    if (selectedTemplates.length === 0) return;

    let currentDays = [...days];
    let addedRegions = [];
    const currentVCount = vehicleCount || 1;

    selectedTemplates.forEach(t => {
      if (!addedRegions.includes(t.region)) {
        addedRegions.push(t.region);
      }

      const templateDays = typeof t.days === 'string' ? JSON.parse(t.days) : t.days;
      templateDays.forEach(d => {
        const rawPrice = (d.dayPrice !== undefined && d.dayPrice !== null && parseFloat(d.dayPrice) > 0) ? parseFloat(d.dayPrice) : ((d.day_price !== undefined && d.day_price !== null && parseFloat(d.day_price) > 0) ? parseFloat(d.day_price) : 0);
        currentDays.push({
          dayNumber: currentDays.length + 1,
          hotelId: '',
          driverId: '',
          description: d.description || '',
          activities: d.activities || '',
          perCarPrice: rawPrice > 0 ? String(rawPrice) : '',
          dayPrice: rawPrice > 0 ? String(Math.round(rawPrice * currentVCount)) : ''
        });
      });
    });

    setDays(currentDays);
    setTotalDays(currentDays.length);
    const sum = currentDays.reduce((acc, d) => acc + (parseFloat(d.dayPrice) || 0), 0);
    setPrice(sum > 0 ? sum.toFixed(2) : '0.00');

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
          numTravelers,
          vehicleCategory,
          vehicleCount
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
        setVehicleCategory(data.lead.vehicle_category || 'T');
        setVehicleCount(data.lead.vehicle_count || 1);
        setIsEditingGuest(false);
        setSuccess(`Guest details updated successfully! Saved mobile number: "${data.lead.client_phone}".`);
      } else {
        setError(data.error || 'Failed to update guest details.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error updating guest details.');
    } finally {
      setGuestSaveLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Strict Daywise Pricing validation: EVERY single configured day must have a valid positive amount
    const invalidDays = days.filter(d => {
      const amt = parseFloat(d.dayPrice);
      return isNaN(amt) || amt <= 0;
    }).map(d => `Day ${d.dayNumber}`);

    if (days.length === 0 || invalidDays.length > 0) {
      setError(`Validation Error: All days must have a price set. Missing or ₹0 amount on: ${invalidDays.length > 0 ? invalidDays.join(', ') : 'All Days'}. Please enter daily rates for every day before saving.`);
      return;
    }

    const daywiseTotal = days.reduce((acc, d) => acc + (parseFloat(d.dayPrice) || 0), 0);
    if (daywiseTotal <= 0) {
      setError('Validation Error: Itinerary cannot be saved without an amount (₹0). Please enter the daywise pricing rate for each program day before saving & publishing.');
      return;
    }

    // Journey Start Date validation (no back dates for new/quoted itineraries)
    if (startDate && (!lead || lead.status === 'new' || lead.status === 'quoted')) {
      const parts = startDate.split('-');
      if (parts.length === 3) {
        const selectedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const today = new Date();
        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        if (selectedDate < todayZero) {
          setError('Validation Error: Journey Start Date cannot be in the past (back date). Please select today or a future date.');
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
        return;
      }
    }

    setSaving(true);

    const sanitizedDays = days.map(d => ({
      ...d,
      driverId: isLeadConverted ? d.driverId : ''
    }));

    try {
      const res = await fetch('/api/admin/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          title,
          price,
          totalDays,
          days: sanitizedDays,
          startDate, // Send the updated start_date too
          vehicleCategory,
          vehicleCount
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Itinerary and travel start date saved & synced successfully.');
        setItineraryId(data.itineraryId);
        router.refresh();
      } else {
        setError(data.error || 'Failed to save itinerary.');
      }
    } catch (err) {
      console.error(err);
      setError('Network failure while saving.');
    } finally {
      setSaving(false);
    }
  };


  const getWhatsAppMessageText = () => {
    if (!lead || !itineraryId) return '';
    const baseDomain = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const guestItineraryUrl = `${baseDomain.replace(/\/$/, '')}/itinerary/${itineraryId}`;
    const assignedDay = days.find(d => d.driverId) || {};
    const driver = drivers.find(drv => String(drv.id) === String(assignedDay.driverId));
    const hasDriver = !!driver;
    
    const vCat = (vehicleCategory || lead?.vehicle_category || 'T').toUpperCase();
    const cap = vCat === 'J' ? 8 : vCat === 'Z' ? 6 : 4;
    const vCount = vehicleCount || lead?.vehicle_count || Math.ceil((numTravelers || 1) / cap);
    const vLabel = vCat === 'J' ? 'J-Series (Maxi Cab 8-Seater)' : vCat === 'Z' ? 'Z-Series (MUV/SUV 6-Seater)' : 'T-Series (Hatchback/Sedan 4-Seater)';

    const formattedStartDate = startDate 
      ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : (lead.travel_dates || 'Flexible');

    const totalPrice = parseFloat(price) || 0;
    const advanceRequired = Math.round(totalPrice * 0.1);

    if ((lead.status === 'converted' || lead.status === 'completed') && hasDriver) {
      return `Hi ${lead.client_name}, your booking with Sandesh Travels is confirmed! 🚗✨\n\n*JOURNEY DETAILS:*\n• Route: ${title}\n• Start Date: ${formattedStartDate}\n• Duration: ${totalDays} Days\n• Guests: ${numTravelers} Traveler(s)\n• Vehicle: ${vCount}x ${vLabel}\n• Overall Price: Rs. ${price}\n\n*ASSIGNED DRIVER & VEHICLE:*\n• Driver Name: ${driver.driver_name}\n• Driver Contact: ${driver.driver_phone}\n• Assigned Car: ${driver.vehicle_model} (${driver.vehicle_number || 'N/A'})\n\nPlease click the link below to view your full day-by-day program, accommodation check-in stays, and updates:\n${guestItineraryUrl}\n\nThank you for choosing Sandesh Travels!`;
    }

    let msg = `*TOUR QUOTATION & ITINERARY – Sandesh Travels* 🏔️✈️\n\n`;
    msg += `Dear *${lead.client_name}*,\n\n`;
    msg += `Greetings from *Sandesh Travels*!\n`;
    msg += `We have prepared your customized day-by-day travel plan and price quotation.\n\n`;
    msg += `📋 *QUOTATION DETAILS:*\n`;
    msg += `• *Tour Plan:* ${title}\n`;
    msg += `• *Duration:* ${totalDays} Days / ${Math.max(1, totalDays - 1)} Nights\n`;
    msg += `• *Journey Start Date:* ${formattedStartDate}\n`;
    msg += `• *Guests:* ${numTravelers} Traveler(s)\n`;
    msg += `• *Vehicle Allocated:* ${vCount}x ${vLabel}\n`;
    if (totalPrice > 0) {
      msg += `• *Total Package Cost:* Rs. ${totalPrice.toLocaleString('en-IN')}\n`;
      msg += `• *10% Advance Deposit to Confirm:* Rs. ${advanceRequired.toLocaleString('en-IN')}\n`;
    }
    msg += `\n🗺️ *VIEW COMPLETE DAY-BY-DAY ITINERARY & STAYS:*\n`;
    msg += `${guestItineraryUrl}\n\n`;
    msg += `You can review the daywise program, sightseeing spots, and hotels on the link above. To confirm your booking, please submit the 10% advance deposit via the portal or reach out to us directly.\n\n`;
    msg += `Warm regards,\n*Sandesh Travels Team*`;
    return msg;
  };

  const getWhatsAppLink = () => {
    if (!lead || !itineraryId) return '#';
    const text = getWhatsAppMessageText();
    const cleanPhone = (lead.client_phone || '').replace(/\D/g, '');
    return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/admin/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}>
            <i className="fa-solid fa-arrow-left"></i> Dashboard
          </Link>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Itinerary Builder</h1>
          {lead && lead.status === 'converted' && (
            <span style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#FBBF24', padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <i className="fa-solid fa-clock"></i> PENDING FLEET ASSIGNMENT
            </span>
          )}
          {lead && lead.status === 'assigned' && (
            <span style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <i className="fa-solid fa-circle-check"></i> FLEET ASSIGNED
            </span>
          )}
        </div>
        <div>
          {itineraryId && (
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                title="Open WhatsApp Web chat"
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

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>PREFERRED VEHICLE CATEGORY</label>
                    <select
                      className="form-control"
                      value={vehicleCategory}
                      onChange={(e) => setVehicleCategory(e.target.value)}
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', background: 'var(--bg-surface-elevated)', color: '#FFF' }}
                    >
                      <option value="T">T-Series (Hatchback/Sedan - Max 4 Pax)</option>
                      <option value="Z">Z-Series (MUV/SUV - Max 6 Pax)</option>
                      <option value="J">J-Series (Maxi Cab - Max 8 Pax)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>VEHICLES REQUIRED (FLEET COUNT)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        className="form-control"
                        value={vehicleCount}
                        onChange={(e) => setVehicleCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        title="Auto-calculate based on passenger capacity"
                        onClick={() => {
                          const cap = vehicleCategory === 'J' ? 8 : vehicleCategory === 'Z' ? 6 : 4;
                          setVehicleCount(Math.max(1, Math.ceil((numTravelers || 1) / cap)));
                        }}
                      >
                        <i className="fa-solid fa-arrows-rotate"></i> Auto
                      </button>
                    </div>
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

                  {/* Preferred Vehicle Requirements Snapshot */}
                  {(() => {
                    const vCat = (vehicleCategory || lead?.vehicle_category || 'T').toUpperCase();
                    const cap = vCat === 'J' ? 8 : vCat === 'Z' ? 6 : 4;
                    const vCount = vehicleCount || lead?.vehicle_count || Math.ceil((numTravelers || 1) / cap);
                    const vLabel = vCat === 'J' ? 'J-Series (Maxi Cab 8-Seater)' : vCat === 'Z' ? 'Z-Series (MUV/SUV 6-Seater)' : 'T-Series (Hatchback/Sedan 4-Seater)';
                    return (
                      <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.25)', marginTop: '0.25rem' }}>
                        <label style={{ color: '#38BDF8', display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                          🚗 PREFERRED VEHICLE FLEET
                        </label>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFF' }}>
                          {vCount}x {vCat}-Series ({vLabel})
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Allocated for {numTravelers} traveler(s) ({vCount * cap} max seats)
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.8rem' }}>SOURCE</label>
                    {lead?.partner_name ? (
                      <span className="badge badge-partner">
                        <i className="fa-solid fa-hotel" style={{ marginRight: '0.3rem' }}></i> B2B: {lead.partner_name}
                      </span>
                    ) : (lead?.source === 'website' || lead?.travel_dates?.includes('Website') || lead?.travel_dates?.includes('🌐')) ? (
                      <span className="badge badge-website">
                        <i className="fa-solid fa-globe" style={{ marginRight: '0.3rem' }}></i> Website Online
                      </span>
                    ) : (
                      <span className="badge badge-direct">
                        <i className="fa-solid fa-phone" style={{ marginRight: '0.3rem' }}></i> Direct Walk-in
                      </span>
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
              <div 
                style={{ position: 'relative', marginTop: '0.85rem' }} 
                ref={multiDropdownRef}
                onMouseLeave={() => setIsMultiDropdownOpen(false)}
              >
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
                            <span 
                              key={t.id} 
                              className="badge" 
                              style={{ 
                                background: 'rgba(56,189,248,0.15)', 
                                border: '1px solid #38bdf8', 
                                color: '#38bdf8', 
                                fontSize: '0.72rem', 
                                padding: '0.15rem 0.45rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <span>[{t.region}] {t.name}</span>
                              <span
                                role="button"
                                title="Remove itinerary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCombineMultipleTemplates(selectedMultiTemplateIds.filter(id => id !== String(t.id)));
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  background: 'rgba(56,189,248,0.25)',
                                  color: '#38bdf8',
                                  cursor: 'pointer',
                                  fontSize: '0.65rem',
                                  lineHeight: 1
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#ef4444';
                                  e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(56,189,248,0.25)';
                                  e.currentTarget.style.color = '#38bdf8';
                                }}
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </span>
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
                            handleCombineMultipleTemplates(visibleIds);
                          }}
                          style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0 }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCombineMultipleTemplates([])}
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
                                    const next = e.target.checked
                                      ? [...selectedMultiTemplateIds, String(t.id)]
                                      : selectedMultiTemplateIds.filter(id => id !== String(t.id));
                                    handleCombineMultipleTemplates(next);
                                  }}
                                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                                />
                                <span style={{ fontWeight: isChecked ? '600' : 'normal', color: '#FFF' }}>
                                  <strong style={{ color: 'var(--accent-teal)', marginRight: '0.4rem' }}>[{t.region}]</strong>
                                  {t.name}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {t.total_days} Days
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

                    return (
                      <>
                        <div style={{ fontSize: '0.82rem' }}>
                          <strong style={{ color: '#FFF' }}>{selectedObjs.length} Templates Selected</strong>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            Total Duration: <strong>{combinedTotalDays} Days</strong>
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
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', gap: '1rem', alignItems: 'start' }}>
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
                  <label htmlFor="price">
                    Total Package Price (Rs.)
                  </label>
                  <input
                    type="text"
                    id="price"
                    className="form-control"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Auto-calculated from day rates"
                    required
                    style={{ fontWeight: 700, color: '#38BDF8' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 500 }}>
                    <i className="fa-solid fa-calculator"></i> Auto-summed from day rates
                  </span>
                </div>
              </div>

              {/* Trip Vehicle Category & Fleet Configuration */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 'var(--border-radius-md)',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className="fa-solid fa-car-side" style={{ color: 'var(--accent-teal)', fontSize: '1.1rem' }}></i>
                    <strong style={{ color: '#FFF', fontSize: '0.95rem' }}>Trip Vehicle & Fleet Configuration</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      (Change category or fleet size anytime per guest preference)
                    </span>
                  </div>
                  {/* Realtime capacity status badge */}
                  {(() => {
                    const vCat = (vehicleCategory || 'T').toUpperCase();
                    const cap = vCat === 'J' ? 8 : vCat === 'Z' ? 6 : 4;
                    const totalCapacity = (vehicleCount || 1) * cap;
                    const guests = numTravelers || 1;
                    const isUnderCapacity = totalCapacity < guests;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge" style={{
                          background: isUnderCapacity ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          border: isUnderCapacity ? '1px solid #ef4444' : '1px solid #10b981',
                          color: isUnderCapacity ? '#fca5a5' : '#6ee7b7',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.6rem'
                        }}>
                          <i className={isUnderCapacity ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-users"} style={{ marginRight: '0.3rem' }}></i>
                          {vehicleCount}x {vCat}-Series = {totalCapacity} Seats for {guests} Guest{guests > 1 ? 's' : ''}
                        </span>
                        {isUnderCapacity && (
                          <span style={{ fontSize: '0.72rem', color: '#f87171' }}>
                            ⚠️ Need at least {Math.ceil(guests / cap)} car(s) or higher series
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="vehicleCategorySelect" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Preferred Vehicle Category (SK Rule)
                    </label>
                    <select
                      id="vehicleCategorySelect"
                      className="form-control"
                      value={vehicleCategory}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setVehicleCategory(newCat);
                      }}
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', background: 'var(--bg-surface-elevated)', color: '#FFF' }}
                    >
                      <option value="T">T-Series — Hatchback / Sedan (Max 4 Pax / Car)</option>
                      <option value="Z">Z-Series — MUV / SUV / Innova (Max 6 Pax / Car)</option>
                      <option value="J">J-Series — Maxi Cab / Bolero (Max 8 Pax / Car)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="vehicleCountInput" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Fleet Count (Cars Needed)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={() => handleFleetCountChange(Math.max(1, (parseInt(vehicleCount, 10) || 1) - 1))}
                        title="Decrease vehicle count"
                      >
                        -
                      </button>
                      <input
                        id="vehicleCountInput"
                        type="number"
                        min="1"
                        max="20"
                        className="form-control"
                        value={vehicleCount}
                        onChange={(e) => handleFleetCountChange(e.target.value)}
                        style={{ textAlign: 'center', fontWeight: 700, color: '#38BDF8', fontSize: '0.9rem', padding: '0.45rem' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={() => handleFleetCountChange((parseInt(vehicleCount, 10) || 1) + 1)}
                        title="Increase vehicle count"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                    <label style={{ fontSize: '0.78rem', opacity: 0, marginBottom: '0.25rem' }}>Auto</label>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                      title="Auto-calculate required vehicle count from guest size"
                      onClick={() => {
                        const vCat = (vehicleCategory || 'T').toUpperCase();
                        const cap = vCat === 'J' ? 8 : vCat === 'Z' ? 6 : 4;
                        const autoCnt = Math.max(1, Math.ceil((numTravelers || 1) / cap));
                        handleFleetCountChange(autoCnt);
                        addToast(`Fleet size auto-calculated to ${autoCnt}x ${vCat}-Series vehicle(s) for ${numTravelers || 1} travelers.`, 'info');
                      }}
                    >
                      <i className="fa-solid fa-calculator"></i> Auto-Fleet Size
                    </button>
                  </div>
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
                    {!isLeadConverted && (
                      <span className="badge" style={{ marginTop: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', color: '#fbbf24' }}>
                        <i className="fa-solid fa-lock"></i> Driver assignment unlocks after Lead Conversion
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <select
                      className="form-control"
                      style={{ width: '220px', fontSize: '0.85rem', padding: '0.4rem', opacity: isLeadConverted ? 1 : 0.6, cursor: isLeadConverted ? 'pointer' : 'not-allowed' }}
                      defaultValue=""
                      disabled={!isLeadConverted}
                      title={!isLeadConverted ? "Driver assignment opens after lead status is converted" : ""}
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
                      <option value="">{isLeadConverted ? '-- Quick Assign Driver --' : '🔒 Drivers Locked (Unconverted Lead)'}</option>
                      {isLeadConverted && drivers
                        .filter(d => isDriverFreeForEntireJourney(d, days.length))
                        .map(d => (
                          <option key={d.id} value={d.id}>
                            {d.vehicle_category ? `[${d.vehicle_category}-${d.seating_capacity || (d.vehicle_category === 'J' ? 8 : d.vehicle_category === 'Z' ? 6 : 4)}P] ` : ''}{d.driver_name} ({d.vehicle_model || 'No Vehicle'} - {d.vehicle_number || 'N/A'})
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFF' }}>
                            Day {day.dayNumber} Logistics & Activities
                          </span>
                          {startDate && (
                            <span className="badge badge-completed" style={{ textTransform: 'none', fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                              {getFormattedDateForDay(startDate, day.dayNumber)}
                            </span>
                          )}
                        </div>

                        {/* Daywise Single-Vehicle Rate Input with Auto-Calculated Fleet Total */}
                        {(() => {
                          const vCat = (vehicleCategory || lead?.vehicle_category || 'T').toUpperCase();
                          const currentCount = vehicleCount || 1;
                          const isInvalid = !day.perCarPrice || parseFloat(day.perCarPrice) <= 0;
                          const perCarNum = parseFloat(day.perCarPrice) || 0;
                          const dayTotalNum = parseFloat(day.dayPrice) || (perCarNum * currentCount);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.55rem',
                                background: isInvalid ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.08)',
                                border: isInvalid ? '1.5px solid #EF4444' : '1px solid rgba(56, 189, 248, 0.35)',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '8px',
                                transition: 'all 0.2s ease',
                                flexWrap: 'wrap'
                              }}>
                                <i className={isInvalid ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-car-side"} 
                                   style={{ color: isInvalid ? '#EF4444' : 'var(--accent-teal)', fontSize: '0.85rem' }}></i>
                                <label style={{ fontSize: '0.78rem', color: isInvalid ? '#FCA5A5' : '#FFF', fontWeight: 600, margin: 0 }}>
                                  {currentCount > 1 
                                    ? `Day ${day.dayNumber} Rate per Car (${vCat}-Series):` 
                                    : `Day ${day.dayNumber} Rate (${vCat}-Series):`}
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                  <span style={{ position: 'absolute', left: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>₹</span>
                                  <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    placeholder="e.g. 3500"
                                    className="form-control"
                                    style={{
                                      width: '120px',
                                      padding: '0.25rem 0.5rem 0.25rem 1.25rem',
                                      fontSize: '0.85rem',
                                      background: 'rgba(0,0,0,0.4)',
                                      color: isInvalid ? '#F87171' : '#38BDF8',
                                      fontWeight: 700,
                                      border: isInvalid ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid var(--border)'
                                    }}
                                    value={day.perCarPrice || ''}
                                    onFocus={(e) => {
                                      if (!e.target.value || parseFloat(e.target.value) === 0 || e.target.value === '0' || e.target.value === '0.00') {
                                        handleDayPerCarPriceChange(idx, '');
                                      } else {
                                        e.target.select();
                                      }
                                    }}
                                    onClick={(e) => {
                                      if (!e.target.value || parseFloat(e.target.value) === 0 || e.target.value === '0' || e.target.value === '0.00') {
                                        handleDayPerCarPriceChange(idx, '');
                                      } else {
                                        e.target.select();
                                      }
                                    }}
                                    onChange={(e) => handleDayPerCarPriceChange(idx, e.target.value)}
                                  />
                                </div>

                                {/* Calculated Multi-Car Total Badge */}
                                {currentCount > 1 && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    color: '#38BDF8',
                                    fontWeight: 700
                                  }}>
                                    <span>× {currentCount} cars =</span>
                                    <strong style={{ color: '#6EE7B7' }}>₹{dayTotalNum > 0 ? dayTotalNum.toLocaleString('en-IN') : '0'}</strong>
                                  </span>
                                )}

                                {isInvalid && (
                                  <span style={{ fontSize: '0.7rem', color: '#EF4444', fontWeight: 700, whiteSpace: 'nowrap' }}>* Required</span>
                                )}
                              </div>
                              {currentCount > 1 && perCarNum > 0 && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <i className="fa-solid fa-calculator"></i>
                                  {currentCount} cars × ₹{perCarNum.toLocaleString('en-IN')} = <strong style={{ color: '#38BDF8' }}>₹{dayTotalNum.toLocaleString('en-IN')} Day Total</strong> (added to Total Package Price)
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>

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
                            value={isLeadConverted ? day.driverId : ''}
                            disabled={!isLeadConverted}
                            style={{ opacity: isLeadConverted ? 1 : 0.6, cursor: isLeadConverted ? 'pointer' : 'not-allowed' }}
                            title={!isLeadConverted ? "Driver assignment opens after lead status is converted" : ""}
                            onChange={(e) => handleDayFieldChange(idx, 'driverId', e.target.value)}
                          >
                            <option value="">{isLeadConverted ? '-- No driver/vehicle assigned --' : '🔒 Driver assignment opens when lead is Converted'}</option>
                            {isLeadConverted && drivers
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

              {/* Live Daywise Financial Breakdown & 10% Advance Deposit Calculator */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
                border: '1px solid rgba(99,102,241,0.4)',
                borderRadius: 'var(--border-radius-lg)',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-glow)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h4 style={{ margin: 0, color: '#FFF', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fa-solid fa-calculator" style={{ color: 'var(--accent-teal)' }}></i>
                      Daywise Pricing & 10% Advance Deposit Calculation
                    </h4>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Total package price is dynamically computed as the sum of all daywise amounts entered above.
                    </p>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#A5B4FC', background: 'rgba(99,102,241,0.15)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <i className="fa-solid fa-receipt" style={{ marginRight: '0.35rem' }}></i> {days.length} Days Configured
                  </div>
                </div>

                {/* Daywise badges breakdown pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {days.map((d, i) => {
                    const isSet = parseFloat(d.dayPrice) > 0;
                    return (
                      <div key={i} style={{
                        background: isSet ? 'rgba(56,189,248,0.12)' : 'rgba(239,68,68,0.15)',
                        border: isSet ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(239,68,68,0.6)',
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <span style={{ color: isSet ? 'var(--text-secondary)' : '#FCA5A5' }}>Day {d.dayNumber}:</span>
                        <strong style={{ color: isSet ? '#38BDF8' : '#F87171' }}>
                          {isSet ? `₹${parseFloat(d.dayPrice).toLocaleString('en-IN')}` : '₹0 ⚠️ (Rate Required)'}
                        </strong>
                      </div>
                    );
                  })}
                </div>

                {/* 3 Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Sum Total (All Days)
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFF', marginTop: '0.25rem' }}>
                      ₹{(parseFloat(price) || 0).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,78,59,0.2))', border: '1px solid rgba(52,211,153,0.4)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      10% Advance Deposit Required
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34D399', marginTop: '0.25rem' }}>
                      ₹{Math.round((parseFloat(price) || 0) * 0.10).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Balance on Arrival (90%)
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      ₹{Math.max(0, (parseFloat(price) || 0) - Math.round((parseFloat(price) || 0) * 0.10)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {hasMissingDays && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '0.85rem 1.25rem',
                  color: '#FCA5A5',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem'
                }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ color: '#EF4444', fontSize: '1.1rem', flexShrink: 0 }}></i>
                  <div>
                    <strong>Daywise pricing is strictly required for every day:</strong> Missing or ₹0 rate on{' '}
                    <span style={{ color: '#FFF', fontWeight: 700 }}>
                      {missingDays.map(d => `Day ${d.dayNumber}`).join(', ')}
                    </span>.
                    You must enter a rate for all {days.length} days before you can save & publish this itinerary.
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '1rem',
                  marginTop: '0.5rem',
                  background: hasMissingDays 
                    ? 'rgba(239, 68, 68, 0.2)' 
                    : 'linear-gradient(135deg, var(--secondary), var(--accent-teal))',
                  border: hasMissingDays ? '1px solid rgba(239, 68, 68, 0.5)' : 'none',
                  color: hasMissingDays ? '#FCA5A5' : '#FFF',
                  cursor: hasMissingDays ? 'not-allowed' : 'pointer',
                  opacity: hasMissingDays ? 0.85 : 1
                }}
                disabled={saving || hasMissingDays}
                id="itinerary-save-btn"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Saving Itinerary Program...
                  </>
                ) : hasMissingDays ? (
                  <>
                    <i className="fa-solid fa-lock" style={{ color: '#F87171', marginRight: '0.4rem' }}></i>
                    Set Rates For All {days.length} Days to Save & Publish ({missingDays.length} Missing: {missingDays.map(d => `Day ${d.dayNumber}`).join(', ')})
                  </>
                ) : (
                  <>
                    Save & Publish Itinerary (₹{(parseFloat(price) || 0).toLocaleString('en-IN')}) <i className="fa-solid fa-circle-check" style={{ marginLeft: '0.4rem' }}></i>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
