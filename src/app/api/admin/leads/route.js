import { LeadController } from '@/controllers/LeadController';
import { LeadModel } from '@/models/Lead';

export async function GET(request) {
  return LeadController.adminGetAllLeads(request);
}

export async function PUT(request) {
  return LeadController.adminUpdateLead(request);
}

export async function POST(request) {
  return LeadController.adminCreateLead(request);
}

export async function autoCompleteEndedJourneys() {
  return LeadModel.autoCompleteEndedJourneys();
}
