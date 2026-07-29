import { TeamsPanel } from '@/features/team/teams-panel';

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  return <TeamsPanel tournamentId={tournamentId} categoryId={categoryId} />;
}
