/**
 * Vertical Slice #1 — Definition of Done UI checklist
 * Requires: BE :3000, FE :3001
 *
 * Run: npx tsx scripts/dod-slice1.ts
 */
import { chromium, type Page } from 'playwright';

const FE = process.env.FE_BASE_URL ?? 'http://localhost:3001';
const stamp = Date.now();
const tournamentName = `DoD Tournament ${stamp}`;
const courtLabel = `D${String(stamp).slice(-4)}`;

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`   [ok]   ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.log(`   [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function expectVisible(page: Page, text: string | RegExp, timeout = 15000) {
  await page.getByText(text).first().waitFor({ state: 'visible', timeout });
}

async function fillById(page: Page, id: string, value: string) {
  await page.locator(`#${id}`).fill(value);
}

async function clickSubmit(page: Page, name?: string | RegExp) {
  if (name) {
    await page.getByRole('button', { name }).click();
  } else {
    await page.locator('button[type="submit"]').click();
  }
}

async function main() {
  console.log('\n========================================================================');
  console.log('Vertical Slice #1 — DoD UI checklist');
  console.log(`FE ${FE}`);
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    // 1. Login
    console.log('-- Login');
    await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
    await fillById(page, 'email', 'admin@setpoint.local');
    await fillById(page, 'password', 'Password123!');
    await Promise.all([
      page.waitForURL(
        (url) => url.pathname.replace(/\/$/, '') === '/tournaments',
        { timeout: 30000 },
      ),
      clickSubmit(page, /Sign in/i),
    ]);
    await expectVisible(page, 'Tournaments');
    pass('Login succeeds');

    // 2. Create Tournament
    console.log('-- Create Tournament');
    await page.getByRole('link', { name: /New tournament/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/tournaments/new'));
    await fillById(page, 'name', tournamentName);
    await fillById(page, 'description', 'DoD automated checklist');
    await Promise.all([
      page.waitForURL((url) =>
        /\/tournaments\/[0-9a-f-]{36}$/i.test(url.pathname),
      ),
      clickSubmit(page, /Create tournament/i),
    ]);
    await expectVisible(page, tournamentName);
    await expectVisible(page, 'Draft');
    pass('Create Tournament from UI', tournamentName);
    const tournamentUrl = page.url();
    const tournamentId = tournamentUrl.split('/').filter(Boolean).pop()!;

    // 3. Move to Setup
    console.log('-- Move to Setup');
    await page.getByRole('button', { name: /Move to Setup/i }).click();
    await expectVisible(page, 'Setup');
    pass('Move tournament to Setup');

    // 4. Create Category
    console.log('-- Create Category');
    await page.getByRole('link', { name: /^Add$/i }).first().click();
    await page.waitForURL((url) => url.pathname.endsWith('/categories/new'));
    await Promise.all([
      page.waitForURL((url) =>
        /\/categories\/[0-9a-f-]{36}$/i.test(url.pathname),
      ),
      clickSubmit(page, /Create category/i),
    ]);
    await expectVisible(page, 'Open Doubles');
    pass('Create Category');
    const categoryUrl = page.url();
    const categoryId = categoryUrl.split('/').filter(Boolean).pop()!;

    // 5. Register Team
    console.log('-- Register Team');
    await page.getByRole('link', { name: /Manage teams/i }).click();
    await page.waitForURL((url) => url.pathname.endsWith('/teams'));
    await fillById(page, 'name', `DoD Team ${stamp}`);
    await fillById(page, 'player1', 'Alice DoD');
    await fillById(page, 'player2', 'Bob DoD');
    await clickSubmit(page, /Register team/i);
    await expectVisible(page, `DoD Team ${stamp}`);
    pass('Register Team(s)');

    // 6. Create Court
    console.log('-- Create Court');
    await page.goto(`${FE}/tournaments/${tournamentId}/courts`, {
      waitUntil: 'networkidle',
    });
    await fillById(page, 'name', 'DoD Center Court');
    await fillById(page, 'label', courtLabel);
    await clickSubmit(page, /Create court/i);
    await expectVisible(page, courtLabel);
    pass('Create Court', courtLabel);

    // 7. Refresh keeps data
    console.log('-- Refresh persistence');
    await page.reload({ waitUntil: 'networkidle' });
    await expectVisible(page, courtLabel);
    await page.goto(`${FE}/tournaments/${tournamentId}`, {
      waitUntil: 'networkidle',
    });
    await expectVisible(page, tournamentName);
    await expectVisible(page, 'Setup');
    await expectVisible(page, 'Open Doubles');
    await expectVisible(page, courtLabel);
    await page.goto(
      `${FE}/tournaments/${tournamentId}/categories/${categoryId}/teams`,
      { waitUntil: 'networkidle' },
    );
    await expectVisible(page, `DoD Team ${stamp}`);
    pass('Refresh keeps correct data');

    // 8. Backend 409 surfaces via wrapper
    console.log('-- Error surfacing (409 duplicate court label)');
    await page.goto(`${FE}/tournaments/${tournamentId}/courts`, {
      waitUntil: 'networkidle',
    });
    await fillById(page, 'name', 'Duplicate Court');
    await fillById(page, 'label', courtLabel);
    const conflictResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/courts') &&
        response.request().method() === 'POST',
    );
    await clickSubmit(page, /Create court/i);
    const response = await conflictResponse;
    const status = response.status();
    await page
      .getByText(/already exists|Could not create court/i)
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => undefined);
    const alertText = (
      await page.locator('[role="alert"]').allInnerTexts()
    ).join(' | ');
    const bodyText = await page.locator('body').innerText();
    const uiShowsError =
      /already exists|Could not create court/i.test(alertText) ||
      /already exists|Could not create court/i.test(bodyText);
    if (status === 409 && uiShowsError) {
      pass(
        'Backend errors surface via Axios wrapper',
        `HTTP ${status}; ${(alertText || 'message in page').replace(/\s+/g, ' ').slice(0, 140)}`,
      );
    } else {
      fail(
        'Backend errors surface via Axios wrapper',
        `HTTP ${status}; alert="${alertText.replace(/\s+/g, ' ').slice(0, 160)}"; uiShowsError=${uiShowsError}`,
      );
      await page.screenshot({
        path: 'scripts/dod-409-failure.png',
        fullPage: true,
      });
    }

    // 9. Logout
    console.log('-- Logout');
    await page.getByRole('button', { name: /Log out/i }).click();
    await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/login');
    await expectVisible(page, /Organizer sign in|Welcome back/i);
    await page.goto(`${FE}/tournaments`, { waitUntil: 'networkidle' });
    await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/login');
    pass('Logout / expired session returns to login');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail('Unhandled crash', message);
    await page
      .screenshot({
        path: 'scripts/dod-slice1-failure.png',
        fullPage: true,
      })
      .catch(() => undefined);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log('DoD summary');
  console.log('========================================================================');
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`   ${r.ok ? 'PASS' : 'FAIL'} ${r.name}`);
  }
  console.log(
    failed.length === 0
      ? '\n   RESULT: PASS — Vertical Slice #1 DoD green\n'
      : `\n   RESULT: FAIL — ${failed.length} item(s)\n`,
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
