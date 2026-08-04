import { defineConfig } from 'astro/config';
import visualEditor from 'astro-visual-editor';

export default defineConfig({
  integrations: [
    visualEditor({
      fileMappings: {
        '/': 'src/pages/index.astro',
        '/fixtures/article': 'src/pages/fixtures/article.astro',
      },
      selectorMappings: {
        '[data-demo-banner]': 'src/pages/index.astro',
      },
    }),
  ],
});
