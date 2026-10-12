import { PaymentModel } from '@/models/Payment';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { LeadModel } from '@/models/Lead';
import { ItineraryModel } from '@/models/Itinerary';
import { PartnerModel } from '@/models/Partner';
import { CompanySettingsModel } from '@/models/CompanySettings';

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

      const companySettings = await CompanySettingsModel.get();

      const itinerary = await ItineraryModel.getByLeadId(leadId);
      let days = [];
      if (itinerary) {
        days = await ItineraryModel.getDaysWithDetails(itinerary.id);
      }

      let partner = null;
      if (lead.partner_id) {
        partner = await PartnerModel.getById(lead.partner_id);
      }

      // Fetch payment ledger history
      let paymentHistory = [];
      try {
        paymentHistory = await PaymentModel.getByLeadId(leadId);
      } catch (e) {
        console.error('Error fetching payment history for invoice:', e);
      }

      // If no payments logged yet in lead_payments table, synthesize from lead advance & settlement
      if (!paymentHistory || paymentHistory.length === 0) {
        const advAmount = parseFloat(lead.advance_paid) || 0;
        const setAmount = parseFloat(lead.settlement_amount) || 0;
        if (advAmount > 0) {
          paymentHistory.push({
            id: 'legacy-adv',
            lead_id: lead.id,
            payment_type: 'advance',
            title: '1. Initial Advance (Pre-Trip)',
            amount: advAmount,
            payment_method: lead.payment_method || 'cash',
            transaction_ref: lead.transaction_ref || 'ADV_RECEIPT',
            payment_date: lead.advance_verified_at || lead.created_at,
            notes: 'Advance deposit collected'
          });
        }
        if (setAmount > 0) {
          paymentHistory.push({
            id: 'legacy-settle',
            lead_id: lead.id,
            payment_type: lead.payment_status === 'settled' ? 'settlement' : 'installment',
            title: lead.payment_status === 'settled' ? 'Final Payment Settlement' : '2. Mid-Trip Installment',
            amount: setAmount,
            payment_method: lead.settlement_method || 'cash',
            transaction_ref: lead.settlement_ref || 'TXN_REF',
            payment_date: lead.settled_at || new Date(),
            notes: lead.settlement_reason || 'Installment collected'
          });
        }
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

      const advancePaid = lead.advance_paid ? parseFloat(lead.advance_paid) : (lead.status === 'converted' || lead.status === 'assigned' || lead.payment_status === 'advance_paid' || lead.payment_status === 'settled' ? Math.round(totalAmount * 0.10) : 0);
      const settlementAmount = parseFloat(lead.settlement_amount) || 0;
      const settlementDiscount = parseFloat(lead.settlement_discount) || 0;
      const isSettled = lead.status === 'completed' || lead.payment_status === 'settled';
      const balanceDue = isSettled ? 0 : Math.max(0, Math.round((totalAmount - advancePaid - settlementAmount - settlementDiscount) * 100) / 100);

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
            name: companySettings.company_name || 'M/s Sandesh Travels',
            tagline: companySettings.tagline || 'Tours & Travel Company',
            phone: companySettings.phone || '+91 9647878373',
            email: companySettings.email || 'santeshtravelsgtk@gmail.com',
            website: companySettings.website || 'www.sandeshtravels.in',
            address: companySettings.address || 'Chota Singtam, Near Kishan School, Aho Busty, Aho Yangtam GPU, Pakyong 737135',
            license: companySettings.license || 'TTD:1667/DoT &CAv/Gtk/24/TA | TL: EOG/AHY/0282',
            pan: companySettings.pan || 'AXXPR3863J',
            gstin: companySettings.gstin || 'AXXPR3863J'
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
          paymentHistory,
          billing: {
            paymentHistory,
            basePrice,
            gstRate: 5,
            gstAmount,
            discount: settlementDiscount,
            totalAmount,
            advancePaid,
            settlementAmount,
            settlementDiscount,
            settlementReason: lead.settlement_reason,
            settlementMethod: lead.settlement_method,
            settlementRef: lead.settlement_ref,
            settledAt: lead.settled_at,
            balanceDue,
            paymentStatus: isSettled ? (settlementDiscount > 0 ? 'SETTLED (WITH WAIVER / ADJUSTMENT)' : 'PAID & FULLY SETTLED') : lead.payment_status === 'partially_settled' ? 'PARTIALLY SETTLED - BALANCE DUE' : (advancePaid > 0 || lead.status === 'converted' || lead.status === 'assigned') ? '10% ADVANCE RECEIVED' : 'ADVANCE DUE',
            rawPaymentStatus: lead.payment_status,
            transactionRef: lead.transaction_ref,
            paymentMethod: lead.payment_method || 'UPI'
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
