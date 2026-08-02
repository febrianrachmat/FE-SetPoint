import { Suspense } from 'react';
import { PublicTournamentListPage } from '@/features/public/public-tournament-list';

export default function PublicTournamentsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
          Loading tournaments…
        </div>
      }
    >
      <PublicTournamentListPage />
    </Suspense>
  );
}
