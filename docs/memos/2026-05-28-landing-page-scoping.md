# Landing page scoping -- affirm-inspired-but-restrained marketing entry on the home route

**Status:** draft, recommends-only (memo scopes the landing page redesign; no React components committed, no `tailwind.config.js` palette extension applied, no new routes added in this commit; phase 1+ implementation is downstream of Steven adjudicating section 10 Q1).
**Date:** 2026-05-28
**Author:** `safeeval-ux` (Cowork), via `design-handoff` skill (output format) with `safeeval-agents:design-memo-author` mode A discipline (alternatives evaluated; adversarial review carried through).
**Companion to:** `docs/memos/2026-05-28-saas-conversion-scoping.md` (the gated SaaS surface this landing page eventually drives signups to -- section 5 signup CTA explicitly deferred until SaaS Phase 1+2 lands), `docs/memos/2026-05-28-data-track-scoping.md` / `2026-05-28-report-generator-scoping.md` / `2026-05-28-osint-monitoring-scoping.md` / `2026-05-28-pii-zero-storage-scoping.md` / `2026-05-28-classifier-feedback-loop-scoping.md` (the product surface this landing page describes -- features section in section 3 section 5 below leans on the closed-set artifacts these memos produced), `tailwind.config.js` (current Tailwind setup -- empty `theme.extend`; the new palette extends this from a clean baseline).
**Steven-locked decisions (not re-opened in this memo):** (1) visual register Option 3 -- affirm-inspired enterprise (generous whitespace, soft pastel palette, rounded everything, big bold typography; adjusted for enterprise credibility with one accent color, Stripe/Linear typographic discipline, no consumer-fintech associations); (2) placement Option A -- replace the current home page (the existing portfolio surfaces stay accessible at their current routes; the new landing IS the home); (3) two-button hero CTAs -- primary "Try a demo" to a hardcoded-fixture demo eval route, secondary "Read the case study" to the existing policy review case study; signup CTA explicitly deferred until SaaS Phase 1+2 ships; (4) copy register Option C -- "An AI safeguard built like trust and safety actually works." (friendly and operator-credible; not consumer-fluffy, not enterprise-stiff; second-person address with vocabulary that signals real T&S work).
**Hard dependency:** SaaS conversion memo landed (sibling, landing now as brief 0080) so the signup-CTA-deferred framing has a known milestone to reference; README polish landed (commit `local_d91795eb`) so the README links and the new landing page reconcile on what the home page is. No data-track, engine, or classifier dependencies -- this is pure frontend work.
**Scope:** scopes the landing page redesign that replaces the current `src/app/page.js` home as the marketing entry point. Tailwind palette extension, typography scale, geometry, spacing, and shadow scale; 9-section page structure; per-component file map under `src/components/landing/`; illustration approach (MVP SVG-with-Tailwind path; Standard+ commissioned art fallback); six-phase implementation (copy + structure; design system; hero illustration + motion; section illustrations; polish + accessibility; final QA + launch); five risks with mitigations; three alternatives rejected with reasoning; five open questions per the escalation-field convention; adversarial review per mode C. Implementation is NAMED but OUT of scope -- the components are not committed in this memo's commit; this is a scoping artifact only.

## 1. Problem statement

SafeEval today has a portfolio-grade home page at `src/app/page.js` -- the v5 evaluator UI, with the prompt input, mode switcher, example pills, and the live classifier result card. Post-README-polish it gets the methodology across to hiring managers in roughly three minutes. The home page does its job for the resume-arriving reader.

To support the SaaS conversion scoped in `docs/memos/2026-05-28-saas-conversion-scoping.md`, the home page now has to also serve as a marketing entry point. A visitor who arrives from search, social, or word-of-mouth -- without a resume in hand -- needs the framework, the case-study story, and the product surface established up front, before the operational depth of the evaluator UI is the right thing to show. The current home page does not do that; the evaluator IS the page, with no narrative scaffolding around it.

Per Steven: replace the current home page. The existing portfolio surfaces (case studies, memos, the live evaluator) remain accessible at their current routes; the evaluator UI moves to `/evaluator` or stays addressable by the existing internal links the README points at, but it is no longer the first thing a non-resume visitor sees. Marketing IS the home page; portfolio depth is one click away.

The recommended scope (sections 10 below) is the six-phase implementation; phases 1-2 alone (copy + structure plus design system) are the minimum-viable landing page and are achievable inside the portfolio window without commissioned illustration spend. Phases 3-6 are the visually-distinctive ramp; they are deferrable in the order presented without making earlier phases incomplete.

Per Steven: portfolio integrity > polish-for-polish's-sake. The new landing page must work as the portfolio entry point AND as the marketing entry point. A hiring manager who lands on it should see the framework summary, the operator-credible signal, and the path to the case study within the same scroll a marketing visitor reads as a product pitch. The design register adjudicated in the locked decision -- affirm-inspired but operator-restrained -- is the simultaneous solve.

## 2. Visual design system extensions to `tailwind.config.js`

The current `tailwind.config.js` is a clean baseline (`theme.extend` is empty). The landing page redesign extends it; the existing tailwind utility usage in the rest of the codebase (the evaluator UI's `bg-green-50`, `text-amber-900`, etc.) is unaffected by additions and remains valid.

The extensions are concrete: a palette extension, a typography scale, geometry primitives, spacing defaults, and a shadow scale. Each is named below with the rationale tied back to Steven's locked qualities.

### 2.1 Palette additions

**Background neutrals (the "cream" foundation).** Off-white warm tones replace pure white at the section background level. Two stops:

- `cream-50` (`#fdfcf9`) -- the page background; warmer than `slate-50`, lighter than the existing `amber-50`.
- `cream-100` (`#f8f5ef`) -- alternating-section background; for the section-to-section rhythm the affirm.com layout uses to separate hero from sub-sections without hard dividers.

**Primary accent: sage.** Sage greens are the primary accent color, replacing the implicit `green` Tailwind default used in disposition chrome elsewhere (the evaluator UI's `bg-green-50` for the ALLOW disposition stays; sage is the landing-page accent, not a swap-out of disposition palette).

- `sage-50` (`#f3f5f0`)
- `sage-100` (`#e3e8db`)
- `sage-200` (`#c9d3bb`)
- `sage-300` (`#a8b894`)
- `sage-400` (`#85986d`)
- `sage-500` (`#647a4e`) -- the canonical accent stop; brand-color analogue
- `sage-600` (`#4f6240`)
- `sage-700` (`#3e4e33`)

**Secondary accent: coral/peach.** One accent color, not a pastel rainbow. Coral is reserved for CTAs and high-emphasis text. Three stops only:

- `coral-400` (`#f1a48a`) -- hover state for the primary CTA
- `coral-500` (`#e88a6c`) -- primary CTA background; the canonical accent
- `coral-600` (`#d36b4d`) -- active state, dark hover

**Body text: slate.** Direct Tailwind slate scale is permitted, but the named uses are:

- Body text: `slate-700`
- Strong body: `slate-800`
- Headline: `slate-900`
- Muted text (captions, footers): `slate-500`

**DROP rule.** Any saturated brand colors landed casually elsewhere in components scoped to this landing page (a stray `bg-blue-500` in a card, for example) are removed during phase 2. The disposition-color palette in the evaluator UI is preserved; this rule applies only to net-new landing-page components.

### 2.2 Typography

**Font stack.** Display and body typefaces are loaded via the Next.js Font system (`next/font`), self-hosted from a single Vercel-region origin to avoid third-party font CDN latency.

- Display: Inter Display at the MVP -- ubiquitous, free, well-hinted at the headline sizes, available via `next/font/google`. Phase 3+ open to substituting General Sans or Soehne for distinctiveness (section 10 open question Q3 records the recommendation: Inter at MVP, distinct font at phase 3+ if budget permits).
- Body: Inter (the regular weight family). Falls back to system-ui in the unlikely event the font fails to load.

**Letter-spacing.** Display sizes use `tracking-tight` to `tracking-tighter`; body uses `tracking-normal`. The display tightening is the typographic-discipline signal that distinguishes the design from a faithful affirm.com clone (which uses looser tracking on display sizes).

**Headline scale.** Hero uses `text-5xl` on mobile, `text-6xl` on tablet, `text-7xl` on desktop. Section headers use `text-3xl` on mobile, `text-4xl` on desktop. Subheadlines under the hero use `text-xl` on mobile, `text-2xl` on desktop. Body text is `text-base` (16px) with `leading-relaxed` (1.625) for legibility.

**Weight discipline.** Headlines use `font-semibold` (600) at the display sizes; the heavier `font-bold` (700) reads as consumer-marketing-loud at the 6xl/7xl scale. Body uses `font-normal` (400). Bold body emphasis (`font-medium`, 500) is reserved for inline-strong text and CTA labels.

### 2.3 Geometry

**Cards.** All cards use `rounded-2xl` (1rem / 16px) as the minimum corner radius. Hero and feature cards step up to `rounded-3xl` (1.5rem / 24px). The current evaluator UI's `rounded-md` (0.375rem / 6px) result card is preserved; this rule is a landing-page-component rule.

**Buttons.** All buttons are pill-shaped (`rounded-full`). The pill geometry is the visual signature -- it reads "friendly" without the corner-radius compromise of a `rounded-xl` rectangle.

**Illustrations.** Custom SVG illustrations use rounded SVG primitives -- circles, ellipses, rounded rectangles (`rx="8"` or higher). Sharp polygons are prohibited in landing-page illustrations. The constraint is enforced at the component-design level (a code-review check, not a lint rule).

### 2.4 Spacing

**Section padding.** Sections use `py-24` on desktop and `py-16` on mobile. The vertical breathing room is the most prominent affirm.com signal Steven called out; the values are intentionally larger than the Tailwind defaults (`py-12` would be the default-sized choice).

**Container.** All section content lives inside `<div class="max-w-7xl mx-auto px-6">`. Hero may step up to `max-w-6xl` (slightly narrower) for the typographic centerline; section content sticks to `max-w-7xl` for the broader feature-grid layouts.

**Spacing scale increase.** A 25% increase on the default Tailwind spacing scale is achieved by using `gap-y-` and `space-y-` values one step larger than the typical instinct -- `space-y-6` becomes `space-y-8`; `gap-y-4` becomes `gap-y-6`. The discipline is a code-review check at phase 2, not a runtime override of the Tailwind spacing scale (overriding the scale would risk regressing the evaluator UI's spacing).

### 2.5 Shadows

**Cards.** Soft, diffuse, colored shadows. The canonical class string for landing-page cards is `shadow-lg shadow-slate-900/5` -- a slate-900 shadow at 5% opacity, large blur. The standard Tailwind `shadow-lg` (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`) reads as too stark for the affirm-inspired register.

**Hero card.** Hero-level cards may step up to `shadow-2xl shadow-sage-900/10` -- a deeper sage-tinted shadow for the visual signature.

**Headline text.** No drop-shadows under headline text. Tailwind's `drop-shadow-*` utilities are not used on type in landing components. Soft, flat type with the cream background is the cleaner reading; shadowed type reads as web-1.0.

### 2.6 Component-level summary

The extensions land in `tailwind.config.js` as a single `theme.extend.colors` block and a `theme.extend.fontFamily` block plus the font loading wired in `src/app/layout.js`. The full diff is small -- approximately 30 lines of net config -- and is the load-bearing prerequisite for phase 2 component restyling. The MVP path (phase 1) uses Tailwind's default classes only; the design system extension lands in phase 2.

## 3. Page structure -- section-by-section spec

Nine sections, one per component under `src/components/landing/`. The composition lives in the new `src/app/page.js` (or whichever path the App Router routes the home to); the current evaluator UI is moved to a dedicated route (`/evaluator` is the recommendation; section 10 open question Q5 records the path naming default-accept).

### 3.1 Section 1 -- Nav

**Purpose.** Top-of-page navigation. Sticky on scroll with backdrop blur.

**Content.** Logo (SafeEval wordmark; SVG, sage-500) on the left. Right-side nav: "Product" / "Docs" / "Case Study" / "GitHub" (4 items). Secondary CTA slot is empty in this phase -- the signup CTA is deferred per the locked decision.

**Behavior.** Sticky (`sticky top-0 z-50`) with `backdrop-blur-md bg-cream-50/80` for the frosted-glass effect. On scroll past 100px, the nav adds `border-b border-slate-200` to subtly separate it from the content below. The progressive-enhancement default-accept in section 10 Q4 keeps the no-backdrop-blur fallback as a solid `bg-cream-50` background -- the no-blur fallback is what older browsers see; the experience does not break.

**Mobile.** On viewports under 768px, the right-side nav collapses to a hamburger menu (button with `Menu` Lucide icon). The menu drawer is `fixed inset-0 z-50` with a sage-50 background and the four nav items stacked.

**File.** `src/components/landing/Nav.tsx`.

### 3.2 Section 2 -- Hero

**Purpose.** Set the framing, deliver the headline, drive to the two CTAs.

**Content.** Two-column layout on desktop (left: text; right: illustration). Full-width single-column stack on mobile (text on top, illustration below or omitted at the smallest viewports).

- Headline (h1): "An AI safeguard built like trust and safety actually works." (or close variant; locked register). `text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-slate-900`.
- Subheadline: 1 sentence elaborating the policy-to-classifier-to-product loop. Recommended draft: "Write the fraud policy, ship it as a versioned classifier, run real cases through it, and turn every reviewer override into a structured improvement." `text-xl md:text-2xl text-slate-700 leading-relaxed`.
- CTA pair: "Try a demo" (primary; coral-500 background, pill shape; links to `/demo/eval` -- the hardcoded-fixture demo route added in phase 1) and "Read the case study" (secondary; sage outline pill; links to `/docs/policy-reviews/index.md` or the closest current path). Buttons sit side-by-side on desktop, stack on mobile.
- Optional social-proof line: a single quiet line under the CTAs, `text-sm text-slate-500`. Recommended: "Evaluated against 8 real fraud cases." Phase 2 acceptance gate is that the claim is true at write time; if not, the line is omitted.

**Right-column illustration.** Rounded-geometry SVG. The MVP version (phase 1-2) is a composed primitive: a sage-100 rounded background card, cream-100 floating shapes representing prompt-input + classifier-output + audit metadata. No screenshots; the visual is symbolic.

**File.** `src/components/landing/Hero.tsx`.

### 3.3 Section 3 -- The problem

**Purpose.** Establish the problem space; ground the visitor in why the product exists.

**Content.** Three short paragraphs (or a three-card grid on desktop, single-column on mobile). The recommended content beats:

1. **Fraud is one of the clearest near-term harms generative AI scales.** One paragraph; second-person address. The framing the README already lands -- one of the clearest near-term harms with the most legible victim arc.
2. **Existing T&S frameworks do not translate cleanly to AI policy work.** One paragraph; what the policy gap is. Bright-line vs. aggregate-scored; ontology stability vs. disposition policy evolution; adversarial corpus vs. clean test set.
3. **SafeEval bridges the gap.** One paragraph; what this product does. Closed-set vocabularies + lockstep verification + audit metadata + a policy-to-product loop.

**Styling.** Section padding `py-24 md:py-32`. Cards (if three-card layout chosen) `rounded-2xl bg-cream-100 p-8 shadow-lg shadow-slate-900/5`. Card headings `text-2xl font-semibold text-slate-900`. Body text `text-base leading-relaxed text-slate-700`.

**File.** `src/components/landing/Problem.tsx`.

### 3.4 Section 4 -- How it works

**Purpose.** Demonstrate operational depth. This is the operator-credible signal section -- the diagram shows real depth without requiring the visitor to read a memo.

**Content.** Simplified version of the 5-stage pipeline (Stage 0 -> 1 -> 2 -> 3 -> 4) as a horizontal flow with rounded boxes and soft connecting lines.

- Stage 0: "Turn parser" -- normalizes single prompts and multi-turn conversations.
- Stage 1: "Triage" -- L1 domain triage on Haiku; fast path for clearly-benign and clearly-risky cases.
- Stage 2: "FAF analysis" -- Sonnet runs the Fraud Analysis Framework; node attributes, component scores, bright-line indicators.
- Stage 3: "Classification" -- L3 tag set; disposition; reason codes.
- Stage 4: "Cascade" -- deterministic rule cascade adjudicates disposition; uncertain cases route to human review.

**Styling.** Horizontal flex layout on desktop (`flex flex-row gap-6`); vertical stack on mobile. Each stage box `rounded-3xl bg-sage-50 border border-sage-200 p-6 min-w-[180px]`. Connecting lines between boxes are simple sage-300 SVG paths with rounded line caps. Section background `bg-cream-100`.

**File.** `src/components/landing/HowItWorks.tsx`.

### 3.5 Section 5 -- What it gives you

**Purpose.** Translate the operational depth into product features.

**Content.** Three-card feature grid. Each card leads with a 2-3 word title, follows with a 2-sentence elaboration, and links to the relevant memo if the visitor wants the full depth.

1. **Versioned classifier.** "Closed-set vocabularies + lockstep-verified policy-to-code surface + audit metadata on every evaluation." Link: the framework memo / spec.
2. **Policy-to-product loop.** "Write the policy. Ship the classifier. Run real cases. Ship improvements grounded in what the cases surfaced." Link: the case study.
3. **Reviewer feedback.** "Every override becomes structured supervision signal. The classifier-feedback loop closes back into the policy track." Link: the feedback-loop scoping memo (`2026-05-28-classifier-feedback-loop-scoping.md`).

**Styling.** Three-card grid (`grid grid-cols-1 md:grid-cols-3 gap-6`). Each card `rounded-3xl bg-cream-50 border border-sage-100 p-8 shadow-lg shadow-slate-900/5`. Title `text-2xl font-semibold text-slate-900`. Body `text-base leading-relaxed text-slate-700`. Link `text-sage-600 hover:text-sage-700 font-medium`.

**File.** `src/components/landing/Features.tsx`.

### 3.6 Section 6 -- Case study tease

**Purpose.** Narrative bridge to the depth artifact. The case study is the load-bearing portfolio piece; this section is what gets a marketing visitor to click into it.

**Content.** Short narrative paragraph: "Eight real fraud cases. Three policy improvements shipped. One structural follow-up the QA pass surfaced." Optional pull-quote or extracted finding from the case study if available (a one-line takeaway like "L2 drift on fixture 1 surfaced a vocabulary gap the v5.2 amendment closed.")

CTA: "Read the case study" -- sage outline pill button, same styling as the secondary hero CTA. Links to `/docs/policy-reviews/index.md` (or the path the case study actually lives at).

**Styling.** Single-column layout, max-width `max-w-4xl mx-auto`. Section padding `py-24`. The narrative paragraph reads as `text-2xl md:text-3xl font-medium tracking-tight text-slate-800 leading-tight` -- larger than body text but smaller than headlines; this is the "pull quote" treatment.

**File.** `src/components/landing/CaseStudy.tsx`.

### 3.7 Section 7 -- Trust signals

**Purpose.** Tasteful credibility signals. NOT overwrought.

**Content.** Possible items (each subject to the "is this true and meaningful" filter):

- Schema version: "v5.2.1 schema; ontology v5.2."
- Test count: "177+ tests passing; lockstep validator runs on every commit."
- Audit-metadata transparency: "Every evaluation carries audit metadata (model, prompt-version, timestamp); replayable in the docs."
- PII posture: "Zero-storage PII posture (per the compliance memo); evaluations are sanitized before persistence."

**The filter.** If any of these would be misleading at write time, the item is omitted. Better empty than fake.

**Styling.** Four-item grid on desktop (`grid grid-cols-2 md:grid-cols-4 gap-8`), two-item grid on mobile. Each item lives as a small card `rounded-2xl bg-cream-50 p-6 border border-sage-100`. Title `text-sm uppercase tracking-wide text-sage-700 font-semibold`. Body number/text `text-3xl font-semibold text-slate-900`. Subtext `text-sm text-slate-600`.

**File.** `src/components/landing/TrustSignals.tsx`.

### 3.8 Section 8 -- CTA banner

**Purpose.** Final-conversion section. The visitor has read the page; this is the explicit "pick one of two paths" moment.

**Content.** Headline: "Try the demo, or read the work." Two CTAs (the same two from the hero): "Try a demo" (primary, coral) and "Read the case study" (secondary, sage outline).

**Styling.** Full-width section with a coral-500 background or (recommended) a sage-50 background with coral-500 accents on the CTAs. Headline `text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 text-center`. CTAs centered, side-by-side on desktop, stacked on mobile. Section padding `py-32` (slightly more than other sections; this is the closing emphasis).

**File.** `src/components/landing/CTABanner.tsx`.

### 3.9 Section 9 -- Footer

**Purpose.** Minimal end-of-page footer.

**Content.**

- GitHub link (left).
- Disclosure note (center): "Built end-to-end with Claude and Cursor as engineering surface." (matches the README's existing disclosure language).
- (c) notice (right): "(c) 2026 Steven Sayasy. SafeEval is portfolio work, not a published standard."

**Styling.** Single-row footer on desktop (`flex justify-between items-center`), stacked on mobile. Background `bg-cream-100`. Text `text-sm text-slate-500`. Section padding `py-12`.

**File.** `src/components/landing/Footer.tsx`.

## 4. Component file map

New under `src/components/landing/`:

```
src/components/landing/
  Nav.tsx
  Hero.tsx
  Problem.tsx
  HowItWorks.tsx
  Features.tsx
  CaseStudy.tsx
  TrustSignals.tsx
  CTABanner.tsx
  Footer.tsx
  (shared primitives -- optional)
  Container.tsx       -- if not already present; the max-w-7xl mx-auto px-6 wrapper.
  Button.tsx          -- the pill-shaped primary / secondary button variants.
  Card.tsx            -- the rounded-2xl / 3xl card variants.
```

The shared primitives (`Container`, `Button`, `Card`) are added only if they reduce duplication across the 9 sections. The default-accept recommendation is to add `Button.tsx` and `Card.tsx` because both are used in 3+ sections each; `Container.tsx` is optional (the `max-w-7xl mx-auto px-6` pattern is inline-able cheaply).

Page composition lives in `src/app/page.js` (the existing home page file). The existing evaluator UI in `src/app/page.js` is moved to `src/app/evaluator/page.js` (or the agreed alternative route from section 10 Q5). The existing evaluator UI is preserved as-is; this is a route move, not a component rewrite.

**Import discipline.** Landing-page components import only from `src/components/landing/` and from the standard libraries (Tailwind utility classes, `next/link`, `lucide-react`, `next/font`). They do not import from the evaluator UI components (`src/lib/safeeval-v5.js`, the result-card components). The two surfaces are decoupled.

## 5. Asset and illustration approach

Two paths, sequenced as MVP-then-Standard-plus.

### 5.1 MVP (phases 1-2): SVG illustrations built with Tailwind and custom shapes

**What this is.** Rounded-geometry SVG illustrations composed programmatically. The Hero illustration is a sage-100 rounded background card with cream-100 floating shapes representing the policy-to-product loop; the HowItWorks diagram is a horizontal SVG of rounded boxes connected by soft sage-300 paths; the Problem section may use a simple "three rounded shapes nested" SVG as the section header art.

**What this looks like.** Polished-but-not-distinctive. The visual register comes from the palette + typography + spacing discipline (phase 2); the illustrations are supporting players, not the visual signature.

**Cost.** Zero. The SVGs are authored in code as part of the component implementation; no designer time, no external assets, no licensing.

**When to stop.** If phase 2 lands and the page hits the affirm-inspired-but-restrained register without looking generic, phases 3-4 (commissioned art) are deferrable. The phase 5 polish + accessibility audit + phase 6 launch QA become the next blocks; commissioned art becomes an "if budget exists" polish add later.

### 5.2 Standard+ (phases 3-4): commissioned illustration OR Figma-to-SVG illustration kit

**Option A -- commissioned art.** A custom hero illustration from a designer; cost range $500-2000 depending on scope (single hero illustration vs. per-section supporting art).

**Option B -- Figma-to-SVG illustration kit.** Use a free or low-cost kit like Humaaans, Open Doodles, or undraw.co with customized palettes; cost is the designer's time to recolor the SVGs to the sage/cream palette (1-3 hours; potentially self-served).

**Decision logic.** Commission only if phase 1-2 SVG approach doesn't hit the quality bar at the phase 5 polish review. The default-accept in section 10 Q2 is the SVG-with-Tailwind path; commissioned art is the upgrade path, not the default.

### 5.3 What NOT to use

- **Generic stock photography.** Kills the credibility signal. A landing page with stock photos of "diverse hands typing on a keyboard" reads as a template, not a portfolio piece.
- **AI-generated images for the hero.** Same reason. The hero is the load-bearing visual; AI-generated hero art telegraphs "the team did not invest in this." Mid-section illustrations or icons are lower-stakes; AI-generated icons in the trust-signals section would be acceptable if they read as competent.
- **3D renders.** Out-of-register with the affirm-inspired-but-restrained discipline. Flat, rounded, geometric SVG is the lane.

## 6. Six scope tiers (phase-by-phase)

Six phases, sequenced. Each phase ends with a reviewable acceptance criterion. Phase 1-2 alone is the minimum-viable landing page; phases 3-6 are the visually-distinctive ramp.

### 6.1 Phase 1 -- Copy + structure (~1 week)

**What ships.** All 9 sections written in plain markdown/JSX with placeholder styling (default Tailwind utilities, no new palette). Composition wired in `src/app/page.js`; existing evaluator UI moved to `/evaluator` route. The page is render-able and reviewable -- the structure works, the copy is in place, the visual is intentionally generic.

**Acceptance.** All 9 sections present and routed. The new home page renders without console errors. The `/evaluator` route shows the existing evaluator UI unchanged. The `/demo/eval` route exists as a stub returning a hardcoded fixture envelope. Hiring-manager smoke read: the page narrates the framework story end-to-end without depending on visual polish.

**Defer.** No new design system; no palette extension; no font changes; no illustration commits beyond placeholder SVG primitives.

### 6.2 Phase 2 -- Design system (~1 week)

**What ships.** `tailwind.config.js` extension per section 2 above (palette, typography, geometry, spacing, shadows). Font loading wired in `src/app/layout.js`. All 9 landing-page components restyled to the new system. Shared `Button.tsx` and `Card.tsx` primitives if they reduce duplication.

**Acceptance.** The page hits the affirm-inspired register: sage + cream palette, large typography, pill buttons, rounded cards, generous whitespace. Side-by-side with affirm.com, the register is recognizable; side-by-side with linear.app or stripe.com, the typographic discipline is recognizable. Cross-skill recommendation: review with `editorial-web-style` skill before declaring the phase done -- the skill is the right guardrail tool for the affirm-inspired-but-restrained register.

**Defer.** Custom illustrations beyond the SVG-with-Tailwind MVP path; motion; accessibility deep-audit (basic semantic HTML is in scope, but full WCAG 2.1 AA audit is phase 5).

### 6.3 Phase 3 -- Hero illustration + motion (~1-2 weeks)

**What ships.** Custom SVG hero illustration (or designer-commissioned per section 5.2 Option A). Subtle motion on scroll via Framer Motion: hero fades in on mount; subsequent sections fade in as they enter the viewport (`whileInView`). Motion is intentionally restrained -- no flashy transitions, no autoplay video, no scroll-jacking.

**Acceptance.** The hero illustration is recognizable as bespoke (not Humaaans, not undraw). Motion improves perceived polish without degrading performance (the page still scores 90+ on Lighthouse performance). Phase is deferrable if Phase 2 hits the visual bar without commissioned art -- the SVG-with-Tailwind path is the fallback.

**Defer.** Per-section supporting illustrations (phase 4); full a11y audit (phase 5).

### 6.4 Phase 4 -- Section illustrations (~1-2 weeks)

**What ships.** Per-section supporting illustrations for Problem, HowItWorks, and Features. Same illustration system as Phase 3 (commissioned or kit-based). The page becomes visually distinctive -- the brand register lands.

**Acceptance.** Each section has supporting illustration that reads as part of a coherent illustration system (same line weights, same palette, same geometric vocabulary). The illustrations do not distract from the copy; they support it.

**Defer.** Polish + accessibility audit (phase 5); final QA + launch (phase 6).

### 6.5 Phase 5 -- Polish + accessibility audit (~1 week)

**What ships.** WCAG 2.1 AA accessibility audit (cross-skill recommendation: `anthropic-skills:safeeval-ui-review` skill is the right review tool for this phase). Color contrast verified across all sections (sage-on-cream, slate-on-cream, coral-on-cream, coral-on-sage); keyboard navigation works on all interactive elements (Nav links, CTA buttons, footer links); focus states are visible and high-contrast; screen-reader labels on all icons and decorative SVGs; mobile responsive verification at 320px / 375px / 768px / 1024px / 1440px viewports.

**Acceptance.** Lighthouse accessibility score 95+. Lighthouse performance score 90+. No keyboard-trap regressions. All landing-page interactive elements pass `axe-core` automated a11y testing. Cross-browser smoke test on Chrome, Safari, Firefox, Edge.

**Defer.** Final social-share meta tags (phase 6); OG image (phase 6).

### 6.6 Phase 6 -- Final QA + launch (~0.5 week)

**What ships.** Cross-browser final QA. Performance budget enforced: page weight under 500KB total (compressed), TTI under 2s on 4G. Social-share meta tags (Open Graph + Twitter Card). OG image (1200x630 PNG; the hero illustration adapted to OG dimensions). Final copy review.

**Acceptance.** Production deploy succeeds. Social-share links render the OG image and meta description correctly on Twitter, LinkedIn, Slack. README links updated to point at the new home as the landing surface (no broken links).

**Defer.** Nothing; phase 6 IS the launch.

The total time budget across phases 1-6 is approximately 5.5-7.5 weeks of focused work. The recommended scope (section 10 open question Q1) is phases 1-5; phase 6 is small and lands with phase 5 unless QA surfaces issues. Phase 3-4 (commissioned illustration) is the cost concentration; the SVG-with-Tailwind path defers that cost.

## 7. Risks

Five named risks. Each is mitigated by the design or flagged as a residual concern.

**R1. Visual register undermines portfolio signal.** The affirm.com aesthetic, applied too literally, reads as consumer fintech. A hiring manager at an enterprise T&S role might see soft pastels and pill buttons and assume the portfolio piece is "a marketing site, not a serious technical artifact." The risk concentrates in phase 2 (design system) and phase 5 (polish review).

Mitigation. Stripe/Linear-level typographic discipline (`font-semibold` not `font-bold` on display sizes; `tracking-tight` on display, `tracking-normal` on body) plus enterprise palette discipline (one accent color -- coral -- not a pastel rainbow). Cross-skill recommendation: review with the `editorial-web-style` skill before phase 5 declares done. The skill is specifically tuned to the affirm-inspired-but-restrained register and acts as a guardrail against drift toward either consumer-fluffy (pure affirm) or enterprise-stiff (pure Stripe). The `anthropic-skills:safeeval-ui-review` skill is the broader audit tool for phase 5; it covers both visual register and IA/content/UX concerns.

**R2. Phase 1 copy doesn't survive Phase 2 design.** Text-heavy hero copy designed first, then doesn't fit when the visual system imposes constraints. The hero headline at `text-7xl` on desktop limits the headline to roughly 5-7 words; a phase 1 draft headline at default styling might be too long.

Mitigation. Design system established in phase 2 BEFORE copy is locked. The phase 1 copy is a placeholder structure; phase 2 establishes the typography constraints; phase 2 acceptance includes a copy review against the new constraints. The hero headline limit (5-7 words at `text-7xl`) is documented at phase 1 so the copy draft anticipates it.

**R3. Custom illustrations exceed budget or schedule.** Phase 3-4 is the cost-risk concentration. A commissioned hero illustration at $500-2000 plus per-section art at additional cost could push phases 3-4 past the portfolio window. The risk concentrates in the time domain even if the dollar cost is acceptable -- designer turnaround can take 2-4 weeks regardless of the dollar amount.

Mitigation. SVG-with-Tailwind MVP path is the fallback. Phase 5 polish review is the gate for whether commissioned art is required; if phase 2's SVG-with-Tailwind register hits the visual bar, phases 3-4 are deferrable. The phase 5 review is the explicit go/no-go for commissioned art.

**R4. Performance regression.** Heavy CSS (the design system's palette + typography + shadow scale), motion (Framer Motion in phase 3), and illustrations can tank Lighthouse performance. The page weight budget (500KB total) is achievable but requires discipline at every phase.

Mitigation. Performance budget in phase 6 acceptance criteria (Lighthouse 90+ performance). Phase 2 (design system) includes a font-loading audit (`next/font` self-hosting + `font-display: swap`); phase 3 (motion) uses Framer Motion's `LazyMotion` to defer the library load; phase 4 (illustrations) compresses SVGs and inlines small ones. Each phase has the same performance hygiene checklist.

**R5. Portfolio routes (case studies, memos) lose discoverability if home page becomes purely marketing.** A visitor lands on marketing, scrolls through 9 sections, and never finds the depth -- the case study and the memos lose discoverability because the home page no longer surfaces them prominently.

Mitigation. Clear nav links to `/case-study` and `/docs` from the section 1 Nav. The section 6 case study tease is explicit (a dedicated section with a clear CTA). The features section 5 cards each link to the relevant memo. The discoverability is wired into the page structure; the risk is that visitors do not click through, which is a marketing problem, not a structural one. The mitigation makes the depth one click away from any point on the page.

## 8. Mitigations (consolidated)

Each risk's mitigation is named inline above; consolidated here:

- R1 (visual register): typographic discipline + restrained accent + cross-skill review with `editorial-web-style` and `anthropic-skills:safeeval-ui-review` skills.
- R2 (copy / design fit): design system established before copy is locked; phase 1 copy is structural placeholder.
- R3 (illustration budget): SVG-with-Tailwind MVP path as default; commissioned art only if phase 5 review demands it.
- R4 (performance): performance budget at phase 6; per-phase performance hygiene checklist (font loading, motion lazy-loading, SVG compression).
- R5 (portfolio discoverability): nav links to case study and docs; explicit case-study-tease section; feature cards link to memos.

## 9. Alternatives evaluated

Three alternatives rejected, with reasoning.

### 9.1 Faithful Affirm clone (Steven's Option 1)

Apply the affirm.com aesthetic without restraint -- full pastel palette (sage + dusty blue + warm coral + buttercream all at once), looser typography tracking on display sizes, even heavier pill geometry, illustrated everywhere.

**Rejected.** Undermines the portfolio signal. A faithful clone reads as consumer fintech; a hiring manager at an enterprise T&S role sees the page and discounts the operational depth that follows. The affirm-inspired register is the value-add over a faithful clone -- restraint IS the signal.

### 9.2 Pure enterprise (Steven's Option 2 / Stripe-only)

Apply pure Stripe/Linear/Vercel design language -- monochrome palette (slate scale plus one accent), tight typographic discipline, minimal illustration, dense information layout.

**Rejected.** Loses the warmth and friendliness Steven specifically pointed at as the qualities he wants. The Stripe register is "operator-credible but cold"; the affirm-inspired register is "operator-credible AND warm." The warmth is part of the locked copy register ("An AI safeguard built like trust and safety actually works.") -- pure enterprise would conflict with the copy.

### 9.3 Separate marketing site at `safeeval.com` domain

Build the marketing page on a separate domain (`safeeval.com`) and keep the existing `safeeval.vercel.app` as the portfolio surface unchanged.

**Rejected.** Fragments the story. Two domains require duplicate maintenance (separate analytics, separate deploys, separate SEO surfaces); domain purchase requires registrar work; DNS setup requires Vercel project configuration. The split also confuses the visitor: which is the real product? Replacing the home page is the cleaner solve and is what Steven adjudicated.

## 10. Open questions for Steven -- escalation field per fifth atomic amendment

Five open questions, each carrying the inline `escalation:` field per the closure-report convention.

1. *(escalation: route-to-steven, reason: scope-tier decision is the load-bearing decision the rest of the memo's phasing rests on -- choosing phases 1-2 only vs. phases 1-5 vs. all six changes the timeline by approximately 4-5 weeks and changes how visually distinctive the page is)* **Standard scope (phases 1-5) adopt?** Section 6 records the recommendation. Phases 1-2 alone is the minimum-viable landing page (copy + structure + design system); phases 1-5 is the recommended primary path (adds hero illustration, section illustrations, polish + a11y audit); phases 1-6 is the full launch (adds final QA + meta tags + OG image, all small additive work). The architecture and the design system are identical across scopes; the difference is how far the polish ramp extends.

2. *(escalation: route-to-steven, reason: illustration approach is the cost-risk concentration; whether to budget for commissioned art depends on what Steven is willing to spend and whether the portfolio window can absorb the 2-4 week designer turnaround)* **Illustration approach -- Tailwind-SVG MVP only or budget for commissioned art?** Section 5 records the two paths. SVG-with-Tailwind is free, fast, polished-but-not-distinctive. Commissioned art is $500-2000 + 2-4 week turnaround, visually distinctive. The default-accept recommendation is to start with the SVG-with-Tailwind path and use phase 5 polish review as the go/no-go for commissioning. Steven can override by committing to commissioned art at phase 3 directly, accepting the cost and the schedule risk.

3. *(escalation: default-accept, rec: Inter at MVP, distinct font at phase 3+)* **Font choice -- Inter (free, ubiquitous, slightly generic) vs. Soehne / General Sans (more distinctive, may require license)?** Inter is the safe choice at MVP -- free, well-hinted, available via `next/font/google`, ubiquitous enough that visitors recognize it without thinking about it. Soehne or General Sans are more distinctive but require license review (Soehne is a Klim Type Foundry commercial license; General Sans is free for commercial use via Fontshare). Recommend Inter for phases 1-2; phase 3+ open to substituting if the distinctiveness is worth the license overhead.

4. *(escalation: default-accept, rec: static demo page in phase 1)* **Demo CTA target -- static "what evaluation looks like" page in phase 1, real fixture eval in later phase?** The "Try a demo" primary CTA links to `/demo/eval`. The MVP phase 1 implementation is a static page showing a canned v5 envelope (what a real evaluation produces) -- no real API call, no live classifier, no signup required. Later phases (likely phase 3-4) wire it to a real fixture eval (hardcoded prompt -> real API call -> real envelope -> displayed in the same UI as the evaluator). Recommend static at phase 1; the static page is enough to demonstrate the product depth without depending on SaaS infrastructure existing yet.

5. *(escalation: default-accept, rec: `/evaluator` for the existing evaluator UI route)* **Where does the existing evaluator UI move to?** The current home page (`src/app/page.js`) is the evaluator. The new home page replaces it; the evaluator needs a route. Recommended: `/evaluator`. Alternatives considered: `/app`, `/try`, `/eval`. Recommend `/evaluator` because it is descriptive, easy to remember, and parallel to the README's existing language ("evaluator", "evaluation pipeline"). The README and any internal links updated to point at the new route as part of phase 1.

**Two `route-to-steven` (Q1 scope tier, Q2 illustration approach) pause auto-chaining; three `default-accept` (Q3 font, Q4 demo target, Q5 evaluator route) proceed with tentative recommendations.**

## 11. Adversarial review -- strongest case against this memo's conclusion

Per the design-memo-author skill's mode C affordance, this memo records its own strongest counter-arguments. Two counters are named; neither flips the recommendation; both sharpen what Steven is asked to confirm.

### 11.1 Strongest case AGAINST a landing page redesign at all

"You're spending design budget on a marketing page when no one is buying yet. Pre-product marketing is premature -- a landing page is the kind of thing you build after product-market fit, not before. The existing evaluator-as-home page works fine for the resume-arriving reader; building a marketing surface ahead of having something to market is wasted effort."

**Refutation.** Three points:

(a) **The page IS the portfolio entry point for hiring managers.** A landing page redesign budget here doubles as portfolio polish. The marketing visitor and the resume-arriving visitor read the same surface; the marketing visitor needs narrative scaffolding to understand the framework, and the resume-arriving visitor benefits from the same narrative scaffolding before diving into the evaluator. The redesign is not pre-product marketing; it is post-portfolio-polish that happens to also work as marketing if and when the SaaS conversion ships.

(b) **Phases 1-2 alone is small work and gets 80% of the affirm-inspired feel.** Phase 1 (copy + structure) is approximately one week of focused work; phase 2 (design system extension + restyling) is approximately one more week. Two weeks of focused work is not "design budget" in the sense the counter implies -- it is one sprint of dedicated work, not a multi-month design effort. The marginal cost over keeping the evaluator-as-home is concentrated in phases 3-4 (commissioned illustration), which are deferrable.

(c) **Replacing the current portfolio home page is a one-time upgrade, not ongoing marketing spend.** The redesign is a single capital expenditure; there is no ongoing maintenance cost beyond what the existing home page already requires. Marketing budget concerns apply to ongoing campaigns, ads, content production -- not to a one-time landing page implementation.

The recommendation does not flip. The framing in section 1 (portfolio integrity > polish-for-polish's-sake; the new landing page must work as the portfolio entry point AND as the marketing entry point) is sharpened.

### 11.2 Strongest case FOR a more dramatic visual redesign

"Affirm-inspired-but-restrained is half-measures. If you're committing to a visual overhaul, commit fully to a distinctive aesthetic -- go all-in on the affirm look, OR go all-in on a custom brand language nobody else uses. Half-measures leave you in the worst of both worlds: identifiably affirm-ish without the consumer-grade polish, and identifiably not-Stripe without the enterprise discipline."

**Refutation.** Three points:

(a) **Steven's explicit qualities (whitespace, rounded, big type, pastel) are achievable without going full consumer-fintech.** The locked decision in the brief frontmatter is specifically "affirm-inspired but enterprise-credibility-adjusted." Going full affirm would re-litigate the locked decision; going full custom would also re-litigate the locked decision in the opposite direction. The restraint IS the value-add; it is what makes the page operator-credible while preserving the warmth.

(b) **Restraint IS the value-add over a faithful clone.** A faithful affirm.com clone reads as derivative -- a hiring manager who has seen affirm.com immediately recognizes the page as a copy. The affirm-inspired-but-restrained register is original -- it lifts the structural qualities (whitespace, rounded, big type) without lifting the specific visual signature (rainbow palette, soft tracking, illustrated everywhere). Originality reads as the team thinking, not the team copying.

(c) **The `editorial-web-style` skill plus the `anthropic-skills:safeeval-ui-review` skill act as guardrails against drift.** The risk that "half-measures leave you in the worst of both worlds" is mitigated by the cross-skill review at phase 2 (editorial-web-style for the affirm-inspired register) and phase 5 (safeeval-ui-review for the broader audit). Drift toward consumer-fluffy is caught at phase 2; drift toward enterprise-stiff is caught at phase 5. The guardrails are explicit and named.

The recommendation does not flip. The §2 design system extensions are sharpened with the typographic-discipline rule (`font-semibold` not `font-bold`; `tracking-tight` on display) and the palette discipline rule (one accent color, not a rainbow).

### 11.3 What mode C can and cannot do here

Per the design-memo-author skill's mode C rule, adversarial review can only downgrade confidence -- ACCEPT -> PARTIAL ADOPT -> DEFER. The adversarial review above does not flip either of this memo's primary recommendations (replace the current home; adopt the affirm-inspired-but-restrained register). The counter-arguments are named and refuted on grounds specific to the portfolio entry point doubling as the marketing surface, the bounded cost of phases 1-2, and the cross-skill guardrails against visual drift.

If the recommendations were overconfident, the mode C move would be to downgrade the Standard scope (phases 1-5) recommendation to PARTIAL ADOPT: ship phases 1-2 first, evaluate against the editorial-web-style skill, then decide phase 3-5 based on the evaluation. This memo declines to do that -- the §6 phasing already supports incremental adoption (phases are independent; phase 1-2 is the meaningful unit; phases 3-4 are the visually-distinctive ramp; phase 5-6 are the launch ramp) -- but the staged path is named for completeness in case Steven prefers the explicit gate. The §10 Q1 question records the scope tier as the primary route-to-steven adjudication; downgrading Standard to PARTIAL ADOPT after Steven's adjudication would be a secondary move, not the memo's primary recommendation.

## 12. Sequencing

No data-track or engine dependencies. This is pure frontend work; the implementation gates only on the sibling memo's framing and the README being current.

Implementation gates on:

- **SaaS conversion memo landed.** Sibling memo (`docs/memos/2026-05-28-saas-conversion-scoping.md`) lands as brief 0080 in parallel with this memo. The landing page's signup CTA deferral references the SaaS conversion's Phase 1+2 milestone explicitly; if the SaaS conversion memo is not on main, the deferral framing has no milestone to point at. Recommended sequencing: SaaS conversion brief 0080 commits first, this brief 0081 commits second, in the same vscode session.

- **README polish landed.** Confirmed in handoff state as `local_d91795eb`. The new landing page replaces what the README's links currently point to as the home; the README and the new landing must reconcile. The reconciliation is in phase 1 acceptance (update README links to point at `/evaluator` and `/case-study` as appropriate; the new home is the landing page).

No other dependencies. No engine code, no schema, no data layer, no auth module changes. The landing page is an additive frontend artifact.

The recommended sequencing of phases 1-6 is serial; no two phases parallelize cleanly (each builds on the previous's acceptance gate). The exception is the section-by-section content polishing within phase 1 -- multiple sections can be drafted in parallel by different writers, as long as the structural composition lands at the end. In practice, phases 1-6 are sequential.

## 13. Cover-letter angle

A polished landing page IS the portfolio piece's exterior. The work itself is the depth (the framework memo; the per-typology threat models; the design memos; the classifier; the audit metadata; the security and compliance posture). The landing page is what hiring managers see before deciding to open the case study or the framework spec.

Phases 1-2 alone is meaningfully higher-impact than any further engineering depth at this point in the application window. The marginal return on additional engine work (another bright-line indicator; another typology rewrite; another stage in the cascade) is decreasing -- the depth is already deep. The marginal return on portfolio-surface polish is increasing -- the first impression is currently underweighted relative to the work it represents.

Phases 3-6 are the visually-distinctive ramp. They add polish without changing the underlying narrative. Whether to invest in them depends on what Steven judges the portfolio window to be: if the window is two weeks of focused work, phases 1-2 are the right scope; if the window extends to 6-8 weeks, phases 1-5 are the right scope; if the window extends further, all six phases close out cleanly.

The cover letter framing -- "the work itself is the depth; the landing page is the polish" -- is the same framing that justified the README polish (commit `local_d91795eb`). The two artifacts are siblings: README is what a GitHub-arriving reader sees first; the landing page is what a domain-arriving reader sees first. Both are portfolio entry points; both deserve the same polish discipline. The landing page is the larger investment because the surface area is larger and the visual register is the load-bearing differentiator; the README polish was the smaller investment because the surface area is smaller and the content is the differentiator.

## 14. Closure

Scoping memo recommends Standard scope (phases 1-5) with the SVG-with-Tailwind illustration approach as the default-accept fallback; implementation across 6 phases; gates on Steven adjudicating section 10 Q1 (scope tier) and section 10 Q2 (illustration approach).
