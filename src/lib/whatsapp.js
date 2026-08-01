/**
 * Sandesh Travels WhatsApp API Dispatcher
 * Integrates with Meta Cloud API for WhatsApp Business messaging.
 * Uses placeholder configurations from .env.local.
 */

export async function sendWhatsAppMessage(toPhone, messageText) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSender = process.env.TWILIO_SENDER_NUMBER || 'whatsapp:+14155238886';

  // Clean phone number: remove non-digits
  const cleanPhone = toPhone.replace(/\D/g, '');

  console.log('--- WHATSAPP DISPATCH MSG ---');
  console.log(`To: ${cleanPhone}`);
  console.log(`Message: \n"${messageText}"`);
  console.log('------------------------------');

  const hasTwilio = twilioSid && twilioAuthToken && twilioSid.trim() !== '' && twilioAuthToken.trim() !== '';
  const hasMeta = token && !token.startsWith('EAAG') && phoneNumberId && phoneNumberId !== '1234567890';

  // If neither Meta nor Twilio is configured, run in simulator mode
  if (!hasMeta && !hasTwilio) {
    console.log('[WhatsApp] Active tokens not configured in env.local. Simulated dispatch successful.');
    return { success: true, simulated: true };
  }

  if (hasMeta) {
    try {
      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: true,
            body: messageText
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Meta WhatsApp API Error]', data);
        return { success: false, error: data.error };
      }

      console.log('[Meta WhatsApp API Success]', data);
      return { success: true, data };
    } catch (error) {
      console.error('[Meta WhatsApp Network Error]', error);
      return { success: false, error: error.message };
    }
  } else {
    // Send via Twilio WhatsApp API
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: `whatsapp:+${cleanPhone}`,
          From: twilioSender,
          Body: messageText
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Twilio WhatsApp API Error]', data);
        return { success: false, error: data.message || 'Twilio message dispatch failed.' };
      }

      console.log('[Twilio WhatsApp API Success]', data);
      return { success: true, data };
    } catch (error) {
      console.error('[Twilio WhatsApp Network Error]', error);
      return { success: false, error: error.message };
    }
  }
}
