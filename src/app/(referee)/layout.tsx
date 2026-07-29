import { RefereeShell } from '@/components/referee-shell';
import { RequireReferee } from '@/features/auth/require-referee';

export default function RefereeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireReferee>
      <RefereeShell>{children}</RefereeShell>
    </RequireReferee>
  );
}
