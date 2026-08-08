import { defineConfig } from 'astro/config';
import visualEditor from '@opacedev/astro-visual-editor';

export default defineConfig({
  site: 'http://localhost:4321',
  integrations: [
    visualEditor({
      editabilityRole: 'owner',
      fileMappings: {
        '/': 'src/pages/index.astro',
        '/fixtures/complex': 'src/pages/fixtures/complex.astro',
      },
      selectorMappings: {
        '[data-demo-banner]': 'src/pages/index.astro',
      },
      lockedAreaMessages: [
        {
          selector: '[data-section="commit"]',
          route: '/',
          message:
            'This card explains the save flow, so its label is fixed as part of the demo chrome.',
          action: 'A developer can change it in demo/src/pages/index.astro.',
        },
      ],
      demoPages: [
        {
          id: 'simple',
          label: 'Simple demo',
          path: '/',
          description: 'The original single-page Beta 4 fixture.',
        },
        {
          id: 'complex',
          label: 'Complex sources',
          path: '/fixtures/complex',
          description: 'A layout, components, JSON data and Content Collection fixture.',
        },
      ],
    }),
  ],
});
