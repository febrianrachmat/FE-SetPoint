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
    <div className="mx-auto max-w-lg space-y-4">
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
            Default: group then knockout with scoring template one_set_4_gp_tb3
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCategoryForm tournamentId={tournamentId} />
        </CardContent>
      </Card>
    </div>
  );
}
