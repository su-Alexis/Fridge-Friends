# Fridge Friends

A static React app for matching recipes, scaling batches, making grocery lists, and adding personal recipes. Ready for GitHub Pages; no server, database, hosting credentials, or API keys are required.

## Run on your Mac

Install Node.js 24 with npm, then open Terminal:

```sh
cd ~/Desktop/"Recipe App Main"
npm ci
npm run dev
```

Open the Local URL Vite prints (usually `http://127.0.0.1:5173`). Keep Terminal open while using the app; press Control+C to stop it. Later launches need only `npm run dev` from the project folder. The previous `TMPDIR` workaround is no longer needed.

If you use nvm, `nvm install` and `nvm use` select the version in `.nvmrc`. Minimum supported Node version: 22.22.2.

## Checks and production preview

```sh
npm run lint
npm run typecheck
npm test
npm audit
npm run preview
```

`npm test` validates the catalog, builds `dist`, and runs regression tests. `npm run preview` serves that build locally. `npm run build` builds without tests. `npm run build:wrapper` is an alias for the same static build; future Capacitor projects should use `dist` as their `webDir`.

## Architecture

| File                                           | Responsibility                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `index.html`, `main.tsx`                       | Static document, security policy, React entry and error boundary |
| `app/page.tsx`                                 | Screen layout and orchestration                                  |
| `components/recipe-editor.tsx`                 | Add/edit/delete personal recipes                                 |
| `components/recipe-calculator.tsx`             | Batch and unit controls                                          |
| `components/grocery-list.tsx`                  | Combined quantities and purchased items                          |
| `components/recipe-matches.tsx`                | Ranked shared-ingredient results                                 |
| `components/goal-filter.tsx`                   | Cutting/bulking labels and the picker filter                     |
| `components/fridge-finder.tsx`                 | Pick your ingredients, find recipes that use them                |
| `components/macros.tsx`                        | Nutrition figures, scaled by batch                               |
| `lib/recipe-schema.ts`                         | Validation for forms, files and saved recipes                    |
| `components/backup.tsx`, `lib/backup.ts`       | Export and restore saved data across devices and addresses       |
| `scripts/sw-template.js`, `scripts/build-sw.mjs` | Offline service worker, generated with each production build   |
| `data/recipes.json`                            | Built-in recipe catalog                                          |
| `app/assets/recipe-spread.*`                   | Shipped WebP plus the original PNG holding its Content Credentials |
| `lib/measurements.ts`, `lib/ingredients.ts`    | Parsing, conversion and aggregation                              |
| `lib/matching.ts`                              | Recipe matching                                                  |
| `lib/planner-state.ts`, `hooks/use-planner.ts` | Validated browser storage and recoverable errors                 |

Only the four UI primitives used by the app are retained. Next.js, Vinext, React Server Components, Cloudflare/Sites integrations, database/auth examples, and unused starter assets/components have been removed.

## Recipe storage and guides

**Add recipe** saves on the current browser/device. It does not update GitHub or share the recipe with other visitors. Browser storage can be cleared or evicted.

**Backup** (top right) exports your personal recipes and grocery list to a JSON file, and restores one. Saved data belongs to one web address: moving between localhost, `USERNAME.github.io`, a custom domain, and a native wrapper gives each its own separate storage, and nothing migrates automatically. **Export a backup before any such move, then restore it on the new address.** Restoring replaces everything currently saved in that browser and asks for confirmation first.

The app works offline after its first successful load. A service worker caches the site's own files; new deployments are picked up on the next online visit.

- [Recipe authoring and catalog updates](docs/RECIPES.md)
- [Security review and hosting limits](docs/SECURITY-REVIEW.md)
- [Future iOS/Android wrapper](docs/MOBILE-WRAPPER.md)

The original recipe sources were not supplied for verification. Quantities represent recipe batches, not verified serving yields.

## Credits and licensing

**Icons** throughout the interface, and the favicon and installed-app icons, are from [Lucide](https://lucide.dev). `public/favicon.svg` and `public/icons/*` are the Lucide `refrigerator` glyph on the app's background colour. Lucide is used under the ISC License, reproduced here as that licence requires:

> ISC License
>
> Copyright (c) 2026 Lucide Icons and Contributors
>
> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

**The food photograph** (`app/assets/recipe-spread.webp`) is AI-generated. Its original PNG is kept alongside it at `app/assets/recipe-spread.png` and carries a signed [C2PA](https://c2pa.org) Content Credentials manifest recording the provenance: created by the OpenAI Media Service API using `gpt-image` v2.0 on 2026-08-30, with IPTC digital source type `trainedAlgorithmicMedia`. **Do not delete that PNG** — it is the only copy of that provenance record, because the WebP re-encode does not carry the C2PA chunk. It is not imported by any source file, so it is never bundled or deployed; only the 270 KB WebP ships.

**Runtime dependencies** are all permissive: React, Radix UI, Zod, clsx, tailwind-merge and lucide-react under MIT or ISC, and class-variance-authority under Apache-2.0. Nothing in the dependency tree is copyleft or restricts publishing this repository.
