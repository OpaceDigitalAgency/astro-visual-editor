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

async function selectedTextInspector(toolbar: import('@playwright/test').Locator) {
  const inspector = toolbar.locator('.selection-inspector');
  await expect(inspector).toBeVisible();
  return inspector;
}

async function queueSelectedText(
  toolbar: import('@playwright/test').Locator,
  value: string,
): Promise<void> {
  const inspector = await selectedTextInspector(toolbar);
  await inspector.locator('textarea').fill(value);
  await inspector.getByRole('button', { name: /Queue change|Update queued change/ }).click();
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
  expect(workbenchBox.width).toBeLessThanOrEqual(421);
  expect(workbenchBox.height).toBeLessThanOrEqual(721);
  await expect(toolbar.getByText('Ready. Changes stay local until saved.')).toBeVisible();

  await workbench.getByRole('button', { name: 'Collapse editor' }).click();
  await expect(workbench).toBeHidden();
  const picker = toolbar.locator('.picker');
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Expand' }).click();
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole('tab', { name: 'Content' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await workbench.getByRole('tab', { name: 'Content' }).click();

  await expect(workbench.getByRole('button', { name: 'Diagnostics' })).toBeHidden();
  const protectedText = page.locator('[data-section="commit"] strong');
  await protectedText.dispatchEvent('pointerover');
  await expect(protectedText).toHaveAttribute('data-astro-ve-text-state', 'protected');
  await expect(protectedText).toHaveAttribute('data-astro-ve-text-label', 'Protected · Bold text');
  await protectedText.dispatchEvent('click');
  let inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-state')).toContainText('Protected');
  await expect(inspector.locator('textarea')).toBeDisabled();
  await expect(inspector.getByRole('button', { name: 'Lock' })).toBeHidden();

  const lead = page.locator('[data-astro-edit-id="hero-lead"]');
  await lead.hover();
  await expect(lead).toHaveAttribute('data-astro-ve-text-state', 'unlocked');
  await expect(lead).toHaveAttribute('data-astro-ve-text-label', 'Edit · Paragraph');
  const originalLead = (await lead.textContent())!.trim();
  await lead.click();
  inspector = await selectedTextInspector(toolbar);
  await expect(workbench.getByRole('heading', { name: 'Edit paragraph' })).toBeVisible();
  await expect(inspector.getByRole('tab', { name: 'Content' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(inspector.getByRole('tab', { name: 'Design' })).toBeVisible();
  await expect(inspector.getByRole('tab', { name: 'Advanced' })).toBeVisible();
  await queueSelectedText(toolbar, 'Browser workflow preview copy.');
  await expect(lead).toHaveText('Browser workflow preview copy.');
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(lead).toHaveText(originalLead);
  await workbench.getByRole('button', { name: 'Open changes tray, 0 queued changes' }).click();
  await workbench.getByRole('button', { name: 'Redo', exact: true }).click();
  await workbench.getByRole('button', { name: 'Discard changes' }).click();

  // Selecting a section changes context automatically; Structure is a navigator,
  // not a prerequisite for selecting, moving or arranging the canvas.
  await page.locator('[data-section="preview"]').dispatchEvent('click');
  const sectionInspector = toolbar.locator('.selection-inspector');
  await expect(sectionInspector).toBeVisible();
  await expect(workbench.getByRole('heading', { name: 'Edit section' })).toBeVisible();
  await expect(sectionInspector.getByRole('tab', { name: 'Content' })).toBeVisible();
  await expect(sectionInspector.getByRole('tab', { name: 'Design' })).toBeVisible();
  await expect(sectionInspector.getByRole('tab', { name: 'Advanced' })).toBeVisible();
  await sectionInspector.getByRole('button', { name: 'Done' }).click();
  const firstControlsBox = (await page
    .locator('.astro-ve-section-controls')
    .first()
    .boundingBox())!;
  expect(firstControlsBox.width).toBeLessThanOrEqual(430);
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
  await workbench.getByRole('button', { name: 'Open changes tray, 1 queued change' }).click();
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
  await workbench.getByRole('tab', { name: 'Structure' }).click();

  await page.locator('[data-section="preview"]').dispatchEvent('click');
  await toolbar.locator('.selection-inspector').getByRole('button', { name: 'Add after' }).click();
  await toolbar
    .locator('dialog')
    .filter({ hasText: 'Add a section' })
    .getByRole('button', { name: /Text/ })
    .click();
  await expect(page.locator('[data-section^="text-"]')).toHaveCount(1);
  await workbench.getByRole('button', { name: 'Open changes tray, 1 queued change' }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await workbench.getByRole('tab', { name: 'Structure' }).click();

  await page.locator('[data-section="commit"]').hover();
  await page.getByRole('button', { name: 'Delete section Section: 03 / COMMIT' }).click();
  await toolbar.getByRole('button', { name: 'Delete section', exact: true }).click();
  await expect(page.locator('[data-section="commit"]')).toHaveCount(0);
  await workbench.getByRole('button', { name: 'Open changes tray, 1 queued change' }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  await workbench.getByRole('tab', { name: 'Page' }).click();
  let seoDialog = toolbar.locator('dialog').filter({ hasText: 'Edit SEO' });
  await expect(seoDialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(seoDialog).toBeHidden();
  await workbench.getByRole('tab', { name: 'Page' }).click();
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
    let inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('tab', { name: 'Advanced' }).click();
    await expect(inspector.locator('.inspector-file')).toHaveText('src/data/complex-page.json');
    await expect(inspector.locator('.inspector-source-path')).toHaveText('hero.title');
    await inspector.getByRole('tab', { name: 'Content' }).click();
    await expect(inspector).toContainText('Shared source: this edit will affect 2 routes.');
    await queueSelectedText(toolbar, 'A safely updated JSON title');

    await page.locator('[data-demo-collection-title]').click();
    inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('tab', { name: 'Advanced' }).click();
    await expect(inspector.locator('.inspector-file')).toHaveText(
      'src/content/case-studies/harbour.md',
    );
    await expect(inspector.locator('.inspector-source-path')).toHaveText('frontmatter.title');
    await inspector.getByRole('tab', { name: 'Content' }).click();
    await queueSelectedText(toolbar, 'Harbour launch plan, reviewed');

    await complexWorkbench.getByRole('tab', { name: 'Page' }).click();
    const seoDialog = toolbar.locator('dialog').filter({ hasText: 'Edit SEO' });
    await expect(seoDialog).toContainText('src/pages/fixtures/complex.astro');
    await seoDialog.locator('[name="title"]').fill('Complex fixture, reviewed');
    await seoDialog
      .locator('[name="description"]')
      .fill('A reviewed description owned by the composed route.');
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

    await complexWorkbench.getByRole('tab', { name: 'Structure' }).click();
    await expect(complexWorkbench).toBeVisible();
    await expect(
      page.locator('[data-astro-edit-region="complex-sections"] > [data-section]'),
    ).toHaveCount(4);
    await complexWorkbench.getByRole('tab', { name: 'Content' }).click();

    await values.nth(2).click();
    let inspector = await selectedTextInspector(toolbar);
    await expect(inspector.locator('textarea')).toHaveValue('Direct JSON properties');
    await queueSelectedText(toolbar, 'Direct JSON properties, updated');
    await expect(values).toHaveText([
      'Shared navigation and footer',
      'Reusable hero and proof cards',
      'Direct JSON properties, updated',
    ]);

    await values.nth(1).click();
    inspector = await selectedTextInspector(toolbar);
    await expect(inspector.locator('textarea')).toHaveValue('Reusable hero and proof cards');
    await queueSelectedText(toolbar, 'Reusable component proof, updated');
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

test('uses direct canvas locks and exposes complex sections without setup', async ({ page }) => {
  test.setTimeout(90_000);
  const originalPolicy = await readFile(editabilityPolicySource, 'utf8');
  try {
    await page.goto('/fixtures/complex');
    const { toolbar, workbench } = await enableEditor(page);

    await expect(workbench.getByRole('button', { name: 'Diagnostics' })).toBeHidden();
    const sections = page.locator('[data-astro-edit-region="complex-sections"] > [data-section]');
    await expect(sections).toHaveCount(4);
    await expect(sections.first()).toHaveAttribute('data-astro-ve-section-active', 'true');
    await expect(sections.last()).toHaveAttribute('data-astro-ve-section-active', 'true');

    const lockedSection = page.locator('[data-section="complex-shared"]');
    await expect(lockedSection).toHaveAttribute('data-astro-ve-protection', 'locked');
    await lockedSection.dispatchEvent('click');
    let inspector = await selectedTextInspector(toolbar);
    await expect(workbench.getByRole('tab', { name: 'Structure' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(inspector.locator('.selection-state')).toContainText('Locked');
    await inspector.getByRole('button', { name: 'Unlock' }).click();
    await expect(workbench.getByText('Unlocked section.')).toBeVisible();
    await expect(lockedSection).toHaveAttribute('data-astro-ve-protection', 'unlocked');
    inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('button', { name: 'Lock' }).click();
    await expect(workbench.getByText('Locked section.')).toBeVisible();
    await expect(lockedSection).toHaveAttribute('data-astro-ve-protection', 'locked');

    const lockedText = page.locator('[data-astro-edit-path="frontmatter.client"]');
    await lockedText.click();
    inspector = await selectedTextInspector(toolbar);
    await expect(inspector.locator('.selection-state')).toContainText('Locked');
    await inspector.getByRole('button', { name: 'Unlock' }).click();
    await expect(workbench.getByText('Unlocked element.')).toBeVisible();
    await expect(lockedText).toHaveAttribute('data-astro-ve-protection', 'unlocked');
    inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('button', { name: 'Lock' }).click();
    await expect(workbench.getByText('Locked element.')).toBeVisible();
    await expect(lockedText).toHaveAttribute('data-astro-ve-protection', 'locked');

    const heroSection = page.locator('[data-section="complex-hero"]');
    await heroSection.hover();
    const moveHero = page
      .locator('.astro-ve-section-controls[data-visible="true"]')
      .getByRole('button', { name: /Move .* down/u });
    await expect(moveHero).toBeVisible();
    await moveHero.click();
    await expect(sections.first()).toHaveAttribute('data-section', 'complex-shared');
    await workbench.getByRole('button', { name: 'Open changes tray, 1 queued change' }).click();
    await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(sections.first()).toHaveAttribute('data-section', 'complex-hero');
  } finally {
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
    let inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('tab', { name: 'Advanced' }).click();
    await expect(inspector.locator('.inspector-file')).toHaveText(
      'src/pages/fixtures/complex.astro',
    );
    await inspector.getByRole('tab', { name: 'Content' }).click();
    await queueSelectedText(toolbar, 'Collection source, reviewed');

    await page.getByText('What this route proves', { exact: true }).click();
    inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('tab', { name: 'Advanced' }).click();
    await expect(inspector.locator('.inspector-file')).toHaveText(
      'src/components/EvidenceGrid.astro',
    );
    await inspector.getByRole('tab', { name: 'Content' }).click();
    await queueSelectedText(toolbar, 'What these components prove');

    await page.getByText('Recovery', { exact: true }).click();
    inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('tab', { name: 'Advanced' }).click();
    await expect(inspector.locator('.inspector-file')).toHaveText('src/layouts/DemoLayout.astro');
    await inspector.getByRole('tab', { name: 'Content' }).click();
    await queueSelectedText(toolbar, 'Recovery, verified');

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
    await queueSelectedText(toolbar, 'Committed browser test copy.');
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

    await pageA.locator('[data-astro-edit-id="hero-lead"]').click();
    await queueSelectedText(editorA.toolbar, 'Committed only from tab A');

    await pageB.locator('[data-astro-edit-id="hero-title"]').click();
    await queueSelectedText(editorB.toolbar, 'Queued only in tab B');
    await waitForWorkbenchButtonEnabled(pageB, 'Open changes tray, 1 queued change');

    await reviewAndCommit(editorA.toolbar, editorA.workbench);
    await expect(pageA.locator('[data-astro-edit-id="hero-lead"]')).toHaveText(
      'Committed only from tab A',
      { timeout: 15_000 },
    );
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
  await workbench.getByRole('tab', { name: 'Structure' }).click();
  await expect(workbench).toBeHidden();
  const move = page.getByRole('button', { name: 'Move Section: 01 / PREVIEW down' });
  await move.focus();
  await move.press('Enter');
  await expect(
    page.locator('[data-astro-edit-region="home-principles"] > section').first(),
  ).toHaveAttribute('data-section', 'review');
  await picker.getByRole('button', { name: /Review 1/ }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();

  await expect(workbench.getByRole('button', { name: 'Diagnostics' })).toBeHidden();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).include('astro-dev-toolbar').analyze();
  expect(
    results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'),
  ).toEqual([]);
  await context.close();
});

test('shows unlocked, owner-locked and source-protected states on the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  const { toolbar, workbench } = await enableEditor(page);

  await expect
    .poll(() => page.locator('[data-astro-ve-text-active="true"]').count())
    .toBeGreaterThan(8);

  const editable = page.locator('[data-astro-edit-id="hero-title"]');
  await editable.hover();
  const elementControls = page.locator('.astro-ve-element-controls');
  await expect(elementControls).toBeVisible();
  await expect(elementControls.getByRole('button', { name: 'Edit Heading' })).toBeVisible();
  await expect(elementControls.getByRole('button', { name: 'Lock Heading' })).toBeVisible();
  await editable.click();
  let inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-state')).toContainText('Unlocked');
  await expect(inspector.getByRole('button', { name: 'Lock' })).toBeVisible();

  const ownerLocked = page.locator('[data-demo-banner]');
  await ownerLocked.click();
  inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-state')).toContainText('Locked');
  await expect(inspector.getByRole('button', { name: 'Unlock' })).toBeVisible();
  await expect(inspector.locator('textarea')).toBeDisabled();

  const sourceProtected = page.locator('[data-section="commit"] strong');
  await sourceProtected.dispatchEvent('click');
  inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-state')).toContainText('Protected');
  await expect(inspector.getByRole('button', { name: 'Lock' })).toBeHidden();
  await expect(inspector.getByRole('button', { name: 'Unlock' })).toBeHidden();

  const lockedSection = page.locator('[data-section="review"]');
  await lockedSection.hover();
  await expect(lockedSection).toHaveAttribute('data-astro-ve-protection', 'locked');
  await expect(page.getByRole('button', { name: 'Unlock Section: 02 / REVIEW' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move Section: 02 / REVIEW down' })).toHaveCount(0);

  const editableSection = page.locator('[data-section="preview"]');
  await editableSection.dispatchEvent('pointerover');
  const sectionControls = page.locator('.astro-ve-section-controls[data-visible="true"]');
  await expect(
    sectionControls.getByRole('button', { name: 'Open settings for Section: 01 / PREVIEW' }),
  ).toBeVisible();
  await expect(
    sectionControls.getByRole('button', { name: 'Drag Section: 01 / PREVIEW to reorder' }),
  ).toBeVisible();
  await expect(
    sectionControls.getByRole('button', { name: 'Lock Section: 01 / PREVIEW' }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).include('astro-dev-toolbar').analyze();
  expect(
    results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'),
  ).toEqual([]);
  await expect(workbench.getByRole('button', { name: 'Diagnostics' })).toBeHidden();
});
