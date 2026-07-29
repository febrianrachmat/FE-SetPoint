/**
 * Vertical Slice #5 — Referee Scoring + Admin Verify
 * Warm-up → Start → +1… → Finish → Verify
 * Also asserts referee cannot verify (MATCH-10).
 *
 * Run: npx tsx scripts/dod-scoring.ts
 */
import { chromium, type Page } from 'playwright';

const FE = process.env.FE_BASE_URL ?? 'http://localhost:3001';
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const stamp = Date.now();

async function api<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
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
    error?: { message: string; statusCode?: number };
  };
  if (!json.success) {
    return {
      ok: false,
      status: json.error?.statusCode ?? res.status,
      message: json.error?.message ?? `API ${res.status} ${path}`,
    };
  }
  return { ok: true, data: json.data };
}

async function apiOk<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const result = await api<T>(token, method, path, body);
  if (!result.ok) throw new Error(result.message);
  return result.data;
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

async function main() {
  console.log('\nScoring UI check (Slice #5)');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  try {
    await login(page);

    await page.getByRole('link', { name: /New tournament/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/tournaments/new'));
    await page.locator('#name').fill(`Scoring UI ${stamp}`);
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
      name: 'Scoring Court',
      label: `C${String(stamp).slice(-4)}`,
    });

    for (let i = 1; i <= 8; i += 1) {
      const label = String(i).padStart(2, '0');
      await apiOk(
        token,
        'POST',
        `/tournaments/${tournamentId}/categories/${categoryId}/teams`,
        {
          name: `Score Team ${label}`,
          players: [
            { displayName: `P${label}A` },
            { displayName: `P${label}B` },
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

    await page.goto(`${FE}/tournaments/${tournamentId}`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: /Publish tournament/i }).click();
    await page.getByText(/Published/i).first().waitFor({ state: 'visible' });

    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/matches`,
      { waitUntil: 'networkidle' },
    );
    await page.getByRole('button', { name: /^Go Live$/i }).click();
    await page.getByText(/^Live$/i).first().waitFor({ state: 'visible' });
    console.log('   [ok] live ready + go live');

    const firstCard = page.locator('[data-match-status="waiting"]').first();
    await firstCard.getByRole('button', { name: /^Warm-up$/i }).click();
    await page
      .locator('[data-match-status="warm_up"]')
      .first()
      .waitFor({ state: 'visible' });
    await page
      .locator('[data-match-status="warm_up"]')
      .first()
      .getByRole('button', { name: /^Start$/i })
      .click();
    await page
      .locator('[data-match-status="live"]')
      .first()
      .waitFor({ state: 'visible' });
    console.log('   [ok] warm-up → start');

    const matchId = await page
      .locator('[data-match-status="live"]')
      .first()
      .getAttribute('data-match-id');
    if (!matchId) throw new Error('Missing match id');

    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/matches/${matchId}`,
      { waitUntil: 'networkidle' },
    );
    await page
      .locator('section[data-match-status="live"]')
      .waitFor({ state: 'visible' });

    // one_set_4_gp_tb3: 4 games × 4 points = 16 points to win 4–0
    const pointA = page.getByRole('button', { name: /^\+1 / }).first();
    for (let i = 0; i < 16; i += 1) {
      await pointA.click();
      await page.waitForTimeout(120);
    }
    await page
      .locator('section[data-score-phase="completed"]')
      .waitFor({ state: 'visible', timeout: 30000 });
    console.log('   [ok] scored to completed (4–0)');

    await page.getByRole('button', { name: /Finish match/i }).click();
    await page
      .locator('section[data-match-status="finished"]')
      .waitFor({ state: 'visible' });
    console.log('   [ok] finish');

    const refereeRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'referee@setpoint.local',
        password: 'Password123!',
      }),
    });
    const refereeJson = (await refereeRes.json()) as {
      success: boolean;
      data: { accessToken: string };
      error?: { message: string };
    };
    if (!refereeJson.success) {
      throw new Error(refereeJson.error?.message ?? 'referee login failed');
    }
    const refereeToken = refereeJson.data.accessToken;

    const verifyAsReferee = await api(
      refereeToken,
      'POST',
      `/tournaments/${tournamentId}/categories/${categoryId}/matches/${matchId}/verify`,
    );
    if (verifyAsReferee.ok) {
      throw new Error('Referee must not be able to verify (MATCH-10)');
    }
    if (verifyAsReferee.status !== 403) {
      throw new Error(
        `Expected 403 for referee verify, got ${verifyAsReferee.status}: ${verifyAsReferee.message}`,
      );
    }
    console.log('   [ok] referee verify blocked (403)');

    await page.getByRole('button', { name: /Verify \(Admin\)/i }).click();
    await page
      .locator('section[data-match-status="verified"]')
      .waitFor({ state: 'visible' });
    console.log('   [ok] admin verify');

    await page.reload({ waitUntil: 'networkidle' });
    await page
      .locator('section[data-match-status="verified"]')
      .waitFor({ state: 'visible' });
    console.log('   [ok] refresh keeps verified state');

    console.log('\n   RESULT: PASS — Scoring / Verify slice\n');
  } catch (error) {
    console.error('FAIL', error);
    await page.screenshot({
      path: 'scripts/dod-scoring-failure.png',
      fullPage: true,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
