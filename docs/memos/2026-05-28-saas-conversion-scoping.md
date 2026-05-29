# SaaS conversion scoping -- public demo + gated product surface, organizations from day one

**Status:** draft, recommends-only (memo scopes the productization split; no schema applied, no auth code, no middleware committed in this commit; M6 migration and `src/lib/auth/` module are downstream of architect / Steven adjudication).
**Date:** 2026-05-28
**Author:** `safeeval-policy` (Cowork), via `safeeval-agents:design-memo-author` (mode A).
**Companion to:** `docs/memos/2026-05-28-data-track-scoping.md` (Compliance-ready persistence; `customer_id` field reserved as the multi-tenancy hook the M6 migration converts to `organization_id`), `docs/memos/2026-05-28-data-track-implementation-spec.md` (M1 -- M3 migrations the M6 migration sequences after; RLS pattern (`app.current_customer_id` GUC) the M6 migration generalizes), `docs/memos/compl/2026-05-28-pii-access-posture-zero-storage-amendment.md` (zero-storage posture; applies uniformly across all customers; no per-tenant override), `docs/memos/2026-05-28-report-generator-scoping.md` (legal-audience auth-gate pattern reused for organization-scoped access), `docs/memos/2026-05-28-classifier-feedback-loop-scoping.md` (`editor_role` closed set the M6 role-permission matrix has to reconcile with the SaaS `member` / `reviewer` roles), `docs/memos/2026-05-24-parallel-cowork-tracks.md` (parallel-tracks framework; fifth atomic amendment escalation-field convention used in §14 below).
**Hard dependency:** data track Phase 1 -- 2 -- 4 shipped (commits `c301f79`, `33a6075`, `2d3e797`); PII zero-storage Tier A landed (commit `e416f02`); M6 migration requires data track migrations M1 -- M3 to exist. Phase 4 (roles) requires the feedback-loop scoping memo's `editor_role` vocabulary to be reconciled with the SaaS `member` / `reviewer` roles (cross-memo reconciliation flagged at §14 Q5).
**Steven-locked decisions (not re-opened in this memo):** (1) architecture Option 1A -- full demo + SaaS split; (2) auth provider Supabase Auth NOW with migration-readiness for Clerk later via a thin `src/lib/auth/` abstraction layer; (3) tenancy model -- organization from day one, every user belongs to an org, billing rolls up to the org, users have roles within the org. These three adjudications are recorded as decisions, not re-litigated as alternatives.
**Scope:** scope items 1 -- 3 (signup, auth, multi-tenancy) of the SaaS conversion behind a gate, with the existing portfolio site preserved as a public demo. Two-surface architecture, auth module shape, M6 multi-tenancy schema, signup / onboarding flow, role-permission matrix, plan tiers (placeholder for billing phase), public-vs-gated surface boundary, PII zero-storage continuity, three scope tiers, five-phase implementation, five risks, sequencing dependencies, open questions, adversarial review per design-memo-author mode C. Billing, Stripe integration, audit-log UI, admin dashboards are NAMED but OUT of scope -- they are the Full-tier follow-on memo's territory.

## 1. Problem statement

SafeEval today is a portfolio demo. The public site at `https://safeeval.vercel.app/` shows case studies, memos, a hardcoded "try it" fixture, and the framework's policy thesis -- all of it accessible without authentication, designed to be readable by a hiring manager scanning the repo in five minutes. The persistence layer landed in the data track is single-tenant (`customer_id` defaults to `'self'`; RLS is wired to `app.current_customer_id` but the value is hardcoded); reports, classifier edits, and the feedback loop are scoped to a single implicit customer. There is no signup, no auth, no per-user history.

To commercialize without losing the portfolio story, the product surface has to split. Items 1 -- 3 from Steven's earlier discussion -- signup, auth, multi-tenancy -- are the foundational moves. The split has to satisfy three constraints simultaneously:

- **Portfolio integrity is the primary constraint.** A hiring manager opening `https://safeeval.vercel.app/` today sees the framework, the memos, the case studies, the "try it" fixture. None of that may move behind a signup gate. The portfolio story degrades the moment a hiring reader has to create an account to see the work.
- **The gated surface must be defensible as production-grade.** A user who signs up is signing up for a real product, not a demo. The auth surface, the multi-tenancy enforcement, and the per-organization isolation all have to be defensible against the standard SaaS data-leak vectors (RLS misconfiguration, auth provider lock-in, billing-from-day-one bloat).
- **The split must be reversible-ish.** Auth provider lock-in is the single decision most likely to be regretted. Supabase Auth handles the MVP tier completely but the migration to Clerk (when SAML / SCIM is required) has to be a one-module rewrite, not a per-route migration.

The proposal is a two-surface architecture: (a) public surface preserved as-is, gaining a clearer "demo vs. product" framing; (b) gated surface at `/app/*` requiring signed-in session, behind which live evaluations are persisted per organization, reports are accessible, and classifier edits are accepted. The infrastructure that makes this work -- a thin auth abstraction layer, an organizations-from-day-one schema migration, a Next.js middleware gate -- is named in this memo's §3 -- §5; the surface mapping is in §8; the implementation phasing is in §11. Items 1 -- 3 are the scope here; billing and plan-tier enforcement are deferred to the Full-tier follow-on memo per §10 and §11 below.

Per Steven: portfolio integrity > rapid productization; the gate doesn't degrade what hiring managers see. The recommended Standard tier (§10.2) is the "real product" tier and is the one this memo is built around; MVP (§10.1) is named as a defensible cheaper path if even the Standard tier is too much for the portfolio window, and Full (§10.3) is named as the eventual commercial-readiness target.

## 2. The two-surface architecture

The split has three architectural layers: the public surface (existing, preserved), the gated surface (new, behind auth), and the middleware enforcement layer that separates them.

### 2.1 Public surface (existing, preserved)

`https://safeeval.vercel.app/` and all current routes. Marketing copy, case studies, memos under `/docs/*`, the hardcoded fixture eval, the "Sign up to evaluate live" CTA. No auth required for any of this; no signup gate; no degradation of what is currently public.

Concretely, the public surface retains:

- `/` -- marketing page, framework summary, "Sign up to evaluate live" CTA below the fold.
- `/case-study/*` -- the existing case studies; portfolio artifacts.
- `/docs/*` -- the FAF policy, the threat models, the design memos (the ones safe for external reading).
- `/about` -- the project narrative.
- `/demo/eval` -- new route added in this scope. Runs against a hardcoded fixture envelope (the same shape the existing site exposes), no real API call, no persistence, no real customer data. The route exists so a hiring reader who clicks "try it" sees a worked example without going through signup; the eval response is a canned demonstration, not a live classification.

The principle: nothing currently public moves behind the gate. The public surface is the portfolio artifact; degrading it to fund the gated surface would invert the priority order Steven adjudicated.

### 2.2 Gated surface (new)

`/app/*` routes (or, deferred, `app.safeeval.com` subdomain). Requires signed-in session. Behind the gate live the surfaces a real product needs:

- Live `/api/app/evaluate` route -- real Anthropic API call, real persistence (`SAFEEVAL_PERSIST_EVALUATIONS=true`), per-organization scope.
- `/app/evaluations` -- per-organization evaluation history.
- `/app/evaluations/:id` -- per-evaluation detail view.
- `/app/reports/:id` -- audience-tailored reports (the report generator's surface, gated per the legal-audience auth-gate pattern from `docs/memos/2026-05-28-report-generator-scoping.md` §8 plus the organization-scoped access pattern this memo adds).
- `/app/edits` -- classifier-edit submission surface, gated per the `editor_role` permission matrix from `docs/memos/2026-05-28-classifier-feedback-loop-scoping.md` §6 plus the organization-role reconciliation flagged at §14 Q5 below.
- `/app/settings`, `/app/org`, `/app/billing` -- per-organization administration surfaces (billing is a placeholder pre-Full; org settings are functional under Standard).

The principle: the gated side ADDS surface area; it does not move surface from the public side. A hiring reader who notes the SaaS infrastructure (auth abstraction, org schema, middleware gate, role-permission matrix) reads it as a product-thinking signal, not as a degradation of the portfolio.

### 2.3 Middleware enforcement

The boundary between the two surfaces is enforced at the Next.js App Router middleware layer (`src/middleware.ts`). The middleware intercepts every request to `/app/*` and `/api/app/*`, validates the session, and redirects unauthenticated requests to `/signup`. The implementation pattern is the standard Next.js 15 middleware shape:

- Matcher config restricts the middleware to `/app/*` and `/api/app/*` paths (`config.matcher = ['/app/:path*', '/api/app/:path*']`). The public surface is unaffected.
- Inside the middleware, the auth module's `getCurrentUser()` is called against the request's cookies / Authorization header. If no session, redirect to `/signup`; if session but no organization context (mid-onboarding), redirect to `/app/welcome`; otherwise, proceed.
- The middleware sets the `app.current_organization_id` GUC for the request scope by attaching the user's current organization to the request context (typically via a header the API route reads and binds before opening a Postgres connection). The GUC binding is the read-path counterpart to the M6 RLS policy.

The middleware is the load-bearing enforcement surface. RLS in Postgres is the second line of defense; the middleware ensures the GUC is bound correctly before any query fires. Bypassing the middleware (a hand-coded `fetch` against `/api/app/*` without a valid session cookie) returns a 401; the API route itself also calls `requireAuth()` defensively, so a middleware bug does not silently leak data.

## 3. Auth module architecture (`src/lib/auth/`)

The auth module is the load-bearing abstraction that makes the Supabase Auth adoption reversible. Two architectural rules are enforced from day one:

- **No Supabase-specific auth dependencies leak out of the module.** User IDs are stored as `auth_user_id` (not `supabase_user_id`); JWT verification uses the standard JOSE library, not Supabase-specific token format; no code outside `src/lib/auth/` depends on Supabase's session shape or claims structure.
- **The module is the single chokepoint for auth SDK calls.** `provider.ts` is the ONLY file in the codebase that imports `@supabase/supabase-js` auth methods. Everything else in the codebase calls `getCurrentUser()`, `requireAuth()`, `getOrganization()`, or `requireOrgRole()` from the abstraction. Migration to Clerk becomes "rewrite `provider.ts` contents"; the rest of the codebase does not move.

### 3.1 Module file layout

```
src/lib/auth/
  provider.ts            -- Supabase Auth SDK wrapper. SOLE importer of @supabase/supabase-js auth methods.
  session.ts             -- getCurrentUser, requireAuth, getOrganization. Provider-agnostic.
  roles.ts               -- requireOrgRole(role). Provider-agnostic.
  types.ts               -- User, Organization, Membership types. NO Supabase-specific shapes.
  middleware-helpers.ts  -- Next.js middleware integrations (cookie parsing, GUC binding).
  __tests__/
    session.test.ts      -- mocked-session tests against the abstraction surface.
    roles.test.ts        -- role-check tests with synthetic memberships.
    provider.test.ts     -- Supabase SDK integration tests (gated on INTEGRATION=1).
```

### 3.2 Public API of the module

```typescript
// src/lib/auth/types.ts -- provider-agnostic types.

export interface User {
  auth_user_id: string;       // UUID from the auth provider (Supabase today, Clerk later); never named after the provider.
  email: string;
  display_name: string | null;
  created_at: string;          // ISO 8601.
}

export interface Organization {
  id: string;                  // UUID.
  name: string;
  slug: string;                // URL-safe; unique.
  plan_tier: 'free' | 'pro' | 'enterprise';
  created_at: string;
}

export interface Membership {
  user_id: string;             // auth_user_id.
  organization_id: string;
  role: 'owner' | 'admin' | 'member' | 'reviewer';
  created_at: string;
}

// src/lib/auth/session.ts -- the load-bearing API surface.

export async function getCurrentUser(): Promise<User | null>;
export async function requireAuth(): Promise<User>;  // throws 401 if no session.
export async function getOrganization(): Promise<Organization | null>;

// src/lib/auth/roles.ts

export async function requireOrgRole(role: Membership['role']): Promise<void>;
  // throws 403 if the current user is not a member of the current organization with
  // at least the named role (using the role hierarchy from §6).
```

### 3.3 Migration-readiness, made concrete

The migration to Clerk -- triggered by customer SAML / SCIM requirement, or by auth UX complexity exceeding 2 -- 3 features Clerk gives free -- is bounded to:

- Rewrite `provider.ts` to import Clerk's SDK in place of Supabase's. The function bodies change; the exports do not.
- Update environment variables in Vercel (Clerk publishable key / secret key replace Supabase URL / anon / service-role keys).
- Migrate user records: Clerk supports CSV import; the existing `auth_user_id` values are kept as Clerk's `external_id`, so the `users` table FKs do not change.

Everything else -- the middleware, the API routes, the session checks, the role enforcement, the database schema -- is provider-agnostic by construction. The migration cost is bounded to "rewrite one module + one env-var migration + one user import," which is the property the abstraction layer buys.

### 3.4 Lint rule enforcement

A repository-level ESLint rule prohibits `import '@supabase/supabase-js'` outside `src/lib/auth/`. The rule is enforced in CI; a violation fails the build. This is the structural guard that prevents accidental Supabase-specific dependencies from leaking out of the module over time -- without it, the abstraction degrades as developers reach for the SDK directly when adding new auth-adjacent features. The rule is in scope for Phase 1 of the implementation.

## 4. Multi-tenancy schema additions -- M6 migration

New migration M6 in the data-track schema directory: `src/lib/data/schema/M6_organizations.sql`. The migration introduces the `organizations`, `users`, and `memberships` tables and renames the `evaluations.customer_id` column (and the downstream `reports.customer_id`, `classifier_edits.customer_id`-equivalents) to `organization_id`. The migration is reversible via the DOWN block.

### 4.1 `organizations` table

```sql
CREATE TABLE organizations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  plan_tier              TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'pro', 'enterprise')),
  created_by_user_id     UUID NOT NULL REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations (slug);
CREATE INDEX idx_organizations_plan_tier ON organizations (plan_tier);
```

The `plan_tier` CHECK constraint mirrors the closed-set vocabulary from §7 below; the lockstep validator extension (`checkPlanTierLockstep`) verifies the SQL CHECK matches the documented closed set.

### 4.2 `users` table

```sql
CREATE TABLE users (
  id                     UUID PRIMARY KEY,    -- mirrors the auth provider's user_id.
  email                  TEXT NOT NULL UNIQUE,
  display_name           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);
```

The `users` table is a mirror of the Supabase Auth user records, extended with project-specific fields (`display_name`; future additions like `avatar_url`, `notification_preferences`). The mirror exists so application code can join `users` against `memberships` and `organizations` without hitting the auth provider's API for every request; user records are kept in sync via a Supabase Auth webhook (or, post-Clerk-migration, via the equivalent Clerk webhook). The `id` column is the `auth_user_id` from §3.2 -- no Supabase-specific naming.

### 4.3 `memberships` table

```sql
CREATE TABLE memberships (
  id                     SERIAL PRIMARY KEY,
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                   TEXT NOT NULL
    CHECK (role IN ('owner', 'admin', 'member', 'reviewer')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_memberships_organization_id ON memberships (organization_id);
CREATE INDEX idx_memberships_user_id ON memberships (user_id);
CREATE INDEX idx_memberships_role ON memberships (role);
```

A user can belong to multiple organizations; the `UNIQUE (organization_id, user_id)` constraint ensures one role per user per organization. The role CHECK constraint mirrors the closed-set vocabulary from §6 below; the lockstep validator extension (`checkOrgRoleLockstep`) verifies SQL CHECK and docs §3.18 stay in sync.

### 4.4 `evaluations.customer_id` -> `evaluations.organization_id` rename

The existing `evaluations.customer_id TEXT NOT NULL DEFAULT 'self'` becomes `evaluations.organization_id UUID NOT NULL REFERENCES organizations(id)`. The rename is the trickiest migration step because:

- The existing column is `TEXT` (matched the placeholder convention from `docs/memos/2026-05-28-data-track-scoping.md` §10 Q4); the new column is `UUID FK`. The type change requires a backfill.
- Existing rows with `customer_id = 'self'` need to be migrated to point at a specific organization. The migration creates a default "Portfolio self" organization (slug `portfolio-self`, plan_tier `free`, created_by_user_id set to a system user) and backfills all existing `customer_id = 'self'` rows to point at that organization's UUID.
- The DOWN block must be reversible: the migration is structured as ADD `organization_id` column, backfill, swap RLS policy to use the new column, then DROP `customer_id`. The DOWN block re-creates `customer_id` from `organization_id` via a reverse join.

Concrete migration steps (the migration runner applies them in order; each is reversible):

```sql
-- 1. Create the system user and the "Portfolio self" organization for backfill.
INSERT INTO users (id, email, display_name)
  VALUES ('00000000-0000-0000-0000-000000000001'::uuid,
          'system@safeeval.vercel.app',
          'SafeEval System');

INSERT INTO organizations (id, name, slug, plan_tier, created_by_user_id)
  VALUES ('00000000-0000-0000-0000-000000000010'::uuid,
          'Portfolio self',
          'portfolio-self',
          'free',
          '00000000-0000-0000-0000-000000000001'::uuid);

-- 2. Add the new organization_id column to evaluations.
ALTER TABLE evaluations
  ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- 3. Backfill: every existing 'self' row points at the "Portfolio self" org.
UPDATE evaluations
  SET organization_id = '00000000-0000-0000-0000-000000000010'::uuid
  WHERE customer_id = 'self';

-- 4. Set NOT NULL after backfill.
ALTER TABLE evaluations
  ALTER COLUMN organization_id SET NOT NULL;

-- 5. Replace the RLS policy. The old policy used current_setting('app.current_customer_id');
--    the new policy uses current_setting('app.current_organization_id').
DROP POLICY IF EXISTS evaluations_tenant_isolation ON evaluations;
CREATE POLICY evaluations_tenant_isolation ON evaluations
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- 6. Drop the old column and its index.
DROP INDEX IF EXISTS idx_evaluations_customer_created_at;
ALTER TABLE evaluations DROP COLUMN customer_id;

-- 7. Add the new equivalent index.
CREATE INDEX idx_evaluations_organization_created_at
  ON evaluations (organization_id, created_at DESC);
```

The DOWN block reverses each step in inverse order: re-create `customer_id` column with the previous default, backfill it from `organization_id` via the reverse mapping (organizations with slug `portfolio-self` map to `'self'`; everything else maps to the org slug), drop the new policy, restore the old policy, drop the new column.

### 4.5 Downstream tables -- `reports`, `classifier_edits`

The `reports` table (per `docs/memos/2026-05-28-report-generator-scoping.md` §8) and the `classifier_edits` table (per `docs/memos/2026-05-28-classifier-feedback-loop-scoping.md` §3) inherit the same `customer_id` -> `organization_id` rename. The downstream tables have not yet shipped at the time of this memo (reports and feedback loop are in scoping phase); the recommended sequencing is that those tables land with `organization_id` from the start, skipping the rename step entirely. The M6 migration is responsible only for the `evaluations` rename; the downstream table designs reference this memo's §4 for the column convention.

### 4.6 RLS policy update

All RLS policies that currently read `app.current_customer_id` are updated to read `app.current_organization_id`. This is a one-line change per policy; the `db-client.ts` wrapper from the data-track implementation spec (`src/lib/data/db-client.ts`) sets the GUC before every query fires, with the value sourced from the auth module's `getOrganization()` call. The wrapper is the single point where the auth context meets the database context; misconfiguration there is the standard SaaS data-leak vector and is the subject of risk R2 in §12.

## 5. Signup + onboarding flow

The flow from "hiring manager reads the marketing page" to "user has an organization and can run live evaluations":

1. **Public marketing site shows "Sign up" CTA.** The CTA is below the fold on the homepage; above the fold is the framework summary, the case studies, the "try it" demo. The signup gate does not interrupt the portfolio reading flow.

2. **`/signup` route.** Renders the Supabase Auth UI (or the equivalent provider-agnostic shell once Clerk migration happens). MVP-tier providers: email / password, Google OAuth, GitHub OAuth (§14 Q3 recommends this set explicitly). The route is part of the public surface (no middleware gate); it is the entry point to the gated surface, not part of it.

3. **Email verification.** Supabase Auth's default email-verification flow. The user clicks a link in the verification email; the session is established on click; the user is redirected to `/app/welcome`.

4. **`/app/welcome` -- organization creation.** First-time-signin landing page. Prompts the user for organization name and slug. The slug field is the user-visible URL component; the form validates slug format (`[a-z0-9][a-z0-9-]*[a-z0-9]`) and uniqueness in real time.

5. **Organization creation -- the user becomes `owner`.** On submit, the application creates a row in `organizations` (with the user as `created_by_user_id`) and a row in `memberships` (with `role = 'owner'`). The user is then redirected to `/app/dashboard`.

6. **Auto-create vs. force-create -- the §14 Q2 escalation.** The recommended UX (default-accept in §14) is to auto-create a personal organization on signup using the user's email as the org name and a slug derived from the email local part. The user never sees the `/app/welcome` org-creation prompt unless they choose to invite a second user. This reduces signup friction and matches the "hobby users should not have to think about orgs" mitigation against risk R4 in §12. The alternative (force-create) is named in §14 in case Steven wants the explicit org-creation step.

7. **Subsequent signups by the same user (joining additional orgs).** Out of MVP scope. The Standard tier adds an invite flow (Phase 4 in §11); for MVP, every user has exactly one organization (their personal one), and there is no path to join an additional organization.

8. **Free tier defaults.** Every newly-created organization is set to `plan_tier = 'free'`. Free tier limits (per §7 below): 100 evaluations / day, 1 organization, 1 user, no reports, no edits. The defaults are intentionally tight to make abuse less attractive (per risk R5 mitigation in §12) and to make the upgrade path to `pro` discoverable.

## 6. Role-permission matrix (per organization)

Closed-set vocabulary. Adding a role is a lockstep-verified change against `docs/08-v5-ontology.md` §3.18 (new section, added in Phase 4 of §11). The role hierarchy is total: `owner` > `admin` > `member` > `reviewer`; `requireOrgRole('admin')` succeeds for `owner` and `admin` but fails for `member` and `reviewer`.

### 6.1 `owner`

**Who.** The creator of the organization. Exactly one owner per organization at any time. Ownership is transferable but not multi-occupant.

**Permissions.** Full access to every per-organization surface: evaluations, reports, edits, member management, role assignment, billing (post-Full), organization settings (name, slug), organization deletion, ownership transfer.

**Constraints.** Cannot be removed from the organization by anyone else. Ownership must be transferred to another member before the current owner can leave.

### 6.2 `admin`

**Who.** Users elevated by the owner to share administrative load. Multiple admins per organization are allowed.

**Permissions.** Full eval / report / edit access. Can invite members, manage roles for non-owner users, edit organization settings (name, but not slug; slug change is owner-only). Cannot delete the organization, cannot transfer ownership, cannot manage billing (billing is owner-only).

**Constraints.** Cannot demote, remove, or modify the role of the owner. Cannot promote another admin to owner.

### 6.3 `member`

**Who.** Users with day-to-day product access. The default role for invited users in the Standard tier.

**Permissions.** Can run evaluations, view their own evaluations, view reports for evaluations they ran. Cannot view other members' evaluations by default (this is the principle-of-least-privilege default; an org-wide visibility option is a Standard-tier add named in §11 Phase 4 but recommend opt-in not opt-out).

**Constraints.** Cannot invite other members, cannot manage roles, cannot edit org settings, cannot submit classifier edits (edits require `reviewer` or higher).

### 6.4 `reviewer`

**Who.** Users with classifier-edit submission authority but otherwise restricted access. The role exists to reconcile the SaaS role model with the feedback-loop scoping memo's `editor_role` closed set per §14 Q5.

**Permissions.** Read-only on evaluations and reports (across the whole organization, not just their own evaluations -- the reviewer role is by definition a cross-evaluation pattern-spotter). Can submit classifier edits per the feedback-loop scoping memo's `editor_role` permission matrix.

**Constraints.** Cannot run new evaluations (that is `member` and above). Cannot manage members or roles. Cannot edit org settings.

### 6.5 Role hierarchy and `requireOrgRole()` semantics

The role check is total in the sense `requireOrgRole('member')` succeeds for `owner`, `admin`, and `member`; it fails for `reviewer` (because `reviewer` is a sibling role for edit submission, not a lesser one for general access). The matrix:

| Required role | owner | admin | member | reviewer |
|---------------|:-----:|:-----:|:------:|:--------:|
| `owner`       |  Yes  |  No   |  No    |  No      |
| `admin`       |  Yes  |  Yes  |  No    |  No      |
| `member`      |  Yes  |  Yes  |  Yes   |  No      |
| `reviewer`    |  Yes  |  Yes  |  No    |  Yes     |

The cross-cell at `requireOrgRole('reviewer')` is the `owner` and `admin` rows -- those roles include reviewer authority because the principle is "more administrative authority subsumes specialist authority." A reviewer cannot do member work because the reviewer role is specifically scoped to edit-submission; widening it would defeat the principle-of-least-privilege design.

The §14 Q5 reconciliation question is whether this SaaS `reviewer` role maps to the feedback-loop scoping memo's `qa_reviewer` role (the lowest-authority edit-submission role in that memo's §3 vocabulary) or to a different role. The recommendation in §14 is `qa_reviewer`; an organization that wants `senior_reviewer` or `policy_lead` semantics elevates the user to `admin` plus a feedback-loop-specific elevation. That reconciliation is the cleanest preservation of both closed sets without forcing either to expand.

## 7. Plan tiers -- placeholder for billing phase

Closed-set vocabulary. The CHECK constraint on `organizations.plan_tier` enforces the closed set; the lockstep validator extension (`checkPlanTierLockstep`) verifies SQL CHECK and docs stay in sync. Billing enforcement is deferred to the Full-tier follow-on memo; this memo lands only the plan_tier metadata and the per-tier limit enforcement at the API layer.

### 7.1 `free`

**Limits.** 100 evaluations / day, 1 organization per user, 1 user per organization, no persistence beyond the 90-day live-tier the data track ships, no reports, no classifier edits.

**Defensible.** "Public-ish, defensible" -- the free tier is the gated surface's entry point and the conversion funnel's top. A hobby user signing up sees a real product they can poke at; a paying customer's overage attempt does not silently degrade.

### 7.2 `pro`

**Limits.** 10,000 evaluations / month (averages to ~330 / day), unlimited users in 1 organization, persistence enabled (the same 90-day live tier), reports generated for `block` and `human_review` dispositions (per the report-generator scoping memo's hybrid strategy), classifier edits enabled per the feedback-loop scoping memo's permission matrix.

**Position.** The "single team" tier. Defensible as the small-fraud-team price point; the limits are sized to make the upgrade path discoverable without making the tier feel artificially constrained.

### 7.3 `enterprise`

**Limits.** Unlimited evaluations, multiple organizations per user (org-switcher UI required, deferred to Standard tier; the M6 schema already supports it), SAML / SSO via the Clerk-migration trigger from §3, VPC deployment option (the deployment surface is a Full-tier concern), dedicated support.

**Position.** The "regulated industry" tier. The SAML / SSO requirement is the explicit Clerk-migration trigger from §3; an enterprise customer is the first event that justifies the auth-provider switch.

### 7.4 What this memo lands vs. defers

The MVP scope (§10.1) lands `plan_tier` as a metadata column with `free` as the only enforced tier (the `pro` and `enterprise` cases are CHECK-allowed but not user-reachable until Standard / Full). The Standard scope (§10.2) lands the `pro` tier as user-reachable via a "Contact for upgrade" placeholder (no Stripe yet). The Full scope (§10.3) lands Stripe integration, plan-tier enforcement at the API layer (per-org daily quota), and the `enterprise` tier's deployment surface.

The plan_tier vocabulary itself is closed-set from day one to avoid a vocabulary-extension event later. Adding a fourth tier (a hypothetical `team`, sized between `pro` and `enterprise`) is a lockstep-verified change with the same discipline as adding an L1 typology -- not a runtime concern, not a config change, a memo-authored decision.

## 8. Public-vs-gated surface boundary -- concrete file map

The boundary is explicit at the route level. This section enumerates which routes live on which side. Anything not listed is implicitly part of the public surface (the catch-all for marketing, docs, case studies); anything starting with `/app/` or `/api/app/` is gated. The middleware matcher from §2.3 enforces the boundary.

### 8.1 Public (no auth required)

- `/` -- marketing page, framework summary, signup CTA.
- `/case-study/*` -- existing case studies.
- `/docs/*` -- the FAF policy text and the externally-readable memos.
- `/about` -- project narrative.
- `/demo/eval` -- new hardcoded fixture eval. No real API call, no persistence, no real customer data; the response is a canned demonstration of the v5 envelope shape.
- `/signup`, `/login`, `/forgot-password` -- auth provider UI surfaces. Part of the public surface because they are the entry point to the gated surface, not part of it.

### 8.2 Gated app routes (`/app/*`)

All require signed-in session via middleware; most also require organization context (i.e. the user has at least one organization and has picked one as their current context).

- `/app/dashboard` -- organization summary, recent evaluations, plan tier, basic metrics.
- `/app/evaluations` -- per-organization evaluation history (members see their own; admins / owners / reviewers see all).
- `/app/evaluations/:id` -- per-evaluation detail view.
- `/app/reports/:id` -- audience-tailored report viewer.
- `/app/edits` -- classifier-edit submission surface (requires `reviewer` role or higher).
- `/app/settings` -- per-user account settings (display name, email, password change).
- `/app/org` -- organization management (admins / owners).
- `/app/org/members` -- member invite, role assignment (admins / owners).
- `/app/billing` -- billing surface (owner only). MVP / Standard: "Contact for upgrade" placeholder. Full: Stripe-integrated.
- `/app/welcome` -- first-time-signin onboarding (org-creation prompt if §14 Q2 resolves to force-create; default-accept makes this a redirect target only for invited users joining a second org).

### 8.3 Gated API routes (`/api/app/*`)

All require signed-in session; the middleware sets `app.current_organization_id` from the session's current-org context before the route handler runs.

- `/api/app/evaluate` -- live evaluation. Real Anthropic API call, persisted per organization, returns the full v5 envelope.
- `/api/app/evaluations` -- list / filter per-organization evaluations.
- `/api/app/evaluations/:id` -- single evaluation detail.
- `/api/app/reports/:id` -- audience-tailored report retrieval. The legal-audience auth-gate from `docs/memos/2026-05-28-report-generator-scoping.md` §8 fires here against the user's role.
- `/api/app/edits` -- classifier-edit submission. The `editor_role` auth-gate from `docs/memos/2026-05-28-classifier-feedback-loop-scoping.md` §6 fires here against the user's role.
- `/api/app/org/invite` -- send an invite email (admins / owners).
- `/api/app/org/members` -- list / manage organization members (admins / owners).
- `/api/app/billing/*` -- billing surface (owner only).

### 8.4 Hybrid -- the existing public `/api/evaluate`

The existing `/api/evaluate` route stays. It is the surface the public demo (`/demo/eval`) uses internally; it also doubles as a low-cost "try it from curl" surface a hiring reader can hit without signing up. The route is rate-limited (N requests per IP per hour; conservative default 10), returns a sanitized envelope (PII zero-storage continuity from §9), and never persists. The route is effectively the public demo surface's backend.

The contrast with `/api/app/evaluate` is explicit:

| Property                | `/api/evaluate` (public) | `/api/app/evaluate` (gated) |
|-------------------------|:------------------------:|:---------------------------:|
| Auth required           |          No              |             Yes             |
| Rate limit              |   10 / IP / hour         |   Plan tier quota           |
| Persistence             |          Never           |             Yes             |
| Envelope returned       |       Sanitized          |             Full            |
| Organization scope      |       N/A (none)         |             Yes             |
| Reports generated       |          No              |     Yes (per disposition)   |

The two routes coexist; the public route is the demo backend and the curl surface, the gated route is the product. The split is the cleanest preservation of both the portfolio story (curl-able demo) and the product story (real persistence, real per-organization scope).

## 9. PII zero-storage posture under multi-tenancy

The zero-storage posture from `docs/memos/compl/2026-05-28-pii-access-posture-zero-storage-amendment.md` applies uniformly to every customer. There is no per-customer exception for "store our PII please." Every organization's evaluations go through the same `PrePersistSanitizer` write path; every persisted envelope is sanitized; the unredacted KMS column does not exist for any customer.

The architectural reasoning carries forward unchanged:

- **The sanitizer is the write boundary.** Per the zero-storage amendment §4, the threat model under zero-storage is materially smaller than the original encryption-mediated model. That property holds independently of how many tenants the system serves. A per-customer "store PII" exception would re-introduce the encryption-mediated model for one tenant and eliminate the structural-rather-than-procedural Article 5 / Article 32 framing the zero-storage amendment relies on.
- **Per-customer exceptions are a Tier 2 / Tier 3 feature with deeper sec/compl review.** "Store this customer's PII" is a regulatory undertaking, not a configuration flag. The minimum dependencies before it could be offered: legally-vetted DPA template per customer, per-customer KMS configuration, per-customer key-rotation cadence, per-customer audit-log retention, per-customer Article 32 control narrative. None of that is in the MVP / Standard scope; all of it is years out.
- **The free tier and the `pro` tier both ship zero-storage.** The `enterprise` tier might eventually expose a "self-host with your own KMS" surface (the VPC deployment option from §7.3), at which point the customer's own KMS key handles the encryption-at-rest. That is the customer's responsibility in their own environment; SafeEval-the-SaaS-product does not store unredacted PII for any customer at any tier.

This is a posture commitment, not a configurability statement. Documented here in §9 so future feature requests ("can we add a setting for...") have an explicit prior decision to cite.

## 10. Three scope tiers

Standard is the recommended tier. MVP is the defensible cheaper path if Standard's 3 -- 4 weeks of focused work is too much for the portfolio window; Full is the "could-charge-money" target that needs Stripe + admin dashboards before it can ship.

### 10.1 MVP (1 -- 2 weeks of focused work)

Supabase Auth + signup + login + single-user single-org + RLS-enforced eval persistence. NO invites, NO roles beyond `owner`, NO billing, NO plan tiers (the `plan_tier` column exists but only `free` is reachable). Just "sign up, get your own evaluation history."

**What lands.** The auth module skeleton, the Next.js middleware gate, the M6 schema with `organizations` / `users` / `memberships` (only the `owner` role is reachable), the `customer_id` -> `organization_id` rename, signup / login / forgot-password routes, `/app/dashboard`, `/app/evaluations`, `/app/evaluations/:id`, basic `/app/settings/profile`.

**What is deferred.** Invites, role assignment beyond `owner`, the `pro` tier surface, billing integration, the `/app/org/members` page, the `/app/billing` page, the role-permission matrix enforcement beyond `requireAuth()`, the abuse-prevention surface beyond the default rate limiting.

**Why this is named.** Completeness, and the off-chance Steven wants the gated surface up quickly for a portfolio review without paying the Standard-tier cost. The MVP shape is enough to demonstrate the architecture (the two-surface split, the auth abstraction, the multi-tenancy schema) without paying the cost of building out the full role-permission surface.

### 10.2 Standard (recommended; 3 -- 4 weeks of focused work)

MVP + organizations + role-permission matrix + member invites + role assignment + plan tier metadata (no billing integration yet).

**What lands.** Everything from MVP, plus: the full role-permission matrix from §6 enforced at `requireOrgRole()`, the invite flow (email-mediated, the standard pattern), the `/app/org/members` page with role assignment, the `/app/settings/org` page for owner / admin org settings, the plan-tier metadata UI ("Contact for upgrade" CTA on free-tier orgs, no Stripe), the cross-organization role enforcement at every gated API route.

**Why this is the recommendation.** It is the "real product" tier. A hiring reader looking at the gated surface sees an organization model, a role-permission matrix, an invite flow, and per-organization data isolation -- the four properties that distinguish a real product from a single-user webapp with auth. The marginal cost over MVP is concentrated in the role-permission surface, which is also the most portfolio-visible part of the work (the role matrix in §6 is a portfolio artifact independent of whether the implementation lands).

**What is still deferred.** Stripe integration, the per-organization daily quota enforcement at `/api/app/evaluate`, the admin / audit-log dashboards, the SAML / SSO surface (Clerk-migration-gated).

### 10.3 Full (6 -- 8 weeks of focused work)

Standard + Stripe billing + plan-tier enforcement + per-org rate limits + admin dashboards + audit-log UI.

**What lands.** Everything from Standard, plus: Stripe integration (Checkout for new subscriptions, Customer Portal for management), plan-tier enforcement at the API layer (daily quota per organization, with graceful overage UI), the `/app/billing` page as a functional surface, admin dashboards (per-org evaluation volume, error rates, per-typology disposition distributions), the audit-log UI (per-org admin view of who-did-what-when), the SAML / SSO surface (gated on Clerk migration -- the trigger is the first enterprise customer, per §3).

**Why this is the eventual target.** It is the "could-charge-money" tier. Until billing is wired, SafeEval-as-a-product cannot collect revenue; until per-org rate limits are enforced, abuse is structurally possible. Both are deferrable for the portfolio window but neither is deferrable indefinitely for a real commercial path.

**What is still deferred even at Full.** VPC deployment (the `enterprise` tier's deployment surface; a separate engineering project), advanced compliance certifications (SOC 2 Type II, ISO 27001; year-long efforts that the Standard / Full tiers can lay the foundation for but do not deliver), self-hosted KMS for enterprise customers per §9.

## 11. Phased implementation (in Standard scope)

Five phases, sequenced. Each phase ends with an acceptance criterion the next phase depends on. Phases can be parallelized only where explicitly named; the default sequencing is serial.

### 11.1 Phase 1 -- Auth module + middleware (~1 week)

**What ships.** `src/lib/auth/` skeleton per §3.1 (the file layout, the type exports, the function signatures). `provider.ts` wired to Supabase Auth SDK. `session.ts` and `roles.ts` implementing the public API against the provider. `middleware-helpers.ts` for Next.js middleware integrations. The ESLint rule from §3.4 in CI. The Next.js middleware at `src/middleware.ts` per §2.3. Signup / login / forgot-password routes with the Supabase Auth UI. Mocked-session unit tests for `getCurrentUser()`, `requireAuth()`, `getOrganization()`, `requireOrgRole()`.

**Acceptance.** A hand-coded test against the middleware gate verifies that `/app/*` redirects unauthenticated requests to `/signup`; a synthetic signed-in request reaches the handler. The lint rule fails CI on a deliberately-added `import '@supabase/supabase-js'` outside `src/lib/auth/`.

### 11.2 Phase 2 -- Multi-tenancy schema + M6 migration (~1 week)

**What ships.** `src/lib/data/schema/M6_organizations.sql` per §4. `organizations`, `users`, `memberships` tables with the lockstep-verified CHECK constraints. The `evaluations.customer_id` -> `organization_id` rename with backfill via the "Portfolio self" organization. RLS policies updated to read `app.current_organization_id`. The Supabase Auth webhook that mirrors auth user records into the `users` table.

**Acceptance.** Integration tests verify that a row inserted into `evaluations` is invisible to a query under a different `app.current_organization_id`. Migration M6 applies cleanly and reverses cleanly via the DOWN block. Existing data is preserved through the migration (the "Portfolio self" org owns the existing `'self'` rows after backfill).

**Dependency.** Requires Phase 1's `provider.ts` to be wired (the webhook handler uses the auth module's user-record mapping).

### 11.3 Phase 3 -- Signup + onboarding UI (~1 week)

**What ships.** `/signup` route with email / password / Google / GitHub OAuth providers (per §14 Q3 recommended set). `/login`. `/app/welcome` with the org-creation prompt OR (per §14 Q2 default-accept) the auto-create flow that skips the welcome page entirely. `/app/settings/profile` for display name and password change. Basic `/app/dashboard` showing recent evaluations and the org's plan tier.

**Acceptance.** A new user can sign up, verify email, land on `/app/dashboard`, and run a live evaluation against `/api/app/evaluate`; the resulting row appears in `evaluations` with the correct `organization_id`. The auto-create flow creates a personal org with the user's email-derived slug.

### 11.4 Phase 4 -- Role-permission enforcement (~1 week)

**What ships.** Invite flow (email-mediated; the standard pattern). Role assignment per §6's matrix. `/app/org/members` page for member listing, invitation, and role management. `/app/settings/org` for org name / slug editing (owner-only for slug; admins can edit name). `requireOrgRole()` enforcement at every gated API route. The lockstep validator extension (`checkOrgRoleLockstep`) verifying SQL CHECK matches docs §3.18. The `editor_role` reconciliation per §14 Q5 (the recommended `reviewer` -> `qa_reviewer` mapping landed in code).

**Acceptance.** Integration tests verify that a `member`-role user cannot submit classifier edits (403); a `reviewer`-role user can. The role matrix in §6 is mirrored exactly in `roles.ts`.

**Dependency.** Requires the feedback-loop scoping memo's `editor_role` vocabulary to have landed (the §14 Q5 reconciliation question is the architect's adjudication; if the architect resolves it before Phase 4 starts, Phase 4 implements the resolution; if not, Phase 4 ships with `qa_reviewer` as a tentative recommendation and the resolution lands later).

### 11.5 Phase 5 -- Plan tier metadata + rate limiting (~0.5 -- 1 week)

**What ships.** `plan_tier` closed-set per org enforced at the CHECK constraint and in `roles.ts` accessors. Per-organization daily eval quota enforcement at `/api/app/evaluate` (the gated API route reads the org's plan_tier and the org's evaluation count in the last 24 hours; over the free-tier limit, returns 429 with the upgrade-flow placeholder URL). Upgrade-flow placeholder: a "Contact for upgrade" page that captures the org owner's email and a free-text message (no Stripe yet; that is the Full tier).

**Acceptance.** A free-tier org cannot submit more than 100 evaluations in a 24-hour window. The 101st request returns 429 with the upgrade-flow URL. The upgrade-flow page captures the contact request and writes it to a follow-up queue (deferred dispatch).

The total Standard tier time budget is approximately 3.5 -- 5 weeks of focused work; the "3 -- 4 weeks" estimate in §10.2 is the low end of this range, achievable if each phase lands cleanly without unexpected integration issues. The Phase 4 dependency on the feedback-loop scoping memo's vocabulary resolution is the single piece of cross-memo coordination Steven should adjudicate before Phase 4 starts.

## 12. Risks

Five named risks. Each is mitigated by the design or flagged as a residual concern that the implementation has to manage going forward.

**R1. Public demo gets confused with the paid product.** A hiring manager opens `https://safeeval.vercel.app/`, sees the signup gate prominently displayed, and concludes that the framework / case studies / memos require an account to read. The portfolio story degrades not because the work is gated but because the framing is unclear.

Mitigation: explicit demo-vs-product framing on the marketing page. Above the fold: framework summary, case studies preview, "Read the memos" CTA. Below the fold: "Want to evaluate your own prompts? Sign up for the SafeEval product." The CTA is opt-in, not interruptive. The `/demo/eval` route is the hardcoded-fixture surface a hiring reader can poke at without signing up; the "try it" pattern is preserved in the public surface.

**R2. Multi-tenancy migration leaks data between orgs.** RLS misconfiguration -- a wrong GUC, a missing policy, a query that bypasses the RLS via a `SECURITY DEFINER` function -- is the standard SaaS data-leak vector. The M6 migration is the highest-risk migration in the data-track sequence because it changes RLS surfaces while data is in the tables.

Mitigation: M6 migration includes RLS tests (per Phase 2 acceptance) that explicitly verify cross-org invisibility. The `db-client.ts` wrapper from the data-track implementation spec is the single point where the GUC is bound; it asserts the GUC is non-empty before every query fires. Adversarial integration tests (a synthetic second org with deliberately-different data) run on every push to main. Residual risk: a future migration that adds a new table without RLS is the regression vector; the lockstep validator extension `checkRLSPolicyLockstep` (a candidate add for the M6 migration's documentation) would close that gap.

**R3. Auth abstraction leaks Supabase types.** Over time, developers adding new auth-adjacent features reach for the Supabase SDK directly because it is convenient; the abstraction degrades; the migration-readiness goal from §3 is defeated.

Mitigation: the ESLint rule from §3.4 prohibits `import '@supabase/supabase-js'` outside `src/lib/auth/`. The rule is in CI; a violation fails the build. The auth module is small enough (six TypeScript files plus tests) to be reviewable on every PR that touches it. Residual risk: a future maintainer disables the lint rule under pressure; the mitigation is documentation in `src/lib/auth/README.md` explaining why the rule exists and what disabling it costs.

**R4. Org-from-day-one adds UX complexity that pushes hobby users away.** A user signing up for a free-tier portfolio-curious account does not want to think about "creating an organization"; the friction at signup pushes them away before they see the product.

Mitigation: auto-create a personal organization on signup, using the user's email as the org name (display name) and a slug derived from the email local part (e.g. `alice` for `alice@example.com`). The user never sees the organization concept until they invite a second user, at which point the org-management surface becomes discoverable. The §14 Q2 question records this as a default-accept recommendation; the alternative (force-create) is named in case Steven prefers the explicit step.

**R5. Free tier abuse.** Bots create organizations en masse, burn through 100 evals / day each, and the free tier's API spend becomes a budget problem. The infrastructure cost of running the gated surface scales with abuse, not with legitimate use.

Mitigation: rate limit signups per IP (conservative default: 5 signups / IP / day, configurable). Require email verification (Supabase Auth's default, kept on). Monitor for abuse patterns (sudden spike in signups from a single IP block, sudden spike in evaluations from new orgs, geographic clustering of suspicious signups). Residual risk: a determined adversary uses a botnet to distribute signups across IPs; the mitigation is the email-verification gate (each verified account costs the attacker a verified email address, which is non-trivially priced on the credential-fraud market). The full abuse-prevention surface is a Full-tier follow-on dispatch; MVP / Standard ship the rate-limited signup + email-verification combination as the minimum defensible posture.

## 13. Sequencing dependencies

Implementation gates on the following, in order:

- **Data track Phase 1 -- 2 -- 4 shipped.** Commits `c301f79` (Phase 1), `33a6075` (Phase 2 -- Compliance-ready persistence), `2d3e797` (Phase 4 -- M4 reports migration). All three are confirmed in the repo at the time of this memo. The M6 migration sequences after M1 -- M5 are in place; the data layer is the persistence substrate the SaaS surface gates.

- **PII zero-storage Tier A landed.** Commit `e416f02`. The zero-storage commitment from §9 of this memo is foundational; without it, the per-customer PII story would have to be reopened. The commit is in place.

- **M6 migration requires data track migrations M1 -- M3 to exist.** Already satisfied per the previous two points. M6 is sequenced after M5 (classifier edits per the feedback-loop scoping memo) in the canonical apply order; if M5 has not yet landed when M6 starts, the M6 migration applies without M5 dependencies and M5 lands with `organization_id` from the start (per §4.5).

- **Phase 4 (roles) requires the feedback loop scoping memo's `editor_role` vocabulary to merge with the SaaS `member` / `reviewer` roles.** Cross-memo reconciliation needed; flagged for the architect at §14 Q5. The recommendation in §14 is `reviewer` -> `qa_reviewer` mapping; the architect adjudicates whether that is the right reconciliation or whether the feedback-loop closed set needs to expand.

The sequencing has no hard external dependencies (no AWS provisioning, no DNS changes for the path-based gated surface). Subdomain-based gating (`app.safeeval.com`) would add a DNS / Vercel-project dependency; §14 Q4 recommends path-based at MVP precisely to avoid that.

## 14. Open questions for Steven -- escalation field per fifth atomic amendment

Five open questions, each carrying the inline `escalation:` field per the closure-report convention. Two are `route-to-steven`; three are `default-accept` with tentative recommendations.

1. *(escalation: route-to-steven, reason: scope-tier decision is the load-bearing decision the rest of the memo's implementation phasing rests on -- choosing Standard vs. MVP changes the timeline by approximately 2 weeks and changes what a hiring reader sees as the gated-surface depth)* **Standard tier -- adopt?** §10.2 vs. §10.1. The memo recommends Standard. MVP is defensible if the portfolio window is shorter than 3 -- 4 weeks of focused work; Standard is the "real product" tier and is the recommended primary path. The choice does not affect the architecture (the §3 auth module, the §4 M6 schema, the §9 PII posture are identical across tiers); it affects how much of the gated surface is built out in this scope.

2. *(escalation: default-accept, rec: auto-create personal org on signup)* **Auto-create personal org vs. force org creation step?** §5.6 records the recommendation. Auto-create reduces signup friction and matches the risk R4 mitigation in §12. Force-create makes the org concept discoverable from the first signin but adds friction. Recommend auto-create; the org-management UI becomes discoverable when the user invites a second user.

3. *(escalation: default-accept, rec: Google + GitHub only at MVP)* **OAuth providers in MVP -- Google + GitHub only, or include others?** The recommended MVP set is Google + GitHub (plus email / password as the always-on baseline). Additional providers (Apple, Microsoft, LinkedIn) are deferrable -- each adds a Supabase Auth configuration surface and a per-provider terms-of-service review. Recommend the lean set at MVP; Standard / Full can expand.

4. *(escalation: default-accept, rec: path-based at MVP, subdomain deferred)* **Subdomain (`app.safeeval.com`) vs. path (`/app/*`) for the gated surface?** Path-based is one Vercel project; subdomain is two (the public `safeeval.vercel.app` is one project, the gated `app.safeeval.com` is another). Path-based is operationally simpler and is the MVP / Standard recommendation. Subdomain is the eventual target once the gated surface needs independent deployment cadence from the public surface (a Full-tier or later concern). Recommend path-based; subdomain deferred to a downstream dispatch.

5. *(escalation: route-to-steven, reason: cross-memo vocabulary reconciliation is a closed-set vocabulary alignment that affects both the feedback-loop memo's `editor_role` and this memo's `member` / `reviewer` roles -- semantic clash; the architect track is the right venue but Steven adjudicates the final mapping)* **Reconcile feedback loop `editor_role` with SaaS `member` / `reviewer` roles.** The feedback-loop scoping memo's `editor_role` closed set is `senior_reviewer`, `policy_lead`, `qa_reviewer`. This memo's SaaS role closed set is `owner`, `admin`, `member`, `reviewer`. The semantic clash: the SaaS `reviewer` role is a sibling of `member` (read-only access plus edit-submission); the feedback-loop `qa_reviewer` is a specific edit-submission role; the feedback-loop `senior_reviewer` and `policy_lead` are higher-authority edit-submission roles. Recommendation: the SaaS `reviewer` role maps to the feedback-loop's `qa_reviewer`; users needing `senior_reviewer` or `policy_lead` authority within an organization are elevated to SaaS `admin` plus a feedback-loop-specific elevation (the feedback-loop module can read the SaaS role from the auth module and grant the appropriate editor authority). This preserves both closed sets without forcing either to expand. Flagged for Steven because the architect adjudication has cross-memo implications.

**Two `route-to-steven` (Q1 Standard tier, Q5 role reconciliation) pause auto-chaining; three `default-accept` (Q2 auto-create, Q3 OAuth set, Q4 path-based) proceed with tentative recommendations.**

## 15. Adversarial review -- strongest case against this memo's conclusion

Per the design-memo-author skill's mode C affordance, this memo records its own strongest counter-arguments. Two counters are named; neither flips the recommendation; both sharpen what Steven is asked to confirm.

### 15.1 Strongest case AGAINST scoping SaaS conversion at all

"You're prematurely productizing. The portfolio doesn't need a gated surface; a hiring manager evaluating SafeEval is looking at the framework, the memos, the case studies, and the engine -- not at whether you've built signup. A gated surface might HURT the portfolio story by hiding the work behind a signup gate that hiring managers will not bother going through."

**Refutation.** Three points:

(a) **The split architecture explicitly preserves portfolio integrity.** §2.1 records that nothing currently public moves behind the gate; the public surface is preserved as-is. The risk that "hiring managers see a signup gate, assume the demo is broken" is risk R1 in §12 and is mitigated by the explicit demo-vs-product framing on the marketing page. The portfolio story degrades only if the framing is unclear, and the memo records exactly how to make the framing clear.

(b) **The gated side ADDS surface area; the SaaS infrastructure is itself a portfolio signal.** The auth module's abstraction layer (§3), the multi-tenancy schema design (§4), the role-permission matrix (§6), the middleware enforcement pattern (§2.3), and the migration-readiness discipline (§3.3) are all portfolio artifacts demonstrating product thinking beyond pure policy. A hiring reader at a regulated employer (financial services, healthcare, anything covered by enterprise compliance requirements) reads "the team built a multi-tenant system from day one with auth-provider migration-readiness baked in" as a stronger signal than "the team built a single-user webapp with a hardcoded fixture." The gated surface is the portfolio's product-thinking surface.

(c) **The Tier 1 -- 3 commercialization gap was already named in the throughput conversation.** Scoping the gap is not the same as committing to build Standard or Full. This memo recommends Standard as the implementation path but explicitly names MVP (§10.1) as the cheaper defensible path if the portfolio window is shorter. Steven retains the choice between scoping-only-and-defer-implementation vs. scoping-plus-implement-Standard vs. scoping-plus-implement-MVP. The scoping artifact itself is the portfolio signal regardless of the implementation choice.

The §11 phasing stands. The recommendation does not flip; the framing-clarity requirement in R1 is sharpened.

### 15.2 Strongest case FOR going Clerk immediately

"Supabase Auth's organization-management features are weaker than Clerk's. You'll hit the SAML / SCIM migration moment soon anyway; build on Clerk from day one and skip the migration. The $25 -- $200 / month differential is small compared to the migration cost you're committing to pay later."

**Refutation.** Three points:

(a) **Supabase Auth handles the MVP tier completely.** Email / password, Google / GitHub OAuth, email verification, password reset, JWT-based session tokens, RLS-aware client libraries (the §3.2 features) are all Supabase Auth native. The MVP / Standard tiers do not need any feature Supabase Auth lacks. The migration to Clerk is triggered only by SAML / SCIM (the enterprise tier) or by auth UX complexity exceeding 2 -- 3 features Clerk gives free (a longer-horizon scaling concern).

(b) **The abstraction layer means the migration cost is bounded.** §3.3 records that the migration is a one-module rewrite plus an environment-variable migration plus a user-record import. That cost is bounded; it does not grow with the size of the rest of the codebase. The argument "you'll pay the migration cost later" assumes the migration cost is monotonically increasing in the size of the codebase that depends on it; the abstraction layer breaks that assumption.

(c) **The cost differential matters during the portfolio period when there is zero revenue.** Clerk's pricing is $0 for the first 10,000 MAU (which exceeds the portfolio scale by approximately three orders of magnitude); Supabase Auth's is also $0 in the free tier. The differential matters at scale, when the SaaS conversion is generating revenue that can absorb it. During the portfolio period, both providers are $0; the choice is on architectural fit, not cost. Supabase Auth's tighter integration with Supabase Postgres (the existing data-track host per the data-track scoping memo §10 Q1) is the architectural-fit reason to start there; the $25 -- $200 / month differential is irrelevant during the portfolio period.

The §3 decision stands. The migration-readiness discipline is the load-bearing property; the choice of starting provider is secondary to whether the abstraction is enforced.

### 15.3 What mode C can and cannot do here

Per the design-memo-author skill's mode-C rule, adversarial review can only downgrade confidence -- ACCEPT -> PARTIAL ADOPT -> DEFER. The adversarial review above does not flip either of this memo's primary recommendations (Standard tier scope; Supabase Auth with Clerk migration-readiness). The counter-arguments are named and refuted on grounds specific to the portfolio integrity preservation, the abstraction-layer bounded-migration property, and the cost-differential-during-portfolio-period reasoning.

If the recommendations were overconfident, the mode-C move would be to downgrade the Standard tier recommendation to PARTIAL ADOPT: ship MVP first and re-evaluate Standard's marginal value after MVP lands and a hiring-reader-visible window of usage data exists. This memo declines to do that -- the §10.2 reasoning that Standard is the "real product" tier and that the marginal cost over MVP is concentrated in the portfolio-visible part of the work is durable -- but the staged path is named for completeness in case Steven prefers it. The §14 Q1 question records the tier choice as the primary route-to-steven adjudication; downgrading Standard to PARTIAL ADOPT after Steven's adjudication would be a secondary move, not the memo's primary recommendation.

## 16. Closure

Scoping memo recommends Standard tier; implementation across 5 phases; gates on Steven adjudicating tier choice (§14 Q1) plus the `editor_role` / `member` / `reviewer` role reconciliation question (§14 Q5).
