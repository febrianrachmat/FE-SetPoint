import { CategoryDetail } from '@/features/category/category-detail';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ tournamentId: string; categoryId: string }>;
}) {
  const { tournamentId, categoryId } = await params;
  return (
    <CategoryDetail tournamentId={tournamentId} categoryId={categoryId} />
  );
}
