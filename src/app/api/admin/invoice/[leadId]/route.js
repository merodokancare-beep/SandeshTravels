import { InvoiceController } from '@/controllers/InvoiceController';

export async function GET(request, { params }) {
  return InvoiceController.getInvoiceData(request, { params });
}
