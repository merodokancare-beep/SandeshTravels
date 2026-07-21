import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { ItineraryModel } from '@/models/Itinerary';
import { LeadModel } from '@/models/Lead';
import { HotelModel } from '@/models/Hotel';

export class ItineraryController {
  static async getItinerary(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      const leadId = searchParams.get('leadId');

      if (!leadId) {
        return NextResponse.json(
          { error: 'Lead ID is required.' },
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

      const itinerary = await ItineraryModel.getByLeadId(parseInt(leadId, 10));

      if (!itinerary) {
        return NextResponse.json({
          success: true,
          lead,
          itinerary: null,
          days: []
        });
      }

      const days = await ItineraryModel.getDays(itinerary.id);

      return NextResponse.json({
        success: true,
        lead,
        itinerary,
        days
      });
    } catch (error) {
      console.error('ItineraryController getItinerary error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async saveItinerary(request) {
    const client = await getClient();
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { leadId, title, price, totalDays, days, startDate } = await request.json();

      if (!leadId || !title || !totalDays) {
        return NextResponse.json(
          { error: 'Lead ID, title, and total days are required.' },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      // Update start_date in leads table
      await LeadModel.update(parseInt(leadId, 10), { startDate }, client);

      // Clean price string by stripping currency symbols, spaces, and commas
      const cleanPrice = String(price || '').replace(/[^0-9.]/g, '');
      const priceNum = parseFloat(cleanPrice) || 0.00;
      const daysCount = parseInt(totalDays, 10) || 1;

      // Check if itinerary exists for this lead
      const existing = await ItineraryModel.getByLeadId(parseInt(leadId, 10), client);
      let itineraryId;

      if (existing) {
        itineraryId = existing.id;
        await ItineraryModel.update(itineraryId, { title, price: priceNum, totalDays: daysCount }, client);
      } else {
        const newItin = await ItineraryModel.create({
          leadId: parseInt(leadId, 10),
          title,
          price: priceNum,
          totalDays: daysCount,
          status: 'draft'
        }, client);
        itineraryId = newItin.id;

        // Update lead status to 'quoted' if it's currently 'new'
        const lead = await LeadModel.getById(parseInt(leadId, 10), client);
        if (lead && lead.status === 'new') {
          await LeadModel.update(lead.id, { status: 'quoted' }, client);
        }
      }

      // Delete all existing days for this itinerary
      await ItineraryModel.deleteDays(itineraryId, client);

      // Insert new days details
      for (const d of days) {
        const hotelId = d.hotelId ? parseInt(d.hotelId, 10) : null;
        const driverId = d.driverId ? parseInt(d.driverId, 10) : null;

        await ItineraryModel.createDay({
          itineraryId,
          dayNumber: parseInt(d.dayNumber, 10),
          hotelId,
          driverId,
          description: d.description || null,
          activities: d.activities || null
        }, client);

        // Manage active stays/stages: if hotel check-in is assigned, create active stay tracker
        if (hotelId) {
          const stayExists = await HotelModel.checkActiveStayExists(parseInt(leadId, 10), hotelId, client);
          if (!stayExists) {
            await HotelModel.createActiveStay(parseInt(leadId, 10), hotelId, client);
          }
        }
      }

      // Verify driver scheduling conflicts if this is a confirmed journey
      const conflicts = await ItineraryModel.getConflictsByLeadId(parseInt(leadId, 10), client);
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
            error: `Scheduling Conflict: Driver "${firstConflict.driver_name}" is already assigned to confirmed guest "${firstConflict.other_client_name}" on ${dateStr}. Please assign another driver.` 
          },
          { status: 400 }
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        itineraryId,
        message: 'Itinerary saved successfully.'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('ItineraryController saveItinerary error:', error);
      return NextResponse.json(
        { error: 'Internal server error during database transaction.' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  }

  static async assignFleet(request) {
    const client = await getClient();
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { itineraryId, assignments } = await request.json();

      if (!itineraryId || !assignments || !Array.isArray(assignments)) {
        return NextResponse.json(
          { error: 'Itinerary ID and assignments array are required.' },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      // Update each day's driver_id
      for (const item of assignments) {
        await ItineraryModel.updateDayDriver(
          parseInt(itineraryId, 10),
          parseInt(item.dayNumber, 10),
          item.driverId ? parseInt(item.driverId, 10) : null,
          client
        );
      }

      // Check for double booking conflicts on the same date for confirmed journeys
      const conflicts = await ItineraryModel.getConflictsByItineraryId(parseInt(itineraryId, 10), client);
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
            error: `Scheduling Conflict: Driver "${firstConflict.driver_name}" already has a confirmed booking with guest "${firstConflict.other_client_name}" on ${dateStr}. Please assign another driver.` 
          },
          { status: 400 }
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Fleet assigned successfully.'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('ItineraryController assignFleet error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  }
}
