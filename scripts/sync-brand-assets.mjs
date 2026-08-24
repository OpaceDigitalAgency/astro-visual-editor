import { copyFile, readFile, writeFile } from 'node:fs/promises';

const masterPath = '.github/assets/astro-visual-editor-logo-transparent.png';
const copies = [
  'demo/public/favicon.png',
  'packages/astro-visual-editor/src/assets/astro-visual-editor-logo.png',
];
const svgFiles = [
  '.github/assets/astro-visual-editor-avatar.svg',
  '.github/assets/astro-visual-editor-social-card.svg',
];

const master = await readFile(masterPath);
const dataUrl = `data:image/png;base64,${master.toString('base64')}`;

await Promise.all(copies.map((destination) => copyFile(masterPath, destination)));

await Promise.all(
  svgFiles.map(async (path) => {
    const svg = await readFile(path, 'utf8');
    const updated = svg.replace(
      /href="(?:astro-visual-editor-logo-transparent\.png|data:image\/png;base64,[^"]+)"/u,
      `href="${dataUrl}"`,
    );

    if (updated === svg && !svg.includes(dataUrl)) {
      throw new Error(`No replaceable brand image found in ${path}`);
    }

    await writeFile(path, updated);
  }),
);
