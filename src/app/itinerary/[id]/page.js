import GuestItineraryView from '@/views/GuestItineraryView';
export { metadata } from '@/views/GuestItineraryView';

export default async function Page({ params }) {
  return <GuestItineraryView params={params} />;
}
