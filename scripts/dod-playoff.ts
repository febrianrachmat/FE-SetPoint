/**
 * Vertical Slice #7 — Playoff
 * Qualified standings → generate → bracket → review → publish → lock
 * → open SF match → generate disabled → refresh
 *
 * Run: npx tsx scripts/dod-playoff.ts
 */
import { chromium, type Page } from 'playwright';

const FE = process.env.FE_BASE_URL ?? 'http://localhost:3001';
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const stamp = Date.now();

async function apiOk<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as {
    success: boolean;
    data: T;
    error?: { message: string };
  };
  if (!json.success) {
    throw new Error(json.error?.message ?? `API ${res.status} ${path}`);
  }
  return json.data;
}

async function login(page: Page) {
  await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
  await page.locator('form[data-hydrated="true"]').waitFor({
    state: 'attached',
    timeout: 30000,
  });
  await page.locator('#email').fill('admin@setpoint.local');
  await page.locator('#password').fill('Password123!');
  await page.locator('button[type="submit"]').click();
  await page.getByRole('link', { name: /New tournament/i }).waitFor({
    state: 'visible',
    timeout: 60000,
  });
}

async function lifecycleToOfficialLocked(
  page: Page,
  kind: 'drawing' | 'schedule' | 'playoff',
) {
  await page.getByRole('button', { name: /Generate version/i }).click();
  await page.getByText(/Version 1/i).first().waitFor({ state: 'visible' });
  console.log(`   [ok] ${kind} generate`);

  await page.getByRole('button', { name: /^Approve$/i }).click();
  await page.waitForTimeout(700);
  console.log(`   [ok] ${kind} approve`);

  await page.getByRole('button', { name: /^Publish$/i }).click();
  await page.waitForTimeout(700);
  console.log(`   [ok] ${kind} publish`);

  await page.getByRole('button', { name: /^Lock$/i }).click();
  await page
    .getByRole('button', { name: /Generate version/i })
    .waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const generate = buttons.find((b) =>
      /Generate version/i.test(b.textContent ?? ''),
    );
    return Boolean(generate && (generate as HTMLButtonElement).disabled);
  });
  console.log(`   [ok] ${kind} lock`);
}

async function completeMatchViaApi(
  token: string,
  tournamentId: string,
  categoryId: string,
  matchId: string,
) {
  const base = `/tournaments/${tournamentId}/categories/${categoryId}/matches/${matchId}`;
  const detail = await apiOk<{
    participations: Array<{ sideLabel: string; team: { name: string } }>;
  }>(token, 'GET', base);
  const sideA = detail.participations.find((p) => p.sideLabel === 'A');
  const sideB = detail.participations.find((p) => p.sideLabel === 'B');
  if (!sideA || !sideB) throw new Error(`Match ${matchId} missing sides`);
  // Deterministic hierarchy: lexicographically earlier team name always wins.
  const winnerSide: 'A' | 'B' =
    sideA.team.name <= sideB.team.name ? 'A' : 'B';

  await apiOk(token, 'POST', `${base}/warm-up`);
  await apiOk(token, 'POST', `${base}/start`);
  for (let i = 0; i < 16; i += 1) {
    await apiOk(token, 'POST', `${base}/score/point`, { side: winnerSide });
  }
  await apiOk(token, 'POST', `${base}/finish`);
  await apiOk(token, 'POST', `${base}/verify`);
}

async function main() {
  console.log('\nPlayoff UI check (Slice #7)');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  try {
    await login(page);

    await page.getByRole('link', { name: /New tournament/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/manage/tournaments/new'));
    await page.locator('#name').fill(`Playoff UI ${stamp}`);
    await Promise.all([
      page.waitForURL((url) =>
        /\/manage\/tournaments\/[0-9a-f-]{36}$/i.test(url.pathname),
      ),
      page.getByRole('button', { name: /Create tournament/i }).click(),
    ]);
    const tournamentId = page.url().split('/').filter(Boolean).pop()!;
    await page.getByRole('button', { name: /Move to Setup/i }).click();
    await page.getByText('Setup').first().waitFor();

    await page.getByRole('link', { name: /^Add$/i }).first().click();
    await page.waitForURL((url) => url.pathname.endsWith('/categories/new'));
    await Promise.all([
      page.waitForURL((url) =>
        /\/categories\/[0-9a-f-]{36}$/i.test(url.pathname),
      ),
      page.getByRole('button', { name: /Create category/i }).click(),
    ]);
    const categoryId = page.url().split('/').filter(Boolean).pop()!;
    console.log('   [ok] tournament+category');

    const token = await page.evaluate(() =>
      window.localStorage.getItem('setpoint.accessToken'),
    );
    if (!token) throw new Error('No access token');

    await apiOk(token, 'POST', `/tournaments/${tournamentId}/courts`, {
      name: 'Playoff Court',
      label: `P${String(stamp).slice(-4)}`,
    });
    for (let i = 1; i <= 8; i += 1) {
      const label = String(i).padStart(2, '0');
      await apiOk(
        token,
        'POST',
        `/tournaments/${tournamentId}/categories/${categoryId}/teams`,
        {
          name: `PO Team ${label}`,
          players: [
            { displayName: `PO${label}A` },
            { displayName: `PO${label}B` },
          ],
        },
      );
    }
    console.log('   [ok] court + 8 teams');

    await page.goto(
      `${FE}/manage/tournaments/${tournamentId}/categories/${categoryId}/drawing`,
      { waitUntil: 'networkidle' },
    );
    await lifecycleToOfficialLocked(page, 'drawing');

    await page.goto(
      `${FE}/manage/tournaments/${tournamentId}/categories/${categoryId}/schedule`,
      { waitUntil: 'networkidle' },
    );
    await lifecycleToOfficialLocked(page, 'schedule');

    await apiOk(token, 'POST', `/tournaments/${tournamentId}/publish`);
    await apiOk(token, 'POST', `/tournaments/${tournamentId}/go-live`);
    console.log('   [ok] publish + go-live');

    const matches = await apiOk<{
      items: Array<{ id: string; status: string }>;
    }>(
      token,
      'GET',
      `/tournaments/${tournamentId}/categories/${categoryId}/matches?pageSize=200`,
    );
    const waiting = matches.items.filter((m) => m.status === 'waiting');
    if (waiting.length < 1) throw new Error('No waiting group matches');
    for (const [index, match] of waiting.entries()) {
      await completeMatchViaApi(token, tournamentId, categoryId, match.id);
      if ((index + 1) % 3 === 0 || index === waiting.length - 1) {
        console.log(
          `   [ok] verified group matches ${index + 1}/${waiting.length}`,
        );
      }
    }

    await apiOk(
      token,
      'POST',
      `/tournaments/${tournamentId}/categories/${categoryId}/standings/recalculate`,
      {},
    );

    const qualified = await apiOk<{ items: unknown[] }>(
      token,
      'GET',
      `/tournaments/${tournamentId}/categories/${categoryId}/standings/qualified`,
    );
    if (qualified.items.length < 4) {
      throw new Error(
        `Need ≥4 qualified for SF bracket, got ${qualified.items.length}`,
      );
    }
    console.log(`   [ok] qualified intake (${qualified.items.length})`);

    await page.goto(
      `${FE}/manage/tournaments/${tournamentId}/categories/${categoryId}/playoff`,
      { waitUntil: 'networkidle' },
    );
    await lifecycleToOfficialLocked(page, 'playoff');
    await page.getByText(/Playoff Ready/i).first().waitFor({ state: 'visible' });
    console.log('   [ok] Playoff Ready badge');

    await page.locator('[data-bracket-matches]').waitFor({ state: 'visible' });
    const sf = page.locator('[data-bracket-position="SF1"]');
    await sf.waitFor({ state: 'visible' });
    console.log('   [ok] bracket SF1 visible');

    await Promise.all([
      page.waitForURL((url) =>
        /\/matches\/[0-9a-f-]{36}$/i.test(url.pathname),
      ),
      sf.getByRole('link', { name: /Open Match/i }).click(),
    ]);
    await page.locator('section[data-match-id]').waitFor({ state: 'visible' });
    console.log('   [ok] open semifinal match desk');

    await page.goto(
      `${FE}/manage/tournaments/${tournamentId}/categories/${categoryId}/playoff`,
      { waitUntil: 'networkidle' },
    );
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const generate = buttons.find((b) =>
        /Generate version/i.test(b.textContent ?? ''),
      );
      return Boolean(generate && (generate as HTMLButtonElement).disabled);
    });
    console.log('   [ok] generate disabled after lock');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(/Playoff Ready/i).first().waitFor({ state: 'visible' });
    await page.locator('[data-bracket-position="SF1"]').waitFor({
      state: 'visible',
    });
    console.log('   [ok] refresh keeps playoff state');

    console.log('\n   RESULT: PASS — Playoff slice\n');
  } catch (error) {
    console.error('FAIL', error);
    await page.screenshot({
      path: 'scripts/dod-playoff-failure.png',
      fullPage: true,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
