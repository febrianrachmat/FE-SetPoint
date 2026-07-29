/**
 * Referee slice — assign → referee desk → score/finish → verify blocked
 *
 * Run: npx tsx scripts/dod-referee.ts
 */
import { chromium, type Page } from 'playwright';

const FE = process.env.FE_BASE_URL ?? 'http://localhost:3001';
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const stamp = Date.now();

async function apiRaw(
  token: string | null,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: unknown;
    error?: { message: string; statusCode?: number };
  };
  return { status: res.status, json };
}

async function apiOk<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { status, json } = await apiRaw(token, method, path, body);
  if (!json.success) {
    throw new Error(
      json.error?.message ?? `API ${status} ${path}`,
    );
  }
  return json.data as T;
}

async function loginAs(
  page: Page,
  email: string,
  password: string,
  expectPath: RegExp,
) {
  await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
  await page.locator('form[data-hydrated="true"]').waitFor({
    state: 'attached',
    timeout: 30000,
  });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => expectPath.test(url.pathname), {
    timeout: 60000,
  });
}

async function lifecycleToOfficialLocked(
  page: Page,
  kind: 'drawing' | 'schedule',
) {
  await page.getByRole('button', { name: /Generate version/i }).click();
  await page.getByText(/Version 1/i).first().waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /^Approve$/i }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Publish$/i }).click();
  await page.waitForTimeout(600);
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
  console.log(`   [ok] ${kind} locked`);
}

async function main() {
  console.log('\nReferee UI check');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  try {
    await loginAs(
      page,
      'admin@setpoint.local',
      'Password123!',
      /\/tournaments/,
    );

    await page.getByRole('link', { name: /New tournament/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/tournaments/new'));
    await page.locator('#name').fill(`Referee UI ${stamp}`);
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

    const adminToken = await page.evaluate(() =>
      window.localStorage.getItem('setpoint.accessToken'),
    );
    if (!adminToken) throw new Error('No admin token');

    await apiOk(adminToken, 'POST', `/tournaments/${tournamentId}/courts`, {
      name: 'Ref Court',
      label: `R${String(stamp).slice(-4)}`,
    });
    for (let i = 1; i <= 8; i += 1) {
      const label = String(i).padStart(2, '0');
      await apiOk(
        adminToken,
        'POST',
        `/tournaments/${tournamentId}/categories/${categoryId}/teams`,
        {
          name: `Ref Team ${label}`,
          players: [
            { displayName: `R${label}A` },
            { displayName: `R${label}B` },
          ],
        },
      );
    }

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
    await apiOk(adminToken, 'POST', `/tournaments/${tournamentId}/publish`);
    await apiOk(adminToken, 'POST', `/tournaments/${tournamentId}/go-live`);
    console.log('   [ok] live setup');

    const matches = await apiOk<{
      items: Array<{ id: string; status: string }>;
    }>(
      adminToken,
      'GET',
      `/tournaments/${tournamentId}/categories/${categoryId}/matches?pageSize=50`,
    );
    const target = matches.items.find((m) => m.status === 'waiting');
    const other = matches.items.find(
      (m) => m.status === 'waiting' && m.id !== target?.id,
    );
    if (!target) throw new Error('No waiting match');

    await apiOk(
      adminToken,
      'POST',
      `/tournaments/${tournamentId}/categories/${categoryId}/matches/${target.id}/referees`,
      { email: 'referee@setpoint.local' },
    );
    console.log('   [ok] referee assigned');

    await page.evaluate(() => window.localStorage.clear());
    await loginAs(
      page,
      'referee@setpoint.local',
      'Password123!',
      /\/referee$/,
    );
    console.log('   [ok] referee lands on /referee');

    await page.locator('[data-referee-assignments]').waitFor({
      state: 'visible',
    });
    await page
      .locator(`[data-assignment-match="${target.id}"]`)
      .getByRole('link', { name: /Open desk/i })
      .click();
    await page.waitForURL((url) => url.pathname.includes(target.id));
    console.log('   [ok] open assigned desk');

    await page.getByRole('button', { name: /^Warm-up$/i }).click();
    await page
      .locator('section[data-match-status="warm_up"]')
      .waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /^Start$/i }).click();
    await page
      .locator('section[data-match-status="live"]')
      .waitFor({ state: 'visible' });

    const pointA = page.getByRole('button', { name: /^\+1 / }).first();
    for (let i = 0; i < 16; i += 1) {
      await pointA.click();
      await page.waitForTimeout(80);
    }
    await page
      .locator('section[data-score-phase="completed"]')
      .waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /Finish match/i }).click();
    await page
      .locator('section[data-match-status="finished"]')
      .waitFor({ state: 'visible' });
    console.log('   [ok] referee scored + finished');

    const verifyBtn = page.getByRole('button', { name: /Verify/i });
    if (await verifyBtn.count()) {
      throw new Error('Verify button must be hidden for referee');
    }
    console.log('   [ok] Verify hidden');

    const refereeToken = await page.evaluate(() =>
      window.localStorage.getItem('setpoint.accessToken'),
    );
    if (!refereeToken) throw new Error('No referee token');

    const verifyAttempt = await apiRaw(
      refereeToken,
      'POST',
      `/tournaments/${tournamentId}/categories/${categoryId}/matches/${target.id}/verify`,
    );
    if (verifyAttempt.json.success || verifyAttempt.status !== 403) {
      throw new Error(
        `Expected 403 verify, got ${verifyAttempt.status}`,
      );
    }
    console.log('   [ok] verify API blocked (403)');

    if (other) {
      const unassigned = await apiRaw(
        refereeToken,
        'POST',
        `/tournaments/${tournamentId}/categories/${categoryId}/matches/${other.id}/warm-up`,
      );
      if (unassigned.json.success || unassigned.status !== 403) {
        throw new Error(
          `Expected 403 unassigned warm-up, got ${unassigned.status}`,
        );
      }
      console.log('   [ok] unassigned match blocked (REF-02)');
    }

    console.log('\n   RESULT: PASS — Referee slice\n');
  } catch (error) {
    console.error('FAIL', error);
    await page.screenshot({
      path: 'scripts/dod-referee-failure.png',
      fullPage: true,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
