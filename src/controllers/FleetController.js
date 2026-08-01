import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { DriverModel } from '@/models/Driver';
import { LeadModel } from '@/models/Lead';

export class FleetController {
  static async getFleetStatus() {
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

      // 1. Fetch all drivers/vehicles
      const drivers = await DriverModel.getAll();

      // 2. Fetch all active bookings/assigned driver days
      const bookingRows = await DriverModel.getDriverBookings();

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

      // 3. Process bookings and assign them to drivers
      const fleet = drivers.map(driver => {
        const driverBookings = [];

        bookingRows.forEach(row => {
          if (row.driver_id === driver.id) {
            try {
              const formattedDate = getIsoDateForDay(row.start_date, row.day_number);
              if (formattedDate) {
                driverBookings.push({
                  date: formattedDate,
                  lead_id: row.lead_id,
                  client_name: row.client_name,
                  client_phone: row.client_phone,
                  lead_status: row.lead_status,
                  itinerary_id: row.itinerary_id,
                  itinerary_title: row.itinerary_title,
                  itinerary_price: row.itinerary_price,
                  day_number: row.day_number,
                  start_date: row.start_date,
                  total_days: row.total_days
                });
              }
            } catch (e) {
              console.error('Error parsing booking date:', e);
            }
          }
        });

        // Determine today's status
        const today = new Date();
        const tYear = today.getFullYear();
        const tMonth = String(today.getMonth() + 1).padStart(2, '0');
        const tDay = String(today.getDate()).padStart(2, '0');
        const todayStr = `${tYear}-${tMonth}-${tDay}`;

        const todayBooking = driverBookings.find(b => b.date === todayStr);

        return {
          ...driver,
          bookings: driverBookings,
          todayBooking: todayBooking || null
        };
      });

      return NextResponse.json({
        success: true,
        fleet
      });
    } catch (error) {
      console.error('FleetController getFleetStatus error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
