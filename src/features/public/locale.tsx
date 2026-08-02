'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Locale = 'en' | 'id';

type Dictionary = Record<string, { en: string; id: string }>;

const dict: Dictionary = {
  'nav.tournaments': { en: 'Tournaments', id: 'Turnamen' },
  'nav.live': { en: 'Live', id: 'Langsung' },
  'nav.organizerLogin': { en: 'Organizer login', id: 'Login organizer' },
  'nav.language': { en: 'EN / ID', id: 'EN / ID' },
  'hero.eyebrow': {
    en: 'Padel tournaments · Live scoring',
    id: 'Turnamen padel · Skor langsung',
  },
  'hero.title': {
    en: 'Run tournaments. Score live.',
    id: 'Kelola turnamen. Skor langsung.',
  },
  'hero.subtitle': {
    en: 'Set Point helps organizers run padel events with live scoring, court schedules, standings, and referee desks — while guests follow the action without an account.',
    id: 'Set Point membantu organizer menjalankan event padel dengan skor live, jadwal lapangan, standing, dan meja wasit — sementara penonton mengikuti tanpa akun.',
  },
  'hero.ctaTournaments': { en: 'See tournaments', id: 'Lihat turnamen' },
  'hero.ctaLogin': { en: 'Organizer login', id: 'Login organizer' },
  'list.title': { en: 'Tournaments', id: 'Turnamen' },
  'list.subtitle': {
    en: 'Published and live events you can follow as a guest.',
    id: 'Event published dan live yang bisa diikuti tanpa login.',
  },
  'list.filterAll': { en: 'All', id: 'Semua' },
  'list.filterLive': { en: 'Live', id: 'Langsung' },
  'list.filterUpcoming': { en: 'Upcoming', id: 'Mendatang' },
  'list.empty': {
    en: 'No public tournaments yet.',
    id: 'Belum ada turnamen publik.',
  },
  'list.open': { en: 'Open hub', id: 'Buka hub' },
  'hub.back': { en: 'Tournaments', id: 'Turnamen' },
  'hub.placeholderTitle': { en: 'Tournament hub', id: 'Hub turnamen' },
  'hub.placeholderBody': {
    en: 'Live matches, schedule, drawing, and standings will appear here next. For now this page confirms the public route for guests.',
    id: 'Match live, jadwal, drawing, dan standing akan muncul di sini berikutnya. Untuk sekarang halaman ini mengunci rute publik untuk guest.',
  },
  'hub.sectionsHint': {
    en: 'Coming sections: live matches · court schedule · drawing · standings · playoff',
    id: 'Section berikutnya: match live · jadwal lapangan · drawing · standing · playoff',
  },
};

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: keyof typeof dict) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem('setpoint.locale');
    if (stored === 'en' || stored === 'id') {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem('setpoint.locale', next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'id' : 'en');
  }, [locale, setLocale]);

  const t = useCallback(
    (key: keyof typeof dict) => dict[key]?.[locale] ?? String(key),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
