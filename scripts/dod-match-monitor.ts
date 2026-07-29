/**
 * Vertical Slice #4 — Tournament Live & Match Monitor
 * Live Ready → Publish → Go Live → Warm-up → Start (no scoring)
 *
 * Run: npx tsx scripts/dod-match-monitor.ts
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
  await page.waitForTimeout(800);
  console.log(`   [ok] ${kind} approve`);

  await page.getByRole('button', { name: /^Publish$/i }).click();
  await page.waitForTimeout(800);
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
  console.log('\nMatch Monitor UI check (Slice #4)');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  try {
    await login(page);

    await page.getByRole('link', { name: /New tournament/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/tournaments/new'));
    await page.locator('#name').fill(`Match Monitor UI ${stamp}`);
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

    await api(token, 'POST', `/tournaments/${tournamentId}/courts`, {
      name: 'Monitor Court',
      label: `M${String(stamp).slice(-4)}`,
    });
    console.log('   [ok] court via API');

    for (let i = 1; i <= 8; i += 1) {
      const label = String(i).padStart(2, '0');
      await api(
        token,
        'POST',
        `/tournaments/${tournamentId}/categories/${categoryId}/teams`,
        {
          name: `Mon Team ${label}`,
          players: [
            { displayName: `M${label}A` },
            { displayName: `M${label}B` },
          ],
        },
      );
    }
    console.log('   [ok] 8 teams via API');

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
    await page.getByText(/Live Ready/i).first().waitFor({ state: 'visible' });
    console.log('   [ok] Live Ready badge (schedule)');

    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/matches`,
      { waitUntil: 'networkidle' },
    );
    await page.getByText(/Live Ready/i).first().waitFor({ state: 'visible' });
    console.log('   [ok] Live Ready badge (monitor)');

    const goLiveBeforePublish = page.getByRole('button', { name: /^Go Live$/i });
    await goLiveBeforePublish.waitFor({ state: 'visible' });
    if (await goLiveBeforePublish.isEnabled()) {
      throw new Error('Go Live should be disabled before tournament publish');
    }
    console.log('   [ok] Go Live disabled until published');

    await page.goto(`${FE}/tournaments/${tournamentId}`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: /Publish tournament/i }).click();
    await page.getByText(/Published/i).first().waitFor({ state: 'visible' });
    console.log('   [ok] tournament published');

    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/matches`,
      { waitUntil: 'networkidle' },
    );
    const goLive = page.getByRole('button', { name: /^Go Live$/i });
    await goLive.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Go Live$/i.test(b.textContent ?? ''),
      );
      return Boolean(btn && !(btn as HTMLButtonElement).disabled);
    });
    await goLive.click();
    await page.getByText(/^Live$/i).first().waitFor({ state: 'visible' });
    console.log('   [ok] Go Live → tournament Live');

    await page.locator('[data-match-id]').first().waitFor({ state: 'visible' });
    const matchCount = await page.locator('[data-match-id]').count();
    if (matchCount < 1) throw new Error('Expected matches to list');
    console.log(`   [ok] match list (${matchCount})`);

    const firstCard = page.locator('[data-match-status="waiting"]').first();
    await firstCard.getByRole('button', { name: /^Warm-up$/i }).click();
    await page
      .locator('[data-match-status="warm_up"]')
      .first()
      .waitFor({ state: 'visible' });
    console.log('   [ok] warm-up');

    await page
      .locator('[data-match-status="warm_up"]')
      .first()
      .getByRole('button', { name: /^Start$/i })
      .click();
    await page
      .locator('[data-match-status="live"]')
      .first()
      .waitFor({ state: 'visible' });
    console.log('   [ok] start');

    await page.reload({ waitUntil: 'networkidle' });
    await page
      .locator('[data-match-status="live"]')
      .first()
      .waitFor({ state: 'visible' });
    await page.getByText(/^Live$/i).first().waitFor({ state: 'visible' });
    console.log('   [ok] refresh keeps Live + match state');

    console.log('\n   RESULT: PASS — Match Monitor / Go Live slice\n');
  } catch (error) {
    console.error('FAIL', error);
    await page.screenshot({
      path: 'scripts/dod-match-monitor-failure.png',
      fullPage: true,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
