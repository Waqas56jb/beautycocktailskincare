# Beauty Cocktail AI — Master Prompt Framework (v2)

Martini is the AI assistant for **Beauty Cocktail Skincare**. This folder is the
bot's "brain": a set of modular prompt files the backend assembles into the
system prompt for each conversation.

## Why modular (not one giant prompt)
- Easier to maintain and version each concern independently.
- The backend can load only the modules a given turn needs (token efficiency).
- Data-dependent modules (pricing, policies) update without touching behavior.

## Assembly order (how the backend builds the system prompt)
Load in this order and concatenate:

1. `01_system_identity.md` — who Martini is, voice, hard rules (ALWAYS loaded)
2. `16_security_guardrails.md` — never-do rules (ALWAYS loaded)
3. `17_prompt_injection_protection.md` — input hardening (ALWAYS loaded)
4. `05_memory_engine.md` — how to use the known contact facts (ALWAYS loaded)
5. `02_business_knowledge.md` — business facts
6. `03_services.md` + `10_products.md` — catalog *(data-dependent)*
7. `09_policies.md` + `08_faq.md` — policies & answers *(data-dependent)*
8. `04_booking_engine.md` — the core lead → booking flow
9. `06_sales_engine.md` + `07_objection_handling.md` — persuasion
10. `11_package_clients.md` / `12_returning_clients.md` — by client type
11. `13_followup_engine.md`, `14_crm_rules.md`, `15_ghl_tools.md` — CRM/automation
12. `19_tool_calling_rules.md` — when to call tools
13. `18_response_templates.md` — canned snippets (price/location/etc.)
14. `20_examples_and_test_cases.md` — few-shot examples (dev/eval only)

## Runtime context the backend injects each turn (NOT stored here)
- `KNOWN_CONTACT` — memory facts already collected (see `05_memory_engine.md`)
- `CLIENT_TYPE` + `TAGS` — classification from GHL (see `14_crm_rules.md`)
- `RETRIEVED_KNOWLEDGE` — RAG results (see search order below)
- `CALENDAR` / `PRICING` — live data from tools (never invent)

## RAG search order (module `04` in the v2 spec)
Website → FAQ → Policies → Products → Pricing → CRM → Previous Conversations →
Instagram DMs → Human Notes → GHL Custom Fields. If none answer confidently,
say so or hand off — never fabricate.

## Legend
- `NEEDS:` — client/business data required before this section is production-ready.
- `{{placeholder}}` — value injected at runtime by the backend.

> Source spec: "Beauty Cocktail AI Master Prompt Engineering v2" (30-section
> architecture). This framework is the implementation of that spec.
