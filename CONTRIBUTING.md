# Contributing to openGym

Thanks for taking a look! openGym is intentionally small and dependency-light, and the goal is
to keep it that way — easy to read, easy to self-host.

## Project layout

```
apps/web/  React + Vite app (src/views, src/components, src/store, src/lib). Builds to static files.
apps/mobile/ Expo + TypeScript native shell for the standalone mobile app (docs/MOBILE.md).
apps/api/  TypeScript backend — Hono on Node, WebAuthn, JSON-file persistence.
Dockerfile multi-stage frontend image (builds frontend → nginx).
web/       nginx.conf (serves app and proxies /api).
media/     exercise img/gif (gitignored, fetched at runtime).
docs/      self-hosting guide.
```

## Running for development

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm dev                            # API + frontend via Turborepo
# open http://localhost:5173
# all TypeScript packages and maintenance scripts:
pnpm typecheck
# training logic (progression rules, 1RM, how a session is read back):
pnpm test
```

The root project is a pnpm workspace managed by Turborepo. The app-local `.env` files keep API
data in `data-dev/` and load exercise media from the pinned upstream CDN, so local development does
not modify the checked-in `data/` or require Docker. Edit `apps/api/.env` or `apps/web/.env` when
testing a different setup.

## Guidelines

- **Keep it dependency-light.** The frontend uses React + Router + Zustand and the API uses Hono,
  SimpleWebAuthn, and Web Push. New dependencies need to earn their place.
- **Match the style.** Small components, clear names, comments only where the "why" isn't obvious.
  State lives in the Zustand store (`src/store`); pure helpers in `src/lib`.
- **Don't commit** the exercise media (`media/`) or `data/` — they're gitignored.
- **Test the flow** you touched — click through the affected screens (and the workout flow) in a
  browser before opening a PR.
- **Training logic gets a unit test.** Anything deciding what you lift next, or reading a logged
  session back, belongs in a pure helper in `src/lib` with tests beside it (`pnpm test`). These
  rules are easy to get subtly wrong and nearly impossible to verify by clicking — the
  progression engine grew two real bugs that only a test pinned down.

## Good first issues

- Additional starter plans (upper/lower, full-body, 5×5…)
- More languages for the exercise instructions (the dataset ships several)
- Percentage / training-max programming (5/3/1-style) on top of the progression engine in
  `src/lib/progression.ts` — the policy interface is already there
- Accessibility passes on the workout and chart screens

## Where to ask what

| You have | Goes to |
| --- | --- |
| A question, or self-hosting that won't behave | [Discussions → Q&A](https://github.com/DuarteSantos8/openGym/discussions/categories/q-a) |
| An idea you're not sure about yet | [Discussions → Ideas](https://github.com/DuarteSantos8/openGym/discussions/categories/ideas) |
| A reproducible bug | [Issues](https://github.com/DuarteSantos8/openGym/issues) |
| A change you've already built | A pull request |

An answered question in Q&A is worth more than the same answer buried in a closed issue — the
next person searching "passkey login fails behind my reverse proxy" actually finds it.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, and your browser/OS. If it's
about login/passkeys, include your `RP_ID`/`ORIGIN` (not the `data/` contents) — most login
issues are an origin mismatch.

By contributing you agree your work is licensed under the project's [GNU AGPL v3.0](LICENSE).
