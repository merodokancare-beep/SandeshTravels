import { query } from '@/lib/db';

export class DriverModel {
  static async getAll() {
    const res = await query('SELECT * FROM drivers_registry ORDER BY driver_name ASC');
    return res.rows;
  }

  static async getById(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q('SELECT * FROM drivers_registry WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async create({ driverName, driverPhone, vehicleNumber, vehicleModel, vehicleOwner }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `INSERT INTO drivers_registry (driver_name, driver_phone, vehicle_number, vehicle_model, vehicle_owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [driverName, driverPhone, vehicleNumber || null, vehicleModel || null, vehicleOwner || null]
    );
    return res.rows[0];
  }

  static async getByVehicleNumber(vehicleNumber, client = null) {
    if (!vehicleNumber) return null;
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `SELECT * FROM drivers_registry 
       WHERE UPPER(REPLACE(vehicle_number, ' ', '')) = UPPER(REPLACE($1, ' ', ''))`,
      [vehicleNumber]
    );
    return res.rows[0] || null;
  }

  static async update(id, { driverName, driverPhone, vehicleNumber, vehicleModel, vehicleOwner }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `UPDATE drivers_registry 
       SET driver_name = $1, driver_phone = $2, vehicle_number = $3, vehicle_model = $4, vehicle_owner = $5
       WHERE id = $6
       RETURNING *`,
      [driverName, driverPhone, vehicleNumber || null, vehicleModel || null, vehicleOwner || null, id]
    );
    return res.rows[0] || null;
  }

  static async delete(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    await q('DELETE FROM drivers_registry WHERE id = $1', [id]);
    return true;
  }

  static async getDriverBookings() {
    const res = await query(`
      SELECT 
        id_day.driver_id, 
        id_day.day_number, 
        l.id as lead_id, 
        l.client_name, 
        l.client_phone, 
        l.start_date, 
        l.status as lead_status,
        i.id as itinerary_id, 
        i.title as itinerary_title, 
        i.price as itinerary_price,
        i.total_days
      FROM itinerary_days id_day
      JOIN itineraries i ON id_day.itinerary_id = i.id
      JOIN leads l ON i.lead_id = l.id
      WHERE id_day.driver_id IS NOT NULL 
        AND l.status IN ('new', 'quoted', 'converted', 'assigned')
        AND l.start_date IS NOT NULL
    `);
    return res.rows;
  }
}
