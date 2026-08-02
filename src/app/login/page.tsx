import Link from 'next/link';
import { LoginForm } from '@/features/auth/login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e8f0ea_0%,_#f4f6f5_50%,_#eef1ef_100%)] px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="font-heading text-4xl tracking-tight hover:opacity-80">
            Set Point
          </Link>
          <p className="mt-1 text-muted-foreground">Organizer login</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Use a seeded admin account against the local backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
