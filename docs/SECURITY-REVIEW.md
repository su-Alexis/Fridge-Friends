# Security and reliability review

Review date: September 9, 2026 (America/Phoenix).

## Static hosting boundary

Fridge Friends is now a static GitHub Pages app. It has no API endpoints, server rendering, database, authentication, uploads, analytics, remote recipe fetching, or API keys. The production artifact contains only HTML, JavaScript, CSS, the recipe image, icons and a web manifest. Built-in recipes are bundled into JavaScript and are public.

Removed Next.js, Vinext, React Server Components, Cloudflare Workers/Wrangler tooling, Sites metadata/build scripts, D1/Drizzle examples, unused auth helpers, unused starter assets, unused UI components and their dependencies. The raw HTML/CSS insertion surface in the unused chart component was removed with it. Old generated server output and local hosting state were deleted.

The September 9 full npm audit returned **0 known vulnerabilities**. This is a source and automated regression review, not proof that every possible vulnerability is absent.

## Browser safeguards

- A CSP meta tag appears before executable assets. Production allows only same-origin scripts and forbids inline scripts, eval, network connections, form submissions, embedded objects, base URL changes and workers. Styles allow inline values because accessible Radix dialogs/selects need them. Icons/manifest and local images are explicitly allowed.
- Only the development server relaxes the policy for React Fast Refresh and a loopback WebSocket. Development and preview bind to `127.0.0.1`.
- Recipe data is strict, bounded, plain text validated with Zod. HTML, control characters, unknown fields, invalid numeric quantities, duplicate IDs and oversized collections are rejected. The app renders recipe text through React and does not evaluate it or insert it as HTML.
- Local storage is validated on load and update. Parsing is capped at 1,000,000 characters and 100 custom recipes. Only known recipe IDs, valid batches and compatible unit selections are accepted. Custom recipes cannot overwrite built-ins.
- Storage failures are visible and preserve usability in the current window. Quantity changes clear stale purchased-item checks; deleting recipes and clearing lists require confirmation.
- The recipe catalog import command validates JSON, bounds file size, rejects duplicate IDs, and writes atomically under an exclusive lock. It does not execute imported content or fetch URLs.

## GitHub workflow safeguards

The workflow runs lint, type checks, a dependency audit, a production build, and regression tests before uploading only `dist`. High/critical known dependency findings block deployment. GitHub actions are pinned to commit SHAs; Dependabot is configured for packages and actions.

Build jobs have read-only repository permissions. Only the separate deployment job receives Pages write and OIDC permissions, and only for `main` push/manual runs. Pull requests never deploy. Checkout does not persist credentials, and no long-lived token is configured. Review changes to workflow files and dependencies before merging them.

## GitHub Pages limitations

GitHub Pages serves static files and does not run the old Worker or honor a custom `_headers` file. The HTML meta policy cannot set response-only controls such as CSP `frame-ancestors`, `X-Frame-Options`, or `Permissions-Policy`. Referrer behavior is set with a supported HTML meta tag. Enforce HTTPS through repository Pages settings. If authenticated access or custom response headers become requirements, use a host that supports them.

The previous Sites access policy is not carried over. All published assets and built-in recipe content must be suitable for public access. Personal recipes stay in the browser, but local storage is neither encrypted nor an account boundary. Separate project paths under one GitHub Pages hostname share an origin; another application on that origin can access browser storage. Do not store credentials or sensitive information here.

Recipes and lists do not sync across devices or automatically migrate between the old site, localhost, GitHub Pages, custom domains, and native wrappers. Browser storage can be cleared or evicted; concurrent tabs use last-writer-wins behavior. There is no service worker, so fresh web loads require connectivity.

## Verification

`npm test` exercises recipe/schema validation, unit conversion, grocery persistence, blocked/corrupt storage, the custom recipe lifecycle, and static output security/asset resolution at root and repository paths. `npm run lint`, `npm run typecheck`, and `npm audit` cover code/dependency checks.

Browser visual QA and physical iOS/Android testing have not been performed. Native projects, signing and store submissions are future work. Cookbook source accuracy, serving yields, preparation instructions and food safety were not independently verified.

## Second review pass — September 10, 2026

An independent source review against the OWASP Top 10 (2021) and the OWASP Cheat Sheet Series found no injection, authentication, or access-control defects: the app has no server, no network calls, no authentication and no HTML sinks. Six issues were fixed.

| Issue | OWASP reference | Fix |
| ----- | --------------- | --- |
| No clickjacking defence. GitHub Pages cannot send `X-Frame-Options` or a CSP `frame-ancestors` directive, and browsers ignore `frame-ancestors` in a `<meta>` policy, so any site could frame and overlay the app. | A05 Security Misconfiguration; Clickjacking Defense Cheat Sheet | `main.tsx` detects a framed context and renders an "open directly" notice instead of the app. |
| `lucide-react`, `radix-ui`, `zod` and `tw-animate-css` used caret ranges while every other dependency was pinned, so a compromised or malicious minor release could enter a fresh install. | A06 Vulnerable and Outdated Components; A08 Software and Data Integrity Failures | Pinned to the exact versions already in `package-lock.json`. |
| The deployed artifact depended on `npm test` building `dist` as a side effect; editing the test script could publish a stale or empty site. | A08 Software and Data Integrity Failures | The workflow runs `npm run build` explicitly before uploading. |
| `app/page.tsx` and `components/grocery-list.tsx` used non-null assertions on recipe lookups. The storage validator currently guarantees those IDs, but any future gap would crash the whole screen on load. | A04 Insecure Design (defence in depth) | Fall back to the first recipe, and skip planned IDs with no matching recipe. |
| Saving a custom recipe called `crypto.randomUUID()`, which is undefined outside a secure context, so the Save button failed silently over plain HTTP on a LAN address. | Availability / A04 Insecure Design | Falls back to `crypto.getRandomValues` when `randomUUID` is unavailable. |
| `README.md` contained an absolute path disclosing the author's macOS account name in a public repository. | A01 Broken Access Control (information disclosure) | Replaced with a `~`-relative path. |

### Confirmed sound

Storage validation (`lib/planner-state.ts`) treats `localStorage` as untrusted, re-validates on every read *and* write, caps input at 1,000,000 characters and 100 custom recipes, and whitelists IDs, batch counts and unit names. Recipe IDs are constrained to `^[a-z0-9]+(?:-[a-z0-9]+)*$`, which cannot express `__proto__`, and `constructor`/`prototype` are rejected explicitly; `Object.hasOwn` guards the untrusted lookups — there is no prototype-pollution path. All rendering goes through React text nodes; there is no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write` or `javascript:` URL anywhere in the source. `package-lock.json` resolves all 416 packages to `registry.npmjs.org` with integrity hashes.

## Offline support and backup — September 10, 2026

Two features were added. Both were reviewed as part of this pass.

### Backup and restore

Export writes the planner state to a JSON file via a blob URL and `<a download>`; import reads a chosen file with `File.text()`. **The backup file is byte-for-byte the storage format**, so an imported file is validated by `parseSavedState` — the identical strict parser that already guards `localStorage`. There is no second format, no second parser, and therefore no new trust boundary: an imported file gets the same size cap, ID whitelist, unit whitelist, custom-recipe limit and plain-text rules as anything already saved. Restoring is destructive, so it requires an explicit confirmation naming what will be replaced.

Neither operation touches the network. `connect-src 'none'` is unchanged, and file reading and blob downloads are not fetch directives, so the policy did not need relaxing for this feature.

### Service worker

`dist/sw.js` is generated at build time by `scripts/build-sw.mjs` from `scripts/sw-template.js`, which injects the exact shipped file list and a cache name derived from a SHA-256 of those bytes. Every deployment therefore installs a fresh cache, and the `activate` handler deletes all others, so stale assets cannot accumulate or be served.

- **Scope is this app's own directory.** Registered as `new URL("sw.js", document.baseURI)`, so on a project site the scope is `/repository/` and the worker cannot observe or intercept requests for anything else on the shared `USERNAME.github.io` host.
- **It never contacts another origin.** Requests whose origin differs from the worker's are passed through untouched; only same-origin `GET` requests are cached.
- **Navigations are network-first** so a new deployment is picked up as soon as the device is online, falling back to the cached document when offline. Hashed build assets are cache-first, which is always correct because the hash identifies the exact bytes.
- **One CSP directive was relaxed:** `worker-src 'none'` became `worker-src 'self'`, the minimum needed to register a same-origin worker. Every other directive is unchanged, and a test asserts the rest of the policy still holds.

The worker is registered only in production builds and never inside a frame, so the development server and any framed context are unaffected.

### Accepted residual risks

- **`style-src 'unsafe-inline'`** is required by Radix positioning. Inline *styles* cannot execute script under `script-src 'self'`, so the practical impact is limited to CSS-based UI redressing.
- **Trusted Types** (`require-trusted-types-for 'script'`) would close the residual DOM-XSS class but is unverified against React 19 and Radix in this project. Add it only with a full `npm test` run and manual browser QA.
- **Shared origin.** Every project site under one `USERNAME.github.io` host shares an origin and therefore shares `localStorage`. A custom domain for this app alone is the only way to isolate it.
- **Dependency install scripts.** `esbuild`, `fsevents` and `flatted` declare install scripts. npm 11.19 (bundled with Node 24.20) blocks these by default under `allowScripts` and warns rather than running them; a clean `npm ci` plus a full production build and test run succeeded with none of them executed, so no approval is needed and no `--ignore-scripts` flag was added. CI resolves the same npm via `.nvmrc`, so the behaviour matches. Re-evaluate if a future dependency genuinely requires an approved script.

### Verification of this pass

Node 24.20.0 / npm 11.19.0 (matching `.nvmrc` and therefore CI) was installed on the review machine and the full gate was re-run after the changes:

| Command | Result |
| ------- | ------ |
| `npm ci` | 339 packages, **0 vulnerabilities**; package.json and package-lock.json in sync after pinning |
| `npm run lint` | clean, `--max-warnings=0` |
| `npm run typecheck` | clean |
| `npm audit --audit-level=high` | **0 vulnerabilities** |
| `npm test` | production build succeeded; **25/25 tests pass** |

Tests added with these features cover the backup round trip through the real UI, restoring into a cleared browser, rejection of corrupt and hostile backup files, and a check that the generated service worker precaches only files that exist and references no other origin.

Still outstanding: delete the untracked `.DS_Store` files (`.gitignore` already excludes them, but `git add -f` would override that). Browser visual QA and physical iOS/Android testing remain unperformed.

References: [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
