import type { NormalizedOptions } from '../../options.js';
import type { EditorChange } from '../../shared/types.js';
import { applyAstroSections, applyAstroSeo, applyAstroText } from './astro.js';
import { applyMarkdownSeo, applyMarkdownText } from './markdown.js';
import { applyJsonText, applyYamlText } from './structured.js';

export async function applyChangeWithAdapter(
  source: string,
  extension: string,
  change: EditorChange,
  options: NormalizedOptions,
): Promise<string> {
  if (change.kind === 'sections') {
    if (extension !== '.astro') throw new Error('Section operations currently require an .astro owner file.');
    return applyAstroSections(source, change, options.sectionTemplates);
  }

  if (change.kind === 'seo') {
    if (extension === '.astro') return applyAstroSeo(source, change);
    if (extension === '.md' || extension === '.mdx') return applyMarkdownSeo(source, change);
    throw new Error(`SEO editing is not supported for ${extension} files.`);
  }

  if (extension === '.astro') return applyAstroText(source, change);
  if (extension === '.json' || extension === '.jsonc') return applyJsonText(source, change);
  if (extension === '.yaml' || extension === '.yml') return applyYamlText(source, change);
  if (extension === '.md' || extension === '.mdx') return applyMarkdownText(source, change);
  throw new Error(`No source adapter is available for ${extension} files.`);
}
