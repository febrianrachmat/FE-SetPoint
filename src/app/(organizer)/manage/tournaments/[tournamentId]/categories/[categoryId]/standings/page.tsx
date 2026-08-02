import { StandingPanel } from '@/features/standing/standing-panel';

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  return (
    <StandingPanel tournamentId={tournamentId} categoryId={categoryId} />
  );
}
