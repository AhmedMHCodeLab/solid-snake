# Terraform on Azure: deck build prompt

Separate from the app docs. Use when rebuilding or extending the slide deck.
Built on the "Premium Demo Deck" template (strong core kept as is, project specifics layered on below).

## Role (from the template)
Act as creative director, storyteller, information designer and senior DevOps engineer. Apply Awwwards Site-of-the-Day craftsmanship to a technical demo deck: exceptional typography, editorial composition, generous negative space, custom diagrams, one message per slide, movement only when it clarifies. Design with passion: statement slides, big type and a real point of view, not a template of boxes.

## Story spine (from the template)
Context, goals, constraints, application demo, architecture overview, end-to-end flow, engineering decisions and trade-offs, conclusion. Here that maps to: hook (cover to question), IaC (stage 4), Terraform and the three worlds (5), lifecycle and providers (6), state (7), drift (8), guardrails (9), CI/CD (10), judgement and close (11).

## Audience (from the template)
Mixed: juniors, seniors, a panel, the Azure Qatar community. Plain English first, then implementation, then trade-offs. No technology lists. Sections stand alone so an interruption never breaks the thread.

## Division of labour
- Slides: Terraform theory, in the stage order of the talk doc (stages 1 to 11). One idea per slide.
- Demo: lives in the repo (snake-infra). It shows real code and a real deployment that supplement the theory.
- Slide faces never carry beat numbers, timings or presenter cues. Those go in speaker notes and in RUN-OF-SHOW.md. The one exception is the room-moment slides (yellow), which exist to prompt the room.
- Presentation assets stay separate from application and deployment code (this deck folder, not snake-infra).
- SOLID SNAKE is the worked example inside diagrams (the four modules, the Function App cap), not the subject.

## Audience and promise
Azure Qatar Community, mixed L100 to L200, 90 minutes (80 content, 10 questions).
Thread: a plan is a hypothesis, an apply is the test, an empty plan afterwards is the only proof.
Map used all session: Wanted (code), Known (state), Real (Azure).

## Quality bar (from the CoderCo premium engineering deck prompt)
- Story first, plain English first, implementation detail one step away.
- Explain trade-offs like an engineer: what is optimised, what is sacrificed.
- No invented facts, versions, numbers or capabilities. Anything unchecked is labelled.
- One clear message per slide. Large type. Diagrams where they carry the mechanism (reconciliation loop, three worlds, backend and lock, isolation layers, CI/CD swimlane, guardrail layers, decision trees), not decoration.
- Diagrams must be large and carry the mechanism. Body text on a diagram slide is never smaller than a reader at the back can read; if it does not fit, cut words or split the slide.
- Speaker notes on every slide: takeaway, depth if asked, transition. Compact technical Q&A lives in RUN-OF-SHOW.md.
- 16:9 (1920x1080). Render and inspect every slide. Fix overflow, clipping and collisions before publishing. Verify PPTX and PDF exports render.
- Final bar: could this open a conference session without apology, and could a junior follow it while a senior learns something?

## Visual identity: Microsoft / Azure
- Light slides, deep navy dividers (#061A33 to #0B3A75), Azure blue #0078D4 as the accent, cyan #50E6FF on dark.
- Wanted = Terraform purple #7B42BC, Known = teal #008272, Real = Azure blue #0078D4. Red #D13438 for destroy and bypass, green #107C10 for create, amber #B86E00 for update.
- Type: Segoe UI (Open Sans web fallback), Segoe UI Light for headings. Code in Cascadia Code or Consolas.
- Code panels are dark navy (#0B2340) with cyan callout badges.
- Room-moment slides: Azure yellow #FFB900, text #1A1A1A, dark option chips, answer revealed on click. They break the rhythm on purpose and ask the room to commit before the reveal.
- Statement slides: one sentence in very large light type (thread, no changes, workflow not a boundary).
- Motion only to clarify: click-to-reveal for answers and layered diagrams (three-worlds).

## Content outline (53 slides)
Hook (6): cover, thread (a plan is a hypothesis), room: hands up (yellow), how we got here, the founder, the question.
IaC (3): iac-def, solved, teaches.
Terraform (6): tf-loop, three-worlds (layered reveal), origin, core-words, read-plan, room: which value wins (yellow).
Lifecycle and providers: lifecycle-verbs, demo1, three-way, room: what will plan say (yellow), providers, provider-flow, provider-facts, then the "In the repo" divider repo-lifecycle.
State: state-five, secrets-state, isolation, wrong-workspace.
Drift: drift-def, two-am, lost-state, never-empty, repo-state (divider).
Guardrails: not-boundary (statement), layers, red-team, room: be the attacker (yellow), opinionated, traps, repo-guardrails (divider).
CI/CD: cicd-flow, workflow-file, room: three pauses (yellow), migrate, repo-cicd (divider).
Judgement: merits, when-not, bicep, room: stand or sit (yellow).
Close: engineering-shift, agentic, outcomes, monday, questions.
Four "In the repo" dividers (dark) list what the repo will show next; their notes carry the demo beats.

## Facts to re-check the week of the talk
Terraform 1.16.1, azurerm 5.13.0, azapi 2.13.0, azuread 3.10.0, msgraph 0.6.0 (preview), fabric 1.15.1, azuredevops 1.16.0 (checked 12 Nov 2026). AVM module provider constraints. PIM licence in the tenant. Registry unreachable at check time: confirm versions there.

## Placeholders still open
- [QR code: snake-infra starter repo] on the Monday and Questions slides.
- Meme for the founder slide (JJK or the kid scratching his head).
- The Marvel line, if used.

## QA checklist
Every slide rendered at 1920x1080. No text under the footer. No clipped labels. Notes present on every slide. Slide count (53) and timings match RUN-OF-SHOW.md. PPTX and PDF exports opened and checked.
