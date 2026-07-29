import { OrganizerShell } from '@/components/organizer-shell';
import { RequireAuth } from '@/features/auth/require-auth';

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <OrganizerShell>{children}</OrganizerShell>
    </RequireAuth>
  );
}
