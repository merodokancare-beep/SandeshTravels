'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { COUNTRY_CODES, parsePhoneNumber, formatFullPhoneNumber } from '@/lib/phone';
import { ToastContainer } from '@/components/Toast';

function getTodayDateString() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [leads, setLeads] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [partners, setPartners] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [fleetAssignments, setFleetAssignments] = useState({});
  const [fleetStartDates, setFleetStartDates] = useState({});
  const [calendarStartDate, setCalendarStartDate] = useState(getTodayDateString());
  const [bookModalTemplateRegion, setBookModalTemplateRegion] = useState('All');
  const [activeTab, setActiveTab] = useState('crm'); // 'crm', 'fleet', 'dispatch', 'tracking', 'hotels', 'drivers', 'templates', 'reports'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  useEffect(() => {
    if (error) {
      addToast(error, 'error', 8000, null, 'Error Notification');
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      addToast(success, 'success', 7000, null, 'Success');
    }
  }, [success]);

  // Search/Filter states
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsFilterStatus, setLeadsFilterStatus] = useState('all');

  // Hotel form states
  const [hotelName, setHotelName] = useState('');
  const [hotelLocation, setHotelLocation] = useState('');
  const [hotelContact, setHotelContact] = useState('');

  // Driver form states
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleOwner, setVehicleOwner] = useState('');
  const [isDriverOwner, setIsDriverOwner] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);

  // Book Enquiry Modal states
  const [showBookModal, setShowBookModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadCountryCode, setNewLeadCountryCode] = useState('+91');
  const [newLeadLocalPhone, setNewLeadLocalPhone] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadDates, setNewLeadDates] = useState('');
  const [newLeadTravelers, setNewLeadTravelers] = useState(1);
  const [newLeadStartDate, setNewLeadStartDate] = useState('');
  const [newLeadTemplateId, setNewLeadTemplateId] = useState('');
  const [selectedWalkInTemplateIds, setSelectedWalkInTemplateIds] = useState([]);
  const [isWalkInMultiDropdownOpen, setIsWalkInMultiDropdownOpen] = useState(false);
  const [newLeadPartnerId, setNewLeadPartnerId] = useState('');

  // Template CRUD form states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateRegion, setTemplateRegion] = useState('North');
  const [templatePrice, setTemplatePrice] = useState(0);
  const [templateTotalDays, setTemplateTotalDays] = useState(1);
  const [templateDays, setTemplateDays] = useState([{ dayNumber: 1, description: '', activities: '' }]);

  // Selected cell for booking details popup
  const [activeCellDetails, setActiveCellDetails] = useState(null);

  // Reports section state
  const [reportSubTab, setReportSubTab] = useState('revenue'); // 'revenue', 'fleet', 'partners', 'regions'

  const exportFinancialReportToCSV = () => {
    const confirmedLeads = leads.filter(l => l.status === 'converted' || l.status === 'assigned' || l.status === 'completed');
    if (confirmedLeads.length === 0) {
      alert('No confirmed booking data available to export.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Booking ID,Client Name,Phone Number,Start Date,Status,Assigned Fleet & Driver,Referral Partner,Itinerary Title,Booking Price (Rs.)\n";

    confirmedLeads.forEach(l => {
      const partnerName = l.partner_name || "Direct B2C";
      const title = l.itinerary_title || "Custom Trip";
      const price = parseFloat(l.itinerary_price) || 0;

      const journey = journeys.find(j => String(j.lead.id) === String(l.id));
      const assignedDrivers = [];
      if (journey && journey.days) {
        journey.days.forEach(d => {
          if (d.driver_name && !assignedDrivers.some(a => a.driver_name === d.driver_name)) {
            assignedDrivers.push(`${d.driver_name} (${d.vehicle_model || 'Vehicle'} - ${d.vehicle_number || 'N/A'})`);
          }
        });
      }
      const driverStr = assignedDrivers.length > 0 ? assignedDrivers.join(' | ') : "Unassigned";

      const cleanTitle = `"${title.replace(/"/g, '""')}"`;
      const cleanPhone = `"\t${l.client_phone || ''}"`;
      const cleanDrivers = `"${driverStr.replace(/"/g, '""')}"`;
      csvContent += `${l.id},"${l.client_name}",${cleanPhone},"${l.start_date ? parseLocalDateString(l.start_date) : 'Flexible'}","${l.status}",${cleanDrivers},"${partnerName}",${cleanTitle},${price}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sandesh_travels_revenue_report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const router = useRouter();

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch leads
      const leadsRes = await fetch('/api/admin/leads');
      if (!leadsRes.ok) {
        if (leadsRes.status === 401) {
          router.push('/admin');
          return;
        }
        throw new Error('Unauthorized');
      }
      const leadsData = await leadsRes.json();
      setLeads(leadsData.leads || []);

      // 2. Fetch hotels
      const hotelsRes = await fetch('/api/admin/hotels');
      const hotelsData = await hotelsRes.json();
      setHotels(hotelsData.hotels || []);

      // 3. Fetch drivers
      const driversRes = await fetch('/api/admin/drivers');
      const driversData = await driversRes.json();
      setDrivers(driversData.drivers || []);

      // 4. Fetch templates
      const templatesRes = await fetch('/api/admin/templates');
      const templatesData = await templatesRes.json();
      setTemplates(templatesData.templates || []);

      // 5. Fetch fleet schedule
      const fleetRes = await fetch('/api/admin/fleet');
      const fleetData = await fleetRes.json();
      setFleet(fleetData.fleet || []);

      // 6. Fetch partners
      const partnersRes = await fetch('/api/admin/partners');
      const partnersData = await partnersRes.json();
      setPartners(partnersData.partners || []);

      // 7. Fetch active tracking journeys
      const trackingRes = await fetch('/api/admin/tracking');
      const trackingData = await trackingRes.json();
      setJourneys(trackingData.journeys || []);

      setAdmin({ name: 'Sandesh Travels Admin', username: 'admin' });
    } catch (err) {
      console.error('Fetch admin dashboard error:', err);
      setError('Could not load portal data. Check database settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getJourneyTimelineStatus = (lead, itinerary) => {
    if (!lead.start_date || !itinerary) return { status: 'Unknown', dayNumber: 0, percent: 0, text: 'No schedule' };
    
    const cleanDateStr = parseLocalDateString(lead.start_date);
    const parts = cleanDateStr.split('-');
    if (parts.length !== 3) return { status: 'Unknown', dayNumber: 0, percent: 0, text: 'Invalid date' };
    const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    
    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const totalDays = parseInt(itinerary.total_days, 10) || 1;
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + totalDays - 1);
    
    if (todayZero < startDate) {
      const diffTime = Math.abs(startDate - todayZero);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        status: 'upcoming',
        dayNumber: 0,
        percent: 0,
        text: `Upcoming: Starts in ${diffDays} day(s) (${startDate.toLocaleDateString()})`
      };
    } else if (todayZero > endDate) {
      return {
        status: 'completed',
        dayNumber: totalDays,
        percent: 100,
        text: `Finished: Ended on ${endDate.toLocaleDateString()}`
      };
    } else {
      const diffTime = Math.abs(todayZero - startDate);
      const elapsedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const currentDay = elapsedDays + 1;
      const percent = Math.min(100, Math.round((currentDay / totalDays) * 100));
      return {
        status: 'active',
        dayNumber: currentDay,
        percent,
        text: `Active: Day ${currentDay} of ${totalDays}`
      };
    }
  };

  const getReceiptWhatsAppLink = (j) => {
    if (!j.lead || !j.itinerary) return '#';
    const guestItineraryUrl = `${window.location.origin}/itinerary/${j.itinerary.id}`;
    
    // Find the first assigned driver details in the itinerary days
    const assignedDayWithDriver = j.days.find(d => d.driver_name) || {};
    const hasDriver = !!assignedDayWithDriver.driver_name;
    
    if (!hasDriver) {
      let message = `Hi ${j.lead.client_name}, your upcoming Sandesh Travels booking is confirmed! 🚗✨\n\n`;
      message += `• Route: ${j.itinerary.title}\n`;
      message += `• Driver & Vehicle details are being finalized. We will notify you as soon as they are assigned.\n\n`;
      message += `You can view your day-by-day program details here:\n👉 ${guestItineraryUrl}`;
      const cleanPhone = j.lead.client_phone.replace(/\D/g, '');
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    }

    let message = `Hi ${j.lead.client_name}, here are the Driver & Vehicle details for your upcoming Sandesh Travels journey: 🚗✨\n\n`;
    message += `• Driver Name: ${assignedDayWithDriver.driver_name}\n`;
    message += `• Driver Contact: ${assignedDayWithDriver.driver_phone}\n`;
    message += `• Vehicle: ${assignedDayWithDriver.vehicle_model} (${assignedDayWithDriver.vehicle_number || 'N/A'})\n\n`;
    message += `Please click the link below to view your full day-by-day program and hotel check-in details:\n👉 ${guestItineraryUrl}\n\nHave a safe and wonderful trip!`;
    
    const cleanPhone = j.lead.client_phone.replace(/\D/g, '');
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  };

  const parseLocalDateString = (dateInput) => {
    if (!dateInput) return '';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return String(dateInput).substring(0, 10);
  };

  const getIsoDateForDay = (startDateStr, dayNum) => {
    if (!startDateStr) return '';
    const cleanDateStr = parseLocalDateString(startDateStr);
    const parts = cleanDateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    date.setDate(date.getDate() + (dayNum - 1));
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dStr = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dStr}`;
  };

  const isDriverFreeOnDate = (d, leadId, startDate, dayNumber) => {
    if (!startDate) return true;
    const targetDateStr = getIsoDateForDay(startDate, dayNumber);
    const hasConflict = d.bookings?.some(b => b.date === targetDateStr && String(b.lead_id) !== String(leadId) && (b.lead_status === 'converted' || b.lead_status === 'assigned'));
    return !hasConflict;
  };

  const getDriverOptionTextForDay = (d, leadId, startDate, dayNumber) => {
    const defaultText = `${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'})`;
    if (!startDate) return defaultText;
    
    const targetDateStr = getIsoDateForDay(startDate, dayNumber);
    const booking = d.bookings?.find(b => b.date === targetDateStr && String(b.lead_id) !== String(leadId) && (b.lead_status === 'converted' || b.lead_status === 'assigned'));
    if (booking) {
      return `${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'}) ⚠️ Busy: ${booking.client_name}`;
    }
    return defaultText;
  };

  const isDriverFreeForEntireJourney = (d, leadId, startDate, totalDays) => {
    if (!startDate || !totalDays) return true;
    for (let i = 1; i <= totalDays; i++) {
      if (!isDriverFreeOnDate(d, leadId, startDate, i)) {
        return false;
      }
    }
    return true;
  };

  const getDriverOptionTextForJourney = (d, leadId, startDate, totalDays) => {
    const defaultText = `${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'})`;
    if (!startDate || !totalDays) return defaultText;
    
    const conflictingDates = [];
    for (let i = 1; i <= totalDays; i++) {
      const targetDateStr = getIsoDateForDay(startDate, i);
      const booking = d.bookings?.find(b => b.date === targetDateStr && String(b.lead_id) !== String(leadId) && (b.lead_status === 'converted' || b.lead_status === 'assigned'));
      if (booking && !conflictingDates.includes(booking.client_name)) {
        conflictingDates.push(booking.client_name);
      }
    }
    
    if (conflictingDates.length > 0) {
      return `${d.driver_name} (${d.vehicle_model || 'No Vehicle'} - ${d.vehicle_number || 'N/A'}) ⚠️ Busy: ${conflictingDates.join(', ')}`;
    }
    return defaultText;
  };

  const handleDriverChange = (itinId, dayNumber, driverId) => {
    setFleetAssignments(prev => ({
      ...prev,
      [itinId]: {
        ...(prev[itinId] || {}),
        [dayNumber]: driverId
      }
    }));
  };

  const handleQuickAssignDriver = (itinId, driverId, totalDaysCount) => {
    const nextAssign = {};
    for (let d = 1; d <= totalDaysCount; d++) {
      nextAssign[d] = driverId;
    }
    setFleetAssignments(prev => ({
      ...prev,
      [itinId]: nextAssign
    }));
  };

  const handleTriggerBackgroundWhatsApp = async (leadId, itineraryId, channel = 'whatsapp') => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, itineraryId, channel })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || `${channel === 'sms' ? 'SMS' : 'WhatsApp'} message sent directly to traveler!`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(data.error || `Failed to dispatch ${channel === 'sms' ? 'SMS' : 'WhatsApp'} message.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError(`Network error triggering ${channel === 'sms' ? 'SMS' : 'WhatsApp'} notification.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveFleet = async (itinId, lead, itinerary, days, channel = 'whatsapp') => {
    setError('');
    setSuccess('');
    setActionLoading(true);

    const selectedStartDate = fleetStartDates[itinId] !== undefined
      ? fleetStartDates[itinId]
      : (lead.start_date ? String(lead.start_date).substring(0, 10) : '');

    // Frontend validation: Start date check for new unconfirmed leads only
    if (selectedStartDate && !lead.start_date && lead.status !== 'converted' && lead.status !== 'assigned') {
      const limitDateStr = lead.converted_at || lead.created_at;
      if (limitDateStr) {
        const limitDate = new Date(limitDateStr);
        limitDate.setHours(0, 0, 0, 0);

        const selDate = new Date(selectedStartDate);
        selDate.setHours(0, 0, 0, 0);

        if (selDate < limitDate) {
          const limitFormatted = limitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          setError(`Validation Error: Start Date cannot be earlier than the converted/created date (${limitFormatted}).`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setActionLoading(false);
          return;
        }
      }
    }

    const selections = fleetAssignments[itinId] || {};
    
    // Prepare assignments array for API
    const assignments = days.map(d => {
      const selectedDriverId = selections[d.day_number] !== undefined 
        ? selections[d.day_number] 
        : (d.driver_id || '');
      return {
        dayNumber: d.day_number,
        driverId: selectedDriverId || null
      };
    });

    // Check for double booking conflicts on the same date (Soft Warning check, does not block save)
    let conflictFound = false;
    let conflictNames = [];

    for (const item of assignments) {
      if (item.driverId) {
        const d = fleet.find(drv => String(drv.id) === String(item.driverId));
        if (d && d.bookings) {
          const targetDateStr = getIsoDateForDay(selectedStartDate, item.dayNumber);
          const conflict = d.bookings.find(b => b.date === targetDateStr && String(b.lead_id) !== String(lead.id) && (b.lead_status === 'converted' || b.lead_status === 'assigned'));
          if (conflict && !conflictNames.includes(d.driver_name)) {
            conflictFound = true;
            conflictNames.push(d.driver_name);
          }
        }
      }
    }

    if (conflictFound) {
      const confirmSave = window.confirm(`Scheduling Alert: Driver(s) [${conflictNames.join(', ')}] are already assigned to other confirmed booking(s) on these dates. Do you still want to proceed and save?`);
      if (!confirmSave) {
        setActionLoading(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/admin/itinerary/assign-fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itineraryId: itinId,
          assignments,
          startDate: selectedStartDate || null
        })
      });

      if (res.ok) {
        setSuccess(`Fleet successfully assigned to the itinerary for "${lead.client_name}".`);
        await fetchDashboardData();
        
        // Trigger background notification if channel specified
        if (channel) {
          await handleTriggerBackgroundWhatsApp(lead.id, itinId, channel);
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save fleet assignment.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure during fleet assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/admin/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/admin');
        router.refresh();
      }
    } catch (err) {
      console.error('Admin logout error:', err);
    }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Lead status updated successfully.');
        fetchDashboardData();
      } else {
        setError(data.error || 'Failed to update status.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to execute update.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHotelSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hotelName, location: hotelLocation, contact: hotelContact }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Hotel "${hotelName}" registered in registry.`);
        setHotelName('');
        setHotelLocation('');
        setHotelContact('');
        fetchDashboardData();
      } else {
        setError(data.error || 'Failed to register hotel.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure during registration.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDriverSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const url = '/api/admin/drivers';
      const method = editingDriver ? 'PUT' : 'POST';
      const body = {
        driverName,
        driverPhone,
        vehicleNumber,
        vehicleModel,
        vehicleOwner
      };
      if (editingDriver) {
        body.id = editingDriver.id;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(editingDriver ? `Driver "${driverName}" updated successfully.` : `Driver "${driverName}" registered in registry.`);
        setDriverName('');
        setDriverPhone('');
        setVehicleNumber('');
        setVehicleModel('');
        setVehicleOwner('');
        setIsDriverOwner(false);
        setEditingDriver(null);
        fetchDashboardData();
      } else {
        setError(data.error || `Failed to ${editingDriver ? 'update' : 'register'} driver.`);
      }
    } catch (err) {
      console.error(err);
      setError(`Connection failure during ${editingDriver ? 'updating' : 'registration'}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditDriverClick = (d) => {
    setEditingDriver(d);
    setDriverName(d.driver_name || '');
    setDriverPhone(d.driver_phone || '');
    setVehicleNumber(d.vehicle_number || '');
    setVehicleModel(d.vehicle_model || '');
    setVehicleOwner(d.vehicle_owner || '');
    const isSelf = d.vehicle_owner && (d.vehicle_owner.includes('Self-Owned') || d.vehicle_owner === d.driver_name);
    setIsDriverOwner(!!isSelf);
    const driverForm = document.getElementById('driver-form-section');
    if (driverForm) {
      driverForm.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelDriverEdit = () => {
    setEditingDriver(null);
    setDriverName('');
    setDriverPhone('');
    setVehicleNumber('');
    setVehicleModel('');
    setVehicleOwner('');
    setIsDriverOwner(false);
  };

  const handleDeleteDriver = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete driver "${name}"?`)) return;
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/drivers?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Driver "${name}" deleted successfully.`);
        fetchDashboardData();
      } else {
        setError(data.error || 'Failed to delete driver.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure during deletion.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open modal for creating template
  const handleOpenNewTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateRegion('North');
    setTemplatePrice(0);
    setTemplateTotalDays(1);
    setTemplateDays([{ dayNumber: 1, description: '', activities: '' }]);
    setError('');
    setSuccess('');
    setShowTemplateModal(true);
  };

  // Open modal for editing template
  const handleOpenEditTemplateModal = (t) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateRegion(t.region);
    setTemplatePrice(parseFloat(t.estimated_price) || 0);
    setTemplateTotalDays(parseInt(t.total_days, 10) || 1);
    
    // Parse days
    const parsedDays = typeof t.days === 'string' ? JSON.parse(t.days) : t.days;
    setTemplateDays(parsedDays || [{ dayNumber: 1, description: '', activities: '' }]);
    setError('');
    setSuccess('');
    setShowTemplateModal(true);
  };

  // Sync days input array when total days count changes
  const handleTemplateTotalDaysChange = (val) => {
    const count = Math.max(1, parseInt(val, 10) || 1);
    setTemplateTotalDays(count);
    setTemplateDays(prev => {
      const updated = [...prev];
      if (updated.length < count) {
        for (let i = updated.length; i < count; i++) {
          updated.push({ dayNumber: i + 1, description: '', activities: '' });
        }
      } else if (updated.length > count) {
        return updated.slice(0, count);
      }
      return updated;
    });
  };

  // Update a single day's text field
  const handleTemplateDayFieldChange = (index, field, value) => {
    setTemplateDays(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  // Submit template creation / edit form
  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    const isEdit = editingTemplate !== null;
    const url = '/api/admin/templates';
    const method = isEdit ? 'PUT' : 'POST';
    const payload = {
      name: templateName,
      region: templateRegion,
      estimatedPrice: templatePrice,
      totalDays: templateTotalDays,
      days: templateDays
    };

    if (isEdit) {
      payload.id = editingTemplate.id;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Template "${templateName}" saved successfully.`);
        setShowTemplateModal(false);
        await fetchDashboardData();
      } else {
        setError(data.error || 'Failed to save template.');
      }
    } catch (err) {
      console.error('Template submit error:', err);
      setError('Connection failure during template submission.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete a template
  const handleTemplateDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete the template "${name}"?`)) return;
    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/templates?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Template "${name}" deleted successfully.`);
        await fetchDashboardData();
      } else {
        setError(data.error || 'Failed to delete template.');
      }
    } catch (err) {
      console.error('Template delete error:', err);
      setError('Connection failure during deletion.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit walkthrough for walk-in / phone enquiries
  const handleBookEnquirySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Journey Start Date validation (no back dates)
    if (newLeadStartDate) {
      const parts = newLeadStartDate.split('-');
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

    setActionLoading(true);
    const fullPhone = formatFullPhoneNumber(newLeadCountryCode, newLeadLocalPhone);

    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: newLeadName,
          clientPhone: fullPhone,
          travelDates: newLeadDates,
          numTravelers: newLeadTravelers,
          startDate: newLeadStartDate || null,
          templateId: newLeadTemplateId || null,
          templateIds: selectedWalkInTemplateIds,
          partnerId: newLeadPartnerId || null
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Enquiry for "${newLeadName}" booked successfully.`);
        setNewLeadName('');
        setNewLeadPhone('');
        setNewLeadDates('');
        setNewLeadTravelers(1);
        setNewLeadStartDate('');
        setNewLeadTemplateId('');
        setSelectedWalkInTemplateIds([]);
        setIsWalkInMultiDropdownOpen(false);
        setNewLeadPartnerId('');
        setShowBookModal(false);
        
        await fetchDashboardData();

        // If templates selected, send directly to itinerary builder
        if (selectedWalkInTemplateIds.length > 0 || newLeadTemplateId) {
          router.push(`/admin/itinerary/${data.lead.id}`);
        }
      } else {
        setError(data.error || 'Failed to book enquiry.');
      }
    } catch (err) {
      console.error('Book enquiry error:', err);
      setError('Failed to contact server.');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate Next 7 Days for Fleet Calendar Grid
  const getNext7Days = () => {
    const daysArr = [];
    if (!calendarStartDate) return [];
    const parts = calendarStartDate.split('-');
    if (parts.length !== 3) return [];
    
    const startYear = parseInt(parts[0], 10);
    const startMonth = parseInt(parts[1], 10) - 1;
    const startDay = parseInt(parts[2], 10);
    
    const baseDate = new Date(startYear, startMonth, startDay);
    const todayStr = getTodayString();
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      d.setDate(baseDate.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      const key = `${year}-${month}-${day}`;
      
      // Label like "Jun 20 (Sat)" or "Today"
      let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      if (key === todayStr) {
        label = `Today (${weekday})`;
      } else {
        label = `${label} (${weekday})`;
      }
      
      daysArr.push({ key, label });
    }
    return daysArr;
  };

  const getTodayString = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const next7Days = getNext7Days();

  // Filtered Leads list
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.client_name.toLowerCase().includes(leadsSearch.toLowerCase()) || 
                          lead.client_phone.includes(leadsSearch) ||
                          (lead.partner_name && lead.partner_name.toLowerCase().includes(leadsSearch.toLowerCase()));
    const matchesStatus = leadsFilterStatus === 'all' || lead.status === leadsFilterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate high level metrics
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const convertedLeads = leads.filter(l => l.status === 'converted' || l.status === 'completed').length;

  // Fleet Statistics
  const totalVehicles = fleet.length;
  const busyTodayCount = fleet.filter(v => v.todayBooking !== null).length;
  const freeTodayCount = totalVehicles - busyTodayCount;

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
          <i className="fa-solid fa-circle-notch fa-spin fa-3x" style={{ marginBottom: '1rem' }}></i>
          <p style={{ color: 'var(--text-secondary)' }}>Opening Travel Owner Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" id="admin-dashboard-container">
      {/* Sidebar navigation */}
      <aside className="sidebar" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.png" alt="Sandesh Travels" style={{ height: '40px', objectFit: 'contain', background: '#fff', borderRadius: '6px', padding: '2px 6px' }} />
            <div>
              <div className="brand-name" style={{ fontSize: '1.1rem', fontWeight: 800 }}>Sandesh Travels</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tours & Travel Company</div>
            </div>
          </div>
          <nav className="nav-menu">
            <button 
              onClick={() => setActiveTab('leads')} 
              className={`nav-link ${activeTab === 'leads' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className="fa-solid fa-address-book"></i> Leads CRM
            </button>
            <button 
              onClick={() => setActiveTab('fleet')} 
              className={`nav-link ${activeTab === 'fleet' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className="fa-solid fa-car-side"></i> Fleet Schedule
            </button>
            <button 
              onClick={() => setActiveTab('dispatch')} 
              className={`nav-link ${activeTab === 'dispatch' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className="fa-solid fa-key"></i> Fleet Assignment
            </button>
            <button 
              onClick={() => setActiveTab('tracking')} 
              className={`nav-link ${activeTab === 'tracking' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className="fa-solid fa-route"></i> Journey Tracking
            </button>
            <button 
              onClick={() => setActiveTab('hotels')} 
              className={`nav-link ${activeTab === 'hotels' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className="fa-solid fa-hotel"></i> Hotels Registry
            </button>
            <button 
              onClick={() => setActiveTab('drivers')} 
              className={`nav-link ${activeTab === 'drivers' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className="fa-solid fa-id-card"></i> Drivers Registry
            </button>
            <button 
              onClick={() => setActiveTab('templates')} 
              className={`nav-link ${activeTab === 'templates' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className="fa-solid fa-compass"></i> Itinerary Master
            </button>
            <button 
              onClick={() => setActiveTab('reports')} 
              className={`nav-link ${activeTab === 'reports' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className="fa-solid fa-chart-pie"></i> Reports & Analytics
            </button>
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
            <p style={{ color: 'var(--text-muted)' }}>Logged in Owner:</p>
            <p style={{ fontWeight: '600', color: '#FFF', marginTop: '0.2rem' }}>{admin?.name}</p>
            <p style={{ color: 'var(--secondary)', marginTop: '0.2rem' }}>Root Administrator</p>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            id="admin-logout-btn"
          >
            <i className="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>Travel Owner Command Portal</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Manage incoming inquiries, track driver logs, build customized itineraries, and check fleet availability.
            </p>
          </div>
          {activeTab === 'leads' && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowBookModal(true)}
              style={{ background: 'linear-gradient(135deg, var(--secondary), var(--accent-teal))' }}
            >
              <i className="fa-solid fa-circle-plus"></i> Book Walk-in / Phone Enquiry
            </button>
          )}
          {activeTab === 'templates' && (
            <button 
              className="btn btn-primary"
              onClick={handleOpenNewTemplateModal}
              style={{ background: 'linear-gradient(135deg, var(--secondary), var(--accent-teal))' }}
            >
              <i className="fa-solid fa-circle-plus"></i> Create Readymade Package
            </button>
          )}
        </header>



        {/* Metrics Grid */}
        <section className="stats-grid">
          {activeTab === 'fleet' ? (
            <>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
                <div className="stat-icon" style={{ color: 'var(--secondary)' }}>
                  <i className="fa-solid fa-car"></i>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{totalVehicles}</div>
                  <div className="stat-label">Total Vehicles</div>
                </div>
              </div>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                <div className="stat-icon" style={{ color: 'var(--accent-orange)' }}>
                  <i className="fa-solid fa-route"></i>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{busyTodayCount}</div>
                  <div className="stat-label">Busy / Dispatch Today</div>
                </div>
              </div>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div className="stat-icon" style={{ color: 'var(--primary)' }}>
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{freeTodayCount}</div>
                  <div className="stat-label">Free & Available Today</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
                <div className="stat-icon" style={{ color: 'var(--secondary)' }}>
                  <i className="fa-solid fa-globe"></i>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{totalLeads}</div>
                  <div className="stat-label">Total Inquiries</div>
                </div>
              </div>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                <div className="stat-icon" style={{ color: 'var(--accent-orange)' }}>
                  <i className="fa-solid fa-envelope-open-text"></i>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{newLeads}</div>
                  <div className="stat-label">New leads</div>
                </div>
              </div>
              <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div className="stat-icon" style={{ color: 'var(--primary)' }}>
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{convertedLeads}</div>
                  <div className="stat-label">Confirmed Journeys</div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Dynamic Panels */}
        {activeTab === 'leads' && (
          <section className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <h2>Lead CRM Registry</h2>
              
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search name, phone, or hotel..."
                  className="form-control"
                  style={{ width: '240px', padding: '0.5rem 1rem' }}
                  value={leadsSearch}
                  onChange={(e) => setLeadsSearch(e.target.value)}
                />
                
                <select
                  className="form-control"
                  style={{ width: '150px', padding: '0.5rem' }}
                  value={leadsFilterStatus}
                  onChange={(e) => setLeadsFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="quoted">Quoted</option>
                  <option value="converted">Converted</option>
                  <option value="assigned">Fleet Assigned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {filteredLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <i className="fa-regular fa-folder-open fa-3x" style={{ marginBottom: '1rem' }}></i>
                <p>No matching traveler inquiries found.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Lead Details</th>
                      <th>Traveler Route & Date</th>
                      <th>Lead Source</th>
                      <th>Status Tracking</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <div style={{ fontWeight: '600', color: '#FFF' }}>{lead.client_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.client_phone}</div>
                        </td>
                        <td>
                          <div>
                            {lead.start_date ? (
                              <span style={{ color: 'var(--accent-teal)', fontWeight: '500' }}>
                                Starts: {new Date(lead.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            ) : (
                              <span>{lead.travel_dates || 'Dates not set'}</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.num_travelers} guest(s)</div>
                        </td>
                        <td>
                          {lead.partner_name ? (
                            <div>
                              <span style={{ color: 'var(--primary)', fontWeight: 500 }}>B2B: </span>
                              {lead.partner_name}
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: {lead.commission_rate}%</div>
                            </div>
                          ) : (
                            <div>
                              <span style={{ color: 'var(--secondary)', fontWeight: 500 }}>B2C: </span>
                              Direct Guest
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className={`badge badge-${lead.status}`}>
                                {lead.status === 'assigned' ? 'FLEET ASSIGNED' : lead.status === 'converted' ? 'CONVERTED' : lead.status}
                              </span>
                              {lead.status !== 'completed' && (
                                <select
                                  value={lead.status}
                                  onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                  disabled={actionLoading}
                                  style={{ 
                                    background: 'var(--bg-surface-elevated)', 
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                    borderRadius: '4px',
                                    padding: '0.2rem',
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  <option value="new" disabled={lead.status === 'assigned' || lead.status === 'completed'}>New</option>
                                  <option value="quoted" disabled={lead.status === 'assigned' || lead.status === 'completed'}>Quoted</option>
                                  <option value="converted" disabled={lead.status === 'assigned' || lead.status === 'completed'}>Converted</option>
                                  <option value="assigned">Fleet Assigned</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              )}
                            </div>
                            {lead.status === 'converted' && (
                              <div style={{ fontSize: '0.75rem', color: '#FBBF24', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <i className="fa-solid fa-clock"></i> Pending Fleet Assignment
                              </div>
                            )}
                            {lead.status === 'assigned' && (
                              <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <i className="fa-solid fa-circle-check"></i> Fleet Dispatched
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                            {(lead.status === 'new' || lead.status === 'quoted') && (
                              <Link 
                                href={`/admin/itinerary/${lead.id}`} 
                                className="btn btn-primary"
                                style={{ 
                                  padding: '0.4rem 0.75rem', 
                                  fontSize: '0.8rem', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.35rem', 
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}
                              >
                                <i className="fa-solid fa-wand-magic-sparkles"></i> Build Itinerary
                              </Link>
                            )}

                            {lead.status === 'converted' && (
                              <>
                                <Link 
                                  href={`/admin/itinerary/${lead.id}`} 
                                  className="btn btn-secondary"
                                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem', color: '#FFF', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                                >
                                  <i className="fa-solid fa-pen-to-square"></i> Edit Itinerary
                                </Link>
                                <button 
                                  type="button"
                                  onClick={() => setActiveTab('dispatch')}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem', color: '#FBBF24', borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                                >
                                  <i className="fa-solid fa-car"></i> Fleet Assignment
                                </button>
                              </>
                            )}

                            {(lead.status === 'assigned' || lead.status === 'completed') && (
                              <Link 
                                href={`/admin/itinerary/${lead.id}`} 
                                className="btn btn-secondary"
                                style={{ 
                                  padding: '0.4rem 0.6rem', 
                                  fontSize: '0.8rem', 
                                  color: 'var(--text-secondary)', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.3rem', 
                                  whiteSpace: 'nowrap' 
                                }}
                              >
                                <i className="fa-solid fa-eye"></i> View Program
                              </Link>
                            )}

                            {(lead.status === 'converted' || lead.status === 'assigned' || lead.status === 'completed') && (
                              <Link 
                                href={`/admin/invoice/${lead.id}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{ 
                                  padding: '0.4rem 0.6rem', 
                                  fontSize: '0.8rem', 
                                  color: '#38bdf8', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.3rem', 
                                  border: '1px solid rgba(56,189,248,0.3)', 
                                  background: 'rgba(56,189,248,0.05)',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Generate & Print Bill Invoice"
                              >
                                <i className="fa-solid fa-file-invoice-dollar"></i> Invoice
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'fleet' && (
          <section className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Fleet Schedule & Availability Calendar</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Real-time occupancy tracking for all 20+ transport vehicles and drivers.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => fetchDashboardData()}>
                <i className="fa-solid fa-rotate"></i> Refresh Fleet
              </button>
            </div>

            {/* Calendar Start Date Controls & Legend */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-surface-elevated)',
              padding: '1rem',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border)',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#FFF', fontWeight: '600' }}>Calendar Start Date:</span>
                <input 
                  type="date"
                  className="form-control"
                  style={{ width: '160px', padding: '0.4rem', fontSize: '0.85rem' }}
                  value={calendarStartDate}
                  onChange={(e) => setCalendarStartDate(e.target.value || getTodayDateString())}
                />
                <button 
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                  onClick={() => setCalendarStartDate(getTodayDateString())}
                >
                  Jump to Today
                </button>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}></div>
                  <span style={{ color: 'var(--text-secondary)' }}>Available</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'var(--accent-orange)' }}></div>
                  <span style={{ color: 'var(--text-secondary)' }}>Quoted (Hold)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'var(--secondary)' }}></div>
                  <span style={{ color: 'var(--text-secondary)' }}>Confirmed (Booked)</span>
                </div>
              </div>
            </div>

            {fleet.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-car-side fa-3x" style={{ marginBottom: '1rem' }}></i>
                <p>No vehicles or drivers registered in the registry. Go to Drivers Registry to add them.</p>
              </div>
            ) : (
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="custom-table" style={{ minWidth: '950px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '220px' }}>Vehicle / Driver Asset</th>
                      <th style={{ width: '180px' }}>Today's Status</th>
                      {next7Days.map(day => (
                        <th key={day.key} style={{ textAlign: 'center', fontSize: '0.8rem', padding: '0.5rem 0.25rem' }}>
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fleet.map((item) => {
                      const todayBooking = item.todayBooking;
                      
                      return (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#FFF' }}>{item.driver_name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {item.vehicle_model} ({item.vehicle_number || 'N/A'})
                            </div>
                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                              <a 
                                href={`https://wa.me/${item.driver_phone.replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <i className="fa-brands fa-whatsapp"></i> Chat Driver
                              </a>
                            </div>
                          </td>
                          <td>
                            {todayBooking ? (
                              <div style={{
                                padding: '0.5rem',
                                background: (todayBooking.lead_status === 'converted' || todayBooking.lead_status === 'assigned') ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
                                border: (todayBooking.lead_status === 'converted' || todayBooking.lead_status === 'assigned') ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(245,158,11,0.2)',
                                borderRadius: '6px',
                                fontSize: '0.8rem'
                              }}>
                                <div style={{ fontWeight: '600', color: (todayBooking.lead_status === 'converted' || todayBooking.lead_status === 'assigned') ? '#A5B4FC' : '#FBBF24', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <i className="fa-solid fa-route"></i> ON WORK
                                </div>
                                <div style={{ color: '#FFF', fontSize: '0.75rem', marginTop: '0.15rem' }}>Guest: {todayBooking.client_name}</div>
                                 <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Price: Rs. {todayBooking.itinerary_price}</div>
                              </div>
                            ) : (
                              <div style={{
                                padding: '0.5rem',
                                background: 'rgba(16,185,129,0.08)',
                                border: '1px solid rgba(16,185,129,0.15)',
                                borderRadius: '6px',
                                color: '#34D399',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                <i className="fa-solid fa-circle-check"></i> FREE & READY
                              </div>
                            )}
                          </td>
                          {next7Days.map(day => {
                            // Find if this driver is booked on this specific date
                            const booking = item.bookings.find(b => b.date === day.key);
                            const isBooked = booking !== undefined;
                            
                            return (
                              <td 
                                key={day.key}
                                onClick={() => isBooked ? setActiveCellDetails(booking) : null}
                                style={{
                                  textAlign: 'center',
                                  cursor: isBooked ? 'pointer' : 'default',
                                  padding: '0.75rem 0.25rem',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {isBooked ? (
                                  <div 
                                    className="animate-fade-in"
                                    style={{
                                      background: (booking.lead_status === 'converted' || booking.lead_status === 'assigned') ? 'var(--secondary)' : 'var(--accent-orange)',
                                      color: '#FFF',
                                      fontSize: '0.7rem',
                                      padding: '0.4rem 0.25rem',
                                      borderRadius: '4px',
                                      fontWeight: '600',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      maxWidth: '90px',
                                      margin: '0 auto',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                                    }}
                                    title={`Click for Details:\nGuest: ${booking.client_name}\nRoute: ${booking.itinerary_title}\nDay ${booking.day_number}`}
                                  >
                                    👤 {booking.client_name.split(' ')[0]}
                                  </div>
                                ) : (
                                  <div style={{
                                    width: '12px',
                                    height: '12px',
                                    background: 'rgba(16,185,129,0.15)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    borderRadius: '50%',
                                    margin: '0 auto'
                                  }} title="Available"></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Active Cell Info Panel */}
            {activeCellDetails && (() => {
              const getJourneyDateRange = (startDateStr, totalDays) => {
                if (!startDateStr || !totalDays) return 'Flexible Schedule';
                try {
                  const parts = String(startDateStr).substring(0, 10).split('-');
                  if (parts.length !== 3) return 'Flexible Schedule';
                  const start = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  const end = new Date(start);
                  end.setDate(start.getDate() + parseInt(totalDays, 10) - 1);
                  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${totalDays} Days)`;
                } catch (e) {
                  return 'Flexible Schedule';
                }
              };

              const cleanGuestPhone = activeCellDetails.client_phone.replace(/\D/g, '');
              const guestWhatsAppUrl = `https://api.whatsapp.com/send?phone=${cleanGuestPhone}&text=${encodeURIComponent(`Hi ${activeCellDetails.client_name}, this is Sandesh Travels contacting you regarding your ongoing transport booking.`)}`;

              return (
                <div 
                  className="animate-fade-in" 
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '1.5rem',
                    marginTop: '1rem',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div style={{ flexGrow: 1 }}>
                      <h4 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '1.05rem' }}>
                        <i className="fa-solid fa-circle-info"></i> Active Assignment & Tour Details
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', fontSize: '0.88rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tourist/Guest</span>
                          <strong style={{ color: '#FFF', fontSize: '0.95rem' }}>{activeCellDetails.client_name}</strong>
                          <span style={{ display: 'block', marginTop: '0.15rem' }}>
                            <i className="fa-solid fa-phone" style={{ fontSize: '0.75rem', marginRight: '0.25rem', color: 'var(--text-muted)' }}></i> {activeCellDetails.client_phone}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Package Program</span>
                          <strong style={{ color: '#FFF' }}>{activeCellDetails.itinerary_title}</strong>
                          <span style={{ display: 'block', color: 'var(--accent-teal)', fontWeight: '600', marginTop: '0.15rem' }}>
                            Rs. {activeCellDetails.itinerary_price}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Journey Duration & Schedule</span>
                          <strong style={{ color: '#FFF' }}>{getJourneyDateRange(activeCellDetails.start_date, activeCellDetails.total_days)}</strong>
                          <span className="badge badge-completed" style={{ display: 'inline-block', marginTop: '0.25rem', fontSize: '0.7rem', padding: '0.15rem 0.4rem', textTransform: 'none' }}>
                            Currently: Day {activeCellDetails.day_number} of {activeCellDetails.total_days || 1}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', minWidth: '220px', justifyContent: 'flex-end', alignSelf: 'center' }}>
                      <a 
                        href={guestWhatsAppUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-primary"
                        style={{ background: '#25D366', border: 'none', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#FFF', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <i className="fa-brands fa-whatsapp"></i> Chat Guest
                      </a>
                      <Link 
                        href={`/admin/itinerary/${activeCellDetails.lead_id}`}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <i className="fa-solid fa-compass"></i> Open Itinerary
                      </Link>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => setActiveCellDetails(null)}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {activeTab === 'tracking' && (
          <section className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Live Journey Operations & Tracking</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Track ongoing guest travels, driver logistics, hotel check-ins, and active itineraries.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => fetchDashboardData()}>
                <i className="fa-solid fa-rotate"></i> Refresh Tracker
              </button>
            </div>

            {journeys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-route fa-3x" style={{ marginBottom: '1rem' }}></i>
                <p>No active or completed journeys found. Convert a lead and set dates to trigger journey tracking.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {['active', 'upcoming', 'completed'].map((cat) => {
                  const filtered = journeys.filter(j => {
                    // Only show under Journey Tracking if a driver/vehicle has been assigned
                    const hasDriver = j.days.some(d => d.driver_id !== null);
                    if (!hasDriver) return false;

                    const info = getJourneyTimelineStatus(j.lead, j.itinerary);
                    if (cat === 'completed') {
                      return j.lead.status === 'completed' || info.status === 'completed';
                    }
                    return info.status === cat;
                  });

                  const categoryTitle = 
                    cat === 'active' ? '🟢 Active Journeys (On Road)' :
                    cat === 'upcoming' ? '📅 Upcoming Journeys (Scheduled)' :
                    '✅ Completed & Ended Journeys';

                  if (filtered.length === 0) return null;

                  return (
                    <div key={cat}>
                      <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem', color: cat === 'active' ? 'var(--primary)' : cat === 'upcoming' ? 'var(--accent-teal)' : 'var(--text-secondary)', fontWeight: '600' }}>
                        {categoryTitle} ({filtered.length})
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
                        {filtered.map(j => {
                          const info = getJourneyTimelineStatus(j.lead, j.itinerary);
                          const activeDayNum = info.dayNumber || 1;
                          const todayDetails = j.days.find(d => d.day_number === activeDayNum) || {};
                          
                          return (
                            <div key={j.lead.id} className="glass-card animate-fade-in" style={{
                              background: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1rem',
                              padding: '1.25rem',
                              position: 'relative'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <strong style={{ fontSize: '1.1rem', color: '#FFF' }}>{j.lead.client_name}</strong>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                    Phone: {j.lead.client_phone} • {j.lead.num_travelers} guest(s)
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <span className={`badge badge-${j.lead.status === 'completed' ? 'completed' : cat === 'active' ? 'converted' : 'new'}`}>
                                    {j.lead.status === 'completed' ? 'Completed' : cat === 'active' ? 'On Work' : 'Scheduled'}
                                  </span>
                                </div>
                              </div>

                              {j.itinerary ? (
                                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                                  <div style={{ fontWeight: '600', color: '#FFF' }}>{j.itinerary.title}</div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                                    <span>Duration: {j.itinerary.total_days} Days</span>
                                    <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Price: Rs. {j.itinerary.price}</span>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ color: 'var(--accent-orange)', fontSize: '0.85rem' }}>
                                  ⚠️ No itinerary found. Please create one to track driver/hotel allocations.
                                </div>
                              )}

                              {j.itinerary && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span style={{ fontWeight: '500', color: 'var(--accent-teal)' }}>{info.text}</span>
                                    <span>{info.percent}%</span>
                                  </div>
                                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${info.percent}%`, background: 'linear-gradient(90deg, var(--secondary), var(--accent-teal))', borderRadius: '3px' }}></div>
                                  </div>
                                </div>
                              )}

                              {j.itinerary && j.days.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
                                  <div style={{ fontWeight: '600', color: '#FFF', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {cat === 'active' ? `Today's Schedule (Day ${activeDayNum})` : `Day 1 Plan Preview`}
                                  </div>

                                  <div>
                                    <span style={{ color: 'var(--text-muted)' }}>Sightseeing: </span>
                                    <span style={{ color: 'var(--text-primary)' }}>{todayDetails.description || 'Sightseeing schedule is being updated.'}</span>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                                    <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)', padding: '0.5rem', borderRadius: '6px' }}>
                                      <div style={{ color: 'var(--secondary)', fontWeight: '600', fontSize: '0.75rem' }}>
                                        <i className="fa-solid fa-taxi"></i> DISPATCHED TRANSPORT
                                      </div>
                                      {todayDetails.driver_name ? (
                                        <div style={{ marginTop: '0.2rem' }}>
                                          <div style={{ color: '#FFF', fontWeight: '500' }}>{todayDetails.driver_name}</div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{todayDetails.vehicle_model}</div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{todayDetails.vehicle_number}</div>
                                          <a 
                                            href={`https://wa.me/${todayDetails.driver_phone.replace(/\D/g, '')}?text=Hi%20${todayDetails.driver_name},%20this%20is%20Sandesh%20Travels%20Admin.%20Regarding%20guest%20${j.lead.client_name}...`}
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#25D366', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: '600' }}
                                          >
                                            <i className="fa-brands fa-whatsapp"></i> Chat Driver
                                          </a>
                                        </div>
                                      ) : (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>No driver assigned</div>
                                      )}
                                    </div>

                                    <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', padding: '0.5rem', borderRadius: '6px' }}>
                                      <div style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.75rem' }}>
                                        <i className="fa-solid fa-hotel"></i> ACCOMMODATION STAY
                                      </div>
                                      {todayDetails.hotel_name ? (
                                        <div style={{ marginTop: '0.2rem' }}>
                                          <div style={{ color: '#FFF', fontWeight: '500' }}>{todayDetails.hotel_name}</div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{todayDetails.hotel_location}</div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{todayDetails.hotel_contact}</div>
                                        </div>
                                      ) : (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>No hotel check-in</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                                <Link
                                   href={`/admin/itinerary/${j.lead.id}`}
                                   className="btn btn-secondary"
                                   style={{ 
                                     flexGrow: 1, 
                                     padding: '0.4rem', 
                                     fontSize: '0.8rem', 
                                     color: '#FFF', 
                                     display: 'inline-flex', 
                                     alignItems: 'center', 
                                     justifyContent: 'center', 
                                     gap: '0.35rem',
                                     fontWeight: '600' 
                                   }}
                                 >
                                   <i className="fa-solid fa-eye"></i> View Journey Details
                                 </Link>
                                <Link
                                  href={`/admin/invoice/${j.lead.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary"
                                  style={{ 
                                    padding: '0.4rem 0.6rem', 
                                    fontSize: '0.8rem', 
                                    color: '#38bdf8', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '0.3rem', 
                                    border: '1px solid rgba(56,189,248,0.3)', 
                                    background: 'rgba(56,189,248,0.05)',
                                    flexGrow: 1,
                                    justifyContent: 'center'
                                  }}
                                  title="Generate & Print Bill Invoice"
                                >
                                  <i className="fa-solid fa-file-invoice-dollar"></i> Bill Invoice
                                </Link>
                                <button
                                   onClick={() => handleTriggerBackgroundWhatsApp(j.lead.id, j.itinerary.id)}
                                   disabled={actionLoading}
                                   className="btn btn-secondary"
                                   style={{ 
                                     padding: '0.4rem 0.6rem', 
                                     fontSize: '0.8rem', 
                                     color: '#25D366', 
                                     display: 'inline-flex', 
                                     alignItems: 'center', 
                                     gap: '0.3rem', 
                                     border: '1px solid rgba(37,211,102,0.3)', 
                                     background: 'rgba(37,211,102,0.05)',
                                     flexGrow: 1,
                                     justifyContent: 'center'
                                   }}
                                   title="Send Acknowledgement Receipt & Driver details via WhatsApp"
                                 >
                                   <i className="fa-brands fa-whatsapp"></i> Send Receipt
                                 </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'dispatch' && (
          <section className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Fleet Assignment Dashboard</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Assign drivers and vehicles to confirmed traveler itineraries, then notify them directly on WhatsApp.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => fetchDashboardData()}>
                <i className="fa-solid fa-rotate"></i> Refresh List
              </button>
            </div>

            {(() => {
              const pending = journeys.filter(j => j.lead.status === 'converted' && !j.days.some(d => d.driver_id !== null));
              const assigned = journeys.filter(j => (j.lead.status === 'assigned' || j.days.some(d => d.driver_id !== null)) && j.lead.status !== 'completed');

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem', color: 'var(--accent-orange)', fontWeight: '600' }}>
                      ⚠️ Pending Assignment ({pending.length})
                    </h3>
                    {pending.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', padding: '1rem' }}>No pending assignments! All confirmed bookings have drivers assigned.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {pending.map(j => {
                          const currentAssignments = fleetAssignments[j.itinerary.id] || {};
                          const selectedStartDate = fleetStartDates[j.itinerary.id] !== undefined
                            ? fleetStartDates[j.itinerary.id]
                            : (j.lead.start_date ? String(j.lead.start_date).substring(0, 10) : "");
                          return (
                            <div key={j.itinerary.id} className="glass-card" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', padding: '1.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                                <div>
                                  <h4 style={{ color: '#FFF', fontSize: '1.05rem' }}>{j.lead.client_name}</h4>
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Route: <strong>{j.itinerary.title}</strong> • Price: <strong>Rs. {j.itinerary.price}</strong>
                                  </p>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', marginBottom: '0.3rem' }}>
                                    <span>Start Date:</span>
                                    <input 
                                      type="date"
                                      className="form-control"
                                      style={{ display: 'inline-block', width: 'auto', padding: '0.1rem 0.3rem', fontSize: '0.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: '#FFF' }}
                                      value={selectedStartDate}
                                      onChange={(e) => {
                                        setFleetStartDates(prev => ({
                                          ...prev,
                                          [j.itinerary.id]: e.target.value
                                        }));
                                      }}
                                    />
                                  </div>
                                  <div>Duration: <strong>{j.itinerary.total_days} Days</strong></div>
                                </div>
                              </div>

                              {/* Quick assign */}
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.8rem', color: '#FFF', fontWeight: '600' }}>Quick Assign Driver to all days:</span>
                                <select 
                                  className="form-control"
                                  style={{ width: '250px', fontSize: '0.8rem', padding: '0.3rem' }}
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleQuickAssignDriver(j.itinerary.id, e.target.value, j.itinerary.total_days);
                                      e.target.value = "";
                                    }
                                  }}
                                >
                                  <option value="">-- Select Driver --</option>
                                  {fleet
                                    .filter(d => isDriverFreeForEntireJourney(d, j.lead.id, selectedStartDate, j.itinerary.total_days))
                                    .map(d => (
                                      <option key={d.id} value={d.id}>
                                        {d.driver_name} ({d.vehicle_model || 'No Vehicle'} - {d.vehicle_number || 'N/A'})
                                      </option>
                                    ))
                                  }
                                </select>
                              </div>

                              {/* Days map */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                {j.days.map(day => {
                                  const activeDriverId = currentAssignments[day.day_number] !== undefined 
                                    ? currentAssignments[day.day_number] 
                                    : (day.driver_id || '');
                                  return (
                                    <div key={day.day_number} style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border)' }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent-teal)', marginBottom: '0.4rem' }}>
                                        Day {day.day_number}
                                      </div>
                                      <select 
                                        className="form-control"
                                        style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                                        value={activeDriverId}
                                        onChange={(e) => handleDriverChange(j.itinerary.id, day.day_number, e.target.value)}
                                      >
                                        <option value="">-- No driver assigned --</option>
                                        {fleet
                                          .filter(d => isDriverFreeOnDate(d, j.lead.id, selectedStartDate, day.day_number) || String(d.id) === String(activeDriverId))
                                          .map(d => (
                                            <option key={d.id} value={d.id}>
                                              {getDriverOptionTextForDay(d, j.lead.id, selectedStartDate, day.day_number)}
                                            </option>
                                          ))
                                        }
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>

                              <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button 
                                  className="btn btn-primary"
                                  style={{ flex: 1, background: '#25D366', border: 'none', padding: '0.6rem', fontWeight: '600', fontSize: '0.85rem' }}
                                  onClick={() => handleSaveFleet(j.itinerary.id, j.lead, j.itinerary, j.days, 'whatsapp')}
                                  disabled={actionLoading}
                                >
                                  <i className="fa-brands fa-whatsapp"></i> Send via WhatsApp
                                </button>
                                <button 
                                  className="btn btn-primary"
                                  style={{ flex: 1, background: '#0070f3', border: 'none', padding: '0.6rem', fontWeight: '600', fontSize: '0.85rem' }}
                                  onClick={() => handleSaveFleet(j.itinerary.id, j.lead, j.itinerary, j.days, 'sms')}
                                  disabled={actionLoading}
                                >
                                  <i className="fa-solid fa-envelope"></i> Send via SMS
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.25rem', color: 'var(--primary)', fontWeight: '600' }}>
                      ✅ Assigned & Dispatched ({assigned.length})
                    </h3>
                    {assigned.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', padding: '1rem' }}>No assigned dispatch records found yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {assigned.map(j => {
                          const currentAssignments = fleetAssignments[j.itinerary.id] || {};
                          const selectedStartDate = fleetStartDates[j.itinerary.id] !== undefined
                            ? fleetStartDates[j.itinerary.id]
                            : (j.lead.start_date ? String(j.lead.start_date).substring(0, 10) : "");
                          return (
                            <div key={j.itinerary.id} className="glass-card" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', padding: '1.5rem', opacity: 0.9 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                                <div>
                                  <h4 style={{ color: '#FFF', fontSize: '1.05rem' }}>{j.lead.client_name} <span className="badge badge-completed" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', textTransform: 'none', marginLeft: '0.5rem' }}>Dispatched</span></h4>
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Route: <strong>{j.itinerary.title}</strong> • Price: <strong>Rs. {j.itinerary.price}</strong>
                                  </p>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end', marginBottom: '0.3rem' }}>
                                    <span>Start Date:</span>
                                    <input 
                                      type="date"
                                      className="form-control"
                                      style={{ display: 'inline-block', width: 'auto', padding: '0.1rem 0.3rem', fontSize: '0.8rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: '#FFF' }}
                                      value={selectedStartDate}
                                      onChange={(e) => {
                                        setFleetStartDates(prev => ({
                                          ...prev,
                                          [j.itinerary.id]: e.target.value
                                        }));
                                      }}
                                    />
                                  </div>
                                  <div>Duration: <strong>{j.itinerary.total_days} Days</strong></div>
                                </div>
                              </div>

                              {/* Quick Reassign Driver to all days */}
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.8rem', color: '#FFF', fontWeight: '600' }}>Reassign Driver to all days:</span>
                                <select 
                                  className="form-control"
                                  style={{ width: '250px', fontSize: '0.8rem', padding: '0.3rem' }}
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleQuickAssignDriver(j.itinerary.id, e.target.value, j.itinerary.total_days);
                                      e.target.value = "";
                                    }
                                  }}
                                >
                                  <option value="">-- Select Driver to Reassign --</option>
                                  {fleet
                                    .filter(d => isDriverFreeForEntireJourney(d, j.lead.id, selectedStartDate, j.itinerary.total_days))
                                    .map(d => (
                                      <option key={d.id} value={d.id}>
                                        {d.driver_name} ({d.vehicle_model || 'No Vehicle'} - {d.vehicle_number || 'N/A'})
                                      </option>
                                    ))
                                  }
                                </select>
                              </div>

                              {/* Days map */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                {j.days.map(day => {
                                  const activeDriverId = currentAssignments[day.day_number] !== undefined 
                                    ? currentAssignments[day.day_number] 
                                    : (day.driver_id || '');
                                  return (
                                    <div key={day.day_number} style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border)' }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--primary)', marginBottom: '0.4rem' }}>
                                        Day {day.day_number}
                                      </div>
                                      <select 
                                        className="form-control"
                                        style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                                        value={activeDriverId}
                                        onChange={(e) => handleDriverChange(j.itinerary.id, day.day_number, e.target.value)}
                                      >
                                        <option value="">-- No driver assigned --</option>
                                        {fleet
                                          .filter(d => isDriverFreeOnDate(d, j.lead.id, selectedStartDate, day.day_number) || String(d.id) === String(activeDriverId))
                                          .map(d => (
                                            <option key={d.id} value={d.id}>
                                              {getDriverOptionTextForDay(d, j.lead.id, selectedStartDate, day.day_number)}
                                            </option>
                                          ))
                                        }
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                                <button 
                                  className="btn btn-primary"
                                  style={{ flexGrow: 1, padding: '0.5rem', fontSize: '0.8rem', fontWeight: '600' }}
                                  onClick={() => handleSaveFleet(j.itinerary.id, j.lead, j.itinerary, j.days)}
                                  disabled={actionLoading}
                                >
                                  <i className="fa-solid fa-floppy-disk"></i> Save Driver Reassignment
                                </button>
                                 <button 
                                    onClick={() => handleTriggerBackgroundWhatsApp(j.lead.id, j.itinerary.id, 'whatsapp')}
                                    className="btn btn-primary"
                                    style={{ background: '#25D366', border: 'none', padding: '0.5rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', fontSize: '0.8rem', flexGrow: 1 }}
                                    disabled={actionLoading}
                                  >
                                    <i className="fa-brands fa-whatsapp"></i> Resend WhatsApp
                                  </button>
                                  <button 
                                    onClick={() => handleTriggerBackgroundWhatsApp(j.lead.id, j.itinerary.id, 'sms')}
                                    className="btn btn-primary"
                                    style={{ background: '#0070f3', border: 'none', padding: '0.5rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', fontSize: '0.8rem', flexGrow: 1 }}
                                    disabled={actionLoading}
                                  >
                                    <i className="fa-solid fa-envelope"></i> Resend SMS
                                  </button>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {activeTab === 'hotels' && (
          <div className="grid-2 animate-fade-in">
            {/* Add Hotel registry */}
            <section className="glass-card">
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
                <i className="fa-solid fa-circle-plus" style={{ color: 'var(--secondary)', marginRight: '0.5rem' }}></i>
                Register Partner Hotel
              </h2>
              <form onSubmit={handleHotelSubmit}>
                <div className="form-group">
                  <label htmlFor="h-name">Hotel Name</label>
                  <input
                    type="text"
                    id="h-name"
                    className="form-control"
                    placeholder="e.g. Pokhara Lakeside Resort"
                    value={hotelName}
                    onChange={(e) => setHotelName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="h-location">Location / Area</label>
                  <input
                    type="text"
                    id="h-location"
                    className="form-control"
                    placeholder="e.g. Lakeside, Pokhara"
                    value={hotelLocation}
                    onChange={(e) => setHotelLocation(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="h-contact">Hotel Phone / Contact Details</label>
                  <input
                    type="text"
                    id="h-contact"
                    className="form-control"
                    placeholder="e.g. +977 61-46xxxx"
                    value={hotelContact}
                    onChange={(e) => setHotelContact(e.target.value)}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '1rem', background: 'linear-gradient(135deg, var(--secondary), var(--accent-teal))' }}
                  disabled={actionLoading}
                >
                  Register Hotel
                </button>
              </form>
            </section>

            {/* List Hotels */}
            <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
                <i className="fa-solid fa-database" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                Registered Accommodations
              </h2>
              {hotels.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <i className="fa-solid fa-hotel fa-2x" style={{ marginBottom: '1rem' }}></i>
                  <p>No accommodations registered yet.</p>
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Hotel Name</th>
                        <th>Location</th>
                        <th>Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotels.map((h) => (
                        <tr key={h.id}>
                          <td style={{ fontWeight: '600', color: '#FFF' }}>{h.name}</td>
                          <td>{h.location || 'N/A'}</td>
                          <td>{h.contact || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="grid-2 animate-fade-in">
            {/* Add/Edit Driver */}
            <section id="driver-form-section" className="glass-card">
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
                <i className={editingDriver ? "fa-solid fa-user-pen" : "fa-solid fa-circle-plus"} style={{ color: editingDriver ? 'var(--accent-teal)' : 'var(--secondary)', marginRight: '0.5rem' }}></i>
                {editingDriver ? "Edit Registered Driver" : "Register Transport Driver"}
              </h2>
              <form onSubmit={handleDriverSubmit}>
                <div className="form-group">
                  <label htmlFor="d-name">Driver Full Name</label>
                  <input
                    type="text"
                    id="d-name"
                    className="form-control"
                    placeholder="e.g. Ramesh Thapa"
                    value={driverName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDriverName(val);
                      if (isDriverOwner) {
                        setVehicleOwner(val ? `${val} (Self-Owned)` : '');
                      }
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="d-phone">Driver Phone / WhatsApp</label>
                  <input
                    type="text"
                    id="d-phone"
                    className="form-control"
                    placeholder="e.g. +977 9851xxxxxx"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="v-num">Vehicle Plate Number</label>
                    <input
                      type="text"
                      id="v-num"
                      className="form-control"
                      placeholder="e.g. Ba 2 Pa 4567"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="v-model">Vehicle Type / Model</label>
                    <input
                      type="text"
                      id="v-model"
                      className="form-control"
                      placeholder="e.g. Scorpio SUV"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label htmlFor="v-owner" style={{ margin: 0 }}>Vehicle Owner / Vendor</label>
                    <label style={{ fontSize: '0.8rem', color: '#38bdf8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isDriverOwner}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsDriverOwner(checked);
                          if (checked) {
                            setVehicleOwner(driverName ? `${driverName} (Self-Owned)` : 'Self-Owned');
                          }
                        }}
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)', width: '15px', height: '15px' }}
                      />
                      <span>Driver is Owner (Self-Owned)</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    id="v-owner"
                    className="form-control"
                    placeholder="e.g. Himalayan Travels / Owner Name"
                    value={vehicleOwner}
                    onChange={(e) => {
                      setVehicleOwner(e.target.value);
                      if (isDriverOwner) setIsDriverOwner(false);
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  {editingDriver && (
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ flex: 1 }}
                      onClick={handleCancelDriverEdit}
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ flex: editingDriver ? 2 : 1, background: 'linear-gradient(135deg, var(--secondary), var(--accent-teal))' }}
                    disabled={actionLoading}
                  >
                    {editingDriver ? "Save Changes" : "Register Driver & Vehicle"}
                  </button>
                </div>
              </form>
            </section>

            {/* List Drivers */}
            <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
                <i className="fa-solid fa-database" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
                Registered Drivers & Transport
              </h2>
              {drivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <i className="fa-solid fa-car fa-2x" style={{ marginBottom: '1rem' }}></i>
                  <p>No transport drivers registered yet.</p>
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Driver Details</th>
                        <th>Vehicle Info</th>
                        <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <div style={{ fontWeight: '600', color: '#FFF' }}>{d.driver_name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.driver_phone}</div>
                          </td>
                          <td>
                            <div>{d.vehicle_model || 'N/A'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.vehicle_number || 'N/A'}</div>
                            {d.vehicle_owner && (
                              <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.15rem' }}>
                                <i className="fa-solid fa-building-user" style={{ marginRight: '0.3rem' }}></i> {d.vehicle_owner}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button 
                                className="btn btn-sm btn-secondary" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} 
                                title="Edit"
                                onClick={() => handleEditDriverClick(d)}
                              >
                                <i className="fa-solid fa-pencil" style={{ color: 'var(--accent-teal)' }}></i>
                              </button>
                              <button 
                                className="btn btn-sm btn-secondary" 
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} 
                                title="Delete"
                                onClick={() => handleDeleteDriver(d.id, d.driver_name)}
                              >
                                <i className="fa-solid fa-trash" style={{ color: 'var(--accent-orange)' }}></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'templates' && (
          <section className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2>Itinerary Master Registry</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Pre-configured readymade packages that are available for instant quotation and CRM assignment.
                </p>
              </div>
              <button 
                className="btn btn-primary"
                onClick={handleOpenNewTemplateModal}
                style={{ background: 'linear-gradient(135deg, var(--secondary), var(--accent-teal))' }}
              >
                <i className="fa-solid fa-circle-plus"></i> Create Readymade Package
              </button>
            </div>

            {templates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-compass fa-3x" style={{ marginBottom: '1rem' }}></i>
                <p>No readymade packages found. Click "Create Readymade Package" to build one.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Package Name</th>
                      <th>Region</th>
                      <th>Duration</th>
                      <th>Price</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div style={{ fontWeight: '600', color: '#FFF' }}>{t.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Highlights: {
                              (() => {
                                try {
                                  const parsed = typeof t.days === 'string' ? JSON.parse(t.days) : t.days;
                                  return parsed.map(d => d.activities).filter(Boolean).slice(0, 3).join(' → ') || 'No activities';
                                } catch (e) {
                                  return 'No details';
                                }
                              })()
                            }
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-new">{t.region}</span>
                        </td>
                        <td>
                          <strong>{t.total_days} Day(s)</strong>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--primary)' }}>Rs. {t.estimated_price}</strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => handleOpenEditTemplateModal(t)}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                              <i className="fa-solid fa-pen-to-square"></i> Edit
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => handleTemplateDelete(t.id, t.name)}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--accent-orange)' }}
                            >
                              <i className="fa-solid fa-trash-can"></i> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Reports & Analytics Tab */}
        {activeTab === 'reports' && (
          <section className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', color: '#FFF', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <i className="fa-solid fa-chart-pie" style={{ color: 'var(--accent-teal)' }}></i>
                  Travel Business Reports & Analytics
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  Executive performance reports, revenue metrics, driver dispatches, and B2B partner commissions for M/s Sandesh Travels.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={exportFinancialReportToCSV}
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', fontWeight: '600' }}
                >
                  <i className="fa-solid fa-file-csv"></i> Export CSV Report
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => window.print()}
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', color: '#FFF', fontWeight: '600' }}
                >
                  <i className="fa-solid fa-print"></i> Print Report
                </button>
              </div>
            </div>

            {/* Top Summary KPI Cards */}
            {(() => {
              const confirmedLeads = leads.filter(l => l.status === 'converted' || l.status === 'assigned' || l.status === 'completed');
              const totalRevenue = confirmedLeads.reduce((acc, l) => acc + (parseFloat(l.itinerary_price) || 0), 0);
              const b2bLeads = confirmedLeads.filter(l => l.partner_id !== null);
              const b2bRevenue = b2bLeads.reduce((acc, l) => acc + (parseFloat(l.itinerary_price) || 0), 0);
              const totalCommission = b2bLeads.reduce((acc, l) => {
                const rate = parseFloat(l.commission_rate) || 0;
                const price = parseFloat(l.itinerary_price) || 0;
                return acc + ((price * rate) / 100);
              }, 0);
              const activeFleetCount = fleet.filter(d => d.bookings && d.bookings.length > 0).length;

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,78,59,0.2))', border: '1px solid rgba(16,185,129,0.3)', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#34D399', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Booking Revenue</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#FFF', margin: '0.3rem 0' }}>Rs. {totalRevenue.toLocaleString()}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Across {confirmedLeads.length} confirmed itineraries</div>
                  </div>

                  <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(12,74,110,0.2))', border: '1px solid rgba(56,189,248,0.3)', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirmed Bookings</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#FFF', margin: '0.3rem 0' }}>{confirmedLeads.length} Journeys</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{leads.filter(l => l.status === 'new' || l.status === 'quoted').length} pending inquiries</div>
                  </div>

                  <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(120,53,15,0.2))', border: '1px solid rgba(245,158,11,0.3)', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#FBBF24', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fleet Utilization</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#FFF', margin: '0.3rem 0' }}>{activeFleetCount} / {fleet.length} Drivers</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active on scheduled routes</div>
                  </div>

                  <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(88,28,135,0.2))', border: '1px solid rgba(168,85,247,0.3)', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#C084FC', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>B2B Commissions Payable</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#FFF', margin: '0.3rem 0' }}>Rs. {totalCommission.toLocaleString()}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>From Rs. {b2bRevenue.toLocaleString()} partner volume</div>
                  </div>
                </div>
              );
            })()}

            {/* Report Sub-tabs Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { id: 'revenue', label: '💰 Revenue & Bookings Log', icon: 'fa-file-invoice-dollar' },
                { id: 'fleet', label: '🚗 Fleet & Driver Report', icon: 'fa-car-side' },
                { id: 'partners', label: '🤝 B2B Partner Commissions', icon: 'fa-handshake' },
                { id: 'regions', label: '🌐 Regional Route Performance', icon: 'fa-map' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReportSubTab(tab.id)}
                  className={`btn ${reportSubTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: reportSubTab === tab.id ? '600' : 'normal',
                    border: reportSubTab === tab.id ? '1px solid var(--primary)' : '1px solid var(--border)'
                  }}
                >
                  <i className={`fa-solid ${tab.icon}`} style={{ marginRight: '0.4rem' }}></i>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-tab 1: Revenue & Bookings Log */}
            {reportSubTab === 'revenue' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', color: '#FFF' }}>Confirmed Traveler Booking Revenue Log</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Showing all converted, assigned, and completed journeys
                  </span>
                </div>

                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border)' }}>
                        <th>Guest Details</th>
                        <th>Journey Start Date</th>
                        <th>Route Program</th>
                        <th>Assigned Fleet & Driver</th>
                        <th>Lead Source</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Booking Price (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads
                        .filter(l => l.status === 'converted' || l.status === 'assigned' || l.status === 'completed')
                        .map(l => {
                          const journey = journeys.find(j => String(j.lead.id) === String(l.id));
                          const assignedDrivers = [];
                          if (journey && journey.days) {
                            journey.days.forEach(d => {
                              if (d.driver_name && !assignedDrivers.some(a => a.driver_name === d.driver_name)) {
                                assignedDrivers.push(d);
                              }
                            });
                          }

                          return (
                            <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td>
                                <strong style={{ color: '#FFF' }}>{l.client_name}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.client_phone} ({l.num_travelers} guest)</div>
                              </td>
                              <td>
                                <span className="badge badge-completed" style={{ fontSize: '0.75rem' }}>
                                  {l.start_date ? parseLocalDateString(l.start_date) : 'Flexible'}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: '500', color: 'var(--accent-teal)' }}>{l.itinerary_title || 'Custom Plan'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.total_days} Days Program</div>
                              </td>
                              <td>
                                {assignedDrivers.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {assignedDrivers.map((drv, i) => (
                                      <div key={i} style={{ fontSize: '0.8rem' }}>
                                        <span style={{ color: '#FFF', fontWeight: '600' }}>
                                          <i className="fa-solid fa-car-side" style={{ color: 'var(--accent-teal)', marginRight: '0.35rem' }}></i>
                                          {drv.driver_name}
                                        </span>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                          {drv.vehicle_model || 'Vehicle'} ({drv.vehicle_number || 'N/A'}) • {drv.driver_phone}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-- Unassigned Fleet --</span>
                                )}
                              </td>
                              <td>
                                {l.partner_name ? (
                                  <span className="badge badge-converted">Referral: {l.partner_name}</span>
                                ) : (
                                  <span className="badge badge-new">B2C Direct</span>
                                )}
                              </td>
                              <td>
                                <span className={`badge badge-${l.status}`}>{l.status.toUpperCase()}</span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-teal)', fontSize: '0.95rem' }}>
                                Rs. {(parseFloat(l.itinerary_price) || 0).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      }
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-surface-elevated)', borderTop: '2px solid var(--border)', fontWeight: '700' }}>
                        <td colSpan="6" style={{ color: '#FFF', fontSize: '0.9rem' }}>GRAND TOTAL REVENUE</td>
                        <td style={{ textAlign: 'right', color: 'var(--primary)', fontSize: '1.1rem' }}>
                          Rs. {leads
                            .filter(l => l.status === 'converted' || l.status === 'assigned' || l.status === 'completed')
                            .reduce((acc, l) => acc + (parseFloat(l.itinerary_price) || 0), 0)
                            .toLocaleString()
                          }
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Fleet & Driver Report */}
            {reportSubTab === 'fleet' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.05rem', color: '#FFF' }}>Transport Fleet & Driver Deployment Report</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registered transport vehicles and assignment logs
                  </span>
                </div>

                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border)' }}>
                        <th>Driver Name</th>
                        <th>Phone Number</th>
                        <th>Vehicle Model & Number</th>
                        <th>Assigned Guest / Tour</th>
                        <th>Vehicle Ownership</th>
                        <th>Assigned Days</th>
                        <th>Occupancy Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleet.map(d => {
                        const totalAssignedTrips = d.bookings ? d.bookings.length : 0;
                        const isOwner = d.vehicle_owner && d.vehicle_owner.toLowerCase() === d.driver_name.toLowerCase();

                        // Find assigned guest names for this driver
                        const assignedGuestNames = [];
                        journeys.forEach(j => {
                          if (j.days && j.days.some(day => day.driver_name && day.driver_name.toLowerCase() === d.driver_name.toLowerCase())) {
                            if (!assignedGuestNames.includes(j.lead.client_name)) {
                              assignedGuestNames.push(j.lead.client_name);
                            }
                          }
                        });

                        return (
                          <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td>
                              <strong style={{ color: '#FFF' }}>{d.driver_name}</strong>
                            </td>
                            <td>
                              <span style={{ color: 'var(--accent-teal)' }}>{d.driver_phone}</span>
                            </td>
                            <td>
                              <strong style={{ color: '#FFF' }}>{d.vehicle_model || 'Vehicle'}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.vehicle_number || 'N/A'}</div>
                            </td>
                            <td>
                              {assignedGuestNames.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  {assignedGuestNames.map((gName, idx) => (
                                    <span key={idx} style={{ color: 'var(--accent-teal)', fontWeight: '600' }}>
                                      👤 {gName}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-- Standby / Available --</span>
                              )}
                            </td>
                            <td>
                              {isOwner ? (
                                <span className="badge badge-completed" style={{ fontSize: '0.75rem' }}>Driver Owned Vehicle</span>
                              ) : (
                                <span className="badge badge-new" style={{ fontSize: '0.75rem' }}>Company Fleet</span>
                              )}
                            </td>
                            <td style={{ fontWeight: '700', color: '#FFF' }}>
                              {totalAssignedTrips} Days Dispatched
                            </td>
                            <td>
                              {totalAssignedTrips > 0 ? (
                                <span className="badge badge-assigned">On Scheduled Tours</span>
                              ) : (
                                <span className="badge badge-new">Available / Standby</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab 3: B2B Partner Commissions */}
            {reportSubTab === 'partners' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.05rem', color: '#FFF' }}>B2B Referral Partner Commission Report</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Track guest referrals, partner sales volume, and commission payouts
                  </span>
                </div>

                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '2px solid var(--border)' }}>
                        <th>Partner Hotel / Agency</th>
                        <th>Contact Person</th>
                        <th>Commission Rate</th>
                        <th>Referred Bookings</th>
                        <th>Total Booking Volume</th>
                        <th style={{ textAlign: 'right' }}>Commission Payable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotels.map(h => {
                        const partnerLeads = leads.filter(l => l.partner_id === h.id && (l.status === 'converted' || l.status === 'assigned' || l.status === 'completed'));
                        const volume = partnerLeads.reduce((acc, l) => acc + (parseFloat(l.itinerary_price) || 0), 0);
                        const rate = parseFloat(h.commission_rate) || 10;
                        const commission = (volume * rate) / 100;

                        return (
                          <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td>
                              <strong style={{ color: '#FFF' }}>{h.name}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.location || 'Nepal'}</div>
                            </td>
                            <td>
                              <div>{h.contact || 'N/A'}</div>
                            </td>
                            <td>
                              <span className="badge badge-completed">{rate}% Commission</span>
                            </td>
                            <td style={{ fontWeight: '700', color: '#FFF' }}>
                              {partnerLeads.length} Confirmed Guests
                            </td>
                            <td style={{ fontWeight: '600', color: 'var(--accent-teal)' }}>
                              Rs. {volume.toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#C084FC', fontSize: '1rem' }}>
                              Rs. {commission.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab 4: Regional Route Performance */}
            {reportSubTab === 'regions' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.05rem', color: '#FFF' }}>Regional Route Popularity & Sales Analytics</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Breakdown of tourist interest across North, South, East, West, & Central regions
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {['North', 'South', 'East', 'West', 'Central'].map(reg => {
                    const regTemplates = templates.filter(t => t.region && t.region.toLowerCase() === reg.toLowerCase());
                    const regLeads = leads.filter(l => {
                      const title = (l.itinerary_title || '').toLowerCase();
                      return title.includes(reg.toLowerCase());
                    });
                    const regRevenue = regLeads.reduce((acc, l) => acc + (parseFloat(l.itinerary_price) || 0), 0);

                    return (
                      <div key={reg} className="glass-card" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border)', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span className="badge badge-converted" style={{ fontSize: '0.75rem' }}>{reg} Region</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{regTemplates.length} Package Blueprints</span>
                        </div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#FFF', margin: '0.4rem 0' }}>
                          {regLeads.length} Tour Bookings
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-teal)', fontWeight: '600' }}>
                          Rs. {regRevenue.toLocaleString()} Revenue
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Book Walk-in / Phone Enquiry Modal */}
      {showBookModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div 
            className="animate-fade-in"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius-lg)',
              width: '100%',
              maxWidth: '580px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
              position: 'relative'
            }}
          >
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fa-solid fa-address-book" style={{ color: 'var(--secondary)' }}></i>
              Book Walk-in / Phone Enquiry
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Book guest details immediately. Optionally select a pre-defined regional package to automatically build their itinerary.
            </p>

            <form onSubmit={handleBookEnquirySubmit}>
              <div className="form-group">
                <label>Guest Full Name *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. Ram Prasad"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>WhatsApp / Phone Number *</label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <select
                    className="form-control"
                    style={{ width: '95px', padding: '0.35rem 0.2rem', fontSize: '0.85rem', flexShrink: 0, background: 'var(--bg-surface-elevated)', color: '#FFF' }}
                    value={newLeadCountryCode}
                    onChange={(e) => setNewLeadCountryCode(e.target.value)}
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input 
                    type="tel" 
                    className="form-control"
                    placeholder="10-digit mobile no."
                    value={newLeadLocalPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('+')) {
                        const parsed = parsePhoneNumber(val);
                        setNewLeadCountryCode(parsed.countryCode);
                        setNewLeadLocalPhone(parsed.localNumber);
                      } else {
                        setNewLeadLocalPhone(val.replace(/\D/g, ''));
                      }
                    }}
                    required
                  />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Saved as: <strong style={{ color: 'var(--accent-teal)' }}>{formatFullPhoneNumber(newLeadCountryCode, newLeadLocalPhone) || 'None'}</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Start Date (Journey Date)</label>
                  <input 
                    type="date" 
                    className="form-control"
                    value={newLeadStartDate}
                    onChange={(e) => setNewLeadStartDate(e.target.value)}
                    min={getTodayString()}
                  />
                </div>
                <div className="form-group">
                  <label>Total Guests</label>
                  <input 
                    type="number" 
                    className="form-control"
                    min="1"
                    value={newLeadTravelers}
                    onChange={(e) => setNewLeadTravelers(parseInt(e.target.value) || 1)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Referral Partner / Lead Source *</label>
                <select 
                  className="form-control"
                  value={newLeadPartnerId}
                  onChange={(e) => setNewLeadPartnerId(e.target.value)}
                  required
                >
                  <option value="">Direct Tourist</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.hotel_name} (Commission: {p.commission_rate}%)
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Attribute guest booking source to Direct Tourist or a registered B2B referral partner hotel.
                </span>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.4rem' }}>Filter Packages by Region</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {['All', 'North', 'South', 'East', 'West', 'Central'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBookModalTemplateRegion(r)}
                      className={`btn ${bookModalTemplateRegion === r ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        padding: '0.3rem 0.6rem', 
                        fontSize: '0.75rem', 
                        border: '1px solid var(--border)',
                        background: bookModalTemplateRegion === r ? 'var(--secondary)' : 'transparent',
                        color: '#FFF'
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                  <label style={{ fontWeight: '600', color: '#FFF' }}>
                    Region/Route Package Blueprints (Optional Multi-Selection)
                  </label>

                  {/* Multi-Select Checkbox Dropdown Box */}
                  <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                    <div
                      onClick={() => setIsWalkInMultiDropdownOpen(prev => !prev)}
                      className="form-control"
                      style={{
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '0.55rem 0.85rem',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-surface)',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <i className="fa-solid fa-square-check" style={{ color: 'var(--accent-teal)' }}></i>
                        {selectedWalkInTemplateIds.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-- Custom Blank Itinerary (No pre-population) --</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ color: '#FFF', fontSize: '0.85rem', fontWeight: '600' }}>
                              {selectedWalkInTemplateIds.length} Region(s) Selected:
                            </span>
                            {templates
                              .filter(t => selectedWalkInTemplateIds.includes(String(t.id)))
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
                                      setSelectedWalkInTemplateIds(prev => prev.filter(id => id !== String(t.id)));
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
                      <i className={`fa-solid fa-chevron-${isWalkInMultiDropdownOpen ? 'up' : 'down'}`} style={{ color: 'var(--text-secondary)' }}></i>
                    </div>

                    {/* Dropdown panel */}
                    {isWalkInMultiDropdownOpen && (
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
                          maxHeight: '260px',
                          overflowY: 'auto'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Check regions to include:</span>
                          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const visibleIds = templates
                                  .filter(t => bookModalTemplateRegion === 'All' || t.region.toLowerCase() === bookModalTemplateRegion.toLowerCase())
                                  .map(t => String(t.id));
                                setSelectedWalkInTemplateIds(visibleIds);
                              }}
                              style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0 }}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedWalkInTemplateIds([])}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {templates
                            .filter(t => bookModalTemplateRegion === 'All' || t.region.toLowerCase() === bookModalTemplateRegion.toLowerCase())
                            .map(t => {
                              const isChecked = selectedWalkInTemplateIds.includes(String(t.id));
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
                                          setSelectedWalkInTemplateIds(prev => [...prev, String(t.id)]);
                                        } else {
                                          setSelectedWalkInTemplateIds(prev => prev.filter(id => id !== String(t.id)));
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

                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                    Check multiple regional blueprints to merge them into a single multi-region itinerary for this guest.
                  </span>
                </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setShowBookModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Booking...' : 'Book & Create Itinerary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Create / Edit Modal */}
      {showTemplateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div 
            className="animate-fade-in"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius-lg)',
              width: '100%',
              maxWidth: '680px',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              position: 'relative',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fa-solid fa-compass" style={{ color: 'var(--secondary)' }}></i>
              {editingTemplate ? 'Edit Readymade Package' : 'Create Readymade Package'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Define the package name, regional classification, pricing in Rs., and configure day-by-day itineraries.
            </p>

            <form onSubmit={handleTemplateSubmit} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', paddingRight: '0.5rem', flexGrow: 1, marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Package Name *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="e.g. Kathmandu Heritage Tour (3 Days)"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Region *</label>
                    <select 
                      className="form-control"
                      value={templateRegion}
                      onChange={(e) => setTemplateRegion(e.target.value)}
                      required
                    >
                      <option value="North">North</option>
                      <option value="South">South</option>
                      <option value="East">East</option>
                      <option value="West">West</option>
                      <option value="Central">Central</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Estimated Price (Rs.) *</label>
                    <input 
                      type="number" 
                      className="form-control"
                      min="0"
                      step="0.01"
                      value={templatePrice}
                      onChange={(e) => setTemplatePrice(parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Total Duration (Days) *</label>
                    <input 
                      type="number" 
                      className="form-control"
                      min="1"
                      max="30"
                      value={templateTotalDays}
                      onChange={(e) => handleTemplateTotalDaysChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginTop: '1.5rem', marginBottom: '1rem', color: '#FFF' }}>
                  Day-by-Day Itinerary Editor
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {templateDays.map((day, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: '700', color: 'var(--secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Day {day.dayNumber}
                      </div>
                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.75rem' }}>Sightseeing & Route Description *</label>
                        <textarea 
                          className="form-control"
                          rows="2"
                          placeholder="Sightseeing description..."
                          value={day.description || ''}
                          onChange={(e) => handleTemplateDayFieldChange(idx, 'description', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Key Activities (comma separated)</label>
                        <input 
                          type="text"
                          className="form-control"
                          placeholder="e.g. Hiking, Sunrise, Temple Visit"
                          value={day.activities || ''}
                          onChange={(e) => handleTemplateDayFieldChange(idx, 'activities', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
