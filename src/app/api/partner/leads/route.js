import { LeadController } from '@/controllers/LeadController';

export async function GET(request) {
  return LeadController.partnerGetLeads(request);
}

export async function POST(request) {
  return LeadController.partnerCreateLead(request);
}
