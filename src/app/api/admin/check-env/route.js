import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasSid: !!process.env.TWILIO_ACCOUNT_SID,
    sidPrefix: process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.substring(0, 5) : 'N/A',
    hasToken: !!process.env.TWILIO_AUTH_TOKEN,
    hasSmsNumber: !!process.env.TWILIO_SMS_NUMBER,
    smsNumberValue: process.env.TWILIO_SMS_NUMBER || 'N/A',
    hasSenderNumber: !!process.env.TWILIO_SENDER_NUMBER,
    senderNumberValue: process.env.TWILIO_SENDER_NUMBER || 'N/A'
  });
}
