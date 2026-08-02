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
import { cn } from '@/lib/utils';

const schema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    competitionMode: z.enum(['group_then_knockout', 'knockout_only']),
    teamSize: z.string().min(1),
    groupCount: z.string().min(1),
    teamsPerGroup: z.string().min(1),
    qualifyTop: z.string().min(1),
    matchFormat: z.enum(['best_of_1', 'best_of_3', 'best_of_5']),
    gamesTo: z.string().min(1),
    deuceMode: z.enum(['golden_point', 'advantage']),
    tieBreakAtGames: z.string().min(1),
    tieBreakPointsTo: z.string().min(1),
  })
  .superRefine((values, ctx) => {
    const gamesTo = Number(values.gamesTo);
    const atGames = Number(values.tieBreakAtGames);
    const pointsTo = Number(values.tieBreakPointsTo);

    if (!Number.isInteger(gamesTo) || gamesTo < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gamesTo'],
        message: 'Games to win set must be an integer ≥ 2',
      });
    }
    if (!Number.isInteger(atGames) || atGames < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tieBreakAtGames'],
        message: 'TB starts at must be an integer ≥ 1',
      });
    } else if (Number.isInteger(gamesTo) && atGames > gamesTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tieBreakAtGames'],
        message: 'TB starts at cannot exceed games to win set',
      });
    }
    if (!Number.isInteger(pointsTo) || pointsTo < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tieBreakPointsTo'],
        message: 'TB points to must be an integer ≥ 1',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function toPositiveInt(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function deriveFormat(
  teamSize: number,
  competitionMode: FormValues['competitionMode'],
) {
  const sizeLabel =
    teamSize === 1 ? 'singles' : teamSize === 2 ? 'doubles' : `teams${teamSize}`;
  return competitionMode === 'knockout_only'
    ? `${sizeLabel}_cup`
    : `${sizeLabel}_group_playoff`;
}

/** Suggested TB trigger: fast-4 → 3–3, fast-6 → 5–5, else gamesTo − 1. */
function defaultTieBreakAtGames(gamesTo: number) {
  if (gamesTo === 4) return 3;
  if (gamesTo === 6) return 5;
  return Math.max(1, gamesTo - 1);
}

function buildScoringConfig(values: FormValues) {
  const gamesTo = toPositiveInt(values.gamesTo, 'Games to win set');
  const atGames = toPositiveInt(values.tieBreakAtGames, 'TB starts at');
  const pointsTo = toPositiveInt(values.tieBreakPointsTo, 'TB points to');

  if (atGames > gamesTo) {
    throw new Error('TB starts at cannot exceed games to win set');
  }

  return {
    templateId: 'custom',
    matchFormat: values.matchFormat,
    gamesTo,
    mustWinBy: 2,
    deuceMode: values.deuceMode,
    decidingSet: 'full_set' as const,
    tieBreak: {
      atGames,
      pointsTo,
      mustWinBy: 2,
    },
    matchTieBreak: {
      atGames: 0,
      pointsTo: 10,
      mustWinBy: 2,
    },
  };
}

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
);

type ScoringPreset = {
  id: string;
  label: string;
  matchFormat: FormValues['matchFormat'];
  gamesTo: string;
  deuceMode: FormValues['deuceMode'];
  tieBreakAtGames: string;
  tieBreakPointsTo: string;
};

const SCORING_PRESETS: ScoringPreset[] = [
  {
    id: 'fast4',
    label: 'Fast to 4 · GP',
    matchFormat: 'best_of_1',
    gamesTo: '4',
    deuceMode: 'golden_point',
    tieBreakAtGames: '3',
    tieBreakPointsTo: '7',
  },
  {
    id: 'fast6',
    label: 'Fast to 6 · GP',
    matchFormat: 'best_of_1',
    gamesTo: '6',
    deuceMode: 'golden_point',
    tieBreakAtGames: '5',
    tieBreakPointsTo: '7',
  },
  {
    id: 'bo3adv',
    label: 'Bo3 to 6 · Advantage',
    matchFormat: 'best_of_3',
    gamesTo: '6',
    deuceMode: 'advantage',
    tieBreakAtGames: '5',
    tieBreakPointsTo: '7',
  },
];

export function CreateCategoryForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: 'Open Doubles',
      competitionMode: 'group_then_knockout',
      teamSize: '2',
      groupCount: '2',
      teamsPerGroup: '4',
      qualifyTop: '2',
      matchFormat: 'best_of_1',
      gamesTo: '4',
      deuceMode: 'golden_point',
      tieBreakAtGames: '3',
      tieBreakPointsTo: '7',
    },
  });

  const competitionMode = form.watch('competitionMode');
  const isGroupMode = competitionMode === 'group_then_knockout';
  const gamesToWatch = form.watch('gamesTo');
  const atGamesWatch = form.watch('tieBreakAtGames');
  const pointsToWatch = form.watch('tieBreakPointsTo');
  const deuceWatch = form.watch('deuceMode');
  const matchFormatWatch = form.watch('matchFormat');

  const applyPreset = (preset: ScoringPreset) => {
    form.setValue('matchFormat', preset.matchFormat);
    form.setValue('gamesTo', preset.gamesTo);
    form.setValue('deuceMode', preset.deuceMode);
    form.setValue('tieBreakAtGames', preset.tieBreakAtGames);
    form.setValue('tieBreakPointsTo', preset.tieBreakPointsTo);
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const teamSize = toPositiveInt(values.teamSize, 'Team size');
      const configuration: Record<string, unknown> = {
        competitionMode: values.competitionMode,
        teamSize,
        scoring: buildScoringConfig(values),
        standings: {
          pointsForWin: 1,
          pointsForLoss: 0,
          ...(values.competitionMode === 'group_then_knockout'
            ? {
                qualifyTop: toPositiveInt(values.qualifyTop, 'Qualify top'),
              }
            : {}),
        },
      };

      if (values.competitionMode === 'group_then_knockout') {
        configuration.groupCount = toPositiveInt(values.groupCount, 'Groups');
        configuration.teamsPerGroup = toPositiveInt(
          values.teamsPerGroup,
          'Teams per group',
        );
      }

      return createCategory(tournamentId, {
        name: values.name,
        format: deriveFormat(teamSize, values.competitionMode),
        configuration,
      });
    },
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: ['categories', tournamentId] });
      toast.success('Category created');
      router.push(`/manage/tournaments/${tournamentId}/categories/${category.id}`);
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
          <Label htmlFor="competitionMode">Format</Label>
          <select
            id="competitionMode"
            className={selectClassName}
            {...form.register('competitionMode')}
          >
            <option value="group_then_knockout">Group</option>
            <option value="knockout_only">Knockout</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="teamSize">Team size</Label>
          <Input id="teamSize" type="number" {...form.register('teamSize')} />
        </div>
        {isGroupMode ? (
          <>
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
          </>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <p className="font-medium">Game rules</p>
          <p className="text-sm text-muted-foreground">
            Applied when matches start. Presets fill the fields; you can still
            customize tie-break.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SCORING_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="matchFormat">Sets</Label>
            <select
              id="matchFormat"
              className={selectClassName}
              {...form.register('matchFormat')}
            >
              <option value="best_of_1">1 set</option>
              <option value="best_of_3">Best of 3</option>
              <option value="best_of_5">Best of 5</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deuceMode">Deuce</Label>
            <select
              id="deuceMode"
              className={selectClassName}
              {...form.register('deuceMode')}
            >
              <option value="golden_point">Golden point</option>
              <option value="advantage">Advantage</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gamesTo">Games to win set</Label>
            <Input
              id="gamesTo"
              type="number"
              min={2}
              {...form.register('gamesTo', {
                onChange: (event) => {
                  const next = Number(event.target.value);
                  if (Number.isInteger(next) && next >= 2) {
                    form.setValue(
                      'tieBreakAtGames',
                      String(defaultTieBreakAtGames(next)),
                    );
                  }
                },
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tieBreakAtGames">TB starts at (e.g. 5 = 5–5)</Label>
            <Input
              id="tieBreakAtGames"
              type="number"
              min={1}
              {...form.register('tieBreakAtGames')}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tieBreakPointsTo">TB points to win</Label>
            <Input
              id="tieBreakPointsTo"
              type="number"
              min={1}
              {...form.register('tieBreakPointsTo')}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Summary:{' '}
          {matchFormatWatch === 'best_of_1'
            ? '1 set'
            : matchFormatWatch === 'best_of_3'
              ? 'Best of 3'
              : 'Best of 5'}
          {' · '}
          first to {gamesToWatch || '—'} games
          {' · '}
          {deuceWatch === 'golden_point' ? 'golden point' : 'advantage'}
          {' · '}
          TB at {atGamesWatch || '—'}–{atGamesWatch || '—'} to {pointsToWatch || '—'}
        </p>
        {form.formState.errors.gamesTo ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.gamesTo.message}
          </p>
        ) : null}
        {form.formState.errors.tieBreakAtGames ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.tieBreakAtGames.message}
          </p>
        ) : null}
        {form.formState.errors.tieBreakPointsTo ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.tieBreakPointsTo.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : 'Create category'}
      </Button>
    </form>
  );
}
