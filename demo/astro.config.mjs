import { defineConfig } from 'astro/config';
import visualEditor from '@opacedev/astro-visual-editor';

export default defineConfig({
  site: 'http://localhost:4321',
  integrations: [
    visualEditor({
      editabilityRole: 'owner',
      fileMappings: {
        '/': 'src/pages/index.astro',
      },
      selectorMappings: {
        '[data-demo-banner]': 'src/pages/index.astro',
      },
    }),
  ],
});
