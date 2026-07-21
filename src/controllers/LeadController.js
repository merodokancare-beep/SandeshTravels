import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getAdminSession, getSession } from '@/lib/auth';
import { LeadModel } from '@/models/Lead';
import { ItineraryModel } from '@/models/Itinerary';
import { TemplateModel } from '@/models/Template';
import { PartnerModel } from '@/models/Partner';

export class LeadController {
  static async adminGetAllLeads() {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      // Auto-complete any converted journeys that have ended
      await LeadModel.autoCompleteEndedJourneys();

      // Retrieve all leads joined with partner details
      const leads = await LeadModel.getAll();

      return NextResponse.json({
        success: true,
        leads
      });
    } catch (error) {
      console.error('LeadController adminGetAllLeads error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async adminUpdateLead(request) {
    const client = await getClient();
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { leadId, status, startDate } = await request.json();

      if (!leadId) {
        return NextResponse.json(
          { error: 'Lead ID is required.' },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      const updatedLead = await LeadModel.update(leadId, { status, startDate }, client);
      if (!updatedLead) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Lead not found.' },
          { status: 404 }
        );
      }

      // If status is converted, check for scheduling conflicts
      if (updatedLead.status === 'converted') {
        const conflicts = await LeadModel.getConflicts(leadId, client);
        if (conflicts.length > 0) {
          await client.query('ROLLBACK');
          const firstConflict = conflicts[0];
          const dateStr = new Date(firstConflict.target_date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
          return NextResponse.json(
            { 
              error: `Cannot confirm booking: Driver "${firstConflict.driver_name}" has a conflict with confirmed guest "${firstConflict.other_client_name}" on ${dateStr}. Please change the driver in Itinerary Builder first.` 
            },
            { status: 400 }
          );
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        lead: updatedLead
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('LeadController adminUpdateLead error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  }

  static async adminCreateLead(request) {
    const client = await getClient();
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { clientName, clientPhone, travelDates, numTravelers, startDate, templateId, partnerId } = await request.json();

      if (!clientName || !clientPhone) {
        return NextResponse.json(
          { error: 'Client name and phone number are required.' },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      const guestsCount = parseInt(numTravelers, 10) || 1;
      const initialStatus = templateId ? 'quoted' : 'new';
      const parsedPartnerId = partnerId ? parseInt(partnerId, 10) : null;

      const lead = await LeadModel.create({
        partnerId: parsedPartnerId,
        clientName,
        clientPhone,
        travelDates,
        numTravelers: guestsCount,
        status: initialStatus,
        startDate: startDate || null
      }, client);

      // Generate itinerary if template selected
      if (templateId) {
        const template = await TemplateModel.getById(parseInt(templateId, 10), client);
        if (template) {
          const itinerary = await ItineraryModel.create({
            leadId: lead.id,
            title: `${template.name} for ${clientName}`,
            price: template.estimated_price,
            totalDays: template.total_days,
            status: 'draft'
          }, client);

          const templateDays = typeof template.days === 'string' ? JSON.parse(template.days) : template.days;
          for (const day of templateDays) {
            await ItineraryModel.createDay({
              itineraryId: itinerary.id,
              dayNumber: day.dayNumber,
              hotelId: null,
              driverId: null,
              description: day.description || '',
              activities: day.activities || ''
            }, client);
          }
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        lead
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('LeadController adminCreateLead error:', error);
      return NextResponse.json(
        { error: 'Internal server error during booking creation.' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  }

  static async publicCreateLead(request) {
    try {
      const { clientName, clientPhone, travelDates, numTravelers } = await request.json();

      if (!clientName || !clientPhone) {
        return NextResponse.json(
          { error: 'Client Name and Client Phone are required.' },
          { status: 400 }
        );
      }

      const travelersCount = parseInt(numTravelers, 10) || 1;

      const lead = await LeadModel.create({
        partnerId: null,
        clientName,
        clientPhone,
        travelDates,
        numTravelers: travelersCount,
        status: 'new'
      });

      return NextResponse.json({
        success: true,
        lead
      });
    } catch (error) {
      console.error('LeadController publicCreateLead error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async partnerCreateLead(request) {
    try {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in.' },
          { status: 401 }
        );
      }

      const { clientName, clientPhone, travelDates, numTravelers } = await request.json();

      if (!clientName || !clientPhone) {
        return NextResponse.json(
          { error: 'Client Name and Client Phone are required.' },
          { status: 400 }
        );
      }

      const travelersCount = parseInt(numTravelers, 10) || 1;

      const lead = await LeadModel.create({
        partnerId: session.partnerId,
        clientName,
        clientPhone,
        travelDates,
        numTravelers: travelersCount,
        status: 'new'
      });

      return NextResponse.json({
        success: true,
        lead
      });
    } catch (error) {
      console.error('LeadController partnerCreateLead error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async partnerGetLeads() {
    try {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in.' },
          { status: 401 }
        );
      }

      const leads = await LeadModel.getByPartnerId(session.partnerId);
      const partner = await PartnerModel.getById(session.partnerId);

      return NextResponse.json({
        success: true,
        leads,
        partner
      });
    } catch (error) {
      console.error('LeadController partnerGetLeads error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async guestAcceptItinerary(request) {
    try {
      const { itineraryId } = await request.json();

      if (!itineraryId) {
        return NextResponse.json(
          { error: 'Itinerary ID is required.' },
          { status: 400 }
        );
      }

      const itinerary = await ItineraryModel.getById(parseInt(itineraryId, 10));
      if (!itinerary) {
        return NextResponse.json(
          { error: 'Itinerary not found.' },
          { status: 404 }
        );
      }

      const leadId = itinerary.lead_id;

      // Unassign conflicting drivers
      await ItineraryModel.unassignConflictingDrivers(parseInt(itineraryId, 10), leadId);

      // Update lead status to converted
      const updatedLead = await LeadModel.update(leadId, { status: 'converted' });

      return NextResponse.json({
        success: true,
        message: 'Itinerary accepted and lead converted successfully.',
        lead: updatedLead
      });
    } catch (error) {
      console.error('LeadController guestAcceptItinerary error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
