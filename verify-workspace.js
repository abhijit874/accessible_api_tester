const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture all console messages
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  await page.goto('http://127.0.0.1:5000', { waitUntil: 'networkidle' });

  // Navigate to Workspaces panel
  const workspaceBtn = page.getByRole('button', { name: /workspace/i }).first();
  await workspaceBtn.click();
  await page.waitForTimeout(500);

  // Screenshot before creating workspace
  await page.screenshot({ path: 'verify-before.png', fullPage: true });

  // Type workspace name and submit
  const input = page.getByLabel(/workspace name/i).or(page.locator('input[placeholder*="workspace" i]')).first();
  await input.fill('VerifyTest Workspace');

  const createBtn = page.getByRole('button', { name: /create workspace/i });
  await createBtn.click();

  // Wait for announcement/status message
  await page.waitForTimeout(1500);

  // Capture status/announcement text
  const statusText = await page.locator('[role="status"], [aria-live], .status-bar, .announcement, [class*="status"], [class*="announce"]')
    .allInnerTexts().catch(() => []);

  // Screenshot after creating workspace
  await page.screenshot({ path: 'verify-after.png', fullPage: true });

  // Also grab full page text for the announcement area
  const bodyText = await page.locator('body').innerText();
  const lines = bodyText.split('\n').filter(l => l.includes('workspace') || l.includes('Workspace') || l.includes('Switched'));

  console.log('=== Status/Announcement elements ===');
  console.log(JSON.stringify(statusText, null, 2));
  console.log('=== Lines mentioning workspace ===');
  console.log(lines.join('\n'));
  console.log('=== Console logs ===');
  console.log(logs.join('\n'));

  await browser.close();
})();
