import { defineConfig } from 'astro/config';
import visualEditor from '@opacedev/astro-visual-editor';

export default defineConfig({
  site: 'http://localhost:4321',
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
