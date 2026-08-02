import type { Metadata } from 'next';
import { LandingPage } from '@/features/public/landing-page';

export const metadata: Metadata = {
  title: 'Set Point',
  description:
    'Padel tournament platform with live scoring for organizers, referees, and guests.',
};

export default function HomePage() {
  return <LandingPage />;
}
