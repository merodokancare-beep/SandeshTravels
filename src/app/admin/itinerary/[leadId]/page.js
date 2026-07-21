import ItineraryBuilderView from '@/views/ItineraryBuilderView';

export default async function Page({ params }) {
  const { leadId } = await params;
  return <ItineraryBuilderView leadId={leadId} />;
}
