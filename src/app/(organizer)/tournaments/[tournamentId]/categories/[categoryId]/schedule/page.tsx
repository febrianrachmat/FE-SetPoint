import { SchedulePanel } from '@/features/schedule/schedule-panel';

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  return (
    <SchedulePanel tournamentId={tournamentId} categoryId={categoryId} />
  );
}
