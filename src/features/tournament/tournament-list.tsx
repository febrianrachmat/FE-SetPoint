'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatusBadge } from '@/features/tournament/status-badge';
import { getErrorMessage } from '@/lib/api/types';
import { listTournaments } from '@/lib/api/tournaments';

export function TournamentList() {
  const query = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => listTournaments({ pageSize: 50 }),
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tournaments…</p>;
  }

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load tournaments</AlertTitle>
        <AlertDescription>{getErrorMessage(query.error)}</AlertDescription>
      </Alert>
    );
  }

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Tournaments</h1>
          <p className="mt-1 text-muted-foreground">
            Prepare events from draft through champion.
          </p>
        </div>
        <Button asChild>
          <Link href="/tournaments/new">
            <Plus className="size-4" />
            New tournament
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No tournaments yet</CardTitle>
            <CardDescription>
              Create the first one to start Vertical Slice #1.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((tournament) => (
            <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
              <Card className="transition-colors hover:border-foreground/20">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">{tournament.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {tournament.description || 'No description'}
                    </p>
                  </div>
                  <StatusBadge status={tournament.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
