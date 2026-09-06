import { query } from '@/lib/db';

export class LeadModel {
  static async getAll() {
    const res = await query(
      `SELECT l.*, 
              i.id as itinerary_id, 
              i.title as itinerary_title, 
              i.price as itinerary_price, 
              i.total_days,
              p.hotel_name as partner_name, 
              p.commission_rate
       FROM leads l
       LEFT JOIN itineraries i ON l.id = i.lead_id
       LEFT JOIN partners p ON l.partner_id = p.id
       ORDER BY l.created_at DESC`
    );
    return res.rows;
  }

  static async getById(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const res = await q(
      `SELECT l.*, 
              p.hotel_name as partner_name, 
              p.commission_rate
       FROM leads l
       LEFT JOIN partners p ON l.partner_id = p.id
       WHERE l.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async getByPartnerId(partnerId) {
    const res = await query(
      `SELECT * FROM leads 
       WHERE partner_id = $1 
       ORDER BY created_at DESC`,
      [partnerId]
    );
    return res.rows;
  }

  static async create({ partnerId, clientName, clientPhone, travelDates, numTravelers, status = 'new', startDate = null, source = null, packageName = null, vehicleType = null, vehicleCategory = 'T', vehicleCount = 1, vehiclePreferenceDetails = null, notes = null, attendedBy = null, attendedByName = null, attendedAt = null, advanceAmount = 0, advancePaid = 0, paymentStatus = 'unpaid', paymentMethod = null, transactionRef = null }, client = null) {
    const q = client ? client.query.bind(client) : query;
    const determinedSource = source || (partnerId ? 'partner' : 'direct');
    const finalAttendedAt = attendedBy && !attendedAt ? new Date() : attendedAt;
    const res = await q(
      `INSERT INTO leads (partner_id, client_name, client_phone, travel_dates, num_travelers, status, start_date, source, package_name, vehicle_type, vehicle_category, vehicle_count, vehicle_preference_details, notes, attended_by, attended_by_name, attended_at, advance_amount, advance_paid, payment_status, payment_method, transaction_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [partnerId, clientName, clientPhone, travelDates || null, numTravelers, status, startDate, determinedSource, packageName, vehicleType, vehicleCategory || 'T', parseInt(vehicleCount, 10) || 1, vehiclePreferenceDetails || null, notes, attendedBy, attendedByName, finalAttendedAt, advanceAmount, advancePaid, paymentStatus, paymentMethod, transactionRef]
    );
    return res.rows[0];
  }

  static async update(id, fields, client = null) {
    const q = client ? client.query.bind(client) : query;
    const updates = [];
    const values = [];
    let idx = 1;

    const { clientName, clientPhone, travelDates, numTravelers, status, startDate, source, packageName, vehicleType, vehicleCategory, vehicleCount, vehiclePreferenceDetails, notes, attendedBy, attendedByName, attendedAt, advanceAmount, advancePaid, paymentStatus, paymentMethod, transactionRef, advanceSubmittedAt, advanceVerifiedAt, advanceVerifiedBy } = fields;

    if (clientName !== undefined) {
      updates.push(`client_name = $${idx++}`);
      values.push(clientName);
    }
    if (clientPhone !== undefined) {
      updates.push(`client_phone = $${idx++}`);
      values.push(clientPhone);
    }
    if (travelDates !== undefined) {
      updates.push(`travel_dates = $${idx++}`);
      values.push(travelDates);
    }
    if (numTravelers !== undefined) {
      updates.push(`num_travelers = $${idx++}`);
      values.push(numTravelers);
    }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
      if (status === 'converted') {
        updates.push(`converted_at = CURRENT_DATE`);
      }
    }
    if (startDate !== undefined) {
      updates.push(`start_date = $${idx++}`);
      values.push(startDate || null);
    }
    if (source !== undefined) {
      updates.push(`source = $${idx++}`);
      values.push(source);
    }
    if (packageName !== undefined) {
      updates.push(`package_name = $${idx++}`);
      values.push(packageName);
    }
    if (vehicleType !== undefined) {
      updates.push(`vehicle_type = $${idx++}`);
      values.push(vehicleType);
    }
    if (vehicleCategory !== undefined) {
      updates.push(`vehicle_category = $${idx++}`);
      values.push(vehicleCategory);
    }
    if (vehicleCount !== undefined) {
      updates.push(`vehicle_count = $${idx++}`);
      values.push(parseInt(vehicleCount, 10) || 1);
    }
    if (vehiclePreferenceDetails !== undefined) {
      updates.push(`vehicle_preference_details = $${idx++}`);
      values.push(vehiclePreferenceDetails);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      values.push(notes);
    }
    if (attendedBy !== undefined) {
      updates.push(`attended_by = $${idx++}`);
      values.push(attendedBy);
    }
    if (attendedByName !== undefined) {
      updates.push(`attended_by_name = $${idx++}`);
      values.push(attendedByName);
    }
    if (attendedAt !== undefined) {
      updates.push(`attended_at = $${idx++}`);
      values.push(attendedAt);
    }
    if (advanceAmount !== undefined) {
      updates.push(`advance_amount = $${idx++}`);
      values.push(advanceAmount);
    }
    if (advancePaid !== undefined) {
      updates.push(`advance_paid = $${idx++}`);
      values.push(advancePaid);
    }
    if (paymentStatus !== undefined) {
      updates.push(`payment_status = $${idx++}`);
      values.push(paymentStatus);
    }
    if (paymentMethod !== undefined) {
      updates.push(`payment_method = $${idx++}`);
      values.push(paymentMethod);
    }
    if (transactionRef !== undefined) {
      updates.push(`transaction_ref = $${idx++}`);
      values.push(transactionRef);
    }
    if (advanceSubmittedAt !== undefined) {
      updates.push(`advance_submitted_at = $${idx++}`);
      values.push(advanceSubmittedAt);
    }
    if (advanceVerifiedAt !== undefined) {
      updates.push(`advance_verified_at = $${idx++}`);
      values.push(advanceVerifiedAt);
    }
    if (advanceVerifiedBy !== undefined) {
      updates.push(`advance_verified_by = $${idx++}`);
      values.push(advanceVerifiedBy);
    }

    if (updates.length === 0) {
      throw new Error('No fields provided to update lead');
    }

    values.push(id);
    const res = await q(
      `UPDATE leads 
       SET ${updates.join(', ')} 
       WHERE id = $${idx} 
       RETURNING *`,
      values
    );

    return res.rows[0] || null;
  }

  static async submitAdvancePayment(leadId, { amount, transactionRef, paymentMethod = 'upi_qr' }) {
    const res = await query(
      `UPDATE leads
       SET advance_paid = $1,
           transaction_ref = $2,
           payment_method = $3,
           payment_status = 'pending_verification',
           advance_submitted_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [amount, transactionRef, paymentMethod, leadId]
    );
    return res.rows[0] || null;
  }

  static async verifyAdvancePayment(leadId, adminId, { verifiedAmount = null } = {}) {
    const res = await query(
      `UPDATE leads
       SET status = 'converted',
           payment_status = 'advance_paid',
           converted_at = CURRENT_DATE,
           advance_verified_at = CURRENT_TIMESTAMP,
           advance_verified_by = $1,
           advance_paid = COALESCE($2, advance_paid)
       WHERE id = $3
       RETURNING *`,
      [adminId, verifiedAmount, leadId]
    );
    return res.rows[0] || null;
  }

  static async pickupLead(leadId, adminId, adminName) {
    const res = await query(
      `UPDATE leads
       SET attended_by = $1,
           attended_by_name = $2,
           attended_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [adminId, adminName, leadId]
    );
    return res.rows[0] || null;
  }

  static async releaseLead(leadId) {
    const res = await query(
      `UPDATE leads
       SET attended_by = NULL,
           attended_by_name = NULL,
           attended_at = NULL
       WHERE id = $1
       RETURNING *`,
      [leadId]
    );
    return res.rows[0] || null;
  }

  static async getConflicts(leadId, client = null) {
    const q = client ? client.query.bind(client) : query;
    const conflictRes = await q(`
      SELECT 
        d.driver_name,
        (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date as target_date,
        l_other.client_name as other_client_name
      FROM itinerary_days id_day
      JOIN itineraries i ON id_day.itinerary_id = i.id
      JOIN leads l_target ON i.lead_id = l_target.id
      JOIN drivers_registry d ON id_day.driver_id = d.id
      JOIN itinerary_days id_day_other ON id_day.driver_id = id_day_other.driver_id
      JOIN itineraries i_other ON id_day_other.itinerary_id = i_other.id
      JOIN leads l_other ON i_other.lead_id = l_other.id
      WHERE l_target.id = $1
        AND l_other.id != $1
        AND l_other.status IN ('converted', 'assigned')
        AND l_target.start_date IS NOT NULL
        AND l_other.start_date IS NOT NULL
        AND (l_target.start_date + (id_day.day_number - 1) * INTERVAL '1 day')::date = 
            (l_other.start_date + (id_day_other.day_number - 1) * INTERVAL '1 day')::date
    `, [leadId]);
    return conflictRes.rows;
  }

  static async autoCompleteEndedJourneys() {
    const activeRes = await query(`
      SELECT l.id as lead_id, l.start_date, i.total_days, i.id as itinerary_id
      FROM leads l
      JOIN itineraries i ON l.id = i.lead_id
      WHERE l.status IN ('converted', 'assigned') AND l.start_date IS NOT NULL
    `);

    const parseLocalDate = (dateInput) => {
      if (!dateInput) return null;
      if (dateInput instanceof Date) {
        return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
      }
      const parts = String(dateInput).substring(0, 10).split('-');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };

    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (const row of activeRes.rows) {
      const driverCheck = await query(
        `SELECT COUNT(*) as count FROM itinerary_days WHERE itinerary_id = $1 AND driver_id IS NOT NULL`,
        [row.itinerary_id]
      );
      const hasDriver = parseInt(driverCheck.rows[0].count, 10) > 0;
      if (!hasDriver) continue;

      const localStart = parseLocalDate(row.start_date);
      if (!localStart) continue;

      const totalDays = parseInt(row.total_days, 10) || 1;
      const localEnd = new Date(localStart);
      localEnd.setDate(localStart.getDate() + totalDays - 1);

      if (todayZero > localEnd) {
        await query(
          `UPDATE leads 
           SET status = 'completed' 
           WHERE id = $1`,
          [row.lead_id]
        );
        console.log(`[Auto-Complete] Lead ${row.lead_id} marked COMPLETED. Journey ended on ${localEnd.toLocaleDateString()}`);
      }
    }
  }

  static async getTrackingLeads() {
    const res = await query(`
      SELECT l.*, i.id as itinerary_id, i.title as itinerary_title, i.price as itinerary_price, i.total_days,
             p.hotel_name as partner_name, p.commission_rate
      FROM leads l
      LEFT JOIN itineraries i ON l.id = i.lead_id
      LEFT JOIN partners p ON l.partner_id = p.id
      WHERE l.status IN ('converted', 'assigned', 'completed')
      ORDER BY l.start_date ASC, l.created_at DESC
    `);
    return res.rows;
  }
}
