/**
 * Vertical Slice #6 — Standings
 * After verified group match: table rows, qualified intake, recalculate.
 *
 * Run: npx tsx scripts/dod-standing.ts
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
  kind: 'drawing' | 'schedule',
) {
  await page.getByRole('button', { name: /Generate version/i }).click();
  await page.getByText(/Version 1/i).first().waitFor({ state: 'visible' });
  console.log(`   [ok] ${kind} generate`);

  await page.getByRole('button', { name: /^Approve$/i }).click();
  await page.waitForTimeout(600);
  console.log(`   [ok] ${kind} approve`);

  await page.getByRole('button', { name: /^Publish$/i }).click();
  await page.waitForTimeout(600);
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
  await apiOk(token, 'POST', `${base}/warm-up`);
  await apiOk(token, 'POST', `${base}/start`);
  for (let i = 0; i < 16; i += 1) {
    await apiOk(token, 'POST', `${base}/score/point`, { side: 'A' });
  }
  await apiOk(token, 'POST', `${base}/finish`);
  await apiOk(token, 'POST', `${base}/verify`);
}

async function main() {
  console.log('\nStandings UI check (Slice #6)');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  try {
    await login(page);

    await page.getByRole('link', { name: /New tournament/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/tournaments/new'));
    await page.locator('#name').fill(`Standing UI ${stamp}`);
    await Promise.all([
      page.waitForURL((url) =>
        /\/tournaments\/[0-9a-f-]{36}$/i.test(url.pathname),
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
      name: 'Standing Court',
      label: `T${String(stamp).slice(-4)}`,
    });
    for (let i = 1; i <= 8; i += 1) {
      const label = String(i).padStart(2, '0');
      await apiOk(
        token,
        'POST',
        `/tournaments/${tournamentId}/categories/${categoryId}/teams`,
        {
          name: `Stand Team ${label}`,
          players: [
            { displayName: `ST${label}A` },
            { displayName: `ST${label}B` },
          ],
        },
      );
    }
    console.log('   [ok] court + 8 teams');

    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/drawing`,
      { waitUntil: 'networkidle' },
    );
    await lifecycleToOfficialLocked(page, 'drawing');

    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/schedule`,
      { waitUntil: 'networkidle' },
    );
    await lifecycleToOfficialLocked(page, 'schedule');

    await apiOk(token, 'POST', `/tournaments/${tournamentId}/publish`);
    await apiOk(token, 'POST', `/tournaments/${tournamentId}/go-live`);
    console.log('   [ok] publish + go-live');

    const matches = await apiOk<{ items: Array<{ id: string; status: string }> }>(
      token,
      'GET',
      `/tournaments/${tournamentId}/categories/${categoryId}/matches?pageSize=50`,
    );
    const waiting = matches.items.find((m) => m.status === 'waiting');
    if (!waiting) throw new Error('No waiting match');
    await completeMatchViaApi(token, tournamentId, categoryId, waiting.id);
    console.log('   [ok] one match verified (API)');

    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/standings`,
      { waitUntil: 'networkidle' },
    );

    await page.locator('[data-standing-groups]').waitFor({ state: 'visible' });
    const rowCount = await page.locator('[data-standing-team]').count();
    if (rowCount < 2) {
      throw new Error(`Expected standing rows, got ${rowCount}`);
    }
    console.log(`   [ok] standing table (${rowCount} rows)`);

    const withPoints = await page
      .locator('[data-standing-team]')
      .evaluateAll((nodes) =>
        nodes.some((n) => {
          const pts = n.parentElement?.querySelector('td:nth-child(6)');
          return Number(pts?.textContent ?? '0') > 0;
        }),
      );
    if (!withPoints) throw new Error('Expected at least one team with points');
    console.log('   [ok] points reflected after verify');

    await page.getByRole('button', { name: /^Recalculate$/i }).click();
    await page.waitForTimeout(800);
    await page.locator('[data-standing-team]').first().waitFor({ state: 'visible' });
    console.log('   [ok] recalculate');

    const qualifiedCount = await page.locator('[data-qualified-team]').count();
    // After one verified match, qualifyTop=2 may still mark top ranks with 0 MP
    // depending on calculator — assert section or badge if any qualified.
    if (qualifiedCount > 0) {
      await page.locator('[data-qualified-section]').waitFor({ state: 'visible' });
      console.log(`   [ok] qualified intake (${qualifiedCount})`);
    } else {
      // Force more results: verify enough matches so top ranks have games,
      // or accept empty qualified if calculator only marks after full group —
      // check API qualified list for consistency.
      const qualified = await apiOk<{ items: unknown[] }>(
        token,
        'GET',
        `/tournaments/${tournamentId}/categories/${categoryId}/standings/qualified`,
      );
      if (qualified.items.length > 0) {
        throw new Error('API has qualified but UI missing intake section');
      }
      console.log('   [ok] qualified empty (consistent with API)');
    }

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-standing-team]').first().waitFor({ state: 'visible' });
    console.log('   [ok] refresh keeps standings');

    console.log('\n   RESULT: PASS — Standings slice\n');
  } catch (error) {
    console.error('FAIL', error);
    await page.screenshot({
      path: 'scripts/dod-standing-failure.png',
      fullPage: true,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
