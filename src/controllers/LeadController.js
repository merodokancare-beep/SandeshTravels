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
    let client;
    try {
      client = await getClient();
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { leadId, clientName, clientPhone, travelDates, numTravelers, adults, children, childAges, child_ages, status, startDate, action, attendedBy, attendedByName, vehicleCategory, vehicleCount, vehiclePreferenceDetails } = await request.json();

      if (!leadId) {
        return NextResponse.json(
          { error: 'Lead ID is required.' },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      const existingLead = await LeadModel.getById(leadId, client);
      if (!existingLead) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Lead not found.' },
          { status: 404 }
        );
      }

      // Handle direct pickup action
      if (action === 'pickup') {
        if (existingLead.status === 'completed' || existingLead.status === 'cancelled') {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { error: 'Completed or cancelled journeys cannot be picked up.' },
            { status: 400 }
          );
        }
        const pickedLead = await LeadModel.pickupLead(leadId, session.adminId, session.name);
        await client.query('COMMIT');
        return NextResponse.json({
          success: true,
          lead: pickedLead
        });
      }

      // Handle direct release action
      if (action === 'release') {
        const releasedLead = await LeadModel.releaseLead(leadId);
        await client.query('COMMIT');
        return NextResponse.json({
          success: true,
          lead: releasedLead
        });
      }

      // Enforce status transition constraints:
      // 1. Once Fleet Assigned or Completed, lead cannot revert back to New, Quoted, or Converted
      if (['new', 'quoted', 'converted'].includes(status) && (existingLead.status === 'assigned' || existingLead.status === 'completed')) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `Cannot change status back to "${status.toUpperCase()}". Fleet has already been assigned or journey is completed.` },
          { status: 400 }
        );
      }

      // 2. Prevent setting 'converted' status manually if advance is not verified
      if (status === 'converted' && existingLead.payment_status !== 'advance_paid') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Cannot confirm booking: 10% Advance Deposit must be verified first.' },
          { status: 400 }
        );
      }

      // Calculate auto-assigned staff for status transitions
      let finalAttendedBy = attendedBy !== undefined ? attendedBy : existingLead.attended_by;
      let finalAttendedByName = attendedByName !== undefined ? attendedByName : existingLead.attended_by_name;
      let finalAttendedAt = existingLead.attended_at;

      if (!finalAttendedBy && (status === 'converted' || status === 'assigned')) {
        finalAttendedBy = session.adminId;
        finalAttendedByName = session.name;
        finalAttendedAt = new Date();
      }

      const updatedLead = await LeadModel.update(leadId, {
        clientName,
        clientPhone,
        travelDates,
        numTravelers,
        adults,
        children,
        childAges,
        child_ages,
        status,
        startDate,
        vehicleCategory,
        vehicleCount,
        vehiclePreferenceDetails,
        attendedBy: finalAttendedBy,
        attendedByName: finalAttendedByName,
        attendedAt: finalAttendedAt
      }, client);

      // If status is converted or assigned, check for scheduling conflicts
      if (updatedLead.status === 'converted' || updatedLead.status === 'assigned') {
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
      if (client) {
        try { await client.query('ROLLBACK'); } catch (e) {}
      }
      console.error('LeadController adminUpdateLead error:', error);
      return NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      );
    } finally {
      if (client) client.release();
    }
  }

  static async adminCreateLead(request) {
    let client;
    try {
      client = await getClient();
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { clientName, clientPhone, travelDates, numTravelers, adults, children, childAges, child_ages, startDate, templateId, templateIds, partnerId, source, packageName, vehicleType, vehicleCategory = 'T', vehicleCount, vehiclePreferenceDetails, notes } = await request.json();

      if (!clientName || !clientPhone) {
        return NextResponse.json(
          { error: 'Client name and phone number are required.' },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      const parsedAdults = adults !== undefined ? (parseInt(adults, 10) || 1) : 1;
      const parsedChildren = children !== undefined ? (parseInt(children, 10) || 0) : 0;
      const guestsCount = numTravelers ? (parseInt(numTravelers, 10) || (parsedAdults + parsedChildren)) : (parsedAdults + parsedChildren);
      const targetTemplateIds = Array.isArray(templateIds) && templateIds.length > 0 
        ? templateIds 
        : (templateId ? [templateId] : []);

      const initialStatus = 'new'; // All new leads start as 'new' until daywise pricing is explicitly saved
      const parsedPartnerId = partnerId ? parseInt(partnerId, 10) : null;
      const determinedSource = source || (parsedPartnerId ? 'partner' : 'direct');

      // Default vehicle count is 1 unless explicitly specified
      const cat = (vehicleCategory || 'T').toUpperCase();
      const capacity = cat === 'J' ? 8 : (cat === 'Z' ? 6 : 4);
      const computedVehicleCount = vehicleCount ? parseInt(vehicleCount, 10) : 1;
      const autoDetails = vehiclePreferenceDetails || `${computedVehicleCount}x ${cat}-Series (${cat === 'J' ? 'Maxi SUV 8-Seater' : cat === 'Z' ? 'MUV/SUV 6-Seater' : 'Sedan/Hatchback 4-Seater'})`;

      const lead = await LeadModel.create({
        partnerId: parsedPartnerId,
        clientName,
        clientPhone,
        travelDates,
        numTravelers: guestsCount,
        adults: parsedAdults,
        children: parsedChildren,
        childAges: childAges || [],
        child_ages: child_ages || null,
        status: initialStatus,
        startDate: startDate || null,
        source: determinedSource,
        packageName,
        vehicleType: vehicleType || `${cat}-Series (${capacity}-Seater)`,
        vehicleCategory: cat,
        vehicleCount: computedVehicleCount,
        vehiclePreferenceDetails: autoDetails,
        notes,
        attendedBy: session.adminId,
        attendedByName: session.name,
        attendedAt: new Date()
      }, client);

      // Generate itinerary blueprint if templates selected (supports multi-region)
      if (targetTemplateIds.length > 0) {
        let combinedDays = [];
        let regionNames = [];

        for (const tId of targetTemplateIds) {
          const template = await TemplateModel.getById(parseInt(tId, 10), client);
          if (template) {
            if (!regionNames.includes(template.region)) {
              regionNames.push(template.region);
            }

            let templateDays = [];
            if (typeof template.days === 'string') {
              try {
                templateDays = JSON.parse(template.days);
              } catch (parseErr) {
                templateDays = [];
              }
            } else if (Array.isArray(template.days)) {
              templateDays = template.days;
            }

            if (Array.isArray(templateDays)) {
              templateDays.forEach(d => {
                combinedDays.push({
                  dayNumber: combinedDays.length + 1,
                  hotelId: null,
                  driverId: null,
                  description: d?.description || '',
                  activities: d?.activities || '',
                  dayPrice: 0.00
                });
              });
            }
          }
        }

        if (combinedDays.length > 0) {
          const regionsStr = regionNames.join(' & ');

          const itinerary = await ItineraryModel.create({
            leadId: lead.id,
            title: `${regionsStr} Multi-Region Tour for ${clientName}`,
            price: 0.00,
            totalDays: combinedDays.length,
            status: 'draft'
          }, client);

          for (const day of combinedDays) {
            await ItineraryModel.createDay({
              itineraryId: itinerary.id,
              dayNumber: day.dayNumber,
              hotelId: null,
              driverId: null,
              description: day.description || '',
              activities: day.activities || '',
              dayPrice: 0.00
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
      if (client) {
        try { await client.query('ROLLBACK'); } catch (e) {}
      }
      console.error('LeadController adminCreateLead error:', error);
      return NextResponse.json(
        { error: error.message || 'Internal server error during booking creation.' },
        { status: 500 }
      );
    } finally {
      if (client) client.release();
    }
  }

  static async publicCreateLead(request) {
    try {
      const { clientName, clientPhone, travelDates, numTravelers, adults, children, childAges, child_ages, startDate, packageName, vehicleType, vehicleCategory = 'T', vehicleCount, notes } = await request.json();

      if (!clientName || !clientPhone) {
        return NextResponse.json(
          { error: 'Client Name and Client Phone are required.' },
          { status: 400 }
        );
      }

      const parsedAdults = adults !== undefined ? (parseInt(adults, 10) || 1) : 1;
      const parsedChildren = children !== undefined ? (parseInt(children, 10) || 0) : 0;
      const travelersCount = numTravelers ? (parseInt(numTravelers, 10) || (parsedAdults + parsedChildren)) : (parsedAdults + parsedChildren);
      const cat = (vehicleCategory || 'T').toUpperCase();
      const capacity = cat === 'J' ? 8 : (cat === 'Z' ? 6 : 4);
      const computedVehicleCount = vehicleCount ? parseInt(vehicleCount, 10) : 1;
      const autoDetails = `${computedVehicleCount}x ${cat}-Series (${cat === 'J' ? 'Maxi SUV 8-Seater' : cat === 'Z' ? 'MUV/SUV 6-Seater' : 'Sedan/Hatchback 4-Seater'})`;

      const lead = await LeadModel.create({
        partnerId: null,
        clientName,
        clientPhone,
        travelDates,
        numTravelers: travelersCount,
        adults: parsedAdults,
        children: parsedChildren,
        childAges: childAges || [],
        child_ages: child_ages || null,
        status: 'new',
        startDate: startDate || null,
        source: 'website',
        packageName,
        vehicleType: vehicleType || `${cat}-Series (${capacity}-Seater)`,
        vehicleCategory: cat,
        vehicleCount: computedVehicleCount,
        vehiclePreferenceDetails: autoDetails,
        notes
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

      const { clientName, clientPhone, travelDates, numTravelers, adults, children, childAges, child_ages, startDate, vehicleCategory = 'T', vehicleCount, notes } = await request.json();

      if (!clientName || !clientPhone) {
        return NextResponse.json(
          { error: 'Client Name and Client Phone are required.' },
          { status: 400 }
        );
      }

      const parsedAdults = adults !== undefined ? (parseInt(adults, 10) || 1) : 1;
      const parsedChildren = children !== undefined ? (parseInt(children, 10) || 0) : 0;
      const travelersCount = numTravelers ? (parseInt(numTravelers, 10) || (parsedAdults + parsedChildren)) : (parsedAdults + parsedChildren);
      const cat = (vehicleCategory || 'T').toUpperCase();
      const capacity = cat === 'J' ? 8 : (cat === 'Z' ? 6 : 4);
      const computedVehicleCount = vehicleCount ? parseInt(vehicleCount, 10) : 1;
      const autoDetails = `${computedVehicleCount}x ${cat}-Series (${cat === 'J' ? 'Maxi SUV 8-Seater' : cat === 'Z' ? 'MUV/SUV 6-Seater' : 'Sedan/Hatchback 4-Seater'})`;

      const lead = await LeadModel.create({
        partnerId: session.partnerId,
        clientName,
        clientPhone,
        travelDates,
        numTravelers: travelersCount,
        adults: parsedAdults,
        children: parsedChildren,
        childAges: childAges || [],
        child_ages: child_ages || null,
        status: 'new',
        startDate: startDate || null,
        source: 'partner',
        vehicleType: `${cat}-Series (${capacity}-Seater)`,
        vehicleCategory: cat,
        vehicleCount: computedVehicleCount,
        vehiclePreferenceDetails: autoDetails,
        notes
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

  static async guestSubmitAdvance(request) {
    try {
      const { itineraryId, transactionRef, amount, paymentMethod = 'upi_qr' } = await request.json();

      if (!itineraryId) {
        return NextResponse.json(
          { error: 'Itinerary ID is required.' },
          { status: 400 }
        );
      }

      if (!transactionRef || !transactionRef.trim()) {
        return NextResponse.json(
          { error: 'Transaction Reference / UTR Number is required to confirm advance payment.' },
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

      const packagePrice = parseFloat(itinerary.price) || 0;
      const minAdvance = Math.round(packagePrice * 0.10); // 10% minimum
      const paidAmount = amount ? parseFloat(amount) : minAdvance;

      const leadId = itinerary.lead_id;

      // Update lead with payment details & set status to pending_verification
      const updatedLead = await LeadModel.update(leadId, {
        advanceAmount: minAdvance,
        advancePaid: paidAmount,
        transactionRef: transactionRef.trim(),
        paymentMethod,
        paymentStatus: 'pending_verification',
        advanceSubmittedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        message: 'Advance payment details submitted successfully! Our team is verifying your payment to confirm your booking.',
        lead: updatedLead,
        minAdvance,
        paidAmount
      });
    } catch (error) {
      console.error('LeadController guestSubmitAdvance error:', error);
      return NextResponse.json(
        { error: 'Internal server error while submitting advance payment.' },
        { status: 500 }
      );
    }
  }

  static async adminVerifyAdvance(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { leadId, verifiedAmount } = await request.json();

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
      if (itinerary) {
        // Unassign conflicting drivers
        await ItineraryModel.unassignConflictingDrivers(itinerary.id, leadId);
      }

      // Mark advance verified and lead converted
      const updatedLead = await LeadModel.verifyAdvancePayment(leadId, session.userId || session.adminId, {
        verifiedAmount: verifiedAmount ? parseFloat(verifiedAmount) : null
      });

      // Auto-assign lead to verifying admin if currently unassigned
      if (!lead.attended_by && (session.adminId || session.userId)) {
        await LeadModel.pickupLead(leadId, session.adminId || session.userId, session.name || 'Admin');
      }

      return NextResponse.json({
        success: true,
        message: 'Advance payment verified! Booking is now confirmed & lead is converted.',
        lead: updatedLead
      });
    } catch (error) {
      console.error('LeadController adminVerifyAdvance error:', error);
      return NextResponse.json(
        { error: 'Internal server error while verifying advance payment.' },
        { status: 500 }
      );
    }
  }

  static async adminRecordManualAdvance(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const { leadId, amount, paymentMethod = 'cash', transactionRef = 'MANUAL' } = await request.json();

      if (!leadId || !amount) {
        return NextResponse.json(
          { error: 'Lead ID and payment amount are required.' },
          { status: 400 }
        );
      }

      const existingLead = await LeadModel.getById(leadId);

      const itinerary = await ItineraryModel.getByLeadId(leadId);
      if (itinerary) {
        await ItineraryModel.unassignConflictingDrivers(itinerary.id, leadId);
      }

      const updatedLead = await LeadModel.update(leadId, {
        status: 'converted',
        advancePaid: parseFloat(amount),
        paymentStatus: 'advance_paid',
        paymentMethod,
        transactionRef,
        advanceVerifiedAt: new Date(),
        advanceVerifiedBy: session.userId || session.adminId,
        ...(existingLead && !existingLead.attended_by ? {
          attendedBy: session.adminId || session.userId,
          attendedByName: session.name || 'Admin',
          attendedAt: new Date()
        } : {})
      });

      return NextResponse.json({
        success: true,
        message: 'Advance payment recorded and lead converted successfully.',
        lead: updatedLead
      });
    } catch (error) {
      console.error('LeadController adminRecordManualAdvance error:', error);
      return NextResponse.json(
        { error: 'Internal server error while recording advance payment.' },
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

  static async adminDeleteLead(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      // Only Admin or Super Admin can delete leads
      if (session.role !== 'admin' && session.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Forbidden: Only Administrator or Super Admin can delete leads.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(request.url);
      let leadId = searchParams.get('id') || searchParams.get('leadId');

      if (!leadId) {
        try {
          const body = await request.json();
          leadId = body.leadId || body.id;
        } catch (e) {
          // ignore
        }
      }

      if (!leadId) {
        return NextResponse.json(
          { error: 'Lead ID is required.' },
          { status: 400 }
        );
      }

      const leadIdNum = parseInt(leadId, 10);
      if (isNaN(leadIdNum)) {
        return NextResponse.json(
          { error: 'Invalid Lead ID.' },
          { status: 400 }
        );
      }

      const existingLead = await LeadModel.getById(leadIdNum);
      if (!existingLead) {
        return NextResponse.json(
          { error: 'Lead not found.' },
          { status: 404 }
        );
      }

      // Restrict deletion strictly to 'new' and 'quoted' leads
      if (existingLead.status !== 'new' && existingLead.status !== 'quoted') {
        return NextResponse.json(
          { error: `Cannot delete lead. Only leads with status "New" or "Quoted" can be deleted. Current status: "${existingLead.status}".` },
          { status: 400 }
        );
      }

      await LeadModel.delete(leadIdNum);

      return NextResponse.json({
        success: true,
        message: 'Lead inquiry and associated records deleted successfully.'
      });
    } catch (error) {
      console.error('LeadController adminDeleteLead error:', error);
      return NextResponse.json(
        { error: 'Internal server error while deleting lead' },
        { status: 500 }
      );
    }
  }
}


