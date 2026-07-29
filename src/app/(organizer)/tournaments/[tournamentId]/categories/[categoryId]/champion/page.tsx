import { ChampionPanel } from '@/features/champion/champion-panel';

export default async function ChampionPage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  return (
    <ChampionPanel tournamentId={tournamentId} categoryId={categoryId} />
  );
}
