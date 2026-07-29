'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCategory } from '@/lib/api/categories';
import { getErrorMessage } from '@/lib/api/types';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  format: z.string().min(2, 'Format is required'),
  competitionMode: z.enum(['group_then_knockout', 'knockout_only']),
  teamSize: z.string().min(1),
  groupCount: z.string().min(1),
  teamsPerGroup: z.string().min(1),
  qualifyTop: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

function toPositiveInt(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

export function CreateCategoryForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: 'Open Doubles',
      format: 'doubles_group_playoff',
      competitionMode: 'group_then_knockout',
      teamSize: '2',
      groupCount: '2',
      teamsPerGroup: '4',
      qualifyTop: '2',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createCategory(tournamentId, {
        name: values.name,
        format: values.format,
        configuration: {
          competitionMode: values.competitionMode,
          teamSize: toPositiveInt(values.teamSize, 'Team size'),
          groupCount: toPositiveInt(values.groupCount, 'Groups'),
          teamsPerGroup: toPositiveInt(values.teamsPerGroup, 'Teams per group'),
          scoring: { templateId: 'one_set_4_gp_tb3' },
          standings: {
            pointsForWin: 1,
            pointsForLoss: 0,
            qualifyTop: toPositiveInt(values.qualifyTop, 'Qualify top'),
          },
        },
      }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: ['categories', tournamentId] });
      toast.success('Category created');
      router.push(`/tournaments/${tournamentId}/categories/${category.id}`);
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) => {
        setFormError(null);
        mutation.mutate(values);
      })}
    >
      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not create category</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...form.register('name')} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="format">Format</Label>
          <Input id="format" {...form.register('format')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teamSize">Team size</Label>
          <Input id="teamSize" type="number" {...form.register('teamSize')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="groupCount">Groups</Label>
          <Input id="groupCount" type="number" {...form.register('groupCount')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teamsPerGroup">Teams per group</Label>
          <Input
            id="teamsPerGroup"
            type="number"
            {...form.register('teamsPerGroup')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qualifyTop">Qualify top N</Label>
          <Input id="qualifyTop" type="number" {...form.register('qualifyTop')} />
        </div>
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : 'Create category'}
      </Button>
    </form>
  );
}
