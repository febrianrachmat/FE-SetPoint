import { TournamentDetail } from '@/features/tournament/tournament-detail';

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  return <TournamentDetail tournamentId={tournamentId} />;
}
