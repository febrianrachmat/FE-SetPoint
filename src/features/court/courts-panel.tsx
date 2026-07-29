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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCourt, listCourts } from '@/lib/api/courts';
import { getErrorMessage } from '@/lib/api/types';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  label: z.string().min(1, 'Label is required').max(50),
});

type FormValues = z.infer<typeof schema>;

export function CourtsPanel({ tournamentId }: { tournamentId: string }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const courtsQuery = useQuery({
    queryKey: ['courts', tournamentId],
    queryFn: () => listCourts(tournamentId),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', label: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createCourt(tournamentId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['courts', tournamentId] });
      form.reset();
      setFormError(null);
      toast.success('Court created');
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const courts = courtsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/tournaments/${tournamentId}`} className="hover:underline">
            Tournament
          </Link>
          {' / '}
          Courts
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">Courts</h1>
        <p className="text-muted-foreground">
          Labels must be unique. Duplicate labels return 409 from the API.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add court</CardTitle>
            <CardDescription>Used by schedule generation (SCH-02)</CardDescription>
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
                  <AlertTitle>Could not create court</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap">
                    {formError}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Center Court" {...form.register('name')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input id="label" placeholder="C1" {...form.register('label')} />
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating…' : 'Create court'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Active courts
              {courtsQuery.data
                ? ` · ${courtsQuery.data.availableCount} available`
                : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {courtsQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(courtsQuery.error)}
              </p>
            ) : null}
            {courts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courts yet.</p>
            ) : (
              courts.map((court) => (
                <div
                  key={court.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    {court.label} — {court.name}
                  </span>
                  <span className="text-muted-foreground">{court.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
