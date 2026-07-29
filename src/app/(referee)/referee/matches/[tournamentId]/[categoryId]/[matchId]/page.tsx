import { MatchScoringPanel } from '@/features/match/match-scoring-panel';

export default async function RefereeMatchDeskPage({
  params,
}: {
  params: Promise<{
    tournamentId: string;
    categoryId: string;
    matchId: string;
  }>;
}) {
  const { tournamentId, categoryId, matchId } = await params;
  return (
    <MatchScoringPanel
      tournamentId={tournamentId}
      categoryId={categoryId}
      matchId={matchId}
      backHref="/referee"
      backLabel="My matches"
      allowVerify={false}
      allowAssign={false}
    />
  );
}
