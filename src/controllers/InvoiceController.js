import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { LeadModel } from '@/models/Lead';
import { ItineraryModel } from '@/models/Itinerary';
import { PartnerModel } from '@/models/Partner';

export class InvoiceController {
  static async getInvoiceData(request, { params }) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { leadId } = await params;

      if (!leadId) {
        return NextResponse.json(
          { error: 'Lead ID is required.' },
          { status: 400 }
        );
      }

      const lead = await LeadModel.getById(leadId);
      if (!lead) {
        return NextResponse.json(
          { error: 'Lead not found.' },
          { status: 404 }
        );
      }

      const itinerary = await ItineraryModel.getByLeadId(leadId);
      let days = [];
      if (itinerary) {
        days = await ItineraryModel.getDaysWithDetails(itinerary.id);
      }

      let partner = null;
      if (lead.partner_id) {
        partner = await PartnerModel.getById(lead.partner_id);
      }

      // Format Dates
      const parseLocalDate = (dateInput) => {
        if (!dateInput) return null;
        if (dateInput instanceof Date) {
          return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
        }
        const parts = String(dateInput).substring(0, 10).split('-');
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      };

      const startDateObj = parseLocalDate(lead.start_date);
      let endDateObj = null;
      if (startDateObj && itinerary?.total_days) {
        endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + (parseInt(itinerary.total_days, 10) || 1) - 1);
      }

      const invoiceNumber = `ST-INV-${String(lead.id).padStart(5, '0')}`;
      const basePrice = itinerary ? (parseFloat(itinerary.price) || 0) : 0;
      const gstRate = 0.05; // 5% GST
      const gstAmount = Math.round(basePrice * gstRate * 100) / 100;
      const totalAmount = Math.round((basePrice + gstAmount) * 100) / 100;

      return NextResponse.json({
        success: true,
        invoice: {
          invoiceNumber,
          invoiceDate: new Date().toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          agency: {
            name: 'M/s Sandesh Travels',
            tagline: 'Tours & Travel Company',
            phone: '+91 9647878373',
            email: 'santeshtravelsgtk@gmail.com',
            website: 'www.sandeshtravels.in',
            address: 'Chota Singtam, Near Kishan School, Aho Busty, Aho Yangtam GPU, Pakyong 737135',
            license: 'TTD:1667/DoT &CAv/Gtk/24/TA | TL: EOG/AHY/0282',
            pan: 'AXXPR3863J',
            gstin: 'AXXPR3863J'
          },
          client: {
            name: lead.client_name,
            phone: lead.client_phone,
            numTravelers: lead.num_travelers,
            travelDates: lead.travel_dates || (startDateObj ? `${startDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${endDateObj ? endDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}` : 'Scheduled'),
            startDate: startDateObj ? startDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
            endDate: endDateObj ? endDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
            status: lead.status
          },
          itinerary: itinerary ? {
            id: itinerary.id,
            title: itinerary.title,
            totalDays: itinerary.total_days,
            price: basePrice
          } : null,
          days,
          partner: partner ? {
            hotelName: partner.hotel_name,
            commissionRate: partner.commission_rate
          } : null,
          billing: {
            basePrice,
            gstRate: 5,
            gstAmount,
            discount: 0,
            totalAmount,
            paymentStatus: lead.status === 'completed' ? 'PAID & COMPLETED' : 'BOOKING CONFIRMED'
          }
        }
      });
    } catch (error) {
      console.error('InvoiceController error:', error);
      return NextResponse.json(
        { error: 'Failed to generate invoice data' },
        { status: 500 }
      );
    }
  }
}
