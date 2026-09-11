# Future iOS/Android wrapper

The GitHub Pages app is already a static bundle. The same output can be packaged in a future Capacitor app:

```sh
npm run build
```

Use `dist` as Capacitor's `webDir`. The compatibility command `npm run build:wrapper` creates exactly the same output. No separate web implementation, server, hosting credentials or authentication helper is needed. Assets use relative URLs. The build targets Safari 16.4+ and Chrome 110+ because the CSS stack needs modern browser features.

The app already includes safe-area spacing, dynamic viewport heights, normal zoom, touch-friendly controls, accessible dialogs and validated local persistence. Personal recipes use the same form and schema everywhere.

## Creating native projects later

Choose an owned application identifier and install compatible Capacitor core/CLI/iOS/Android packages. Set the name to Fridge Friends and `webDir` to `dist`. Enable zoom, leave mixed content disabled, and do not enable production WebView debugging. Add the platforms, build, and run `npx cap sync` before opening Xcode or Android Studio.

Package local assets for production. Do not set a remote `server.url` or allow arbitrary external navigation. No native plugin or permission is needed by the current app. Review the CSP against the wrapper's local origin and test it on each platform.

Follow the current [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow) and [configuration reference](https://capacitorjs.com/docs/config) when beginning native work.

## Release work still required

- App IDs, developer accounts, platform SDKs, signing and store assets.
- Real-device checks for safe areas, keyboards, large text, rotation, background/resume and app upgrades.
- Android system-back behavior with open dialogs and at the root screen.
- Storage persistence through upgrades. Browser and wrapper origins differ; existing data will not migrate automatically. **Export/import now exists** (the Backup button), so a user can carry data across that boundary by hand; durable native storage is still worth adding before release.
- Keep future credentials in platform secure storage. Introduce permissions/plugins only when a feature requires them.

Home-screen installation from GitHub Pages is separate from native packaging. The web manifest, Apple icon metadata and a service worker are included, so an installed copy launches full screen and works offline after its first load. Consider whether that is already sufficient before taking on native packaging: it needs no developer account, no store review, and updates ship as soon as you push.

A native wrapper earns its cost when the app needs platform APIs the web cannot reach. The current app needs none. If you do package it, note that Capacitor serves from its own origin, so the wrapper starts with empty storage — use Backup to carry data in.
