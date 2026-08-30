import { PartnerController } from '@/controllers/PartnerController';

export async function GET(request) {
  return PartnerController.adminGetAllPartners(request);
}

export async function POST(request) {
  return PartnerController.adminCreatePartner(request);
}

export async function PUT(request) {
  return PartnerController.adminUpdatePartner(request);
}

export async function DELETE(request) {
  return PartnerController.adminDeletePartner(request);
}
