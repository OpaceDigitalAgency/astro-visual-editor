import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const demoSource = fileURLToPath(new URL('../../demo/src/pages/index.astro', import.meta.url));

async function enableEditor(page: import('@playwright/test').Page) {
  const toolbar = page.locator('astro-dev-toolbar');
  await toolbar.getByRole('button', { name: 'Visual Editor' }).click();
  return { toolbar, workbench: toolbar.locator('.workbench') };
}

async function clickRevertWhenStable(page: import('@playwright/test').Page): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const revert = page.locator('astro-dev-toolbar').last().locator('.workbench .revert').last();
    try {
      if (await revert.count() && await revert.evaluate((button: HTMLButtonElement) => !button.disabled)) {
        // Dispatch synchronously inside the toolbar's shadow DOM. A normal
        // locator click can succeed and then reject when the resulting source
        // write immediately replaces the toolbar during Astro HMR.
        await revert.evaluate((button: HTMLButtonElement) => button.click());
        return;
      }
    } catch {
      // Astro HMR can replace the toolbar node between resolution and click.
    }
    await page.waitForTimeout(250);
  }
  throw new Error('The durable revert control never became stable.');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews text, undo/redo, section drag/drop, templates, deletion and SEO', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  const { toolbar, workbench } = await enableEditor(page);
  await expect(workbench).toBeVisible();
  await expect(toolbar.getByText('Connected. Changes remain local until committed.')).toBeVisible();

  const lead = page.locator('[data-astro-edit-id="hero-lead"]');
  const originalLead = (await lead.textContent())!.trim();
  await lead.click();
  const textDialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
  await textDialog.locator('textarea').fill('Browser workflow preview copy.');
  await textDialog.getByRole('button', { name: 'Queue change' }).click();
  await expect(lead).toHaveText('Browser workflow preview copy.');
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(lead).toHaveText(originalLead);
  await workbench.getByRole('button', { name: 'Redo', exact: true }).click();
  await workbench.getByRole('button', { name: 'Clear' }).click();

  await workbench.getByRole('tab', { name: 'Sections' }).click();
  const source = page.getByRole('button', { name: 'Drag preview to reorder' });
  const target = page.locator('[data-section="review"]');
  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + 40, targetBox.y + targetBox.height - 10, { steps: 14 });
  await page.mouse.up();
  await expect(page.locator('[data-astro-edit-region="home-principles"] > section').first()).toHaveAttribute('data-section', 'review');
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  await page.getByRole('button', { name: 'Add section after preview' }).click();
  await toolbar.locator('dialog').filter({ hasText: 'Add a section' }).getByRole('button', { name: /Text/ }).click();
  await expect(page.locator('[data-section^="text-"]')).toHaveCount(1);
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  await page.getByRole('button', { name: 'Delete section review' }).click();
  await toolbar.getByRole('button', { name: 'Delete section', exact: true }).click();
  await expect(page.locator('[data-section="review"]')).toHaveCount(0);
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  await workbench.getByRole('tab', { name: 'SEO' }).click();
  const seoDialog = toolbar.locator('dialog').filter({ hasText: 'Edit SEO' });
  await seoDialog.locator('[name="title"]').fill('Queued browser SEO title');
  await seoDialog.getByRole('button', { name: 'Queue SEO change' }).click();
  await expect(page).toHaveTitle('Queued browser SEO title');
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page).toHaveTitle('Astro Visual Editor demo');
});

test('commits through HMR and reverts from a durable receipt', async ({ page }) => {
  test.setTimeout(60_000);
  const originalSource = await readFile(demoSource, 'utf8');
  try {
    await page.setViewportSize({ width: 1440, height: 980 });
    let { toolbar, workbench } = await enableEditor(page);
    const lead = page.locator('[data-astro-edit-id="hero-lead"]');
    const originalText = (await lead.textContent())!.trim();
    await lead.click();
    const dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await dialog.locator('textarea').fill('Committed browser test copy.');
    await dialog.getByRole('button', { name: 'Queue change' }).click();
    await workbench.getByRole('button', { name: /Commit 1 change/ }).click();
    await expect(lead).toHaveText('Committed browser test copy.', { timeout: 15_000 });

    toolbar = page.locator('astro-dev-toolbar');
    workbench = toolbar.locator('.workbench');
    if (!(await workbench.isVisible())) await toolbar.getByRole('button', { name: 'Visual Editor' }).click();
    await expect(workbench.getByRole('button', { name: 'Revert last commit' })).toBeEnabled({ timeout: 15_000 });
    await clickRevertWhenStable(page);
    await expect(lead).toHaveText(originalText, { timeout: 15_000 });
    await expect.poll(async () => readFile(demoSource, 'utf8')).toBe(originalSource);
  } finally {
    if ((await readFile(demoSource, 'utf8')) !== originalSource) await writeFile(demoSource, originalSource);
  }
});

test('isolates save responses and queues between two browser tabs', async ({ browser }) => {
  test.setTimeout(60_000);
  const originalSource = await readFile(demoSource, 'utf8');
  const context = await browser.newContext({ baseURL: 'http://localhost:4357', viewport: { width: 1440, height: 980 } });
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  try {
    await Promise.all([pageA.goto('/'), pageB.goto('/')]);
    const editorA = await enableEditor(pageA);
    const editorB = await enableEditor(pageB);

    await pageA.locator('[data-demo-banner]').click();
    const dialogA = editorA.toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await dialogA.locator('textarea').fill('Committed only from tab A');
    await dialogA.getByRole('button', { name: 'Queue change' }).click();

    await pageB.locator('[data-astro-edit-id="hero-title"]').click();
    const dialogB = editorB.toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await dialogB.locator('textarea').fill('Queued only in tab B');
    await dialogB.getByRole('button', { name: 'Queue change' }).click();
    await expect(editorB.workbench.getByRole('button', { name: /Commit 1 change/ })).toBeEnabled();

    await editorA.workbench.getByRole('button', { name: /Commit 1 change/ }).click();
    await expect(pageA.locator('[data-demo-banner]')).toHaveText('Committed only from tab A', { timeout: 15_000 });
    await expect(pageB.locator('[data-astro-edit-id="hero-title"]')).toHaveText('Queued only in tab B');
    await expect(pageB.locator('astro-dev-toolbar').locator('.workbench').getByRole('button', { name: /Commit 1 change/ })).toBeEnabled();

    const toolbarA = pageA.locator('astro-dev-toolbar');
    const workbenchA = toolbarA.locator('.workbench');
    if (!(await workbenchA.isVisible())) await toolbarA.getByRole('button', { name: 'Visual Editor' }).click();
    await expect(workbenchA.getByRole('button', { name: 'Revert last commit' })).toBeEnabled({ timeout: 15_000 });
    await clickRevertWhenStable(pageA);
    await expect.poll(async () => readFile(demoSource, 'utf8')).toBe(originalSource);
    await pageB.locator('astro-dev-toolbar').locator('.workbench').getByRole('button', { name: 'Clear' }).click();
  } finally {
    if ((await readFile(demoSource, 'utf8')) !== originalSource) await writeFile(demoSource, originalSource);
    await context.close();
  }
});

test('supports mobile pick mode, keyboard section controls and WCAG-critical states', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://localhost:4357', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/');
  const { toolbar, workbench } = await enableEditor(page);
  const picker = toolbar.locator('.picker');
  await expect(picker).toBeVisible();
  await expect(workbench).toBeHidden();

  await page.locator('[data-astro-edit-id="hero-lead"]').tap();
  const textDialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
  await expect(textDialog).toBeVisible();
  await expect(textDialog.locator('textarea')).toBeFocused();
  await textDialog.getByRole('button', { name: 'Cancel' }).click();
  await picker.getByRole('button', { name: 'Review 0' }).click();
  await workbench.getByRole('tab', { name: 'Sections' }).click();
  const move = page.getByRole('button', { name: 'Move preview down' });
  await move.focus();
  await move.press('Enter');
  await expect(page.locator('[data-astro-edit-region="home-principles"] > section').first()).toHaveAttribute('data-section', 'review');
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).include('astro-dev-toolbar').analyze();
  expect(results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious')).toEqual([]);
  await context.close();
});
