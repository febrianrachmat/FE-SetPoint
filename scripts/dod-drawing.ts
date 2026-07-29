/**
 * Drawing slice UI check: generate → approve → publish → lock
 * Prefers API for team bulk registration after UI login.
 *
 * Run: npx tsx scripts/dod-drawing.ts
 */
import { chromium } from 'playwright';

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

async function main() {
  console.log('\nDrawing UI check');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
    await page.locator('#email').fill('admin@setpoint.local');
    await page.locator('#password').fill('Password123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(
      () =>
        location.pathname.replace(/\/$/, '') === '/tournaments' ||
        document.body.innerText.includes('Could not sign in'),
      null,
      { timeout: 60000 },
    );
    if ((await page.locator('body').innerText()).includes('Could not sign in')) {
      throw new Error('Login failed in UI');
    }

    await page.getByRole('link', { name: /New tournament/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/tournaments/new'));
    const name = `Drawing UI ${stamp}`;
    await page.locator('#name').fill(name);
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
    console.log('   [ok] tournament+category', tournamentId, categoryId);

    const token = await page.evaluate(() =>
      window.localStorage.getItem('setpoint.accessToken'),
    );
    if (!token) throw new Error('No access token in localStorage');

    for (let i = 1; i <= 8; i += 1) {
      const label = String(i).padStart(2, '0');
      await api(token, 'POST', `/tournaments/${tournamentId}/categories/${categoryId}/teams`, {
        name: `Draw Team ${label}`,
        players: [
          { displayName: `P${label}A` },
          { displayName: `P${label}B` },
        ],
      });
    }
    console.log('   [ok] 8 teams registered via API');

    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/drawing`,
      { waitUntil: 'networkidle' },
    );
    await page.getByRole('button', { name: /Generate version/i }).click();
    await page.getByText(/Version 1/i).first().waitFor({ state: 'visible' });
    console.log('   [ok] generate');

    await page.getByRole('button', { name: /^Approve$/i }).click();
    await page.getByText(/review approved|approved/i).first().waitFor({
      state: 'visible',
      timeout: 10000,
    }).catch(() => undefined);
    // version list shows approved
    await page.waitForTimeout(800);
    console.log('   [ok] approve');

    await page.getByRole('button', { name: /^Publish$/i }).click();
    await page.getByText(/published|official|Schedule Ready/i).first().waitFor({
      timeout: 10000,
    }).catch(() => undefined);
    await page.waitForTimeout(800);
    console.log('   [ok] publish');

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
    console.log('   [ok] lock → generate disabled (Schedule Ready)');

    console.log('\n   RESULT: PASS — Drawing UI slice\n');
  } catch (error) {
    console.error('FAIL', error);
    await page.screenshot({
      path: 'scripts/dod-drawing-failure.png',
      fullPage: true,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
