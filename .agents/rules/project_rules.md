# Project Rules: Ropenix (ecommerce, React + Node/Express, cPanel hosting)

## Stack and deployment facts (do not change without asking)
- Frontend: React 19 + Vite + Tailwind, source in `src/`.
- Backend: Express + TypeScript. It is bundled by esbuild to `dist/server.cjs` (CommonJS, `--packages=external`).
- Production runs on cPanel / Phusion Passenger. `app.cjs` is the ONLY startup file. Never create or edit `app.js`.
- `package.json` has `"type": "module"`. Any CommonJS file must use `.cjs`.
- Package manager: npm only. Never create or update `bun.lock`, `yarn.lock` or `pnpm-lock.yaml`.
- Anything the server imports at runtime must be in `dependencies`. Anything only used by Vite/the frontend build or types goes in `devDependencies`.
- Database is currently SQLite via `sql.js` (in-memory, saved to `veloce.sqlite`). MySQL (`mysql2`) is the migration target. Do not add new in-memory data stores.

## Target structure
```
server/
  index.ts          # bootstrap only: create app, mount routers, listen
  config/           # env loading + validation (fail fast if required vars missing)
  middleware/       # auth, requireAdmin, rateLimit, errorHandler, validate
  routes/           # one file per domain: auth, products, orders, customers,
                    # suppliers, settings, content, payments, newsletter, reviews
  services/         # business logic (no req/res here)
  db/               # connection, migrations, repositories (all SQL lives here)
  email/            # templates, queue, transporter
src/                # frontend only. Never import from server/
scripts/            # build and packaging
docs/               # CPANEL_DEPLOYMENT.md, ARCHITECTURE.md
```
Routes call services, services call repositories. Routes never touch the DB directly.

## Hard rules
1. **One route, one place.** Before adding an endpoint, search for the path. Never register the same method and path twice (Express silently ignores the later one).
2. **Auth on by default.** Every route outside a small public allowlist (storefront reads, login/register, contact, newsletter subscribe, order tracking) must pass `requireAuth`, and every admin, settings, customer, supplier, CRM, order-management and review-moderation route must pass `requireAdmin`.
3. **Never trust the client.** Derive the user from the verified session/token, never from `userEmail` or `userId` in the body. Recompute order totals and prices server-side from the database.
4. **Payments:** an order is marked paid only from a verified payment callback or an authenticated admin action. Never from a client-supplied status.
5. **Secrets:** read only from environment variables. No hardcoded keys, passwords, personal emails or fallback secrets. Never return secrets, OTPs, reset codes, password hashes or stack traces in API responses. Log errors server-side and return a generic message.
6. **Persistence:** orders, users, reviews, carts, requests, inventory logs and settings must be stored in the database. In-memory variables are allowed only for caches that can be rebuilt. Never write runtime state to JSON files in the project root.
7. **Validation:** validate every request body with `zod` at the route boundary. Escape all user-supplied values before putting them in HTML emails.
8. **Passwords and tokens:** scrypt/bcrypt for passwords (no plaintext or empty-hash accounts), signed tokens (JWT or sessions) with expiry, `crypto.randomInt` for codes. Never `Math.random` for anything security-related.
9. **No dead or duplicate code.** Delete unused code instead of commenting it out. Do not leave mock or demo endpoints in production paths.
10. **No new files in the repo root** except config files. Never commit build output, `*.zip`, `*.sqlite*`, `.env`, `scratch/` or `.notified_expiry_products.json`.

## Coding conventions
- TypeScript strict. No `any` in new code; define types for request and response shapes.
- One responsibility per file. Keep files under ~300 lines; split when larger.
- Consistent API response shape: `{ success, data?, error? }` with correct HTTP status codes (don't return 200 for failures).
- One URL style: `/api/<resource>` with no trailing-slash duplicates (use `app.set('strict routing', false)` instead of listing both paths).
- Names are in English and consistent. Use the "Ropenix" brand throughout and remove leftover "Veloce"/"marid" references when touching a file.

## Workflow rules
- Make small, focused changes. Do not refactor unrelated code in the same change.
- Before editing, read the existing code and search for existing helpers. Reuse them instead of writing new ones.
- Ask before: deleting files, changing the database schema, changing auth behavior, adding a dependency, or changing the build/deploy setup.
- After every change run `npm run lint` and `npm run build`. Fix errors before reporting done.
- Do not change `app.cjs`, `package.json` scripts, or `vite.config.ts` unless the task requires it, and explain why.
- When you finish, summarize: files changed, why, anything you deliberately left alone, and anything I must do manually (env vars, cPanel restart, migration).

## Definition of done
Builds without errors, no duplicate routes, no new secrets in code, new endpoints have auth plus validation, and `docs/` is updated if behavior or deployment changed.
