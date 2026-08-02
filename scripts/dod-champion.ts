/**
 * Vertical Slice #8 — Champion
 * Playoff Ready → verify SF → verify Final → Champion screen
 *
 * Run: npx tsx scripts/dod-champion.ts
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
  const winnerSide: 'A' | 'B' =
    sideA.team.name <= sideB.team.name ? 'A' : 'B';

  await apiOk(token, 'POST', `${base}/warm-up`);
  await apiOk(token, 'POST', `${base}/start`);
  for (let i = 0; i < 16; i += 1) {
    await apiOk(token, 'POST', `${base}/score/point`, { side: winnerSide });
  }
  await apiOk(token, 'POST', `${base}/finish`);
  await apiOk(token, 'POST', `${base}/verify`);
  return winnerSide === 'A' ? sideA.team.name : sideB.team.name;
}

type BracketMatch = {
  id: string;
  status: string;
  bracketPosition: string | null;
};

async function waitForFinalMatch(
  token: string,
  tournamentId: string,
  categoryId: string,
  bracketId: string,
) {
  const path = `/tournaments/${tournamentId}/categories/${categoryId}/playoff/brackets/${bracketId}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bracket = await apiOk<{ matches: BracketMatch[] }>(
      token,
      'GET',
      path,
    );
    const final = bracket.matches.find((m) => m.bracketPosition === 'F');
    if (final) {
      const detail = await apiOk<{
        id: string;
        participations: unknown[];
      }>(
        token,
        'GET',
        `/tournaments/${tournamentId}/categories/${categoryId}/matches/${final.id}`,
      );
      if (detail.participations.length >= 2) return final.id;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Final match not materialized after semis');
}

async function main() {
  console.log('\nChampion UI check (Slice #8)');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  try {
    await login(page);

    await page.getByRole('link', { name: /New tournament/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/manage/tournaments/new'));
    await page.locator('#name').fill(`Champion UI ${stamp}`);
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
      name: 'Champion Court',
      label: `H${String(stamp).slice(-4)}`,
    });
    for (let i = 1; i <= 8; i += 1) {
      const label = String(i).padStart(2, '0');
      await apiOk(
        token,
        'POST',
        `/tournaments/${tournamentId}/categories/${categoryId}/teams`,
        {
          name: `Ch Team ${label}`,
          players: [
            { displayName: `CH${label}A` },
            { displayName: `CH${label}B` },
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
    for (const [index, match] of matches.items
      .filter((m) => m.status === 'waiting')
      .entries()) {
      await completeMatchViaApi(token, tournamentId, categoryId, match.id);
      if ((index + 1) % 6 === 0) {
        console.log(`   [ok] group matches progress ${index + 1}`);
      }
    }
    await apiOk(
      token,
      'POST',
      `/tournaments/${tournamentId}/categories/${categoryId}/standings/recalculate`,
      {},
    );
    console.log('   [ok] group stage complete');

    await page.goto(
      `${FE}/manage/tournaments/${tournamentId}/categories/${categoryId}/playoff`,
      { waitUntil: 'networkidle' },
    );
    await lifecycleToOfficialLocked(page, 'playoff');
    console.log('   [ok] playoff ready');

    const brackets = await apiOk<{
      items: Array<{ id: string; officialFlag: boolean }>;
      currentOfficialBracketId: string | null;
    }>(
      token,
      'GET',
      `/tournaments/${tournamentId}/categories/${categoryId}/playoff/brackets`,
    );
    const bracketId =
      brackets.currentOfficialBracketId ??
      brackets.items.find((b) => b.officialFlag)?.id;
    if (!bracketId) throw new Error('No official bracket');

    const bracket = await apiOk<{ matches: BracketMatch[] }>(
      token,
      'GET',
      `/tournaments/${tournamentId}/categories/${categoryId}/playoff/brackets/${bracketId}`,
    );
    const semis = bracket.matches.filter((m) =>
      (m.bracketPosition ?? '').startsWith('SF'),
    );
    if (semis.length < 2) throw new Error('Expected SF1 and SF2');
    for (const semi of semis) {
      await completeMatchViaApi(token, tournamentId, categoryId, semi.id);
    }
    console.log('   [ok] semis verified');

    const finalId = await waitForFinalMatch(
      token,
      tournamentId,
      categoryId,
      bracketId,
    );
    const championName = await completeMatchViaApi(
      token,
      tournamentId,
      categoryId,
      finalId,
    );
    console.log(`   [ok] final verified → ${championName}`);

    await page.goto(
      `${FE}/manage/tournaments/${tournamentId}/categories/${categoryId}/champion`,
      { waitUntil: 'networkidle' },
    );
    await page
      .locator('[data-champion-state="declared"]')
      .waitFor({ state: 'visible' });
    const shown = await page
      .locator('[data-champion-team]')
      .getAttribute('data-champion-team');
    if (shown !== championName) {
      throw new Error(`Champion UI shows "${shown}", expected "${championName}"`);
    }
    console.log('   [ok] champion screen');

    await page.reload({ waitUntil: 'networkidle' });
    await page
      .locator(`[data-champion-team="${championName}"]`)
      .waitFor({ state: 'visible' });
    console.log('   [ok] refresh keeps champion');

    console.log('\n   RESULT: PASS — Champion slice\n');
  } catch (error) {
    console.error('FAIL', error);
    await page.screenshot({
      path: 'scripts/dod-champion-failure.png',
      fullPage: true,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
