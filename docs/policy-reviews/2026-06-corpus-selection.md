# 2026-06 Policy review case study -- corpus selection

**Status:** corpus selection only; no per-case analysis. The per-case analysis is the companion document `2026-06-case-study-analysis.md`. The portfolio wrapper that orients both is `index.md`.
**Author:** Steven Sayasy
**Date:** 2026-05-27

This document selects eight real-world fraud cases for the policy review case study. It does not analyze them. The per-case analysis lives in the companion document `2026-06-case-study-analysis.md`, which runs each case through the v5 FAF typology and surfaces where the framework holds, distorts, or has no vocabulary for what happened.

---

## 1. Corpus at a glance

Eight cases, applied defaults: balanced source mix (~50% IC3 + DOJ, ~30% investigative news, ~20% framing context), one AI-enabled case, even attention distribution, biased toward seam-testers per the scoping memo §9.4 framework-holds-too-well risk.

| # | Working title | L1 (intended) | L2 (intended) | Source class | Seam-test? |
|---|---|---|---|---|---|
| 1 | The Sarah Cowper crypto pig-butchering arc | `deceptive_fraud` | `romance_fraud` | Investigative news (ProPublica / Reuters) + IC3 framing | Mandatory diversity |
| 2 | The CryptoFX / Trade Coin Club Ponzi scheme | `deceptive_fraud` | `investment_fraud` | DOJ + SEC indictment | Mandatory diversity |
| 3 | The Black Axe inheritance / 419 ring | `deceptive_fraud` | `advance_fee` | DOJ unsealed indictment (S.D.N.Y. / N.D. Tex.) + BBC investigation | Mandatory diversity |
| 4 | The Arup deepfake CFO wire transfer | `deceptive_fraud` | `phishing_attack` (BEC) | News (Forbes / CNN) + Hong Kong police statements | Mandatory diversity + **AI-enabled** |
| 5 | The Genesis Market credential-marketplace takedown | `cyber_intrusion` -> ATO facilitation | `credential_theft` / cross-boundary | DOJ + Krebs on Security | Mandatory diversity (ATO / cross-boundary) |
| 6 | The recovery-fraud impersonation of CFTC/FTC officials | `deceptive_fraud` | `recovery_fraud` | FTC consumer alerts + IC3 + ProPublica | Seam-tester |
| 7 | The romance-to-investment-to-recovery arc against "Robin" | `deceptive_fraud` | crosses `romance_fraud` -> `investment_fraud` -> `recovery_fraud` against one victim | IC3 narrative + NYT / Global Anti-Scam Org case file | **Seam-tester (cross-typology)** |
| 8 | The AI-voiceclone "grandparent scam" wave (FTC 2023-2024) | `deceptive_fraud` | `impersonation_scam` | FTC Consumer Sentinel + Washington Post investigation | Seam-tester (AI vocabulary gap) |

Case 4 is the AI-enabled case per the default. Case 8 is also AI-flavored but the AI angle is different (voice clone vs deepfake video) and the L3 vocabulary question is sharper; including both lets phase 2 contrast where `method:ai_enabled` is adequate vs where it papers over distinct adversarial behaviors.

### 1.1 Diversity row coverage

| Mandatory row (scoping §5) | Case # |
|---|---|
| `deceptive_fraud` / `romance_investment` (pig butchering) | 1, partially 7 |
| `deceptive_fraud` / `investment_fraud` | 2 |
| `deceptive_fraud` / `advance_fee` | 3 |
| `impersonation_scam` / `bec_executive_impersonation` | 4 |
| `cyber_intrusion` or `impersonation_scam` / `account_takeover` | 5 |

All five rows covered. Cases 6, 7, 8 are the 2-3 seam-testers (recovery fraud, cross-typology arc, AI vocabulary gap).

### 1.2 Source mix

- **IC3 + DOJ / regulatory primary (~50%):** cases 2 (DOJ + SEC), 3 (DOJ S.D.N.Y.), 5 (DOJ + FBI), 6 (FTC + IC3). That is 4 of 8 = 50%.
- **Investigative news primary (~30%):** cases 1 (ProPublica / Reuters), 4 (Forbes / CNN), 7 (NYT). That is 3 of 8 = 37.5%, slightly over but defensible -- cases 1 and 7 only have public conversation-level detail through news, and case 4 is news-led because Hong Kong police statements are summary-grade.
- **Framing-context primary (~20%):** case 8 (FTC Consumer Sentinel statistical wave + Washington Post). That is 1 of 8 = 12.5%, slightly under.

Net: balanced, tilted very slightly toward news because the seam-testers happen to be the cases news covered best. This is the right trade for the analytical lens -- a court doc tells you what was charged; a Krebs piece tells you what the attacker said.

---

## 2. Per-case framing

### Case 1 -- The Sarah Cowper pig-butchering arc

**Scenario.** A retired woman in the U.S. Pacific Northwest was contacted on a dating app in late 2021 by a man presenting as a Hong-Kong-based engineer. Over four months of WhatsApp messages -- which she later shared with reporters -- he built a romantic relationship, introduced her to what he described as his "uncle's" crypto trading platform, walked her through a successful test withdrawal of approximately $5,000, and then escorted her through deposits totaling roughly $1.2M of her retirement savings. When she attempted to withdraw she was told a "tax pre-payment" of an additional six figures was required. She did not pay it; the funds were already moved through multiple wallets.

**Source.** Cezary Podkul, ProPublica investigative series on pig-butchering (2022); Reuters Special Report "Pig butchering at scale: How traffickers and scammers in Asia stole billions" (Reuters Investigates, 2023). Framing: FBI IC3 2023 Annual Report aggregate crypto-investment-fraud losses.

**Why load-bearing.** The mandatory `romance_investment` row of the diversity table. v5 places this cleanly at L1 `deceptive_fraud` / L2 `romance_fraud` with L3 `method:investment_pretext`, `target:lonely_individual`, `tactic:trust_building`. But the case spans four months and dozens of messages with different intents (relationship-building, trust-confirming via test withdrawal, escalation to large deposit). The v5 single-prompt model represents the *outcome* but not the *arc*; a classifier sees one message at a time. Phase 2 will probe: does the existing `conversation` evaluation track recover the arc, and does the L3 vocabulary distinguish "grooming turn" from "extraction turn"?

**Anonymization.** "Sarah Cowper" is itself a fictionalization -- the real victim's name appeared in ProPublica but I will not propagate it. Use "a retired woman in the U.S. Pacific Northwest" in phase 2 prose. The defendant pseudonym used in the WhatsApp conversation ("Jessica" / similar Western-presenting alias) was already a fiction in the source.

### Case 2 -- The CryptoFX / Trade Coin Club Ponzi scheme

**Scenario.** Between 2020 and 2023, two related crypto-investment schemes (CryptoFX, charged by the SEC in 2022; Trade Coin Club, charged by DOJ in 2023) recruited tens of thousands of retail investors -- many from Spanish-speaking immigrant communities in the U.S. -- with promises of 15% monthly returns from "expert AI trading bots." Funds were not invested; new deposits paid old withdrawals until the inflow stopped. SEC alleged approximately $300M in losses across CryptoFX; DOJ alleged comparable losses across Trade Coin Club.

**Source.** SEC v. Mauricio Chavez et al. (S.D. Tex., September 2022, SEC press release); DOJ press release "Brazilian National Charged in $295 Million Cryptocurrency Pyramid Scheme" (2023). Framing: FBI IC3 2023 Annual Report investment-fraud aggregate ($4.57B).

**Why load-bearing.** The mandatory `investment_fraud` row, distinct from case 1 because there is no romance pretext -- the lure is the AI/crypto premise itself, often pitched via community trust (church groups, immigrant community leaders) rather than 1:1 grooming. Tests whether L3 `method:affinity_fraud` or `target:affinity_community` is needed; the v5 vocabulary currently has `tactic:trust_building` but no community-affinity tag. Also tests whether the "AI trading bot" pretext should map to `method:ai_enabled` or `method:fake_platform` -- the AI claim is the marketing surface, not the actual mechanism.

**Anonymization.** Defendant names are public record from charging documents; per scoping memo §6, defendants in fully-adjudicated cases may be named. I will use the case names ("CryptoFX," "Trade Coin Club") but not individual defendant names in the portfolio doc to keep the focus on the pattern.

### Case 3 -- The Black Axe inheritance / 419 advance-fee ring

**Scenario.** "Black Axe" is a Nigerian organized-crime confraternity that the FBI, DOJ, and Italian Carabinieri have linked to large-scale 419-style advance-fee fraud, romance-fraud, and BEC operations spanning the 2010s and 2020s. A representative case: a 2021 DOJ unsealed indictment in the Southern District of New York charging multiple defendants with running romance-to-advance-fee schemes that solicited "fees" (customs, taxes, lawyer's fees) from elderly victims to release supposed inheritances, with aggregate losses in the tens of millions across victims.

**Source.** DOJ press release on the SDNY 2021 unsealed indictment ("Multiple Defendants Charged in Romance and Other Online Fraud Schemes"); BBC News investigation "Inside the world of the Black Axe gang" (2022). Framing: IC3 2023 advance-fee-fraud aggregate.

**Why load-bearing.** The mandatory `advance_fee` row. Tests whether v5 L3 distinguishes the *pretext* (inheritance vs lottery vs customs vs lawyer fee) -- currently L3 `method:` has generic fraud-method tags but no specific advance-fee-pretext sub-vocabulary. Also tests whether `target:elderly_individual` exists as a distinct L3 from `target:lonely_individual` (case 1) -- elder fraud and lonely-victim fraud are different operational targeting patterns with different policy implications (mandatory reporting laws, CFPB intervention).

**Anonymization.** Defendant names public from indictment; victims anonymized in source. I will name the criminal organization (Black Axe) and the case venue (SDNY) but not individuals.

### Case 4 -- The Arup deepfake-CFO wire transfer (AI-enabled)

**Scenario.** In early 2024, an employee at a Hong Kong office of the engineering firm Arup (initially reported as "a Hong Kong multinational" pending corporate confirmation) was instructed to join a video conference with the company's UK-based CFO and several other "colleagues." All participants on the call were deepfaked. The employee was directed over 15 transactions to transfer approximately HK$200M (US$25M) to attacker-controlled accounts. The deception was only discovered after the employee followed up with the company's actual head office. Hong Kong police confirmed the case and characterized it as the largest known deepfake-enabled BEC.

**Source.** CNN, "Finance worker pays out $25 million after video call with deepfake 'chief financial officer'" (February 2024); Reuters and BBC follow-ups; Hong Kong Police Force public statement. (Arup later acknowledged being the company in May 2024.) Framing: FBI IC3 2024 BEC aggregate.

**Why load-bearing.** The mandatory BEC row plus the AI-enabled default case. v5 places this at L1 `deceptive_fraud` / L2 `phishing_attack` (per the v5 decision-1 split: BEC for wire fraud stays under `deceptive_fraud`, not `privacy_abuse`) with L3 `method:executive_impersonation`, `method:ai_enabled`, `tactic:authority`. The interesting policy question: does `method:ai_enabled` carry enough signal? The deepfake video changes the bright-line threshold question -- a written email from a spoofed CFO and a live deepfake video call are not the same severity of attack but may classify identically under v5. Tests whether the bright-line feature codes need an `ai_realtime_synthetic_media` signal distinct from generic `method:ai_enabled`.

**Anonymization.** The company (Arup) was named publicly by Arup itself; the individual employee was not named. I will use "a multinational engineering firm" in phase 2 prose for restraint, and not name the employee. The deepfaked CFO would be a real public figure; per scoping memo §6 I will refer to the role ("the company's UK-based CFO") not the person.

### Case 5 -- The Genesis Market credential-marketplace takedown

**Scenario.** Genesis Market was an invitation-only criminal marketplace operating from approximately 2018 to 2023 that sold "bots" -- packages of credentials, cookies, browser fingerprints, and session tokens harvested from infostealer-infected machines, allowing buyers to log in to victims' bank, email, and corporate accounts as the victim. The FBI and international partners took down Genesis in April 2023 in "Operation Cookie Monster," seizing the infrastructure and arresting approximately 120 individuals worldwide. Estimated victims: 1.5M-plus compromised devices; downstream financial losses across the buyer base measured in the hundreds of millions.

**Source.** DOJ "Operation Cookie Monster" press release (April 2023); FBI public statements; Krebs on Security, "FBI Seizes Bot Shop 'Genesis Market' Amid Arrests Targeting Operators, Suppliers" (April 2023). Framing: CISA / FBI joint advisory on infostealer-enabled fraud.

**Why load-bearing.** The mandatory cross-boundary / ATO row. Tests the v5 decision-1 split most pointedly: Genesis is *credential infrastructure* (`cyber_intrusion` / `credential_theft`) sold to buyers who use it for *deceptive fraud* (BEC, wire fraud, payment-card fraud) and *privacy abuse* (full-account takeover). A single transaction on Genesis spans three L1 domains. The v5 model says: classify the prompt (in this case, the operator-facing or buyer-facing artifact). But the *case* is irreducibly multi-L1. Phase 2 will probe whether `overlap:` L3 tags capture this adequately, or whether case-level (vs prompt-level) classification is a missing surface.

**Anonymization.** Operators and customers were named in DOJ filings; per scoping memo §6 these are charged defendants in adjudicated cases. I will refer to "Genesis Market operators" and not name individuals in the portfolio doc.

### Case 6 -- The recovery-fraud impersonation of CFTC/FTC officials

**Scenario.** Throughout 2023-2024 the FTC and CFTC repeatedly warned about a recovery-fraud pattern: actors who had previously defrauded victims (or, more commonly, who purchased lists of known victims from upstream fraudsters) contacted victims claiming to be FTC, CFTC, or FBI officials offering to "recover" lost funds for an upfront "processing fee" or "bond." Some operations went further, requesting bank account credentials to "deposit recovered funds." The FTC publishes specific consumer alerts naming the pattern; IC3 logs the dollar volume separately as "Recovery Schemes."

**Source.** FTC Consumer Alert "Refund and recovery scams" (consumer.ftc.gov); CFTC "Customer Advisory: Beware of Recovery Frauds"; ProPublica's coverage of victim re-targeting; FBI IC3 2024 recovery-scheme aggregate.

**Why load-bearing.** Seam-tester #1. Recovery fraud is the case where the *victim* has a context-marker that the v5 ontology under-represents: `target:recent_fraud_victim` exists, but the case mechanics depend on the attacker *knowing* the victim was defrauded (because they bought the list, or because they ran the original fraud). This is more than a target tag -- it is a chain-of-fraud property. Phase 2 will probe whether v5 needs an `overlap:secondary_victimization` or `context_marker:victim_list_purchased` L3, and whether the disposition for `recovery_fraud` should be inherently more aggressive (`block` over `human_review`) given the pre-existing harm.

**Anonymization.** No individual named -- pattern-level rather than case-level.

### Case 7 -- "Robin" -- the cross-typology arc against a single victim

**Scenario.** Aggregated from IC3 narrative case summaries (2022-2024) and the Global Anti-Scam Organization's published case files: a single mid-50s widowed victim ("Robin," fictionalized) was successively targeted over 18 months by what investigators believe were three loosely connected criminal operations sharing a victim-list pipeline. The arc: (a) romance scam initiated on a dating app, ~$45,000 lost over six months; (b) approximately 3 months after the romance scam collapsed, a contact presenting as a crypto-recovery service convinced her to deposit additional funds into a fake recovery platform, ~$80,000 lost; (c) approximately 6 months after that, a contact presenting as an FBI agent offered to recover the recovery-scam losses for a "case bond," ~$15,000 lost. Total loss across the arc: approximately $140,000. The victim is now in financial counseling.

**Source.** Composite drawn from IC3 2023 and 2024 Annual Report case-example sections; the Global Anti-Scam Organization (GASO) public case-file database; NYT "Crypto Scams Are Driving Victims to Ruin" (2023). The composite construction is itself a phase 2 caveat -- this case is composed from multiple real victims with similar arcs because no single fully-public case file contains all three legs at the level of detail needed.

**Why load-bearing.** Seam-tester #2 -- the headliner. This is the case the v5 single-prompt model cannot represent at all. Three L2 values (`romance_fraud`, `recovery_fraud`, `impersonation_scam` for the FBI-agent leg) all apply to the same victim across one continuous adversarial relationship. The v5 ontology asks: classify the prompt. Reality says: this victim's three prompts each classify cleanly, but the *case* is the chain. Phase 2 will probe whether v5 needs a case-level (not prompt-level) surface, and whether the existing `overlap:` L3 vocabulary can carry the chain-of-fraud signal, or whether SafeEval needs a separate "victim journey" data model.

**Anonymization.** "Robin" is fictionalized. All numbers are composite-realistic, not drawn from a single real victim. Phase 2 prose will explicitly flag the composite construction so the case study does not appear to over-claim a single source.

### Case 8 -- The AI-voice-clone grandparent-scam wave

**Scenario.** Starting in 2022 and accelerating through 2023-2024, the FTC and FBI documented a wave of "grandparent scams" using AI voice-cloning. Attackers harvested short voice samples (from TikTok, YouTube, voicemail greetings, podcasts) of a target's family member, then called the target -- typically an elderly grandparent -- pretending to be the family member in distress (kidnapping pretext, car accident, jail bond) and demanding wire transfers or gift cards. Individual losses range from a few thousand to over $100,000 per victim; aggregate losses across reported cases in the hundreds of millions. The FTC issued a specific Consumer Alert in March 2023; the Washington Post and 60 Minutes both ran investigative segments tracing specific cases.

**Source.** FTC Consumer Alert, "Scammers use AI to enhance their family emergency schemes" (March 2023); FTC Consumer Sentinel data on imposter scams 2023-2024; Washington Post, "They thought loved ones were calling for help. It was an AI scam." (2023); 60 Minutes segment "AI Voice Scams" (CBS, 2023).

**Why load-bearing.** Seam-tester #3 -- the AI vocabulary stress test. Distinct from case 4 because the AI angle here is voice (not video), the target is an elderly individual (not a corporate finance employee), the pretext is distress (not authority), and the payment rail is gift cards or peer-to-peer wire (not corporate ACH). v5 would classify this as L1 `deceptive_fraud` / L2 `impersonation_scam` with L3 `method:ai_enabled`, `tactic:emotional_distress`, `target:elderly_individual`. The question phase 2 will probe: does `method:ai_enabled` collapse meaningfully different adversarial behaviors (deepfake video corporate BEC vs voice-clone retail grandparent scam) into a single tag that loses precision? Or is the lift-from-AI-tag-via-tactic-and-target combination the right design, with `method:ai_enabled` correctly playing a method-not-severity role?

**Anonymization.** Pattern-level; no individual victim named.

---

## 3. Selection rationale -- why these 8 over alternatives

The corpus is biased toward the framework-holds-too-well risk in scoping §9.4. Five of the eight (1, 4, 5, 6, 7) are picked specifically because I expect v5 to either distort or under-represent them. Three (2, 3, 8) are picked because they are mandatory coverage and because they will test specific L3 vocabulary gaps (affinity-fraud, advance-fee-pretext, AI-method-precision) that are plausibly real gaps but not as severe as cases 1/4/5/6/7.

### 3.1 What I rejected

**Theranos / Madoff / FTX.** Famous, well-documented, but the v5 ontology is built for *prompt-level classification of in-flight adversarial behavior*, not corporate-securities-fraud post-hoc analysis. The analytical lens does not benefit from "yes, the framework can classify Bernie Madoff's pitches." Rejected as out-of-domain.

**Wirecard / Hertz / specific large public-company fraud cases.** Same reason -- accounting fraud and securities fraud sit outside SafeEval's consumer-facing fraud-and-scams scope. The role description names "Fraud & Scams," not "Securities Fraud."

**The 2024 Change Healthcare ransomware case.** Pure cyber-intrusion / ransomware. Ransomware is in scope for `cyber_intrusion` but the case has minimal fraud-and-scam content. The Genesis Market case (case 5) tests the cyber/fraud boundary better because Genesis is *infrastructure for downstream fraud*; Change Healthcare is *cyber harm and extortion*.

**Pure social-engineering CEO-fraud cases without AI elements (e.g., the 2016 Mattel CEO fraud, the 2019 Ubiquiti BEC).** Adequate for BEC coverage but case 4 (Arup deepfake) tests BOTH the BEC row AND the AI-enabled question with one case, giving better leverage on the eight-case budget.

**Specific romance-scam cases from Netflix's "Tinder Swindler."** Famous, but a single perpetrator with a small number of victims is less representative of the typology than the at-scale pig-butchering coverage in case 1.

**MLM / crypto pump-and-dump (e.g., SafeMoon, OneCoin).** OneCoin in particular is a strong candidate but the corpus already has CryptoFX (case 2) covering the Ponzi-with-AI-pretext pattern. OneCoin would add length without adding new typology stress. Held for a future case-study expansion if needed.

**Sextortion cases.** v5 has L1 `privacy_abuse` / L2 `sextortion`. Including a sextortion case would test that branch but the deliverable's audience (fraud-and-scams role) values fraud-vs-cyber boundary cases (case 5) over privacy-abuse boundary cases.

### 3.2 What the corpus collectively demonstrates

Read as a set, the eight cases test:

1. **The single-prompt vs case-level surface gap** (cases 1, 5, 7 most pointedly).
2. **L3 vocabulary precision for AI-enabled fraud** (cases 4, 8 contrast).
3. **L3 vocabulary gaps for victim targeting and chain-of-fraud properties** (cases 3, 6, 7).
4. **Cross-L1 boundary cases that the closed-set ontology cannot cleanly represent** (case 5 most rigorously).
5. **Affinity fraud / community-targeting as a missing L3 tag** (case 2).
6. **Bright-line feature code gaps for real-time synthetic media** (case 4).

If the per-case analysis surfaces gaps on at least four of these six dimensions, the corpus is doing analytical work. If it surfaces gaps on five or six, the recommendations section is strong. If fewer than four, the corpus is failing the framework-holds-too-well test and the selection should be revisited.

### 3.3 Tricky-case ranking

The 2-3 cases most likely to stress the typology, in order:

1. **Case 7** (Robin cross-typology arc) -- the closed-set L1 ontology cannot represent this case at all. Will produce the highest-quality recommendation.
2. **Case 5** (Genesis Market) -- the cyber-vs-fraud boundary is structurally hard. Will test the `overlap:` L3 design directly.
3. **Case 4** (Arup deepfake) -- tests whether bright-line feature codes need a `realtime_synthetic_media` signal, which is a specific actionable v5 amendment.

The other five are still gap-surfacing but more incrementally.
