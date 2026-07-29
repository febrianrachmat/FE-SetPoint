import { Badge } from '@/components/ui/badge';
import type { TournamentStatus } from '@/lib/api/tournaments';

const LABELS: Record<TournamentStatus, string> = {
  draft: 'Draft',
  setup: 'Setup',
  published: 'Published',
  live: 'Live',
  finished: 'Finished',
  archived: 'Archived',
};

export function StatusBadge({ status }: { status: TournamentStatus }) {
  return <Badge variant="secondary">{LABELS[status] ?? status}</Badge>;
}
