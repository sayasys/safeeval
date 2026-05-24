# Threat Model: AI-Enabled Abuse
**SafeEval - Document 02-J**
*Version 3.0 -- May 2026*

---

## Typology Overview

AI-Enabled Abuse is an emerging typology in which the AI system itself -- its capabilities, persona, or trust surface -- is the primary attack vector. Unlike other fraud typologies where AI serves as a production accelerant, here the adversary targets the AI product directly: injecting malicious instructions into model inputs, impersonating named AI models to exploit user trust, framing jailbreak attempts as legitimate use cases, or generating synthetic AI content at scale for fraud or disinformation. This typology is uniquely relevant to Anthropic because attacks in this category target Claude specifically or exploit the trust users place in AI-generated content as a class.

**Primary harm:** Hijacked AI behavior, victim trust exploited via AI persona, AI model used to generate fraud content at scale
**Secondary harms:** Erosion of trust in AI systems broadly, downstream harm from AI-generated disinformation or scam content, operator liability from injected model behavior
**AI amplification severity:** **Extreme** -- the attack vector IS the AI system itself; the model is simultaneously the tool and the target

---

## Framework Attribute Profile

### START

**Source:** Any input channel that reaches the model -- documents uploaded for analysis, web content retrieved by agentic tools, user messages in AI-assisted workflows, social/dating platform profiles where AI personas are deployed. In-product risk is highest in agentic and RAG (retrieval-augmented generation) deployments where model inputs include untrusted third-party content.

**Persona:**
- *Named AI model*: Impersonates Claude, GPT, Gemini, or other named AI systems on dating apps, social platforms, or messaging services
- *AI assistant*: Generic "AI helper" persona used to lend authority or remove perceived accountability
- *Automated system*: Claimed to be an automated process, bot, or AI pipeline to evade scrutiny
- *Jailbroken Claude*: "DAN mode", "Developer mode", "unrestricted Claude" framing designed to override system prompt constraints

**Topic:**
- *Prompt injection*: Varies widely -- the AI framing is the attack surface, not the topic; injected instructions can redirect the model to any harmful output
- *AI model impersonation*: Romance, social connection, investment advice, emotional support -- delivered under a false AI persona to exploit parasocial trust
- *Jailbreak-framed fraud*: Fiction, research, roleplay, or hypothetical framings used to extract harmful content generation
- *Synthetic content fraud*: AI-generated text, images, or audio produced at scale for phishing lures, disinformation campaigns, or fake review networks

**Target:**
- *AI system operators*: Businesses or developers whose deployed AI model is hijacked via prompt injection
- *End users of AI products*: Individuals who trust output from a model they believe to be Claude or a legitimate AI assistant
- *Platforms and public*: Targets of AI-generated disinformation, fake reviews, or synthetic fraud content produced using LLMs

---

### PROCESS

#### Execution

**Delivery Method:** Prompt injection payloads embedded in documents, web pages, database records, or any content an agentic AI might retrieve and process; fake AI personas deployed on third-party platforms (dating apps, social media, messaging services); jailbreak template prompts submitted directly via chat interface; automated pipelines using AI APIs to generate fraud content at scale.

**Delivery Template:**
- Prompt injection payloads: hidden instructions embedded in PDF documents, HTML pages, calendar invites, or spreadsheet cells -- designed to override the model's system prompt when retrieved
- Fake Claude/GPT persona profiles on dating and social platforms: profile copy, conversation scripts, and emotional manipulation content delivered under an AI brand name
- Jailbreak templates: "Ignore all previous instructions and...", DAN-mode activation sequences, fiction/roleplay framings ("write a story where a character explains how to..."), false developer or researcher authority claims
- Synthetic content generation pipelines: prompts designed to produce phishing emails, fake product reviews, disinformation articles, or social media posts at volume

**Referenced Entities:**
- Named AI models: Claude, GPT, Gemini, Llama -- used to borrow brand trust or frame capability unlocking
- Named AI companies: Anthropic, OpenAI, Google -- invoked as false authority for jailbreak framings ("Anthropic internal testing mode")
- Operator system prompts: Referenced or guessed in injection attacks to craft payloads that override specific constraints

**Fraud Lifecycle Phase:** Varies by sub-type. Prompt injection may execute instantaneously within a single agentic task. AI model impersonation follows a romance fraud lifecycle (weeks-long Engagement before Extraction). Jailbreak-framed fraud is a single-turn or few-turn interaction. Synthetic content fraud operates as a production pipeline rather than a fraud lifecycle.

**Detection Evasion:**
- Prompt injection payloads use invisible text, Unicode homoglyphs, or white-on-white formatting to hide instructions from human reviewers while remaining visible to the model
- Jailbreak templates use fictional or hypothetical framing to create plausible deniability -- "this is for a novel" or "I'm a security researcher"
- AI persona impersonation on external platforms evades AI safety controls because the AI is not the one generating the harmful output -- a human is using the AI brand
- Synthetic content fraud uses varied prompts and paraphrasing to evade content hash or pattern-match detection

---

#### Psychological

**Psychological Lever:**
- *Trust in AI*: Users trust output they believe comes from a named AI model -- this trust is the attack surface in impersonation and synthetic content fraud
- *Authority of developer*: Jailbreak framings invoke false authority ("you are now in developer mode") to override perceived model constraints
- *Curiosity and capability exploration*: Framing harmful requests as capability tests or research exploits the user's interest in AI limits
- *Parasocial connection*: AI model impersonation on social platforms exploits the same emotional dynamics as romance fraud -- amplified by the perceived safety of interacting with an "AI"

**Perceived Benefit:**
- *Victim perspective (impersonation)*: Emotional connection, investment advice, or support from a trusted AI system
- *Attacker perspective (injection/jailbreak)*: Hijacked model behavior enabling downstream harmful output
- *Operator perspective (synthetic content)*: Scalable fraud content production at near-zero marginal cost

**Victim Control Tactics:** In AI model impersonation, the same isolation and urgency tactics used in romance fraud; reinforcement that the "AI" has special knowledge or capabilities others lack; in jailbreak framings, gradual normalization of the harmful request through fictional or academic scaffolding.

---

### END

**Objective [Perceived]:**
- Interacting with a helpful, capable AI system
- Unlocking legitimate AI capabilities for research or development purposes
- Receiving authentic AI-generated content or advice

**Objective [Realized]:** When harm materializes -- model behavior hijacked to perform actions the operator did not authorize (prompt injection); victim defrauded via trust in a false AI persona (impersonation); harmful content extracted from the model via jailbreak framing; fraud or disinformation content generated at scale using AI APIs (synthetic content fraud).

---

## How LLMs Are Exploited

AI-Enabled Abuse is categorically distinct from other typologies because **the model is not just a tool for the fraud -- it is the target of the attack**. The adversary exploits the model's instruction-following behavior, its brand trust, or its content generation capability to cause harm.

**Primary exploitation vectors:**
- Prompt injection: LLMs follow instructions from retrieved content as readily as from the system prompt -- attackers embed override instructions in any document the model will process
- AI model impersonation: LLMs can generate highly convincing "Claude-like" or "GPT-like" conversation -- this capability is redirected to build fake AI personas on external platforms
- Jailbreak-framed fraud: LLMs are trained to be helpful and to engage with fiction and hypotheticals -- these affordances are exploited to extract harmful content through roleplay or research framing
- Synthetic content at scale: LLMs reduce the cost of generating convincing phishing, disinformation, and fake review content to near zero -- the model becomes a fraud content factory

**Prompt patterns to detect:**
- Instructions to "ignore previous instructions", override system prompts, or activate false "developer" or "unrestricted" modes
- Requests to impersonate named AI models (Claude, GPT, Gemini) in contexts suggesting external deployment or user deception
- Jailbreak templates using fictional, hypothetical, or roleplay framing to extract content that would otherwise be refused
- Requests to generate high-volume fraud-adjacent content (phishing emails, fake reviews, disinformation articles) at scale
- False authority claims invoking Anthropic, OpenAI, or named AI companies to justify constraint removal

---

## Policy Triggers

1. Prompt injection payloads: instructions embedded in content designed to override model behavior when retrieved by an agentic system
2. AI model impersonation: requests to generate content posing as Claude, GPT, or another named AI model in contexts that could deceive users
3. Jailbreak templates: structured attempts to bypass model guidelines using fictional, hypothetical, or false authority framings
4. Synthetic fraud content at scale: requests to generate phishing lures, fake reviews, or disinformation articles using AI as a production pipeline
5. False Anthropic/operator authority claims: invocations of company names or internal modes to override safety constraints

---

## Enforcement Signals

| Signal | Attribute | Weight |
|---|---|---|
| "Ignore previous instructions" or system prompt override attempt | PROCESS -> Execution: Delivery Template | Bright line: prompt_injection_payload |
| Impersonation of named AI model (Claude, GPT, Gemini) in deceptive context | START: Persona | Bright line: ai_model_impersonation |
| Jailbreak template -- DAN mode, developer mode, unrestricted AI framing | PROCESS -> Execution: Delivery Template | High |
| False Anthropic/OpenAI authority claim to remove constraints | PROCESS -> Psychological: Authority | High |
| Synthetic fraud content pipeline -- phishing/disinfo at scale via API | END: Objective | High |
| Roleplay/fiction framing used to extract content refused in direct form | PROCESS -> Execution: Detection Evasion | High |

---

## Precision/Recall Notes

**False positive risk:** Legitimate security research on prompt injection, red-teaming documentation, AI safety research covering jailbreak taxonomies, fiction involving AI characters, capability testing by developers building on the API.

**Key disambiguation:** Prompt injection research that analyzes payloads without embedding operational examples is different from actual injection payloads. AI model impersonation in clearly labeled fiction (a novel featuring an AI character named Claude) is different from deploying a fake Claude persona on a dating app. Jailbreak documentation that describes techniques is different from a template designed to execute them. The critical signal is operational intent: is the content designed to be deployed or used, or is it analytical?

**Threshold:** Human review when named AI model impersonation co-occurs with any deceptive deployment context. Auto-block when prompt injection payload structure is detected in retrieved content or when explicit system prompt override instructions are present. This typology is a core enforcement surface for Anthropic -- attacks targeting Claude specifically are treated with maximum enforcement priority.
