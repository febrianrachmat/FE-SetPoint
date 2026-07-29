import { PlayoffPanel } from '@/features/playoff/playoff-panel';

export default async function PlayoffPage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  return (
    <PlayoffPanel tournamentId={tournamentId} categoryId={categoryId} />
  );
}
