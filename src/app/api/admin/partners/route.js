import { PartnerController } from '@/controllers/PartnerController';

export async function GET(request) {
  return PartnerController.adminGetAllPartners(request);
}
