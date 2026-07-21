import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { LeadModel } from '@/models/Lead';
import { ItineraryModel } from '@/models/Itinerary';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export class WhatsAppController {
  static async sendItineraryNotification(request) {
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

      const lead = await LeadModel.getById(parseInt(leadId, 10));
      if (!lead) {
        return NextResponse.json(
          { error: 'Lead not found.' },
          { status: 404 }
        );
      }

      const itinerary = await ItineraryModel.getById(parseInt(itineraryId, 10));
      if (!itinerary) {
        return NextResponse.json(
          { error: 'Itinerary not found.' },
          { status: 404 }
        );
      }

      const host = request.headers.get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const guestItineraryUrl = `${protocol}://${host}/itinerary/${itineraryId}`;

      let message = '';

      if (lead.status === 'converted' || lead.status === 'completed') {
        const firstDriver = await ItineraryModel.getFirstAssignedDriver(parseInt(itineraryId, 10));

        if (firstDriver) {
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
          message += `• Driver Name: ${firstDriver.driver_name}\n`;
          message += `• Driver Contact: ${firstDriver.driver_phone}\n`;
          message += `• Vehicle: ${firstDriver.vehicle_model} (${firstDriver.vehicle_number || 'N/A'})\n\n`;
          message += `Please click the link below to view your full day-by-day program, accommodation check-in stays, and updates:\n👉 ${guestItineraryUrl}\n\nThank you for choosing VaniTravels!`;
        } else {
          message = `Hi ${lead.client_name}, your booking with VaniTravels is confirmed! 🚗✨\n\nPlease click the link below to view your full day-by-day program and itinerary updates:\n👉 ${guestItineraryUrl}\n\nThank you for choosing VaniTravels!`;
        }
      } else {
        message = `Hi ${lead.client_name}, this is VaniTravels. We have prepared your custom day-by-day travel plan and itinerary! 🗺️✈️\n\nPlease click this link to view all your hotel stay details, drivers, and activities:\n👉 ${guestItineraryUrl}\n\nLet us know if you want to proceed! Thank you.`;
      }

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
      console.error('WhatsAppController sendItineraryNotification error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
