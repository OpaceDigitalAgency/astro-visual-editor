import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const demoSource = fileURLToPath(new URL('../../demo/src/pages/index.astro', import.meta.url));
const editabilityPolicySource = fileURLToPath(
  new URL('../../demo/astro-visual-editor.policy.json', import.meta.url),
);
const complexJsonSource = fileURLToPath(
  new URL('../../demo/src/data/complex-page.json', import.meta.url),
);
const complexCollectionSource = fileURLToPath(
  new URL('../../demo/src/content/case-studies/harbour.md', import.meta.url),
);
const complexRouteSource = fileURLToPath(
  new URL('../../demo/src/pages/fixtures/complex.astro', import.meta.url),
);
const complexComponentSource = fileURLToPath(
  new URL('../../demo/src/components/EvidenceGrid.astro', import.meta.url),
);
const complexLayoutSource = fileURLToPath(
  new URL('../../demo/src/layouts/DemoLayout.astro', import.meta.url),
);

async function enableEditor(page: import('@playwright/test').Page) {
  const toolbar = page.locator('astro-dev-toolbar').last();
  const workbench = toolbar.locator('.workbench');
  if (!(await workbench.isVisible().catch(() => false))) {
    await toolbar.getByRole('button', { name: 'Visual Editor' }).click();
  }
  return { toolbar, workbench: toolbar.locator('.workbench') };
}

async function restoreFromHistory(page: import('@playwright/test').Page): Promise<void> {
  // Do not force a reload while Astro is already applying the source-write
  // HMR update; two competing navigations can abort one another in Chromium.
  await page.waitForTimeout(1_000);
  await waitForWorkbenchButtonEnabled(page, 'History');
  const historyButtons = page
    .locator('astro-dev-toolbar')
    .locator('.workbench')
    .getByRole('button', { name: 'History' });
  for (let index = (await historyButtons.count()) - 1; index >= 0; index -= 1) {
    const history = historyButtons.nth(index);
    if (await history.isEnabled()) {
      await history.evaluate((button: HTMLButtonElement) => button.click());
      break;
    }
  }
  const restores = page
    .locator('astro-dev-toolbar')
    .locator('dialog')
    .filter({ hasText: 'Saved changes' })
    .getByRole('button', { name: /Restore saved changes/ });
  await expect(restores.filter({ visible: true }).first()).toBeVisible();
  await restores
    .filter({ visible: true })
    .first()
    .evaluate((button: HTMLButtonElement) => button.click());
}

async function waitForWorkbenchButtonEnabled(
  page: import('@playwright/test').Page,
  name: string | RegExp,
  timeout = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 2_000 });
      // Astro can briefly retain an outgoing toolbar while installing its HMR
      // replacement. Accept the enabled control from any connected instance.
      const toolbars = page.locator('astro-dev-toolbar');
      const buttons = toolbars.locator('.workbench').getByRole('button', { name });
      for (let index = (await buttons.count()) - 1; index >= 0; index -= 1) {
        if (await buttons.nth(index).isEnabled()) return;
      }
      const openers = toolbars.getByRole('button', { name: 'Visual Editor' });
      for (let index = (await openers.count()) - 1; index >= 0; index -= 1) {
        const opener = openers.nth(index);
        if ((await opener.isVisible()) && (await opener.isEnabled())) {
          await opener.click();
          break;
        }
      }
    } catch {
      // The source write can replace the toolbar while Astro completes HMR.
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`The ${String(name)} control did not become enabled after HMR.`);
}

async function reviewAndCommit(
  toolbar: import('@playwright/test').Locator,
  workbench: import('@playwright/test').Locator,
): Promise<void> {
  await workbench.getByRole('button', { name: /Review 1 file change/ }).click();
  const review = toolbar.locator('dialog').filter({ hasText: 'Review file changes' });
  await expect(review).toBeVisible();
  expect(await review.locator('.diff-line.remove').count()).toBeGreaterThan(0);
  expect(await review.locator('.diff-line.add').count()).toBeGreaterThan(0);
  const commit = review.getByRole('button', { name: 'Commit these changes' });
  await expect(commit).toBeEnabled();
  // The click intentionally writes source and can replace the toolbar before
  // Playwright finishes its pointer action. Dispatch once from the confirmed
  // enabled control, then let the caller verify the resulting HMR state.
  await commit.dispatchEvent('click');
}

async function closePagesAfterHmr(pages: import('@playwright/test').Page[]): Promise<void> {
  // Closing a whole context while Astro is replacing several documents can
  // occasionally stall Chromium. Close each page without unload handlers and
  // let Playwright dispose the now-empty context with the browser fixture.
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    void Promise.allSettled(
      pages.map(async (page) => {
        if (!page.isClosed()) await page.close({ runBeforeUnload: false });
      }),
    ).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('previews text, undo/redo, section drag/drop, templates, deletion and SEO', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  const { toolbar, workbench } = await enableEditor(page);
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole('button', { name: 'Simple demo' })).toBeVisible();
  await expect(workbench.getByRole('button', { name: 'Complex sources' })).toBeVisible();
  const workbenchBox = (await workbench.boundingBox())!;
  expect(workbenchBox.width).toBeLessThanOrEqual(401);
  expect(workbenchBox.height).toBeLessThanOrEqual(611);
  await expect(toolbar.getByText('Connected. Changes remain local until committed.')).toBeVisible();

  await workbench.getByRole('button', { name: 'Collapse editor' }).click();
  await expect(workbench).toBeHidden();
  const picker = toolbar.locator('.picker');
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Expand' }).click();
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole('tab', { name: 'Text' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await workbench.getByRole('tab', { name: 'Text' }).click();

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
  await expect(workbench).toBeHidden();
  await expect(picker).toBeVisible();
  const firstControlsBox = (await page
    .locator('.astro-ve-section-controls')
    .first()
    .boundingBox())!;
  expect(firstControlsBox.width).toBeLessThanOrEqual(137);
  const source = page.getByRole('button', { name: 'Drag preview to reorder' });
  await expect(source).toHaveAttribute('title', 'Drag preview to reorder');
  await expect(source).toHaveAttribute('data-tooltip', 'Drag preview to reorder');
  const target = page.locator('[data-section="review"]');
  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + 40, targetBox.y + targetBox.height - 10, { steps: 14 });
  await page.mouse.up();
  await expect(
    page.locator('[data-astro-edit-region="home-principles"] > section').first(),
  ).toHaveAttribute('data-section', 'review');
  await picker.getByRole('button', { name: /Review 1/ }).click();
  await expect(workbench.locator('.change-summary')).toHaveText(
    'Reordered 3 sections in home-principles',
  );
  await expect(workbench.locator('.diff')).toContainText('Before: preview → review → commit');
  await expect(workbench.locator('.diff')).toContainText('After: review → preview → commit');
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await workbench.getByRole('tab', { name: 'Sections' }).click();

  await page.getByRole('button', { name: 'Add section after preview' }).click();
  await toolbar
    .locator('dialog')
    .filter({ hasText: 'Add a section' })
    .getByRole('button', { name: /Text/ })
    .click();
  await expect(page.locator('[data-section^="text-"]')).toHaveCount(1);
  await picker.getByRole('button', { name: /Review 1/ }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await workbench.getByRole('tab', { name: 'Sections' }).click();

  await page.getByRole('button', { name: 'Delete section review' }).click();
  await toolbar.getByRole('button', { name: 'Delete section', exact: true }).click();
  await expect(page.locator('[data-section="review"]')).toHaveCount(0);
  await picker.getByRole('button', { name: /Review 1/ }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  await workbench.getByRole('tab', { name: 'SEO' }).click();
  let seoDialog = toolbar.locator('dialog').filter({ hasText: 'Edit SEO' });
  await expect(seoDialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(seoDialog).toBeHidden();
  await workbench.getByRole('tab', { name: 'SEO' }).click();
  seoDialog = toolbar.locator('dialog').filter({ hasText: 'Edit SEO' });
  await seoDialog.locator('[name="title"]').fill('Queued browser SEO title');
  await seoDialog.getByRole('button', { name: 'Queue SEO change' }).click();
  await expect(page).toHaveTitle('Queued browser SEO title');
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page).toHaveTitle('Astro Visual Editor demo');
});

test('switches to the composed fixture and safely writes JSON plus collection frontmatter', async ({
  page,
}) => {
  test.setTimeout(75_000);
  const originalJson = await readFile(complexJsonSource, 'utf8');
  const originalCollection = await readFile(complexCollectionSource, 'utf8');
  try {
    const { workbench } = await enableEditor(page);
    await workbench.getByRole('button', { name: 'Complex sources' }).click();
    await expect(page).toHaveURL(/\/fixtures\/complex$/);
    await expect(page.locator('[data-demo-json-title]')).toHaveText(
      'A page assembled from trusted sources',
    );
    const { toolbar, workbench: complexWorkbench } = await enableEditor(page);

    await page.locator('[data-demo-json-title]').click();
    let dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(dialog).toContainText('src/data/complex-page.json → hero.title');
    await expect(dialog).toContainText('Shared source: this edit will affect 2 routes.');
    await dialog.locator('textarea').fill('A safely updated JSON title');
    await dialog.getByRole('button', { name: 'Queue change' }).click();

    await page.locator('[data-demo-collection-title]').click();
    dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(dialog).toContainText('src/content/case-studies/harbour.md → frontmatter.title');
    await dialog.locator('textarea').fill('Harbour launch plan, reviewed');
    await dialog.getByRole('button', { name: 'Queue change' }).click();
    await expect(
      complexWorkbench.getByRole('button', { name: /Review 2 file changes/ }),
    ).toBeEnabled();

    await complexWorkbench.getByRole('button', { name: /Review 2 file changes/ }).click();
    const review = toolbar.locator('dialog').filter({ hasText: 'Review file changes' });
    await expect(review).toContainText('src/data/complex-page.json');
    await expect(review).toContainText('src/content/case-studies/harbour.md');
    await review.getByRole('button', { name: 'Commit these changes' }).click();
    await expect
      .poll(async () => readFile(complexJsonSource, 'utf8'))
      .toContain('A safely updated JSON title');
    await expect
      .poll(async () => readFile(complexCollectionSource, 'utf8'))
      .toContain('Harbour launch plan, reviewed');

    await restoreFromHistory(page);
    await expect.poll(async () => readFile(complexJsonSource, 'utf8')).toBe(originalJson);
    await expect
      .poll(async () => readFile(complexCollectionSource, 'utf8'))
      .toBe(originalCollection);
    await expect(page.locator('[data-demo-json-title]')).toHaveText(
      'A page assembled from trusted sources',
    );
    await expect(page.locator('[data-demo-collection-title]')).toHaveText('Harbour launch plan');
    await waitForWorkbenchButtonEnabled(page, 'History');
  } finally {
    if ((await readFile(complexJsonSource, 'utf8')) !== originalJson)
      await writeFile(complexJsonSource, originalJson);
    if ((await readFile(complexCollectionSource, 'utf8')) !== originalCollection)
      await writeFile(complexCollectionSource, originalCollection);
  }
});

test('targets each repeated JSON-backed evidence card independently', async ({ page }) => {
  const { workbench } = await enableEditor(page);
  await workbench.getByRole('button', { name: 'Complex sources' }).click();
  await expect(page).toHaveURL(/\/fixtures\/complex$/);
  const { toolbar, workbench: complexWorkbench } = await enableEditor(page);
  const values = page.locator(
    '[data-astro-edit-path^="evidence."][data-astro-edit-path$=".value"]',
  );
  await expect(values).toHaveText([
    'Shared navigation and footer',
    'Reusable hero and proof cards',
    'Direct JSON properties',
  ]);

  await complexWorkbench.getByRole('tab', { name: 'Sections' }).click();
  await expect(complexWorkbench).toBeVisible();
  await expect(
    complexWorkbench.getByText('No reorderable section region is declared on this page.'),
  ).toBeVisible();
  await complexWorkbench.getByRole('tab', { name: 'Text' }).click();

  await values.nth(2).click();
  let dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
  await expect(dialog).toContainText('src/data/complex-page.json → evidence.2.value');
  await expect(dialog.locator('textarea')).toHaveValue('Direct JSON properties');
  await dialog.locator('textarea').fill('Direct JSON properties, updated');
  await dialog.getByRole('button', { name: 'Queue change' }).click();
  await expect(values).toHaveText([
    'Shared navigation and footer',
    'Reusable hero and proof cards',
    'Direct JSON properties, updated',
  ]);

  await values.nth(1).click();
  dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
  await expect(dialog).toContainText('src/data/complex-page.json → evidence.1.value');
  await expect(dialog.locator('textarea')).toHaveValue('Reusable hero and proof cards');
  await dialog.locator('textarea').fill('Reusable component proof, updated');
  await dialog.getByRole('button', { name: 'Queue change' }).click();
  await expect(values).toHaveText([
    'Shared navigation and footer',
    'Reusable component proof, updated',
    'Direct JSON properties, updated',
  ]);

  await complexWorkbench.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(values).toHaveText([
    'Shared navigation and footer',
    'Reusable hero and proof cards',
    'Direct JSON properties',
  ]);
});

test('commits and restores literal text owned by the route, component and layout', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const originals = new Map([
    [complexRouteSource, await readFile(complexRouteSource, 'utf8')],
    [complexComponentSource, await readFile(complexComponentSource, 'utf8')],
    [complexLayoutSource, await readFile(complexLayoutSource, 'utf8')],
  ]);
  try {
    const { workbench } = await enableEditor(page);
    await workbench.getByRole('button', { name: 'Complex sources' }).click();
    await expect(page).toHaveURL(/\/fixtures\/complex$/);
    const { toolbar, workbench: complexWorkbench } = await enableEditor(page);

    await page.getByText('Content Collection', { exact: true }).click();
    let dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(dialog).toContainText('src/pages/fixtures/complex.astro');
    await dialog.locator('textarea').fill('Collection source, reviewed');
    await dialog.getByRole('button', { name: 'Queue change' }).click();

    await page.getByText('What this route proves', { exact: true }).click();
    dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(dialog).toContainText('src/components/EvidenceGrid.astro');
    await dialog.locator('textarea').fill('What these components prove');
    await dialog.getByRole('button', { name: 'Queue change' }).click();

    await page.getByText('Recovery', { exact: true }).click();
    dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(dialog).toContainText('src/layouts/DemoLayout.astro');
    await dialog.locator('textarea').fill('Recovery, verified');
    await dialog.getByRole('button', { name: 'Queue change' }).click();

    await complexWorkbench.getByRole('button', { name: /Review 3 file changes/ }).click();
    const review = toolbar.locator('dialog').filter({ hasText: 'Review file changes' });
    await expect(review).toContainText('src/pages/fixtures/complex.astro');
    await expect(review).toContainText('src/components/EvidenceGrid.astro');
    await expect(review).toContainText('src/layouts/DemoLayout.astro');
    await review.getByRole('button', { name: 'Commit these changes' }).dispatchEvent('click');

    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('Collection source, reviewed');
    await expect
      .poll(async () => readFile(complexComponentSource, 'utf8'))
      .toContain('What these components prove');
    await expect
      .poll(async () => readFile(complexLayoutSource, 'utf8'))
      .toContain('Recovery, verified');

    await restoreFromHistory(page);
    for (const [file, original] of originals) {
      await expect.poll(async () => readFile(file, 'utf8')).toBe(original);
    }
    await expect(page.getByText('Content Collection', { exact: true })).toBeVisible();
    await expect(page.getByText('What this route proves', { exact: true })).toBeVisible();
    await expect(page.getByText('Recovery', { exact: true })).toBeVisible();
    await waitForWorkbenchButtonEnabled(page, 'History');
  } finally {
    for (const [file, original] of originals) {
      if ((await readFile(file, 'utf8')) !== original) await writeFile(file, original);
    }
  }
});

test('commits through HMR and restores from durable History', async ({ page }) => {
  test.setTimeout(60_000);
  const originalSource = await readFile(demoSource, 'utf8');
  try {
    await page.setViewportSize({ width: 1440, height: 980 });
    const { toolbar, workbench } = await enableEditor(page);
    const lead = page.locator('[data-astro-edit-id="hero-lead"]');
    const originalText = (await lead.textContent())!.trim();
    await lead.click();
    const dialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await dialog.locator('textarea').fill('Committed browser test copy.');
    await dialog.getByRole('button', { name: 'Queue change' }).click();
    await reviewAndCommit(toolbar, workbench);
    await expect(lead).toHaveText('Committed browser test copy.', { timeout: 15_000 });

    await restoreFromHistory(page);
    await expect(lead).toHaveText(originalText, { timeout: 15_000 });
    await expect.poll(async () => readFile(demoSource, 'utf8')).toBe(originalSource);
  } finally {
    if ((await readFile(demoSource, 'utf8')) !== originalSource)
      await writeFile(demoSource, originalSource);
  }
});

test('isolates save responses and queues between two browser tabs', async ({ browser }) => {
  // Source writes can cause more than one Astro HMR navigation on slower CI
  // runners. Keep the per-step limits strict but allow the full recovery flow
  // to settle before Playwright tears its pages down.
  test.setTimeout(90_000);
  const originalSource = await readFile(demoSource, 'utf8');
  const context = await browser.newContext({
    baseURL: 'http://localhost:4357',
    viewport: { width: 1440, height: 980 },
  });
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
    await waitForWorkbenchButtonEnabled(pageB, /Review 1 file change/);

    await reviewAndCommit(editorA.toolbar, editorA.workbench);
    await expect(pageA.locator('[data-demo-banner]')).toHaveText('Committed only from tab A', {
      timeout: 15_000,
    });
    await waitForWorkbenchButtonEnabled(pageB, /Review 1 file change/);
    await expect(pageB.locator('[data-astro-edit-id="hero-title"]')).toHaveText(
      'Queued only in tab B',
      { timeout: 30_000 },
    );
  } finally {
    if ((await readFile(demoSource, 'utf8')) !== originalSource)
      await writeFile(demoSource, originalSource);
    await closePagesAfterHmr([pageA, pageB]);
  }
});

test('supports mobile pick mode, keyboard section controls and WCAG-critical states', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://localhost:4357',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
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
  await picker.getByRole('button', { name: 'Expand' }).click();
  await workbench.getByRole('tab', { name: 'Sections' }).click();
  await expect(workbench).toBeHidden();
  const move = page.getByRole('button', { name: 'Move preview down' });
  await move.focus();
  await move.press('Enter');
  await expect(
    page.locator('[data-astro-edit-region="home-principles"] > section').first(),
  ).toHaveAttribute('data-section', 'review');
  await picker.getByRole('button', { name: /Review 1/ }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).include('astro-dev-toolbar').analyze();
  expect(
    results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'),
  ).toEqual([]);
  await context.close();
});

test('inventories page content and persists reviewed owner allow and deny policy', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const originalPolicy = await readFile(editabilityPolicySource, 'utf8');
  try {
    await writeFile(
      editabilityPolicySource,
      `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`,
    );
    await page.reload();
    await page.setViewportSize({ width: 1440, height: 980 });
    let { toolbar, workbench } = await enableEditor(page);
    await workbench.getByRole('button', { name: 'Open Editability Setup' }).click();
    await expect(workbench.getByRole('heading', { name: 'Editability Setup' })).toBeVisible();
    await expect(workbench.getByText('9 visible items')).toBeVisible();
    await expect(workbench.getByRole('button', { name: 'Blocked 3' })).toBeVisible();
    await expect(workbench.locator('.setup-toggle')).toHaveAccessibleName('Back to editor');
    await expect(workbench.getByText('Allow or block content')).toBeVisible();
    expect((await workbench.boundingBox())!.width).toBeLessThanOrEqual(461);
    expect(
      await page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).marginLeft)),
    ).toBeGreaterThanOrEqual(475);

    let previewLabel = workbench.locator('.inventory-item').filter({ hasText: '01 / PREVIEW' });
    await expect(previewLabel.locator('.inventory-status')).toHaveText('Blocked');
    await expect(previewLabel.locator('.inventory-reason')).toContainText(
      'not included by the current editability policy',
    );
    await previewLabel.getByRole('button', { name: 'Allow all <strong>' }).click();
    let policyReview = toolbar
      .locator('dialog')
      .filter({ hasText: 'Save this permission change?' });
    await expect(policyReview).toBeVisible();
    await expect(policyReview.locator('.diff-line.add')).toContainText(['"selector": "strong"']);
    await policyReview.getByRole('button', { name: 'Back to setup' }).click();
    await expect(workbench.getByText('Not saved yet')).toBeVisible();
    await expect(workbench.getByText('1 permission change will only work')).toBeVisible();
    await workbench.getByRole('button', { name: 'Review and save (1)' }).click();
    await expect(policyReview).toBeVisible();
    await policyReview.getByRole('button', { name: 'Save and return to editor' }).click();
    await expect(workbench.getByText(/You can now edit the allowed content/)).toBeVisible();
    ({ toolbar, workbench } = await enableEditor(page));

    await page.locator('[data-section="preview"] strong').click();
    let textDialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(textDialog).toBeVisible();
    await expect(textDialog.locator('.dialog-file')).toHaveText('src/pages/index.astro');
    await textDialog.getByRole('button', { name: 'Cancel' }).click();

    await workbench.getByRole('button', { name: 'Open Editability Setup' }).click();
    await expect(workbench.locator('.message')).toBeHidden();
    const inventoryBox = await workbench.locator('.ledger').boundingBox();
    const setupActionsBox = await workbench.locator('.setup-actions').boundingBox();
    expect(inventoryBox!.y + inventoryBox!.height).toBeLessThanOrEqual(setupActionsBox!.y);
    previewLabel = workbench.locator('.inventory-item').filter({ hasText: '01 / PREVIEW' });
    await expect(previewLabel.locator('.inventory-status')).toHaveText('Editable');
    await previewLabel.getByRole('button', { name: 'Block this item' }).click();
    await expect(previewLabel.locator('.inventory-status')).toHaveText('Blocked');
    policyReview = toolbar.locator('dialog').filter({ hasText: 'Save this permission change?' });
    await expect(policyReview.locator('.diff-line.add')).toContainText(['"effect": "deny"']);
    await policyReview.getByRole('button', { name: 'Save and return to editor' }).click();
    await expect(workbench.getByText(/You can now edit the allowed content/)).toBeVisible();
    ({ toolbar, workbench } = await enableEditor(page));

    await page.reload();
    ({ toolbar, workbench } = await enableEditor(page));
    await workbench.getByRole('button', { name: 'Open Editability Setup' }).click();
    previewLabel = workbench.locator('.inventory-item').filter({ hasText: '01 / PREVIEW' });
    const reviewLabel = workbench.locator('.inventory-item').filter({ hasText: '02 / REVIEW' });
    await expect(previewLabel.locator('.inventory-status')).toHaveText('Blocked');
    await expect(reviewLabel.locator('.inventory-status')).toHaveText('Editable');
    const results = await new AxeBuilder({ page }).include('astro-dev-toolbar').analyze();
    expect(
      results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'),
    ).toEqual([]);

    await page.goto('/fixtures/article');
    ({ toolbar, workbench } = await enableEditor(page));
    await workbench.getByRole('button', { name: 'Open Editability Setup' }).press('Enter');
    const unresolved = workbench
      .locator('.inventory-item')
      .filter({ hasText: 'This source needs owner confirmation.' });
    const unsafe = workbench
      .locator('.inventory-item')
      .filter({ hasText: 'Nested formatting must stay structurally safe.' });
    await expect(unresolved.locator('.inventory-status')).toHaveText('Unresolved');
    await expect(unsafe.locator('.inventory-status')).toHaveText('Unsafe');
    await expect(unsafe.getByRole('button', { name: /Allow/ })).toHaveCount(0);
    await unresolved.locator('[name="file"]').fill('src/pages/fixtures/article.astro');
    await unresolved.getByRole('button', { name: 'Confirm source and allow' }).click();
    policyReview = toolbar.locator('dialog').filter({ hasText: 'Save this permission change?' });
    await expect(
      policyReview
        .locator('.diff-line.add')
        .filter({ hasText: 'src/pages/fixtures/article.astro' }),
    ).toBeVisible();
    await policyReview.getByRole('button', { name: 'Save and return to editor' }).click();
    await expect(workbench.getByText(/You can now edit the allowed content/)).toBeVisible();
    ({ toolbar, workbench } = await enableEditor(page));
    await page.getByText('This source needs owner confirmation.').click();
    textDialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(textDialog).toBeVisible();
    await expect(textDialog.locator('.dialog-file')).toHaveText('src/pages/fixtures/article.astro');
    await textDialog.getByRole('button', { name: 'Cancel' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await workbench.getByRole('button', { name: 'Open Editability Setup' }).click();
    await expect(workbench).toBeVisible();
    expect((await workbench.boundingBox())!.width).toBeLessThanOrEqual(379);
    expect(
      (await workbench.getByRole('button', { name: /All / }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  } finally {
    await writeFile(editabilityPolicySource, originalPolicy);
  }
});
