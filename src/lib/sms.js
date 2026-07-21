/**
 * VaniTravels Twilio SMS API Dispatcher
 * Integrates with Twilio SMS Messaging.
 * Uses configuration values from .env.local.
 */

export async function sendSMS(toPhone, messageText) {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioSmsSender = process.env.TWILIO_SMS_NUMBER;

  // Clean phone number: remove non-digits
  const cleanPhone = toPhone.replace(/\D/g, '');

  console.log('--- SMS DISPATCH MSG ---');
  console.log(`To: ${cleanPhone}`);
  console.log(`Message: \n"${messageText}"`);
  console.log('------------------------------');

  const hasTwilio = twilioSid && twilioAuthToken && twilioSid.trim() !== '' && twilioAuthToken.trim() !== '';

  // Run in simulator mode if Twilio is not configured or SMS sender is missing
  if (!hasTwilio || !twilioSmsSender) {
    console.log('[SMS] Twilio credentials or TWILIO_SMS_NUMBER not configured. Simulated dispatch successful.');
    return { success: true, simulated: true };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');
    
    const isMessagingService = twilioSmsSender.trim().startsWith('MG');
    const smsParams = {
      To: `+${cleanPhone}`,
      Body: messageText
    };
    if (isMessagingService) {
      smsParams.MessagingServiceSid = twilioSmsSender.trim();
    } else {
      smsParams.From = twilioSmsSender.trim();
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(smsParams)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Twilio SMS API Error]', data);
      return { success: false, error: data.message || 'Twilio SMS message dispatch failed.' };
    }

    console.log('[Twilio SMS API Success]', data);
    return { success: true, data };
  } catch (error) {
    console.error('[Twilio SMS Network Error]', error);
    return { success: false, error: error.message };
  }
}
