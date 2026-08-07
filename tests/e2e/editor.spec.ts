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
const complexHeroSource = fileURLToPath(
  new URL('../../demo/src/components/SourceHero.astro', import.meta.url),
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

async function ensureDetailsOpen(details: import('@playwright/test').Locator): Promise<void> {
  if ((await details.getAttribute('open')) === null)
    await details.locator(':scope > summary').click();
  await expect(details).toHaveAttribute('open', '');
}

async function restoreFromHistory(page: import('@playwright/test').Page): Promise<void> {
  // Do not force a reload while Astro is already applying the source-write
  // HMR update; two competing navigations can abort one another in Chromium.
  await page.waitForTimeout(1_000);
  await waitForWorkbenchButtonEnabled(page, /Open changes tray/);
  const trayButtons = page
    .locator('astro-dev-toolbar')
    .locator('.workbench')
    .getByRole('button', { name: /Open changes tray/ });
  for (let index = (await trayButtons.count()) - 1; index >= 0; index -= 1) {
    const tray = trayButtons.nth(index);
    if (await tray.isEnabled()) {
      await tray.evaluate((button: HTMLButtonElement) => button.click());
      break;
    }
  }
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
  await workbench.getByRole('button', { name: 'Open changes tray, 1 queued change' }).click();
  await workbench.getByRole('button', { name: /Review and save \(1\)/ }).click();
  const review = toolbar.locator('dialog').filter({ hasText: 'Review and save' });
  await expect(review).toBeVisible();
  expect(await review.locator('.diff-line.remove').count()).toBeGreaterThan(0);
  expect(await review.locator('.diff-line.add').count()).toBeGreaterThan(0);
  const commit = review.getByRole('button', { name: 'Save changes' });
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
  await expect(toolbar.getByText('Ready. Changes stay local until saved.')).toBeVisible();

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
  await workbench.getByRole('button', { name: 'Open changes tray, 0 queued changes' }).click();
  await workbench.getByRole('button', { name: 'Redo', exact: true }).click();
  await workbench.getByRole('button', { name: 'Discard changes' }).click();

  await workbench.getByRole('tab', { name: 'Sections' }).click();
  await expect(workbench).toBeHidden();
  await expect(picker).toBeVisible();
  const firstControlsBox = (await page
    .locator('.astro-ve-section-controls')
    .first()
    .boundingBox())!;
  expect(firstControlsBox.width).toBeLessThanOrEqual(155);
  const source = page.getByRole('button', { name: 'Drag Section: 01 / PREVIEW to reorder' });
  await expect(source).toHaveAttribute('title', 'Drag Section: 01 / PREVIEW to reorder');
  await expect(source).toHaveAttribute('data-tooltip', 'Drag Section: 01 / PREVIEW to reorder');
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
  const sectionChange = workbench.locator('.change').first();
  await expect(sectionChange.locator('.change-page')).toContainText('Simple demo');
  await expect(sectionChange.locator('.change-summary')).toHaveText('Reordered 3 sections');
  await expect(sectionChange.locator('.change-description')).toHaveText(
    'Moved “02 / REVIEW” from position 2 to 1',
  );
  await expect(sectionChange.locator('.change-technical')).not.toHaveAttribute('open', '');
  await sectionChange.locator('.change-technical > summary').click();
  await expect(sectionChange.locator('.technical-diff')).toContainText(
    'Before: 01 / PREVIEW → 02 / REVIEW → 03 / COMMIT',
  );
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await workbench.getByRole('tab', { name: 'Sections' }).click();

  await page.getByRole('button', { name: 'Add section after Section: 01 / PREVIEW' }).click();
  await toolbar
    .locator('dialog')
    .filter({ hasText: 'Add a section' })
    .getByRole('button', { name: /Text/ })
    .click();
  await expect(page.locator('[data-section^="text-"]')).toHaveCount(1);
  await picker.getByRole('button', { name: /Review 1/ }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await workbench.getByRole('tab', { name: 'Sections' }).click();

  await page.getByRole('button', { name: 'Delete section Section: 02 / REVIEW' }).click();
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
  const originalRoute = await readFile(complexRouteSource, 'utf8');
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

    await complexWorkbench.getByRole('tab', { name: 'SEO' }).click();
    const seoDialog = toolbar.locator('dialog').filter({ hasText: 'Edit SEO' });
    await expect(seoDialog).toContainText('src/pages/fixtures/complex.astro');
    await seoDialog.locator('[name="title"]').fill('Complex fixture, reviewed');
    await seoDialog
      .locator('[name="description"]')
      .fill('A reviewed description owned by the composed route.');
    await seoDialog.locator('[name="keywords"]').fill('astro, editor');
    await seoDialog.locator('[name="canonical"]').fill('https://example.com/complex');
    await seoDialog.locator('[name="ogTitle"]').fill('Complex social title');
    await seoDialog.locator('[name="ogDescription"]').fill('Complex social description');
    await seoDialog.locator('[name="robots"]').fill('index, follow');
    await seoDialog.getByRole('button', { name: 'Queue SEO change' }).click();
    await complexWorkbench
      .getByRole('button', { name: 'Open changes tray, 3 queued changes' })
      .click();
    await expect(
      complexWorkbench.getByRole('button', { name: /Review and save \(3\)/ }),
    ).toBeEnabled();

    await complexWorkbench.getByRole('button', { name: /Review and save \(3\)/ }).click();
    const review = toolbar.locator('dialog').filter({ hasText: 'Review and save' });
    await expect(review).toContainText('src/data/complex-page.json');
    await expect(review).toContainText('src/content/case-studies/harbour.md');
    await expect(review).toContainText('src/pages/fixtures/complex.astro');
    await review.getByRole('button', { name: 'Save changes' }).click();
    await expect
      .poll(async () => readFile(complexJsonSource, 'utf8'))
      .toContain('A safely updated JSON title');
    await expect
      .poll(async () => readFile(complexCollectionSource, 'utf8'))
      .toContain('Harbour launch plan, reviewed');
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('title="Complex fixture, reviewed"');
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('description="A reviewed description owned by the composed route."');
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('keywords="astro, editor"');
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('canonical="https://example.com/complex"');
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('ogTitle="Complex social title"');
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('ogDescription="Complex social description"');
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('robots="index, follow"');

    await restoreFromHistory(page);
    await expect.poll(async () => readFile(complexJsonSource, 'utf8')).toBe(originalJson);
    await expect
      .poll(async () => readFile(complexCollectionSource, 'utf8'))
      .toBe(originalCollection);
    await expect.poll(async () => readFile(complexRouteSource, 'utf8')).toBe(originalRoute);
    await expect(page.locator('[data-demo-json-title]')).toHaveText(
      'A page assembled from trusted sources',
    );
    await expect(page.locator('[data-demo-collection-title]')).toHaveText('Harbour launch plan');
    await waitForWorkbenchButtonEnabled(page, /Open changes tray/);
  } finally {
    if ((await readFile(complexJsonSource, 'utf8')) !== originalJson)
      await writeFile(complexJsonSource, originalJson);
    if ((await readFile(complexCollectionSource, 'utf8')) !== originalCollection)
      await writeFile(complexCollectionSource, originalCollection);
    if ((await readFile(complexRouteSource, 'utf8')) !== originalRoute)
      await writeFile(complexRouteSource, originalRoute);
  }
});

test('targets each repeated JSON-backed evidence card independently', async ({ page }) => {
  const originalPolicy = await readFile(editabilityPolicySource, 'utf8');
  try {
    await writeFile(
      editabilityPolicySource,
      `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`,
    );
    await page.waitForTimeout(500);
    await page.goto('/');
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
      complexWorkbench.getByText('No section region is enabled on this page yet.'),
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

    await complexWorkbench
      .getByRole('button', { name: 'Open changes tray, 2 queued changes' })
      .click();
    const firstChange = complexWorkbench.locator('.change').first();
    await expect(firstChange.locator('.change-page')).toContainText('Complex sources');
    await expect(firstChange.locator('.change-summary')).toHaveText('Changed visible text');
    await expect(firstChange.locator('.change-description')).toHaveText(
      'Added “, updated” after “Direct JSON properties”',
    );
    await expect(firstChange.locator('.visible-diff')).toContainText('Before');
    await expect(firstChange.locator('.visible-diff')).toContainText('Direct JSON properties');
    await expect(firstChange.locator('.visible-diff')).toContainText('After');
    await expect(firstChange.locator('.visible-diff')).toContainText(
      'Direct JSON properties, updated',
    );
    await expect(firstChange.locator('.change-technical')).not.toHaveAttribute('open', '');
    await complexWorkbench.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(values).toHaveText([
      'Shared navigation and footer',
      'Reusable hero and proof cards',
      'Direct JSON properties',
    ]);
  } finally {
    await writeFile(editabilityPolicySource, originalPolicy);
  }
});

test('enables and persists complex sections without source annotations', async ({ page }) => {
  test.setTimeout(90_000);
  const originalPolicy = await readFile(editabilityPolicySource, 'utf8');
  const originalRoute = await readFile(complexRouteSource, 'utf8');
  const originalHero = await readFile(complexHeroSource, 'utf8');
  const originalJson = await readFile(complexJsonSource, 'utf8');
  try {
    await writeFile(
      editabilityPolicySource,
      `${JSON.stringify({ version: 1, rules: [] }, null, 2)}\n`,
    );
    await page.waitForTimeout(500);
    await page.goto('/fixtures/complex');
    let { toolbar, workbench } = await enableEditor(page);
    await workbench.getByRole('button', { name: 'Open Editor Setup' }).click();
    await expect(workbench.getByRole('heading', { name: 'Editing permissions' })).toBeVisible();
    await expect(workbench.getByRole('heading', { name: 'Sections' })).toBeVisible();
    await expect(workbench.getByText('0 enabled')).toBeVisible();
    await expect(workbench.getByRole('heading', { name: 'Text' })).toBeVisible();
    await workbench
      .locator('.section-setup')
      .getByRole('button', { name: 'Select on page' })
      .click();
    const evidenceHeading = page.getByRole('heading', {
      name: 'One rendered page, several deliberate owners',
    });
    await evidenceHeading.hover();
    await expect(page.locator('[data-astro-ve-setup-pick="true"]')).toHaveCount(1);
    await expect(toolbar.locator('.setup-picker-label')).toContainText(
      'One rendered page, several deliberate owners',
    );
    await toolbar.getByRole('button', { name: 'Cancel' }).click();
    await expect(workbench).toBeVisible();

    await workbench.getByRole('button', { name: 'Choose from list' }).click();
    let regionDialog = toolbar.locator('dialog').filter({ hasText: 'Choose an area to reorder' });
    await regionDialog.getByRole('button', { name: 'Choose Main page content' }).click();

    let policyReview = toolbar.locator('dialog').filter({ hasText: 'Save these editor choices?' });
    await expect(policyReview).toBeVisible();
    await expect(policyReview.locator('.policy-technical')).not.toHaveAttribute('open', '');
    await policyReview.getByRole('button', { name: 'Save settings' }).click();

    ({ toolbar, workbench } = await enableEditor(page));
    await workbench.getByRole('button', { name: 'Open Editor Setup' }).click();
    await expect(workbench.getByText('1 enabled')).toBeVisible();
    const manageSections = workbench.locator('.manage-sections');
    await expect(manageSections).not.toHaveAttribute('open', '');
    await manageSections.locator(':scope > summary').focus();
    await manageSections.locator(':scope > summary').press('Enter');
    await expect(manageSections).toHaveAttribute('open', '');
    await expect(workbench.locator('.section-region-item')).toContainText('Main section');
    await expect(workbench.locator('.section-region-item .technical-details')).not.toHaveAttribute(
      'open',
      '',
    );

    await workbench
      .locator('.section-setup')
      .getByRole('button', { name: 'Select on page' })
      .click();
    await page.getByRole('button', { name: 'Review the source map' }).click();
    regionDialog = toolbar.locator('dialog').filter({
      hasText: 'How much do you want to reorder?',
    });
    await expect(regionDialog.getByText('Whole page', { exact: true })).toBeVisible();
    await regionDialog
      .locator('.friendly-region')
      .filter({ hasText: 'Smallest area' })
      .getByRole('button', { name: /Choose/ })
      .click();
    await expect(policyReview).toContainText('src/components/SourceHero.astro');
    await expect(policyReview).toContainText('astro:children:element:section:0');
    await policyReview.getByRole('button', { name: 'Save settings' }).click();
    await expect
      .poll(async () => readFile(editabilityPolicySource, 'utf8'))
      .toContain('src/components/SourceHero.astro');
    await page.waitForTimeout(1_000);

    ({ toolbar, workbench } = await enableEditor(page));
    await workbench.getByRole('button', { name: 'Open Editor Setup' }).click();
    await workbench
      .locator('.section-setup')
      .getByRole('button', { name: 'Select on page' })
      .click();
    await page.locator('[data-astro-edit-path="evidence.0.value"]').click();
    regionDialog = toolbar.locator('dialog').filter({
      hasText: 'How much do you want to reorder?',
    });
    await expect(regionDialog.getByText('Smallest area', { exact: true })).toBeVisible();
    await expect(regionDialog.getByText(/Parent area/u).first()).toBeVisible();
    await expect(regionDialog.getByText('Whole page', { exact: true })).toBeVisible();
    await regionDialog
      .locator('.friendly-region')
      .filter({ hasText: 'Grid' })
      .getByRole('button', { name: /Choose/ })
      .click();
    policyReview = toolbar.locator('dialog').filter({ hasText: 'Save these editor choices?' });
    await expect(policyReview).toContainText('src/data/complex-page.json');
    await expect(policyReview).toContainText('json:array:evidence');
    await policyReview.getByRole('button', { name: 'Save settings' }).click();

    const savedPolicy = JSON.parse(await readFile(editabilityPolicySource, 'utf8')) as {
      regions: Array<{ selector: string; filePath: string; sourcePath: string }>;
    };
    expect(savedPolicy.regions).toContainEqual(
      expect.objectContaining({
        selector: 'main > section.hero',
        filePath: 'src/components/SourceHero.astro',
      }),
    );
    expect(savedPolicy.regions).toContainEqual(
      expect.objectContaining({
        selector: 'main',
        filePath: 'src/pages/fixtures/complex.astro',
        sourcePath: 'astro:children:component:DemoLayout:0',
      }),
    );
    expect(savedPolicy.regions).toContainEqual(
      expect.objectContaining({
        selector: 'main > section.evidence > div.grid',
        filePath: 'src/data/complex-page.json',
        sourcePath: 'json:array:evidence',
      }),
    );
    expect(
      savedPolicy.regions.some((region) => region.selector.includes('data-astro-edit-file')),
    ).toBe(false);

    ({ toolbar, workbench } = await enableEditor(page));
    await workbench.getByRole('tab', { name: 'Sections' }).click();
    const picker = toolbar.locator('.picker');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Expand' }).click();
    await expect(
      workbench.getByRole('button', { name: 'Select another section on page' }),
    ).toBeVisible();
    await workbench.getByRole('button', { name: 'Select another section on page' }).click();
    await toolbar.getByRole('button', { name: 'Cancel' }).click();
    const deleteHero = page.getByRole('button', {
      name: /Delete section Section: A page assembled from trusted sources/u,
    });
    await expect(deleteHero).toBeVisible();
    await deleteHero.click();
    await toolbar.getByRole('button', { name: 'Delete section', exact: true }).click();
    await expect(page.locator('main > section.hero')).toHaveCount(0);
    await workbench.getByRole('button', { name: 'Open changes tray, 1 queued change' }).click();
    await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('main > section.hero')).toHaveCount(1);
    await workbench.getByRole('button', { name: 'Close changes tray, 0 queued changes' }).click();
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Expand' }).click();
    const moveHero = page.getByRole('button', {
      name: /Move Section: A page assembled from trusted sources down/u,
    });
    await expect(moveHero).toBeVisible();
    await moveHero.click();
    await expect(page.locator('main > *').first()).toHaveClass(/shared-note/u);
    const moveAction = page.getByRole('button', {
      name: 'Move Button: Review the source map up',
    });
    await expect(moveAction).toBeVisible();
    await moveAction.click();
    await expect(page.locator('section.hero > :not([data-astro-ve-ui])').nth(2)).toHaveText(
      'Review the source map',
    );
    const moveLayoutCard = page.getByRole('button', { name: 'Move Card: Layout down' });
    await expect(moveLayoutCard).toBeVisible();
    await moveLayoutCard.click();
    await expect(page.locator('section.evidence .grid article').first()).toContainText('Component');
    await expect(workbench.locator('.change-summary')).toHaveCount(3);
    await workbench.getByRole('button', { name: 'Open changes tray, 3 queued changes' }).click();
    await workbench.getByRole('button', { name: /Review and save \(3\)/ }).click();
    await expect(workbench.locator('.message')).toBeHidden();
    const review = toolbar.locator('dialog').filter({ hasText: 'Review and save' });
    await expect(review).toBeVisible();
    await expect(review).toContainText('src/pages/fixtures/complex.astro');
    await expect(review).toContainText('src/components/SourceHero.astro');
    await expect(review).toContainText('src/data/complex-page.json');
    await review.getByRole('button', { name: 'Save changes' }).dispatchEvent('click');
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toMatch(/<p[\s\S]*?<SourceHero/u);
    await expect
      .poll(async () => readFile(complexHeroSource, 'utf8'))
      .toMatch(/<\/h1>[\s\S]*?<button[\s\S]*?<p[\s\S]*?class="summary"/u);
    await expect
      .poll(async () => readFile(complexJsonSource, 'utf8'))
      .toMatch(/"label": "Component"[\s\S]*?"label": "Layout"/u);
    await restoreFromHistory(page);
    await expect.poll(async () => readFile(complexRouteSource, 'utf8')).toBe(originalRoute);
    await expect.poll(async () => readFile(complexHeroSource, 'utf8')).toBe(originalHero);
    await expect.poll(async () => readFile(complexJsonSource, 'utf8')).toBe(originalJson);
  } finally {
    if ((await readFile(complexRouteSource, 'utf8')) !== originalRoute)
      await writeFile(complexRouteSource, originalRoute);
    if ((await readFile(complexHeroSource, 'utf8')) !== originalHero)
      await writeFile(complexHeroSource, originalHero);
    if ((await readFile(complexJsonSource, 'utf8')) !== originalJson)
      await writeFile(complexJsonSource, originalJson);
    await writeFile(editabilityPolicySource, originalPolicy);
  }
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

    await complexWorkbench
      .getByRole('button', { name: 'Open changes tray, 3 queued changes' })
      .click();
    await complexWorkbench.getByRole('button', { name: /Review and save \(3\)/ }).click();
    const review = toolbar.locator('dialog').filter({ hasText: 'Review and save' });
    await expect(review).toContainText('src/pages/fixtures/complex.astro');
    await expect(review).toContainText('src/components/EvidenceGrid.astro');
    await expect(review).toContainText('src/layouts/DemoLayout.astro');
    await review.getByRole('button', { name: 'Save changes' }).dispatchEvent('click');

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
    await waitForWorkbenchButtonEnabled(page, /Open changes tray/);
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
    await waitForWorkbenchButtonEnabled(pageB, 'Open changes tray, 1 queued change');

    await reviewAndCommit(editorA.toolbar, editorA.workbench);
    await expect(pageA.locator('[data-demo-banner]')).toHaveText('Committed only from tab A', {
      timeout: 15_000,
    });
    await waitForWorkbenchButtonEnabled(pageB, 'Open changes tray, 1 queued change');
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
  const move = page.getByRole('button', { name: 'Move Section: 01 / PREVIEW down' });
  await move.focus();
  await move.press('Enter');
  await expect(
    page.locator('[data-astro-edit-region="home-principles"] > section').first(),
  ).toHaveAttribute('data-section', 'review');
  await picker.getByRole('button', { name: /Review 1/ }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  await workbench.getByRole('button', { name: 'Open Editor Setup' }).click();
  await workbench
    .locator('.text-settings-heading')
    .getByRole('button', { name: 'Select on page' })
    .click();
  await page.locator('[data-astro-edit-id="hero-lead"]').tap();
  const permissionChoice = toolbar
    .locator('dialog')
    .filter({ hasText: 'Choose what can be edited' });
  await expect(permissionChoice).toBeVisible();
  await permissionChoice.getByRole('button', { name: 'Cancel' }).tap();

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
    await workbench.getByRole('button', { name: 'Open Editor Setup' }).click();
    await expect(workbench.getByRole('heading', { name: 'Editing permissions' })).toBeVisible();
    await expect(workbench.getByRole('heading', { name: 'Sections' })).toBeVisible();
    await expect(workbench.getByRole('heading', { name: 'Text' })).toBeVisible();
    const manageText = workbench.locator('.manage-text > summary');
    await expect(manageText).toHaveText('Manage all text (9)');
    await expect(manageText).toBeVisible();
    await expect(workbench.locator('.inventory-list')).toBeHidden();
    await ensureDetailsOpen(workbench.locator('.manage-text'));
    await expect(workbench.getByRole('button', { name: 'Blocked 3' })).toBeVisible();
    const inventorySearch = workbench.getByRole('searchbox', { name: 'Search visible text' });
    await inventorySearch.fill('01 / PREVIEW');
    await expect(workbench.locator('.inventory-item:visible')).toHaveCount(1);
    await inventorySearch.fill('');
    await expect(workbench.locator('.setup-toggle')).toBeHidden();
    await expect(workbench.getByRole('button', { name: 'Back to editor' })).toBeVisible();
    expect((await workbench.boundingBox())!.width).toBeLessThanOrEqual(461);
    expect(
      await page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).marginLeft)),
    ).toBeGreaterThanOrEqual(475);

    await workbench
      .locator('.text-settings-heading')
      .getByRole('button', { name: 'Select on page' })
      .click();
    const heroHeading = page.getByRole('heading', { name: 'Edit Astro where you can see it' });
    await heroHeading.hover();
    await expect(heroHeading).toHaveAttribute('data-astro-ve-setup-pick', 'true');
    await heroHeading.click();
    const permissionChoice = toolbar
      .locator('dialog')
      .filter({ hasText: 'Choose what can be edited' });
    await expect(permissionChoice).toContainText('currently editable');
    await expect(permissionChoice.getByText('Technical details')).toBeVisible();
    await permissionChoice.getByRole('button', { name: 'Cancel' }).click();

    let previewLabel = workbench.locator('.inventory-item').filter({ hasText: '01 / PREVIEW' });
    await expect(previewLabel.locator('.inventory-status')).toHaveText('Blocked');
    await expect(previewLabel.locator('.inventory-reason')).toContainText(
      'not included by the current editability policy',
    );
    await previewLabel.getByRole('button', { name: 'Allow all <strong>' }).click();
    let policyReview = toolbar.locator('dialog').filter({ hasText: 'Save these editor choices?' });
    await expect(policyReview).toBeVisible();
    await expect(policyReview.locator('.diff-line.add')).toContainText(['"selector": "strong"']);
    await policyReview.getByRole('button', { name: 'Keep editing' }).click();
    await expect(workbench.getByText('Not saved yet')).toBeVisible();
    await expect(workbench.getByText('1 editor setting will only work')).toBeVisible();
    await workbench.getByRole('button', { name: 'Review and save (1)' }).click();
    await expect(policyReview).toBeVisible();
    await policyReview.getByRole('button', { name: 'Save settings' }).click();
    await expect(
      workbench.getByText(/text permissions and section mappings are now active/),
    ).toBeVisible();
    await page.waitForTimeout(1_000);
    ({ toolbar, workbench } = await enableEditor(page));

    await page.locator('[data-section="preview"] strong').click();
    let textDialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(textDialog).toBeVisible();
    await expect(textDialog.locator('.dialog-file')).toHaveText('src/pages/index.astro');
    await textDialog.getByRole('button', { name: 'Cancel' }).click();

    await workbench.getByRole('button', { name: 'Open Editor Setup' }).click();
    await expect(workbench.locator('.message')).toBeHidden();
    await ensureDetailsOpen(workbench.locator('.manage-text'));
    const inventoryBox = await workbench.locator('.ledger').boundingBox();
    const setupActionsBox = await workbench.locator('.setup-actions').boundingBox();
    expect(inventoryBox!.y + inventoryBox!.height).toBeLessThanOrEqual(setupActionsBox!.y);
    previewLabel = workbench.locator('.inventory-item').filter({ hasText: '01 / PREVIEW' });
    await expect(previewLabel.locator('.inventory-status')).toHaveText('Editable');
    const blockPreview = previewLabel.getByRole('button', { name: 'Block this item' });
    await expect(blockPreview).toBeVisible();
    await blockPreview.click();
    await expect(previewLabel.locator('.inventory-status')).toHaveText('Blocked');
    policyReview = toolbar.locator('dialog').filter({ hasText: 'Save these editor choices?' });
    await expect(policyReview.locator('.diff-line.add')).toContainText(['"effect": "deny"']);
    await policyReview.getByRole('button', { name: 'Save settings' }).click();
    await expect(
      workbench.getByText(/text permissions and section mappings are now active/),
    ).toBeVisible();
    await page.waitForTimeout(1_000);
    ({ toolbar, workbench } = await enableEditor(page));

    await page.reload();
    ({ toolbar, workbench } = await enableEditor(page));
    await workbench.getByRole('button', { name: 'Open Editor Setup' }).click();
    await ensureDetailsOpen(workbench.locator('.manage-text'));
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
    await workbench.getByRole('button', { name: 'Open Editor Setup' }).press('Enter');
    await ensureDetailsOpen(workbench.locator('.manage-text'));
    const unresolved = workbench
      .locator('.inventory-item')
      .filter({ hasText: 'This source needs owner confirmation.' });
    const unsafe = workbench
      .locator('.inventory-item')
      .filter({ hasText: 'Nested formatting must stay structurally safe.' });
    await expect(unresolved.locator('.inventory-status')).toHaveText('Unresolved');
    await expect(unsafe.locator('.inventory-status')).toHaveText('Unsafe');
    await expect(unsafe.getByRole('button', { name: /Allow/ })).toHaveCount(0);
    await unresolved.getByRole('button', { name: 'Find source and allow editing' }).click();
    policyReview = toolbar.locator('dialog').filter({ hasText: 'Save these editor choices?' });
    await policyReview.getByText('Review technical project change').click();
    await expect(
      policyReview
        .locator('.diff-line.add')
        .filter({ hasText: 'src/pages/fixtures/article.astro' }),
    ).toBeVisible();
    await policyReview.getByRole('button', { name: 'Save settings' }).click();
    await expect(
      workbench.getByText(/text permissions and section mappings are now active/),
    ).toBeVisible();
    ({ toolbar, workbench } = await enableEditor(page));
    await page.getByText('This source needs owner confirmation.').click();
    textDialog = toolbar.locator('dialog').filter({ hasText: 'Edit text' });
    await expect(textDialog).toBeVisible();
    await expect(textDialog.locator('.dialog-file')).toContainText(
      'src/pages/fixtures/article.astro → astro:text:',
    );
    await textDialog.getByRole('button', { name: 'Cancel' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await workbench.getByRole('button', { name: 'Open Editor Setup' }).click();
    await ensureDetailsOpen(workbench.locator('.manage-text'));
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
