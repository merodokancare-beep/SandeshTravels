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

      const { leadId, title, price, totalDays, days, startDate, vehicleCategory, vehicleCount } = await request.json();

      if (!leadId || !title || !totalDays) {
        return NextResponse.json(
          { error: 'Lead ID, title, and total days are required.' },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      // Update start_date, vehicleCategory, and vehicleCount in leads table
      const leadUpdates = { startDate };
      if (vehicleCategory) {
        const vCat = String(vehicleCategory).toUpperCase();
        leadUpdates.vehicleCategory = vCat;
        leadUpdates.vehicleType = vCat === 'J' ? 'J-Series (Maxi Cab 8-Seater)' : vCat === 'Z' ? 'Z-Series (MUV/SUV 6-Seater)' : 'T-Series (Hatchback/Sedan 4-Seater)';
      }
      if (vehicleCount !== undefined && vehicleCount !== null) {
        leadUpdates.vehicleCount = Math.max(1, parseInt(vehicleCount, 10) || 1);
      }
      await LeadModel.update(parseInt(leadId, 10), leadUpdates, client);

      // Validate that EVERY day has a positive price
      const missingDays = Array.isArray(days)
        ? days.filter(d => {
            const amt = parseFloat(d.dayPrice || d.day_price);
            return isNaN(amt) || amt <= 0;
          }).map(d => `Day ${d.dayNumber}`)
        : [];

      if (missingDays.length > 0) {
        return NextResponse.json(
          { error: `Validation Error: Every day must have a valid price greater than ₹0. Missing amount on: ${missingDays.join(', ')}.` },
          { status: 400 }
        );
      }

      // Compute total price from daywise sum
      const daywiseSum = Array.isArray(days)
        ? days.reduce((acc, d) => acc + (parseFloat(d.dayPrice || d.day_price) || 0), 0)
        : 0;
      const finalPrice = daywiseSum > 0 ? daywiseSum : (parseFloat(price) || 0);

      const daysCount = parseInt(totalDays, 10) || 1;
      const minAdvance = Math.round(finalPrice * 0.10); // 10% calculated advance deposit

      // Check if itinerary exists for this lead
      const existing = await ItineraryModel.getByLeadId(parseInt(leadId, 10), client);
      let itineraryId;

      if (existing) {
        itineraryId = existing.id;
        await ItineraryModel.update(itineraryId, { title, price: finalPrice, totalDays: daysCount }, client);
      } else {
        const newItin = await ItineraryModel.create({
          leadId: parseInt(leadId, 10),
          title,
          price: finalPrice,
          totalDays: daysCount,
          status: 'draft'
        }, client);
        itineraryId = newItin.id;
      }

      // Update lead status to 'quoted' if it's currently 'new' and a valid price (> 0) has been configured
      const lead = await LeadModel.getById(parseInt(leadId, 10), client);
      if (lead && lead.status === 'new' && finalPrice > 0) {
        await LeadModel.update(lead.id, { status: 'quoted' }, client);
      }

      // Sync 10% advance amount to lead record
      await LeadModel.update(parseInt(leadId, 10), { advanceAmount: minAdvance }, client);

      // Auto-assign lead to current admin user if it is currently open/unassigned
      const currentLead = await LeadModel.getById(parseInt(leadId, 10), client);
      if (currentLead && !currentLead.attended_by && session?.adminId) {
        await LeadModel.update(currentLead.id, {
          attendedBy: session.adminId,
          attendedByName: session.name,
          attendedAt: new Date()
        }, client);
      }

      const leadObj = await LeadModel.getById(parseInt(leadId, 10), client);
      const isConvertedLead = leadObj && (leadObj.status === 'converted' || leadObj.status === 'assigned' || leadObj.status === 'completed');

      // Fetch existing days to preserve driver_id assignments made in Fleet Assignment tab
      const existingDays = await ItineraryModel.getDays(itineraryId, client);
      const driverMap = {};
      existingDays.forEach(ed => {
        if (ed.driver_id) {
          driverMap[ed.dayNumber || ed.day_number] = ed.driver_id;
        }
      });

      // Delete all existing days for this itinerary
      await ItineraryModel.deleteDays(itineraryId, client);

      // Insert new days details with dayPrice while preserving any existing driver_id assignments ONLY IF lead is converted
      for (const d of days) {
        const hotelId = d.hotelId ? parseInt(d.hotelId, 10) : null;
        const driverId = isConvertedLead ? (d.driverId ? parseInt(d.driverId, 10) : (driverMap[d.dayNumber] || null)) : null;
        const dayAmount = parseFloat(d.dayPrice || d.day_price) || 0.00;

        await ItineraryModel.createDay({
          itineraryId,
          dayNumber: parseInt(d.dayNumber, 10),
          hotelId,
          driverId,
          description: d.description || null,
          activities: d.activities || null,
          dayPrice: dayAmount
        }, client);

        // Manage active stays/stages: if hotel check-in is assigned, create active stay tracker
        if (hotelId) {
          const stayExists = await HotelModel.checkActiveStayExists(parseInt(leadId, 10), hotelId, client);
          if (!stayExists) {
            await HotelModel.createActiveStay(parseInt(leadId, 10), hotelId, client);
          }
        }
      }

      // Auto-update lead status to 'assigned' if drivers are assigned to days on converted lead
      if (isConvertedLead) {
        const hasAnyDriver = days.some(d => d.driverId) || Object.values(driverMap).some(Boolean);
        if (hasAnyDriver && leadObj.status === 'converted') {
          await LeadModel.update(leadObj.id, { status: 'assigned' }, client);
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

      const { itineraryId, assignments, startDate } = await request.json();

      if (!itineraryId || !assignments || !Array.isArray(assignments)) {
        return NextResponse.json(
          { error: 'Itinerary ID and assignments array are required.' },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      // Update start_date in leads if provided
      if (startDate) {
        const itinerary = await ItineraryModel.getById(parseInt(itineraryId, 10), client);
        if (itinerary) {
          const lead = await LeadModel.getById(itinerary.lead_id, client);
          if (lead) {
            // Only enforce creation limit if lead was not previously converted/assigned and has no start_date set
            if (!lead.start_date && lead.status !== 'converted' && lead.status !== 'assigned') {
              const convertedLimit = lead.converted_at || lead.created_at;
              if (convertedLimit) {
                const limitDate = new Date(convertedLimit);
                limitDate.setHours(0, 0, 0, 0);

                const selectedDate = new Date(startDate);
                selectedDate.setHours(0, 0, 0, 0);

                if (selectedDate < limitDate) {
                  const limitStr = limitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  await client.query('ROLLBACK');
                  return NextResponse.json(
                    { error: `Validation Error: Start Date cannot be earlier than the converted/created date (${limitStr}).` },
                    { status: 400 }
                  );
                }
              }
            }
          }
          await LeadModel.update(itinerary.lead_id, { startDate }, client);
        }
      }

      // Update each day's driver_id
      for (const item of assignments) {
        await ItineraryModel.updateDayDriver(
          parseInt(itineraryId, 10),
          parseInt(item.dayNumber, 10),
          item.driverId ? parseInt(item.driverId, 10) : null,
          client
        );
      }

      // Auto-update lead status to 'assigned' if drivers are assigned
      const hasAnyDriver = assignments.some(a => a.driverId);
      if (hasAnyDriver) {
        const itinerary = await ItineraryModel.getById(parseInt(itineraryId, 10), client);
        if (itinerary) {
          const lead = await LeadModel.getById(itinerary.lead_id, client);
          if (lead && (lead.status === 'new' || lead.status === 'quoted' || lead.status === 'converted')) {
            await LeadModel.update(lead.id, { status: 'assigned' }, client);
          }
        }
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

  static async updateDriverSnapshot(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized. Please log in as admin.' }, { status: 401 });
      }

      const { itineraryId, driverName, driverPhone, vehicleNumber, vehicleModel } = await request.json();

      if (!itineraryId || !driverName) {
        return NextResponse.json({ error: 'Itinerary ID and Driver Name are required.' }, { status: 400 });
      }

      const { query: dbQuery } = await import('@/lib/db');
      await dbQuery(
        `UPDATE itinerary_days 
         SET driver_name_snapshot = $1,
             driver_phone_snapshot = $2,
             vehicle_number_snapshot = $3,
             vehicle_model_snapshot = $4
         WHERE itinerary_id = $5`,
        [driverName, driverPhone || null, vehicleNumber || null, vehicleModel || null, parseInt(itineraryId, 10)]
      );

      return NextResponse.json({
        success: true,
        message: 'Historical driver details updated successfully.'
      });
    } catch (error) {
      console.error('ItineraryController updateDriverSnapshot error:', error);
      return NextResponse.json(
        { error: error.message || 'Internal server error updating driver history.' },
        { status: 500 }
      );
    }
  }
}
