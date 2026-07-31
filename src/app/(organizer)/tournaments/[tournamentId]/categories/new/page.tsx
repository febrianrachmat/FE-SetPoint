import Link from 'next/link';
import { CreateCategoryForm } from '@/features/category/create-category-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function NewCategoryPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">
        <Link href={`/tournaments/${tournamentId}`} className="hover:underline">
          Tournament
        </Link>
        {' / '}
        New category
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Create category</CardTitle>
          <CardDescription>
            Set format, groups, and game rules (sets, games, deuce, tie-break).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCategoryForm tournamentId={tournamentId} />
        </CardContent>
      </Card>
    </div>
  );
}
