import { PublicTournamentHub } from '@/features/public/public-tournament-hub';

export default async function PublicTournamentHubPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  return <PublicTournamentHub tournamentId={tournamentId} />;
}
