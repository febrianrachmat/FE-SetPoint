import { DrawingPanel } from '@/features/drawing/drawing-panel';

export default async function DrawingPage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  return (
    <DrawingPanel tournamentId={tournamentId} categoryId={categoryId} />
  );
}
