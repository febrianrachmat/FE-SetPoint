import Link from 'next/link';
import { CreateTournamentForm } from '@/features/tournament/create-tournament-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function NewTournamentPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">
        <Link href="/manage/tournaments" className="hover:underline">
          Tournaments
        </Link>
        {' / '}
        New
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Create tournament</CardTitle>
          <CardDescription>Starts in Draft status</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTournamentForm />
        </CardContent>
      </Card>
    </div>
  );
}
