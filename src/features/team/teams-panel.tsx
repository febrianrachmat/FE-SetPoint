'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createTeam, listTeams } from '@/lib/api/teams';
import { getErrorMessage } from '@/lib/api/types';

const schema = z.object({
  name: z.string().min(2, 'Team name is required'),
  player1: z.string().min(2, 'Player 1 is required'),
  player2: z.string().min(2, 'Player 2 is required'),
});

type FormValues = z.infer<typeof schema>;

export function TeamsPanel({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const teamsQuery = useQuery({
    queryKey: ['teams', tournamentId, categoryId],
    queryFn: () => listTeams(tournamentId, categoryId),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', player1: '', player2: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createTeam(tournamentId, categoryId, {
        name: values.name,
        players: [
          { displayName: values.player1 },
          { displayName: values.player2 },
        ],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['teams', tournamentId, categoryId],
      });
      form.reset();
      setFormError(null);
      toast.success('Team registered');
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const teams = teamsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/manage/tournaments/${tournamentId}/categories/${categoryId}`}
            className="hover:underline"
          >
            Category
          </Link>
          {' / '}
          Teams
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">Register teams</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New team</CardTitle>
            <CardDescription>Doubles registration (team size 2)</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => {
                setFormError(null);
                mutation.mutate(values);
              })}
            >
              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>Could not register team</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap">
                    {formError}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="name">Team name</Label>
                <Input id="name" {...form.register('name')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player1">Player 1</Label>
                <Input id="player1" {...form.register('player1')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player2">Player 2</Label>
                <Input id="player2" {...form.register('player2')} />
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Registering…' : 'Register team'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registered ({teams.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {teamsQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(teamsQuery.error)}
              </p>
            ) : null}
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams yet.</p>
            ) : (
              teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{team.name}</span>
                  <span className="text-muted-foreground">{team.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
