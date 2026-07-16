import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in as admin.' },
        { status: 401 }
      );
    }

    const { leadId, itineraryId } = await request.json();

    if (!leadId || !itineraryId) {
      return NextResponse.json(
        { error: 'Lead ID and Itinerary ID are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch Lead Details
    const leadRes = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (leadRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Lead not found.' },
        { status: 404 }
      );
    }
    const lead = leadRes.rows[0];

    // 2. Fetch Itinerary Details
    const itinRes = await query('SELECT * FROM itineraries WHERE id = $1', [itineraryId]);
    if (itinRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Itinerary not found.' },
        { status: 404 }
      );
    }
    const itinerary = itinRes.rows[0];

    // 3. Construct dynamic URL and body
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const guestItineraryUrl = `${protocol}://${host}/itinerary/${itineraryId}`;
    
    let message = '';
    
    if (lead.status === 'converted' || lead.status === 'completed') {
      // Find the first assigned driver details in the itinerary days
      const daysRes = await query(`
        SELECT id_day.*, d.driver_name, d.driver_phone, d.vehicle_model, d.vehicle_number
        FROM itinerary_days id_day
        LEFT JOIN drivers_registry d ON id_day.driver_id = d.id
        WHERE id_day.itinerary_id = $1 AND id_day.driver_id IS NOT NULL
        ORDER BY id_day.day_number ASC
        LIMIT 1
      `, [parseInt(itineraryId, 10)]);

      if (daysRes.rows.length > 0) {
        const driver = daysRes.rows[0];
        const formattedStartDate = lead.start_date
          ? new Date(lead.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Flexible';

        message = `Hi ${lead.client_name}, your booking with VaniTravels is confirmed! 🚗✨\n\n`;
        message += `*JOURNEY DETAILS:*\n`;
        message += `• Route: ${itinerary.title}\n`;
        message += `• Start Date: ${formattedStartDate}\n`;
        message += `• Duration: ${itinerary.total_days} Days\n`;
        message += `• Overall Price: Rs. ${itinerary.price}\n\n`;
        message += `*ASSIGNED DRIVER & VEHICLE:*\n`;
        message += `• Driver Name: ${driver.driver_name}\n`;
        message += `• Driver Contact: ${driver.driver_phone}\n`;
        message += `• Vehicle: ${driver.vehicle_model} (${driver.vehicle_number || 'N/A'})\n\n`;
        message += `Please click the link below to view your full day-by-day program, accommodation check-in stays, and updates:\n👉 ${guestItineraryUrl}\n\nThank you for choosing VaniTravels!`;
      } else {
        message = `Hi ${lead.client_name}, your booking with VaniTravels is confirmed! 🚗✨\n\nPlease click the link below to view your full day-by-day program and itinerary updates:\n👉 ${guestItineraryUrl}\n\nThank you for choosing VaniTravels!`;
      }
    } else {
      // Default quotation message
      message = `Hi ${lead.client_name}, this is VaniTravels. We have prepared your custom day-by-day travel plan and itinerary! 🗺️✈️\n\nPlease click this link to view all your hotel stay details, drivers, and activities:\n👉 ${guestItineraryUrl}\n\nLet us know if you want to proceed! Thank you.`;
    }

    // 4. Dispatch
    const result = await sendWhatsAppMessage(lead.client_phone, message);

    if (result.success) {
      return NextResponse.json({
        success: true,
        simulated: result.simulated || false,
        message: result.simulated
          ? 'WhatsApp dispatch simulated successfully. Credentials not configured in .env.local.'
          : 'WhatsApp message sent directly to traveller.'
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to dispatch message.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Trigger WhatsApp API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
