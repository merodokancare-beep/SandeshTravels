import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { LeadModel } from '@/models/Lead';
import { ItineraryModel } from '@/models/Itinerary';

export class TrackingController {
  static async getTrackingData() {
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

      // Query converted and completed leads
      const leads = await LeadModel.getTrackingLeads();

      const journeys = [];

      for (const lead of leads) {
        if (!lead.itinerary_id) {
          journeys.push({
            lead,
            itinerary: null,
            days: []
          });
          continue;
        }

        const days = await ItineraryModel.getDaysWithDetails(lead.itinerary_id);

        journeys.push({
          lead,
          itinerary: {
            id: lead.itinerary_id,
            title: lead.itinerary_title,
            price: lead.itinerary_price,
            total_days: lead.total_days
          },
          days
        });
      }

      return NextResponse.json({
        success: true,
        journeys
      });
    } catch (error) {
      console.error('TrackingController getTrackingData error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
