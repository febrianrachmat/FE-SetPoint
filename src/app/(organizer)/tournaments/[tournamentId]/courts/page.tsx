import { CourtsPanel } from '@/features/court/courts-panel';

export default async function CourtsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  return <CourtsPanel tournamentId={tournamentId} />;
}
