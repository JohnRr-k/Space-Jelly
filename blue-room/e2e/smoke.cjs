/* End-to-end smoke test against a running build (default http://127.0.0.1:4173).
 * Run:  npm run build && npm run preview &  then  node e2e/smoke.cjs
 * Uses a fresh browser profile; creates clearly-labelled test records only inside that throwaway profile. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); if (!cond) process.exitCode = 1; };
let failN = 0;
const step = async (name, fn) => { try { await fn(); } catch (e) { try { const pg = global.__page; if (pg && process.env.SHOTS) { await pg.screenshot({ path: `${process.env.SHOTS}/fail-${++failN}.png` }); console.log('DEBUG', name, pg.url(), (await pg.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160)); } } catch {} ok(name, false, String(e.message).split('\n').filter((l) => /locator|waiting for|strict|Timeout/.test(l)).slice(0, 2).join(' / ') || String(e.message).slice(0, 200)); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.grantPermissions([]);
  const page = await ctx.newPage(); global.__page = page;
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(() => { localStorage.setItem('blueroom.introSeen', '1'); sessionStorage.setItem('blueroom.session', '1'); });
  const go = async (hash) => { for (let i = 0; i < 3; i++) await page.keyboard.press('Escape'); await page.goto(BASE + '#' + hash); await page.waitForTimeout(400); const cur = await page.evaluate(() => location.hash); if (cur.split('#')[1] !== hash.split('#')[0] && cur !== '#' + hash) { console.log('NAV-RETRY', hash, 'was', cur); await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(500); } };
  const toastSeen = (t) => page.locator('.toasts').getByText(t, { exact: false }).first().waitFor({ timeout: 4000 }).then(() => true).catch(() => false);

  await page.goto(BASE);
  await step('onboarding appears and completes', async () => {
    await page.waitForSelector('text=Welcome to your Blue Room');
    await page.fill('input >> nth=0', 'Janice');
    for (let i = 0; i < 4; i++) await page.click('button:has-text("Continue")');
    await page.click('button:has-text("Enter your room")');
    await page.waitForSelector('h1:has-text("Welcome back, Janice.")');
    ok('onboarding → room greeting', true);
  });

  await step('room hotspots are keyboard-reachable links', async () => {
    const n = await page.locator('svg [role="link"]').count();
    ok('8 interactive room objects', n === 8, `found ${n}`);
    await page.locator('svg .hs-journal').click();
    await page.waitForURL(/#\/journal/);
    ok('journal hotspot navigates', true);
  });

  // ---------------- journal
  await step('journal create / autosave / persist / edit / delete', async () => {
    await go('/journal/new');
    await page.waitForSelector('textarea[aria-label="Entry text"]');
    await page.fill('input[aria-label="Title"]', 'QA entry one');
    await page.fill('textarea[aria-label="Entry text"]', 'Writing a test entry about rain.');
    await page.waitForSelector('.save-status:has-text("Draft saved")', { timeout: 5000 });
    ok('autosave draft', true);
    await page.click('button:has-text("Keep entry")');
    ok('keep entry toast', await toastSeen('Entry saved'));
    await page.reload(); await page.waitForTimeout(800);
    ok('entry persists after reload', (await page.locator('.entry-row').count()) === 1);
    await page.click('.entry-row');
    await page.fill('input[aria-label="Title"]', 'QA entry edited');
    await page.waitForTimeout(1500);
    await page.reload(); await page.waitForTimeout(800);
    ok('edit persists', (await page.locator('.entry-row').first().innerText()).includes('QA entry edited'));
    await page.fill('input[type="search"][aria-label="Search journal"]', 'rain');
    ok('journal search finds entry', (await page.locator('.entry-row').count()) === 1);
    await page.fill('input[type="search"][aria-label="Search journal"]', 'zzzz');
    ok('journal search empty state', (await page.locator('.entry-row').count()) === 0);
    await page.fill('input[type="search"][aria-label="Search journal"]', '');
    await page.click('.entry-row');
    await page.click('button:has-text("Promote to memory")');
    ok('promote to memory', await toastSeen('Legacy'));
    await page.click('button:has-text("Delete")');
    await page.click('dialog[open] button:has-text("Delete entry")');
    await page.waitForTimeout(600);
    ok('delete entry (confirmed)', (await page.locator('.entry-row').count()) === 0);
  });

  // ---------------- legacy: memory with photo, timeline, person, link
  await step('legacy memory + attachment + people + links', async () => {
    await go('/legacy/memories');
    ok('promoted memory present', (await page.locator('.polaroid').count()) === 1);
    await go('/legacy/people');
    await page.locator('main button:has-text("Add a person")').first().click();
    await page.fill('dialog[open] input >> nth=0', 'QA Mara');
    await page.click('dialog[open] button:has-text("Save")');
    ok('person saved', await toastSeen('Person added'));
    await go('/legacy/memories');
    await page.locator('main button:has-text("Save a memory")').first().click();
    await page.fill('dialog[open] input >> nth=0', 'QA Beach day');
    // 1x1 png upload
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('dialog[open] input[type=file]', { name: 'tiny.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('dialog[open] .attach img');
    ok('photo attached', true);
    await page.setInputFiles('dialog[open] input[type=file]', { name: 'bad.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('x') });
    ok('invalid file rejected', await page.locator('dialog[open] .err').first().isVisible());
    await page.click('dialog[open] button:has-text("Link something")');
    await page.selectOption('select[aria-label="Type of record"]', 'person');
    await page.locator('dialog[open] .picker-list button', { hasText: 'QA Mara' }).first().click();
    await page.click('dialog[open] button:has-text("Done")');
    await page.click('dialog[open] button:has-text("Save")');
    await page.waitForTimeout(600);
    await page.click('.polaroid:has-text("QA Beach day")');
    ok('memory detail shows linked person + photo', (await page.locator('dialog[open]').innerText()).includes('QA Mara') && (await page.locator('dialog[open] .attach img').count()) === 1);
    await page.keyboard.press('Escape');
    await go('/legacy/timeline');
    await page.locator('main button:has-text("Add a moment")').first().click();
    await page.fill('dialog[open] input >> nth=0', 'QA Moved cities');
    await page.click('dialog[open] button:has-text("Save")');
    ok('timeline event', await toastSeen('added'));
    for (const [path, btn, label] of [['/legacy/chapters', 'Begin a chapter', 'QA Chapter'], ['/legacy/odyssey', 'Add an experience', 'QA See auroras'], ['/legacy/places', 'Add a place', 'QA Harbour'], ['/legacy/lessons', 'Record a lesson', 'QA Lesson'], ['/legacy/achievements', 'Record a milestone', 'QA Achievement']]) {
      await go(path); await page.locator(`main button:has-text("${btn}")`).first().click(); await page.fill('dialog[open] input >> nth=0', label); await page.click('dialog[open] button:has-text("Save")');
      ok(`${label} saved`, await toastSeen('added'));
    }
    await go('/legacy/letters');
    await page.locator('main button:has-text("Write a letter")').first().click();
    await page.fill('dialog[open] input >> nth=0', 'QA Letter');
    await page.locator('dialog[open] textarea').last().fill('Dear me, hello from the test.');
    await page.click('dialog[open] button:has-text("Save")');
    ok('letter saved', await toastSeen('added'));
    await go('/legacy/odyssey');
    await page.click('.odyssey-card');
    await page.click('dialog[open] button.chip:has-text("Experienced")');
    await page.click('dialog[open] button:has-text("Save this as a memory")');
    ok('odyssey → memory', await toastSeen('Saved as a memory'));
  });

  // ---------------- goals
  await step('goal create / milestone / progress / complete / archive', async () => {
    await go('/future');
    await page.locator('main button:has-text("Create a goal")').first().click();
    await page.fill('dialog[open] input >> nth=0', 'QA Sail a boat');
    await page.click('dialog[open] button:has-text("Add milestone")');
    await page.fill('dialog[open] input[aria-label="Milestone 1 title"]', 'First lesson');
    await page.click('dialog[open] button:has-text("Add milestone")');
    await page.fill('dialog[open] input[aria-label="Milestone 2 title"]', 'Solo sail');
    await page.click('dialog[open] button:has-text("Save goal")');
    ok('goal created', await toastSeen('Goal created'));
    await page.click('.goal-card');
    await page.click('dialog[open] .milestones li:first-child input');
    await page.waitForTimeout(400);
    ok('progress 50% from milestones', (await page.locator('dialog[open]').innerText()).includes('50%'));
    await page.click('dialog[open] .milestones li:last-child input'); await page.waitForTimeout(300);
    await page.click('dialog[open] button:has-text("Mark goal complete")');
    await page.waitForTimeout(400);
    ok('completed with date', (await page.locator('dialog[open]').innerText()).includes('Completed on'));
    await page.click('dialog[open] button:has-text("Archive")');
    await page.keyboard.press('Escape');
    await page.click('button:has-text("Archive")');
    ok('archived goal in archive view', (await page.locator('.goal-card').count()) === 1);
  });

  // ---------------- calendar
  await step('calendar events: create / recurring / complete / reschedule / delete / views', async () => {
    await go('/calendar');
    await page.click('button:has-text("New event")');
    await page.fill('dialog[open] input >> nth=0', 'QA Dentist');
    await page.selectOption('dialog[open] select >> nth=0', 'weekly');
    await page.click('dialog[open] button:has-text("Save event")');
    ok('recurring event created', await toastSeen('Event added'));
    ok('shows in month view', (await page.locator('.ev-pill', { hasText: 'QA Dentist' }).count()) >= 1);
    for (const v of ['Week', 'Day', 'Upcoming', 'Month']) { await page.click(`.segmented button:has-text("${v}")`); await page.waitForTimeout(250); }
    ok('all four views render', true);
    await page.click('.ev-pill:has-text("QA Dentist") >> nth=0');
    await page.click('dialog[open] button:has-text("Mark this one complete")');
    ok('complete one occurrence', await toastSeen('complete'));
    await page.click('dialog[open] button:has-text("Reschedule")');
    await page.click('dialog[open] button:has-text("Move it")');
    await page.waitForTimeout(500);
    await page.fill('input[aria-label="Search events"]', 'Dentist');
    ok('event search', (await page.locator('.agenda-row').count()) >= 1);
    await page.fill('input[aria-label="Search events"]', '');
    for (let i = 0; i < 4 && (await page.locator('.ev-pill', { hasText: 'QA Dentist' }).count()) > 0; i++) {
      await page.locator('.ev-pill', { hasText: 'QA Dentist' }).first().click();
      await page.click('dialog[open] button:has-text("Delete")');
      const series = page.locator('dialog[open] button:has-text("The whole series")');
      if (await series.count()) await series.click();
      await page.locator('dialog[open]').last().locator('button:has-text("Delete")').last().click().catch(() => {});
      await page.waitForTimeout(500);
    }
    ok('series deleted', (await page.locator('.ev-pill', { hasText: 'QA Dentist' }).count()) === 0);
    await page.click('button:has-text("Remind me")');
    await page.fill('dialog[open] input >> nth=0', 'QA custom reminder');
    await page.click('dialog[open] button:has-text("Set reminder")');
    ok('custom reminder set', await toastSeen('Reminder set'));
  });

  // ---------------- reminders fire (in-app)
  await step('reminder engine surfaces a due reminder honestly', async () => {
    await go('/calendar');
    await page.click('button:has-text("New event")');
    await page.fill('dialog[open] input >> nth=0', 'QA due-now event');
    const now = await page.evaluate(() => { const d = new Date(Date.now() + 60000); return d.toTimeString().slice(0, 5); });
    await page.fill('dialog[open] input[type=time] >> nth=0', now);
    await page.click('dialog[open] button.chip:has-text("At the time")');
    await page.click('dialog[open] button:has-text("Save event")');
    await toastSeen('Event added');
    await page.waitForTimeout(65000);
    await page.click('button[aria-label^="Notifications"]');
    const txt = await page.locator('.notif').innerText();
    ok('due reminder appears in bell', txt.includes('QA due-now event'), txt.slice(0, 80));
    ok('bell is honest about closed-browser limits', /blocked|only while|while The Blue Room is open/i.test(txt));
    await page.keyboard.press('Escape');
  });

  // ---------------- notes
  await step('notes: quick add / pin / edit / convert / delete', async () => {
    await go('/notes');
    await page.fill('#quick-note', 'QA quick thought');
    await page.locator('form.quick-capture button:has-text("Add note")').click();
    ok('note added', await toastSeen('Note added'));
    await page.click('button[aria-label="Pin note"]'); await page.waitForTimeout(500);
    ok('note pinned', (await page.locator('.sticky.pinned').count()) === 1);
    await page.click('button[aria-label="Add to journal"]');
    ok('note → journal', await toastSeen('journal'));
    await page.click('.sticky-body');
    await page.fill('dialog[open] textarea', 'QA quick thought edited');
    await page.click('dialog[open] button:has-text("Save")');
    await page.click('.sticky-body');
    await page.click('dialog[open] button:has-text("Delete")');
    await page.click('dialog[open] button:has-text("Delete") >> nth=-1');
    await page.waitForTimeout(500);
    ok('note deleted', (await page.locator('.sticky').count()) === 0);
  });

  // ---------------- oracle
  await step('oracle: record → frozen → reflect → replay → wisdom', async () => {
    await go('/oracle/decisions/new');
    await page.waitForSelector('.decision-form');
    await page.getByLabel(/^Decision/).first().fill('QA Which path');
    await page.getByLabel('Name').nth(0).fill('Take the offer');
    await page.getByLabel('Name').nth(1).fill('Stay put');
    await page.locator('.decision-form textarea').nth(1).fill('We need to choose');
    await page.waitForTimeout(1800);
    ok('draft autosaved', (await page.locator('text=Draft saved').count()) >= 1);
    await page.click('button:has-text("Record decision")');
    ok('validation blocks thin record', await page.locator('.callout.warn').isVisible());
    await page.getByLabel(/Why this one/).fill('It feels right and the numbers work.');
    await page.getByLabel(/What you expect to happen/).fill('A calmer year.');
    await page.getByLabel('Chosen option').selectOption({ label: 'Take the offer' });
    await page.click('button:has-text("Record decision")');
    await page.click('dialog[open] button:has-text("Record it")');
    await page.waitForSelector('.frozen');
    ok('decision recorded & frozen view', true);
    ok('no edit control on recorded decision', (await page.locator('.frozen button:has-text("Edit")').count()) === 0);
    await page.click('button:has-text("Reflect on the outcome")');
    await page.getByLabel('What actually happened?').fill('It went fine.');
    await page.getByLabel('Was the expected result achieved?').selectOption('partly');
    await page.click('dialog[open] button:has-text("Save reflection")');
    ok('reflection saved separately', await toastSeen('Reflection saved'));
    ok('original reasoning still intact', (await page.locator('.frozen').innerText()).includes('It feels right and the numbers work.'));
    await page.click('a:has-text("Replay")');
    await page.waitForSelector('.replay-card');
    let text0 = await page.locator('.replay-card').innerText();
    ok('replay hides outcome at start', !text0.includes('It went fine.'));
    for (let i = 0; i < 5; i++) await page.click('.replay-card button:has-text("Begin replay"), .replay-card button:has-text("Continue"), .replay-card button:has-text("Skip & reveal")');
    await page.waitForSelector('text=What I chose');
    await page.click('.replay-card button:has-text("Continue")');
    ok('outcome revealed only at step 7', (await page.locator('.replay-card').innerText()).includes('It went fine.'));
    await page.click('.replay-card button:has-text("Continue")');
    await page.getByLabel('What I understand differently now').fill('Trust the process.');
    await page.click('button:has-text("Save replay notes")');
    ok('replay notes saved', await toastSeen('Replay notes saved'));
    await page.click('button:has-text("Add to Wisdom")');
    await page.fill('dialog[open] input >> nth=0', 'QA Principle');
    await page.click('dialog[open] button:has-text("Save")');
    ok('wisdom entry created from decision', await toastSeen('added'));
  });

  // ---------------- search, export, import
  await step('global search + export + import round-trip', async () => {
    await go('/search?q=QA');
    await page.waitForTimeout(800);
    ok('global search spans modules', (await page.locator('section[aria-label]').count()) >= 5);
    await go('/settings#data');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download backup")')]);
    const path = await dl.path();
    const fs = require('fs');
    const json = JSON.parse(fs.readFileSync(path, 'utf8'));
    ok('backup file has expected shape', json.format === 'blue-room-backup' && json.tables.decisions.length === 1 && json.tables.attachments.length >= 1);
    const [md] = await Promise.all([page.waitForEvent('download').catch(() => null), page.click('button:has-text("Journal as Markdown")')]);
    // wipe then import
    await page.click('button:has-text("Erase all data on this device")');
    await page.fill('dialog[open] input', 'erase');
    await page.click('dialog[open] button:has-text("Erase all data")');
    await page.waitForTimeout(1500);
    await page.addInitScript(() => {});
    await go('/settings#data');
    await page.waitForTimeout(800);
    const skip = page.locator('button:has-text("Skip for now")'); if (await skip.count()) await skip.click();
    await page.setInputFiles('input[type=file][accept*=json]', path);
    await page.waitForSelector('dialog[open] :text("This backup is valid")');
    await page.click('dialog[open] .segmented button:has-text("Replace everything")');
    await page.fill('dialog[open] input[type=text], dialog[open] input:not([type])', 'replace');
    await page.click('dialog[open] button:has-text("Replace everything") >> nth=-1');
    await page.waitForTimeout(2500);
    await go('/oracle/decisions');
    await page.waitForTimeout(800);
    ok('decision restored from backup', (await page.locator('.decision-card:has-text("QA Which path")').count()) === 1);
    await go('/legacy/memories'); await page.waitForTimeout(800);
    ok('memory photo restored', (await page.locator('.polaroid-img').count()) >= 1);
  });

  // ---------------- responsive
  await step('mobile layout: no horizontal overflow, bottom nav, room tiles', async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    await mp.addInitScript(() => { localStorage.setItem('blueroom.introSeen', '1'); sessionStorage.setItem('blueroom.session', '1'); });
    await mp.goto(BASE); await mp.waitForSelector('text=Welcome to your Blue Room'); await mp.waitForTimeout(1200); await mp.locator('button:has-text("Skip for now")').click({ force: true });
    await mp.waitForTimeout(800);
    for (const p of ['/', '/journal', '/legacy', '/legacy/timeline', '/oracle', '/future', '/calendar', '/notes', '/settings']) {
      await mp.goto(BASE + '#' + p); await mp.waitForTimeout(700);
      const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(`no horizontal overflow at 390px on ${p}`, over <= 1, `overflow ${over}px`);
    }
    await mp.goto(BASE + '#/'); await mp.waitForTimeout(500);
    ok('bottom nav present on phone', await mp.locator('.bottomnav').isVisible());
    ok('room tiles instead of the big scene on phone', (await mp.locator('.tile').count()) === 8 && (await mp.locator('.scene').count()) === 0);
    if (process.env.SHOTS) await mp.screenshot({ path: process.env.SHOTS + '/mobile-room.png' });
    await m.close();
  });

  ok('no console errors during the run', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.map((r) => `${r[0]}  ${r[1]}${r[2] ? '  — ' + r[2] : ''}`).join('\n'));
  console.log(`\n${results.filter((r) => r[0] === 'PASS').length} passed, ${results.filter((r) => r[0] === 'FAIL').length} failed`);
  await browser.close();
})();
