# Astro Theme Product and Publishing Plan

**Status:** proposed follow-on project  
**Last reviewed:** 4 August 2026  
**Related product:**
[`@opacedev/astro-visual-editor`](https://github.com/OpaceDigitalAgency/astro-visual-editor)

## Purpose

Create a genuinely reusable, content-rich Astro theme that demonstrates the
Astro Visual Editor in a realistic website without turning either product into
a dependency of the other. The theme should be valuable on its own, easy to
install, polished enough for Astro's official theme catalogue, and configured
so developers can optionally edit its supported content through the Visual
Editor during local development.

This is a separate product from the integration:

- the Visual Editor remains an npm integration and is eligible for an Astro
  `/integrations/` listing;
- the theme is a reusable website starter submitted through the
  [Astro Developer Portal](https://portal.astro.build/) and can receive a
  dedicated `/themes/details/.../` page;
- the theme may install and demonstrate the Visual Editor, but the production
  website must not require or expose the editor.

## Recommended product

Use the working title **Opace Launchpad** until naming and trademark checks are
complete. Position it as a free, production-ready agency and professional
services starter. A strong free theme is the best first release because it
removes purchase friction, gives the Visual Editor a public reference
implementation, and can build trust before any premium variants are offered.

The starter should include:

- a high-impact home page with editable hero, proof, services, projects,
  testimonials, process, frequently asked questions and calls to action;
- service landing pages with reusable content modules;
- case studies/projects backed by Astro content collections;
- an editorial blog and author/category pages;
- an about/team page;
- a tools/resources directory that can showcase the Astro Visual Editor and
  other Opace products;
- contact and enquiry forms with a documented, provider-neutral adapter;
- SEO defaults, Open Graph images, sitemap, RSS, canonical URLs and structured
  data;
- accessible navigation, keyboard interactions, forms and motion preferences;
- dark/light presentation only if both modes are fully designed and tested;
- realistic sample content that users are explicitly licensed to replace.

Avoid filling the starter with thin placeholder pages or presenting it as a
finished bespoke Opace client site. It must be a template that another
developer can rename, restyle and deploy without removing Opace-specific
business logic.

## Visual Editor integration

The theme should make the integration tangible while preserving production
isolation:

1. Add `@opacedev/astro-visual-editor` as a development dependency.
2. Enable it only for Astro's development command.
3. Annotate editable text and SEO fields with stable source references.
4. Declare named section regions and a curated allowlist of compatible section
   templates.
5. Give repeated sections stable identities so reordering produces a clear,
   reviewable transaction.
6. Include an editor demo page and a short guided walkthrough in the theme
   documentation.
7. Prove that `astro build` contains no editor UI, mutation route, write
   capability or editor-only client bundle.

The editor must remain optional. Removing its import and development dependency
must leave a fully working theme.

## Repository and distribution

Create a separate public repository, proposed as
`OpaceDigitalAgency/astro-launchpad-theme`, with GitHub's **Use this template**
feature enabled. Do not place the theme inside the integration repository.

The repository should contain:

- a focused README with screenshots, live demo, install commands and feature
  matrix;
- a permissive licence appropriate for a free starter and explicit licences
  for fonts, icons, images and sample content;
- contribution, support, security and code-of-conduct documents;
- a changelog and versioned releases;
- a one-command local setup and a tested deployment guide;
- Dependabot/Renovate and CI for formatting, linting, type checking, builds and
  browser tests;
- no secrets, customer material or production form credentials.

For a free theme, the catalogue's download link should point to the public
repository or a stable starter route. Also provide an `astro.new` link once the
repository can be created cleanly from the standard Astro starter flow.

## Live demo

Publish a production demo on a stable Opace-controlled domain or subdomain.
The demo must:

- build from the public theme repository;
- use representative, high-quality content across every advertised page type;
- expose no development editor or write routes;
- have working navigation, forms or clearly labelled form-demo behaviour;
- include a visible link to documentation and the Visual Editor product page;
- pass mobile, accessibility, performance, metadata and broken-link checks;
- be redeployed automatically from the protected release branch.

A short video or animated walkthrough may demonstrate front-end editing, but
the theme gallery should lead with clean screenshots of the finished website.

## Developer Portal submission pack

Prepare all listing material before opening the submission:

- final product name and slug;
- one-sentence catalogue description;
- longer feature-led description written for Astro developers;
- free/paid classification and price if applicable;
- relevant categories and technology tags only;
- public repository/download URL;
- working live-demo URL;
- documentation, support, licence and issue-tracker links;
- polished desktop and mobile screenshots with consistent dimensions;
- logo/thumbnail that remains legible at catalogue-card size;
- Opace developer/agency profile with a concise biography, logo and canonical
  website URL;
- accurate creator attribution and links to related Opace Astro products.

Sign into the [Astro Developer Portal](https://portal.astro.build/) with the
approved Opace GitHub identity, complete the developer/agency profile, create
the theme listing, preview every field and submit it. Astro's catalogue data is
synchronised from the portal daily; that external review/synchronisation is not
complete until the public detail page renders correctly.

## Discovery and cross-linking

After both public listings exist:

- link the theme demo and documentation to the Visual Editor integration page;
- link the integration README and Opace product page to the theme as a complete
  example project;
- add the theme to the Opace tools/resources directory;
- use consistent names, descriptions, screenshots and canonical URLs across
  GitHub, the live demo, Astro and Opace;
- publish one substantive implementation article rather than creating thin
  duplicate landing pages;
- add structured data appropriate to the live demo and product page;
- avoid claims that Astro endorses the product unless Astro explicitly does so.

## Quality gates

The theme is ready to submit only when all of these pass from a clean clone:

1. install with the documented supported Node and package-manager versions;
2. `astro check`, lint, formatting and unit tests;
3. static and configured server builds, where both are advertised;
4. browser tests for navigation, menus, forms and key user journeys;
5. WCAG 2.2 AA review, including keyboard and reduced-motion behaviour;
6. responsive visual regression at phone, tablet, laptop and wide desktop;
7. Lighthouse checks with documented budgets rather than a one-off score;
8. metadata, structured data, sitemap, RSS and broken-link validation;
9. clean creation through the public repository/download route;
10. Visual Editor text, SEO, add, delete and section-reorder workflow;
11. production-isolation proof after the editor is enabled in development;
12. licence and attribution review for every shipped asset;
13. screenshots and live demo visually checked against the submitted listing.

## Delivery phases

### Phase 1 — Product brief and design system

- approve name, audience, free/paid model and licence;
- define page inventory, content model and supported editor regions;
- create a distinctive but adaptable visual system;
- specify performance, accessibility and browser-support budgets.

**Exit:** approved product brief, wireframes, content schema and acceptance
criteria.

### Phase 2 — Reusable implementation

- build components, layouts, collections and example content;
- add SEO, accessibility and form foundations;
- implement optional Visual Editor annotations and section templates;
- write setup, customisation and deployment documentation.

**Exit:** clean-clone install and all functional tests pass locally.

### Phase 3 — Demo and release

- publish the public repository and enable template use;
- deploy the live demo from the repository;
- run the full quality gate and remediate findings;
- create the first signed/tagged release and stable download route.

**Exit:** public repository, release and production demo are independently
verified.

### Phase 4 — Catalogue submission

- create or update the Opace Developer Portal profile;
- upload the complete submission pack;
- submit the theme and address any Astro feedback;
- verify the public `/themes/details/.../` page after catalogue sync.

**Exit:** the listing is publicly rendered with correct attribution, gallery,
demo, download, documentation and Opace profile links.

### Phase 5 — Launch and maintenance

- cross-link the theme, integration, Opace product page and implementation
  article;
- monitor issues, dependency updates, demo uptime and Astro compatibility;
- publish tested releases and keep the portal listing current;
- use actual adoption and support feedback to decide whether premium variants
  are justified.

## Definition of done

The follow-on project is complete only when the reusable repository and live
demo are public, the full clean-install and production-isolation gates pass,
the Astro theme detail page is visibly live, its creator profile and links are
correct, and the documentation explains both using the theme by itself and
using it with the optional Visual Editor. Portal submission alone is not proof
of catalogue publication.

## Official references

- [Astro themes and submission](https://astro.build/themes/1/#submit-a-theme)
- [Astro Developer Portal](https://portal.astro.build/)
- [Astro catalogue update process](https://github.com/withastro/astro.build#updating-themes)
- [Astro integration library](https://docs.astro.build/en/guides/integrations/#integrations-library)
- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro accessibility guidance](https://docs.astro.build/en/reference/experimental-flags/accessibility/)
