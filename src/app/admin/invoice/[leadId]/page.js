import InvoiceView from '@/views/InvoiceView';

export default async function InvoicePage({ params }) {
  const { leadId } = await params;
  return <InvoiceView leadId={leadId} />;
}
