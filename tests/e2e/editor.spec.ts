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
    const opener = toolbar.getByRole('button', { name: 'Visual Editor', exact: true });
    await opener.click();
    // WebKit's synthesized pointer click can miss Astro's auto-hiding
    // toolbar hit-box; fall back to a programmatic toggle. Activation shows
    // the workbench on desktop but only the picker on mobile.
    const deadline = Date.now() + 2_000;
    let opened = false;
    while (!opened && Date.now() < deadline) {
      opened =
        (await workbench.isVisible().catch(() => false)) ||
        (await toolbar
          .locator('.picker[data-open="true"]')
          .isVisible()
          .catch(() => false));
      if (!opened) await page.waitForTimeout(100);
    }
    if (!opened) await opener.evaluate((element: HTMLElement) => element.click());
  }
  return { toolbar, workbench };
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
  await toolbar.page().waitForTimeout(450);
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
    .filter({ hasText: 'History and restore' })
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
  await workbench.getByRole('button', { name: /Save and apply \(1\)/ }).click();
  const review = toolbar.getByRole('dialog', { name: 'Save and apply' });
  await expect(review).toBeVisible();
  expect(await review.locator('.diff-line.remove').count()).toBeGreaterThan(0);
  expect(await review.locator('.diff-line.add').count()).toBeGreaterThan(0);
  const commit = review.getByRole('button', { name: 'Save and apply' });
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
  await expect(page.locator('.astro-ve-region-controls')).toHaveText('GROUP · Editor principles');
  await expect(page.locator('.astro-ve-section-label')).toHaveText([
    'SECTION · Preview',
    'SECTION · Review',
    'SECTION · Commit',
  ]);
  await expect(workbench.getByRole('tab', { name: 'Structure' })).toHaveCount(0);

  await workbench.getByRole('button', { name: 'Collapse editor' }).click();
  await expect(workbench).toBeHidden();
  const picker = toolbar.locator('.picker');
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Expand' }).click();
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole('tab', { name: 'Builder' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await workbench.getByRole('tab', { name: 'Builder' }).click();

  await expect(workbench.getByRole('button', { name: 'Diagnostics' })).toBeHidden();
  const protectedText = page.locator('[data-section="commit"] strong');
  await protectedText.dispatchEvent('pointerover');
  await expect(protectedText).toHaveAttribute('data-astro-ve-text-state', 'protected');
  await expect(protectedText).toHaveAttribute('data-astro-ve-text-label', 'Protected · Bold text');
  // The hover toolbar explains the lock in the owner's words: the project's
  // configured lockedAreaMessages entry for the commit card wins over the
  // per-status default copy.
  await expect(page.locator('.astro-ve-explainer')).toContainText(
    'fixed as part of the demo chrome',
  );
  await expect(
    page.locator('.astro-ve-element-controls').getByRole('button', {
      name: 'Why can’t I edit this?',
    }),
  ).toBeEnabled();
  await protectedText.dispatchEvent('click');
  let inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-state')).toContainText('Protected');
  await expect(inspector.locator('.selection-lock-card')).toContainText('Protected');
  await expect(inspector.locator('.selection-lock-card')).toContainText(
    'fixed as part of the demo chrome',
  );
  await expect(inspector.locator('.selection-lock-card .lock-action')).toContainText(
    'demo/src/pages/index.astro',
  );
  await expect(inspector.locator('.editable-text-setting')).toBeHidden();
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
  // Progressive chrome: controls stay hidden until the section is hovered.
  await page.locator('[data-section="preview"]').hover();
  const source = page.getByRole('button', { name: 'Drag Preview to reorder' });
  await expect(source).toHaveAttribute('title', 'Drag Preview to reorder');
  await expect(source).toHaveAttribute('data-tooltip', 'Drag Preview to reorder');
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
    'Moved “Review” from position 2 to 1',
  );
  await expect(sectionChange.locator('.change-technical')).not.toHaveAttribute('open', '');
  await sectionChange.locator('.change-technical > summary').click();
  await expect(sectionChange.locator('.technical-diff')).toContainText(
    'Before: Preview → Review → Commit',
  );
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await workbench.getByRole('tab', { name: 'Builder' }).click();

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
  await workbench.getByRole('tab', { name: 'Builder' }).click();

  const commitControls = page.locator('.astro-ve-section-controls[data-section-id="commit"]');
  await page.locator('[data-section="commit"]').hover();
  await commitControls.getByRole('button', { name: 'Drag Commit to reorder' }).click();
  await commitControls.getByRole('button', { name: 'Delete section Commit' }).click();
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
  // Reopening must show the queued edit, not reset the form to the source.
  await workbench.getByRole('tab', { name: 'Page' }).click();
  seoDialog = toolbar.locator('dialog').filter({ hasText: 'Edit SEO' });
  await expect(seoDialog.locator('[name="title"]')).toHaveValue('Queued browser SEO title');
  await expect(seoDialog.locator('[name="keywords"]')).toBeEnabled();
  await page.mouse.click(5, 5);
  await expect(seoDialog).toBeHidden();
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

    await page.locator('[data-demo-json-title]').dispatchEvent('click');
    let inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('tab', { name: 'Advanced' }).click();
    await expect(inspector.locator('.inspector-file')).toHaveText('src/data/complex-page.json');
    await expect(inspector.locator('.inspector-source-path')).toHaveText('hero.title');
    await inspector.getByRole('tab', { name: 'Content' }).click();
    await expect(inspector).toContainText('Shared source: this edit will affect 2 routes.');
    await queueSelectedText(toolbar, 'A safely updated JSON title');

    await page.locator('[data-demo-collection-title]').dispatchEvent('click');
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
    // This route delegates its head to a layout that accepts every SEO prop,
    // so all fields resolve to literal props and stay editable. (The locked
    // delegated-field path is covered by the seo-capabilities unit tests.)
    await expect(seoDialog.locator('[name="keywords"]')).toBeEnabled();
    await expect(seoDialog.locator('[name="title"]')).toBeEnabled();
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
      complexWorkbench.getByRole('button', { name: /Save and apply \(3\)/ }),
    ).toBeEnabled();

    await complexWorkbench.getByRole('button', { name: /Save and apply \(3\)/ }).click();
    const review = toolbar.getByRole('dialog', { name: 'Save and apply' });
    await expect(review).toContainText('src/data/complex-page.json');
    await expect(review).toContainText('src/content/case-studies/harbour.md');
    await expect(review).toContainText('src/pages/fixtures/complex.astro');
    await review.getByRole('button', { name: 'Save and apply' }).click();
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

test('keeps every draft after a conflict and can save the independent changes', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const originalJson = await readFile(complexJsonSource, 'utf8');
  const originalCollection = await readFile(complexCollectionSource, 'utf8');
  try {
    const simple = await enableEditor(page);
    await simple.workbench.getByRole('button', { name: 'Complex sources' }).click();
    await expect(page).toHaveURL(/\/fixtures\/complex$/);
    let current = await enableEditor(page);

    await page.locator('[data-demo-json-title]').dispatchEvent('click');
    await queueSelectedText(current.toolbar, 'Independent JSON title');
    await page.locator('[data-demo-collection-title]').dispatchEvent('click');
    await queueSelectedText(current.toolbar, 'Queued collection title');

    await writeFile(
      complexCollectionSource,
      originalCollection.replace('title: Harbour launch plan', 'title: Externally changed title'),
    );
    await page.waitForTimeout(750);
    current = await enableEditor(page);
    await current.workbench
      .getByRole('button', { name: 'Open changes tray, 2 queued changes' })
      .click();
    await current.workbench.getByRole('button', { name: /Save and apply \(2\)/ }).click();

    await expect(current.workbench.getByText(/Nothing was saved/u)).toBeVisible();
    await expect(current.workbench.getByRole('button', { name: 'Keep editing' })).toBeVisible();
    const replacement = page.waitForEvent('framenavigated');
    const deferredDraft = await current.workbench
      .getByRole('button', { name: 'Save the rest' })
      .evaluate((button: HTMLButtonElement) => {
        button.click();
        const stored = sessionStorage.getItem('astro-visual-editor:deferred-failures:v1');
        // Force replacement before the asynchronous save response can reach
        // this toolbar, matching Astro's faster HMR ordering on Node 24 CI.
        setTimeout(() => window.location.reload(), 0);
        return stored;
      });
    expect(deferredDraft).not.toBeNull();
    await replacement;
    await page.waitForLoadState('domcontentloaded');
    await waitForWorkbenchButtonEnabled(page, /changes tray, 1 queued change/u);
    current = await enableEditor(page);

    await expect
      .poll(async () => readFile(complexJsonSource, 'utf8'))
      .toContain('Independent JSON title');
    await expect(
      current.workbench.getByRole('button', { name: /changes tray, 1 queued change/u }),
    ).toBeVisible();
    await expect(readFile(complexCollectionSource, 'utf8')).resolves.toContain(
      'Externally changed title',
    );
  } finally {
    await writeFile(complexJsonSource, originalJson);
    await writeFile(complexCollectionSource, originalCollection);
    await page.waitForTimeout(1_000);
  }
});

test('adds a section and saves an auto-queued text edit inside it in one atomic batch', async ({
  page,
}) => {
  test.setTimeout(75_000);
  const originalRoute = await readFile(complexRouteSource, 'utf8');
  try {
    const simple = await enableEditor(page);
    await simple.workbench.getByRole('button', { name: 'Complex sources' }).click();
    await expect(page).toHaveURL(/\/fixtures\/complex$/);
    const { toolbar, workbench } = await enableEditor(page);
    await page.locator('[data-section="complex-evidence"]').dispatchEvent('click');
    const inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('button', { name: 'Add after' }).click();
    await toolbar
      .locator('dialog')
      .filter({ hasText: 'Add a section' })
      .getByRole('button', { name: /Text/ })
      .click();

    const added = page.locator('[data-section^="text-"]');
    await expect(added).toHaveCount(1);
    await added.locator('p').click();
    await queueSelectedText(toolbar, 'Newly added content saves in the same batch.');
    await expect(added.locator('p')).toHaveText('Newly added content saves in the same batch.');
    await expect(workbench.locator('.change-count')).toHaveText('2');

    await workbench.getByRole('button', { name: 'Open changes tray, 2 queued changes' }).click();
    await workbench.getByRole('button', { name: /Save and apply \(2\)/ }).click();
    const review = toolbar.getByRole('dialog', { name: 'Save and apply' });
    await expect(review).toContainText('Newly added content saves in the same batch.');
    await review.getByRole('button', { name: 'Save and apply' }).click();
    await expect
      .poll(async () => readFile(complexRouteSource, 'utf8'))
      .toContain('Newly added content saves in the same batch.');

    await restoreFromHistory(page);
    await expect.poll(async () => readFile(complexRouteSource, 'utf8')).toBe(originalRoute);
  } finally {
    if ((await readFile(complexRouteSource, 'utf8')) !== originalRoute)
      await writeFile(complexRouteSource, originalRoute);
  }
});

test('previews which side a dragged block will land on', async ({ page }) => {
  // The drop highlight says which element a block lands in; without an edge
  // indicator it does not say which side, so a drop that lands correctly is
  // indistinguishable from one that did nothing. The bar is driven by the same
  // midpoint test onSectionDrop uses, so preview and result cannot disagree.
  // Assert the painted computed style: an earlier version of this highlight was
  // applied but never rendered, because a higher-specificity rule outranked it.
  test.setTimeout(60_000);
  const simple = await enableEditor(page);
  await simple.workbench.getByRole('button', { name: 'Complex sources' }).click();
  await expect(page).toHaveURL(/\/fixtures\/complex$/);
  await enableEditor(page);

  const heading = page.locator('[data-section="hero-heading"]');
  await expect(heading).toBeVisible();

  const painted = await heading.evaluate((el: HTMLElement) => {
    const read = (edge: string) => {
      el.dataset.astroVeDragOver = 'true';
      el.dataset.astroVeDropEdge = edge;
      const style = getComputedStyle(el);
      const seen = { outline: style.outline, shadow: style.boxShadow };
      delete el.dataset.astroVeDragOver;
      delete el.dataset.astroVeDropEdge;
      return seen;
    };
    return {
      resting: getComputedStyle(el).boxShadow,
      before: read('before'),
      after: read('after'),
    };
  });

  // The drop target must visibly change, in the accent colour, not the resting grey.
  expect(painted.before.outline).toContain('233, 75, 138');
  // The edge bar must be painted, on opposite sides for before vs after.
  expect(painted.before.shadow).toContain('233, 75, 138');
  expect(painted.after.shadow).toContain('233, 75, 138');
  expect(painted.before.shadow).not.toEqual(painted.after.shadow);
  expect(painted.resting).not.toContain('233, 75, 138');
});

test('clears drop feedback when a drag leaves and when it ends', async ({ page }) => {
  // Stale feedback is worse than none: a bar left behind points at a target
  // that is no longer live. dragleave and dragend must both clear both flags.
  const simple = await enableEditor(page);
  await simple.workbench.getByRole('button', { name: 'Complex sources' }).click();
  await expect(page).toHaveURL(/\/fixtures\/complex$/);
  await enableEditor(page);

  const summary = page.locator('[data-section="hero-summary"]');
  await summary.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -260));
  await summary.hover();
  // Hovering a text block yields the merged toolbar, which carries the
  // block's drag handle alongside the text controls.
  const handle = page
    .locator('.astro-ve-element-controls')
    .getByRole('button', { name: 'Drag Summary to reorder' });
  await expect(handle).toBeVisible();

  const hb = (await handle.boundingBox())!;
  const heading = (await page.locator('[data-section="hero-heading"]').boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, heading.y + heading.height * 0.25, { steps: 20 });
  await page.mouse.up();

  await expect
    .poll(async () => page.locator('[data-astro-ve-drag-over], [data-astro-ve-drop-edge]').count())
    .toBe(0);
});

test('reorders nested hero blocks and saves two structural changes consecutively', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const heroSource = fileURLToPath(
    new URL('../../demo/src/components/SourceHero.astro', import.meta.url),
  );
  const originalHero = await readFile(heroSource, 'utf8');
  try {
    const simple = await enableEditor(page);
    await simple.workbench.getByRole('button', { name: 'Complex sources' }).click();
    await expect(page).toHaveURL(/\/fixtures\/complex$/);
    let current = await enableEditor(page);

    await expect(
      page.locator('.astro-ve-region-controls').filter({ hasText: 'GROUP · Complex page content' }),
    ).toHaveCount(1);
    await expect(
      page.locator('.astro-ve-region-controls').filter({ hasText: 'ROW · Hero content' }),
    ).toHaveCount(1);
    await expect(
      page.locator('.astro-ve-section-label').filter({ hasText: 'BLOCK · Primary action' }),
    ).toHaveCount(1);

    // Selecting pins the full toolbar; hover shows only the compact tag.
    await page.locator('[data-section="hero-action"]').dispatchEvent('click');
    const mergedControls = page.locator('.astro-ve-element-controls[data-pinned="true"]');
    await mergedControls
      .getByRole('button', { name: 'Move Primary action up' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(
      page.locator('[data-astro-edit-region="complex-hero-blocks"] > [data-section]').nth(2),
    ).toHaveAttribute('data-section', 'hero-action');
    await current.workbench
      .getByRole('button', { name: 'Open changes tray, 1 queued change' })
      .click();
    await current.workbench.getByRole('button', { name: /Save and apply \(1\)/ }).click();
    await current.toolbar
      .getByRole('dialog', { name: 'Save and apply' })
      .getByRole('button', { name: 'Save and apply' })
      .click();
    await expect
      .poll(async () => readFile(heroSource, 'utf8'))
      .toMatch(/data-section="hero-action"[\s\S]*data-section="hero-summary"/u);

    await waitForWorkbenchButtonEnabled(page, /Open changes tray/);
    current = await enableEditor(page);
    await page.locator('[data-section="hero-action"]').dispatchEvent('click');
    await mergedControls
      .getByRole('button', { name: 'Move Primary action down' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await current.workbench
      .getByRole('button', { name: 'Open changes tray, 1 queued change' })
      .click();
    await current.workbench.getByRole('button', { name: /Save and apply \(1\)/ }).click();
    await current.toolbar
      .getByRole('dialog', { name: 'Save and apply' })
      .getByRole('button', { name: 'Save and apply' })
      .click();
    await expect.poll(async () => readFile(heroSource, 'utf8')).toBe(originalHero);
  } finally {
    if ((await readFile(heroSource, 'utf8')) !== originalHero)
      await writeFile(heroSource, originalHero);
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

    await complexWorkbench.getByRole('tab', { name: 'Builder' }).click();
    await expect(complexWorkbench).toBeVisible();
    await expect(
      page.locator('[data-astro-edit-region="complex-sections"] > [data-section]'),
    ).toHaveCount(4);

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
    await expect(workbench.getByRole('tab', { name: 'Builder' })).toHaveAttribute(
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

    const heroControls = page.locator('.astro-ve-section-controls[data-section-id="complex-hero"]');
    // Peek the hero's own toolbar: its centre sits over a nested block, and a
    // real hover near the edge would land on the toolbar that appears.
    await page
      .locator('[data-section="complex-hero"]')
      .dispatchEvent('pointerover', { bubbles: true });
    await heroControls.getByRole('button', { name: 'Drag Hero to reorder' }).click();
    const moveHero = heroControls.getByRole('button', { name: 'Move Hero down' });
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

    await page.getByText('Content Collection', { exact: true }).dispatchEvent('click');
    let inspector = await selectedTextInspector(toolbar);
    await inspector.getByRole('tab', { name: 'Advanced' }).click();
    await expect(inspector.locator('.inspector-file')).toHaveText(
      'src/pages/fixtures/complex.astro',
    );
    await inspector.getByRole('tab', { name: 'Content' }).click();
    await queueSelectedText(toolbar, 'Collection source, reviewed');

    await page.getByText('What this route proves', { exact: true }).dispatchEvent('click');
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
    await complexWorkbench.getByRole('button', { name: /Save and apply \(3\)/ }).click();
    const review = toolbar.getByRole('dialog', { name: 'Save and apply' });
    await expect(review).toContainText('src/pages/fixtures/complex.astro');
    await expect(review).toContainText('src/components/EvidenceGrid.astro');
    await expect(review).toContainText('src/layouts/DemoLayout.astro');
    await review.getByRole('button', { name: 'Save and apply' }).dispatchEvent('click');

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
    baseURL: `http://localhost:${process.env.PW_PORT ?? 4357}`,
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
    baseURL: `http://localhost:${process.env.PW_PORT ?? 4357}`,
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
  await textDialog.getByRole('button', { name: 'Close' }).click();
  await picker.getByRole('button', { name: 'Expand' }).click();
  await workbench.getByRole('tab', { name: 'Builder' }).click();
  await expect(workbench).toBeVisible();
  const previewControls = page.locator('.astro-ve-section-controls[data-section-id="preview"]');
  // Keyboard path: focusing the section reveals its full toolbar without a pointer.
  await page.locator('[data-section="preview"]').focus();
  const move = previewControls.getByRole('button', { name: 'Move Preview down' });
  await move.focus();
  await move.press('Enter');
  await expect(
    page.locator('[data-astro-edit-region="home-principles"] > section').first(),
  ).toHaveAttribute('data-section', 'review');
  await workbench.getByRole('button', { name: 'Open changes tray, 1 queued change' }).click();
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

test('double-click edits text in place; Escape restores, Enter keeps and queues', async ({
  page,
}) => {
  const { workbench } = await enableEditor(page);
  const lead = page.locator('[data-astro-edit-id="hero-lead"]');
  const original = (await lead.textContent())!.trim();

  await lead.dblclick();
  await expect(lead).toHaveAttribute('contenteditable', /plaintext-only|true/u);
  // The caret must be a collapsed point, never a whole-text selection: an
  // immediate Backspace removes exactly one character, not the block.
  const lengthBefore = (await lead.textContent())!.length;
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await lead.textContent())!.length).toBe(lengthBefore - 1);
  // Editing must survive the queue's 320ms preview cycle: pause past it,
  // then keep deleting — the caret may not be destroyed by a rewrite.
  await page.waitForTimeout(450);
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await lead.textContent())!.length).toBe(lengthBefore - 2);
  // Clicking elsewhere inside the same text moves the caret without ending
  // the session, and Backspace keeps working afterwards.
  await lead.click({ position: { x: 60, y: 10 } });
  await expect(lead).toHaveAttribute('contenteditable', /plaintext-only|true/u);
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await lead.textContent())!.length).toBe(lengthBefore - 3);
  await page.keyboard.type('ZZZ ');
  await page.keyboard.press('Escape');
  await expect(lead).toHaveText(original);
  await expect.poll(() => lead.evaluate((el) => el.isContentEditable)).toBe(false);

  await lead.dblclick();
  await page.keyboard.type('Fresh ');
  await page.keyboard.press('Enter');
  await expect.poll(() => lead.evaluate((el) => el.isContentEditable)).toBe(false);
  await expect(lead).toContainText('Fresh');
  await workbench.getByRole('button', { name: 'Open changes tray, 1 queued change' }).click();
  await workbench.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(lead).toHaveText(original);
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
  await editable.click();
  const pinnedControls = page.locator('.astro-ve-element-controls[data-pinned="true"]');
  await expect(pinnedControls.getByRole('button', { name: /^Edit Heading ·/ })).toBeVisible();
  await expect(pinnedControls.getByRole('button', { name: /^Lock Heading ·/ })).toBeVisible();
  let inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-state')).toContainText('Unlocked');
  await expect(inspector.getByRole('button', { name: 'Lock' })).toBeVisible();

  const ownerLocked = page.locator('[data-demo-banner]');
  await ownerLocked.click();
  inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-state')).toContainText('Locked');
  await expect(inspector.getByRole('button', { name: 'Unlock' })).toBeVisible();
  await expect(inspector.locator('.selection-lock-card')).toContainText('Locked');
  await expect(inspector.locator('.editable-text-setting')).toBeHidden();

  const sourceProtected = page.locator('[data-section="commit"] strong');
  await sourceProtected.dispatchEvent('click');
  inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-state')).toContainText('Protected');
  await expect(inspector.getByRole('button', { name: 'Lock' })).toBeHidden();
  await expect(inspector.getByRole('button', { name: 'Unlock' })).toBeHidden();

  const lockedSection = page.locator('[data-section="review"]');
  await lockedSection.hover();
  await expect(lockedSection).toHaveAttribute('data-astro-ve-protection', 'locked');
  // The locked state stays visible at rest as a corner chip; the Unlock
  // control appears once the section is selected.
  await expect(page.locator('.astro-ve-lock-chip[data-protection="locked"]')).toBeVisible();
  await lockedSection.dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'Unlock Review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move Review down' })).toHaveCount(0);

  const editableSection = page.locator('[data-section="preview"]');
  await expect(editableSection).toHaveAttribute('data-astro-ve-protection', 'unlocked');
  const sectionControls = page.locator('.astro-ve-section-controls[data-section-id="preview"]');
  await editableSection.hover();
  await sectionControls.getByRole('button', { name: 'Drag Preview to reorder' }).click();
  await expect(
    sectionControls.getByRole('button', { name: 'Open settings for Preview' }),
  ).toBeVisible();
  await expect(
    sectionControls.getByRole('button', { name: 'Drag Preview to reorder' }),
  ).toBeVisible();
  await expect(sectionControls.getByRole('button', { name: 'Lock Preview' })).toBeVisible();

  const results = await new AxeBuilder({ page }).include('astro-dev-toolbar').analyze();
  expect(
    results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious'),
  ).toEqual([]);
  await expect(workbench.getByRole('button', { name: 'Diagnostics' })).toBeHidden();
});

test('explains locked content in plain language and spotlights what is editable', async ({
  page,
}) => {
  await page.goto('/fixtures/complex');
  const { toolbar, workbench } = await enableEditor(page);

  // A page-authored data-astro-edit-locked-reason wins over the per-status
  // default copy and over configured lockedAreaMessages.
  const generated = page.locator('[data-demo-generated-note]');
  await generated.dispatchEvent('pointerover');
  await expect(generated).toHaveAttribute('data-astro-ve-text-state', 'protected');
  await expect(page.locator('.astro-ve-explainer')).toContainText(
    'assembled automatically when the page builds',
  );
  await page
    .locator('.astro-ve-element-controls')
    .getByRole('button', { name: 'Why can’t I edit this?' })
    .dispatchEvent('click');
  const inspector = await selectedTextInspector(toolbar);
  await expect(inspector.locator('.selection-lock-card')).toContainText(
    'assembled automatically when the page builds',
  );
  await expect(inspector.locator('.selection-lock-card .lock-action')).toContainText(
    'move this copy into a content file',
  );

  // The "What can I edit?" filter fades protected content and leaves editable
  // content at full strength, then restores the page when switched off.
  const filterToggle = workbench.getByRole('button', { name: 'Show what I can edit' });
  await filterToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-astro-ve-editable-filter', 'true');
  await expect(filterToggle).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => generated.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBeLessThan(0.5);
  await expect
    .poll(() =>
      page
        .locator('[data-demo-json-title]')
        .evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBe(1);
  await filterToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-astro-ve-editable-filter', 'false');
  await expect
    .poll(() => generated.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBe(1);
});

test('rewinds every save in the session with Restore session start', async ({ page }) => {
  test.setTimeout(90_000);
  const originalSource = await readFile(demoSource, 'utf8');
  try {
    let current = await enableEditor(page);
    const lead = page.locator('[data-astro-edit-id="hero-lead"]');
    await lead.click();
    await queueSelectedText(current.toolbar, 'First session edit for the rewind test.');
    await reviewAndCommit(current.toolbar, current.workbench);
    await expect
      .poll(async () => readFile(demoSource, 'utf8'))
      .toContain('First session edit for the rewind test.');

    // Astro replaces the document after the source write; re-acquire the
    // toolbar and layer a second save on the same element.
    await page.waitForTimeout(1_000);
    await waitForWorkbenchButtonEnabled(page, /Open changes tray/);
    current = await enableEditor(page);
    await page
      .getByText('First session edit for the rewind test.', { exact: true })
      .dispatchEvent('click');
    await queueSelectedText(current.toolbar, 'Second session edit for the rewind test.');
    await reviewAndCommit(current.toolbar, current.workbench);
    await expect
      .poll(async () => readFile(demoSource, 'utf8'))
      .toContain('Second session edit for the rewind test.');

    // A brand-new tab must reconnect to the same undo trail: the client
    // identity is durable, so closing a tab never orphans the rewind.
    const freshTab = await page.context().newPage();
    await freshTab.goto('/');
    const fresh = await enableEditor(freshTab);
    await fresh.workbench.getByRole('button', { name: /Open changes tray/ }).click();
    await fresh.workbench.getByRole('button', { name: 'History and restore' }).click();
    const freshHistory = fresh.toolbar.locator('dialog').filter({ hasText: 'History and restore' });
    await expect(freshHistory.getByRole('button', { name: 'Restore session start' })).toBeEnabled();
    await freshHistory.getByRole('button', { name: 'Close' }).click();
    await freshTab.close();

    await page.waitForTimeout(1_000);
    await waitForWorkbenchButtonEnabled(page, /Open changes tray/);
    current = await enableEditor(page);
    await current.workbench.getByRole('button', { name: /Open changes tray/ }).click();
    await current.workbench.getByRole('button', { name: 'History and restore' }).click();
    const historyDialog = current.toolbar
      .locator('dialog')
      .filter({ hasText: 'History and restore' });
    const restoreButton = historyDialog.getByRole('button', {
      name: 'Restore session start',
    });
    await expect(restoreButton).toBeEnabled();
    await restoreButton.click();
    const confirmRestore = current.toolbar
      .locator('dialog')
      .filter({ hasText: 'Restore how this session started?' });
    await expect(confirmRestore).toContainText('src/pages/index.astro');
    await confirmRestore
      .getByRole('button', { name: 'Restore session start' })
      .dispatchEvent('click');

    // Both saves are gone in one step: the file is byte-identical to the
    // pre-session original, not merely missing the last edit.
    await expect.poll(async () => readFile(demoSource, 'utf8')).toBe(originalSource);
  } finally {
    if ((await readFile(demoSource, 'utf8')) !== originalSource)
      await writeFile(demoSource, originalSource);
  }
});

test('edits and rearranges a completely unannotated page with zero setup', async ({ page }) => {
  // The plain fixture has no data attributes, no fileMappings entry and no
  // policy rules: everything the editor offers must come from zero-step
  // inference, and every write is still save-time validated.
  const plainSource = fileURLToPath(
    new URL('../../demo/src/pages/fixtures/plain.astro', import.meta.url),
  );
  const original = await readFile(plainSource, 'utf8');
  try {
    // First-ever hit on a route can abort while Vite optimises; retry once.
    await page.goto('/fixtures/plain').catch(() => page.goto('/fixtures/plain'));
    const { toolbar, workbench } = await enableEditor(page);
    const heading = page.locator('main > section > h1');
    await expect
      .poll(async () => heading.getAttribute('data-astro-ve-protection'), { timeout: 10_000 })
      .toBe('unlocked');
    await expect
      .poll(async () => page.locator('main > section[data-astro-ve-section-active="true"]').count())
      .toBe(3);

    await heading.dispatchEvent('click');
    await queueSelectedText(toolbar, 'A completely ordinary page, edited live');

    const secondSection = page.locator('main > section').nth(1);
    await secondSection.dispatchEvent('click');
    const inspector = toolbar.locator('.selection-inspector');
    await expect(inspector).toBeVisible();
    await page
      .locator('.astro-ve-section-controls[data-visible="true"]')
      .getByRole('button', { name: /Move .* up/ })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator('main > section').first()).toContainText('Why plain pages matter');

    await workbench.getByRole('button', { name: 'Open changes tray, 2 queued changes' }).click();
    await workbench.getByRole('button', { name: /Save and apply \(2\)/ }).click();
    const review = toolbar.getByRole('dialog', { name: 'Save and apply' });
    await review.getByRole('button', { name: 'Save and apply' }).dispatchEvent('click');
    await expect
      .poll(async () => readFile(plainSource, 'utf8'))
      .toContain('A completely ordinary page, edited live');
    const saved = await readFile(plainSource, 'utf8');
    expect(saved.indexOf('Why plain pages matter')).toBeLessThan(
      saved.indexOf('A completely ordinary page, edited live'),
    );
  } finally {
    await writeFile(plainSource, original);
  }
});

test('recovers from a stale queued change with one click and flags it in the tray', async ({
  page,
}) => {
  // Reproduces the owner-reported failure: changes queued, then the file
  // changes underneath (another editor, git, an earlier save). The save must
  // refuse honestly, mark exactly which change is stale, and 'Save the rest'
  // must land every valid change in ONE click, however many are stale.
  const original = await readFile(demoSource, 'utf8');
  try {
    const { toolbar, workbench } = await enableEditor(page);
    await page.locator('[data-astro-edit-id="hero-title"]').dispatchEvent('click');
    await queueSelectedText(toolbar, 'This edit will go stale');
    await page.locator('[data-astro-edit-id="hero-lead"]').dispatchEvent('click');
    await queueSelectedText(toolbar, 'This edit stays valid');
    // The first change goes stale: its source text changes on disk.
    await writeFile(
      demoSource,
      original.replace('Edit Astro where you can see it', 'Changed outside the editor'),
    );
    // The write triggers a full Vite reload (sometimes two); let it land
    // completely before touching controls, or a late reload wipes the
    // runtime failure state mid-assertion.
    await page.waitForTimeout(2_500);
    await waitForWorkbenchButtonEnabled(page, /Open changes tray/);
    await workbench
      .getByRole('button', { name: 'Open changes tray, 2 queued changes' })
      .dispatchEvent('click');
    // The stale change is caught at preview time, so the failure UI appears
    // without a confirm dialog.
    await workbench.getByRole('button', { name: /Save and apply \(2\)/ }).dispatchEvent('click');
    await expect(
      workbench.getByText(/changed after you started|text changed after you started/u),
    ).toBeVisible();
    await expect(workbench.locator('.change[data-failed="true"]')).toBeVisible();
    await expect(workbench.locator('.change-failed-note')).toContainText('file changed');
    await workbench.getByRole('button', { name: 'Save the rest' }).click();
    await expect.poll(async () => readFile(demoSource, 'utf8')).toContain('This edit stays valid');
    // The stale change returns to the tray for review rather than vanishing —
    // durable across the HMR reload the save itself triggers.
    await waitForWorkbenchButtonEnabled(page, /Open changes tray/);
    await expect(
      page
        .locator('astro-dev-toolbar')
        .locator('.workbench')
        .getByRole('button', { name: 'Open changes tray, 1 queued change' })
        .last(),
    ).toBeVisible();
  } finally {
    await writeFile(demoSource, original);
  }
});
