import { MatchMonitor } from '@/features/match/match-monitor';

export default async function MatchMonitorPage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  return (
    <MatchMonitor tournamentId={tournamentId} categoryId={categoryId} />
  );
}
