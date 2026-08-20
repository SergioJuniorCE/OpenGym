# opengym.duarte-santos.ch

Source of the project website — hand-written HTML/CSS with a TypeScript browser
entry point. Build the deployable static directory from the repository root:

```sh
pnpm build:website
```

Serve or deploy `website/dist/`; `site.js` in that directory is generated from
`site.ts` and is intentionally not committed.

Not in the generated directory (add these deployment artifacts after building):

- `img/` — the five screenshots from `../assets/screenshots/` plus `banner.png`
- `icon-180.png` / `icon-512.png` — copied from `../apps/web/public/` (the same
  icons the PWA uses, so the browser tab, home screen and app all match)
- `openGym.apk` — the signed release build (see `../docs/MOBILE.md`)

`site.ts` fetches the star/fork counts from the public GitHub API at view time.
