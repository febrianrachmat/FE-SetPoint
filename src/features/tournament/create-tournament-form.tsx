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
import { getErrorMessage } from '@/lib/api/types';
import { createTournament } from '@/lib/api/tournaments';

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateTournamentForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const mutation = useMutation({
    mutationFn: createTournament,
    onSuccess: async (tournament) => {
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament created');
      router.push(`/tournaments/${tournament.id}`);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error));
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) => {
        setFormError(null);
        mutation.mutate({
          name: values.name,
          description: values.description || undefined,
        });
      })}
    >
      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not create tournament</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register('name')} />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...form.register('description')} />
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : 'Create tournament'}
      </Button>
    </form>
  );
}
