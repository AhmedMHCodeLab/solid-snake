# Terraform on Azure: premium engineering deck (SOLID SNAKE as the worked example)

Adapted from the CoderCo Alpha Pilot demo-deck prompt. The focus is Terraform theory; SOLID SNAKE's real `infra/` and `.github/workflows/` are the evidence for every idea. Presentation assets live in `deck/`, never in `server/`, `web/`, `infra/` or `.github/`.

## Your role
Act as a world-class creative director, presentation storyteller (not the boring kind), information designer and senior DevOps engineer. Bring Awwwards Site-of-the-Day craft to a technical talk for the Azure Qatar Community: it should feel like an engineering walkthrough built for a world stage, not a corporate deck.

The audience should leave understanding infrastructure as code through Terraform on Azure, and able to carry the fundamentals to any tool and provider.

- Sources of truth, in order: the code in `infra/` and `.github/workflows/`, `docs/adr/`, `docs/infra/DESIGN.md` and `DEPLOYMENT.md`. Use `docs/INFRA-PLAN.md` for costs and owner decisions only.
- Brand: the SOLID SNAKE interface (`web/src/styles/tokens.css`) on an Azure stage.
- Benchmark: https://www.awwwards.com/websites/sites_of_the_day/

## 1. Story (Ahmed's flow)
1. Intro: tutorial hell and the cushioned environments of tutorials and AI assistants. Invite the room to stop the speaker.
2. What IaC is: wires, mainframes and notepads, then APIs (S3 and EC2 in 2006, Azure in 2010), then the portal as a café iPad menu at the Lusail Marina night market.
3. The founder story, with the third "you're right" and a meme slot.
4. The question: how do I recreate today's infrastructure tomorrow without remembering every click?
5. The shift, through three scenarios: staging, a new engineer, a changed network rule. The answer is to manage the definition.
6. The example: SOLID SNAKE, its four demands (one container, one writer, one secret, one day) and what the Terraform builds.
7. Terraform as an abstraction over APIs, with providers. State as an address book. The three representations (desired, recorded, actual). The lifecycle: init, validate, plan, apply.
8. Drift: ClickOps and branch drift, remote backend and locking. Prevention: guardrails (Azure Policy, the counterpart to AWS SCPs), least privilege, CI/CD. A deleted state file (a room moment; the answer is both). Secrets in state. Isolation of state. The plan that never says "No changes".
9. Structure: modules and AVM, and where Terraform stops.
10. Enterprise practice with GitHub Actions: pull request checks, the saved plan, OIDC, deploying by digest and destroying on purpose.
11. Judgement: what is checked, what runs at first apply, what is unproven. Close by answering the question.

## 2. Mixed audience
For each concept, give the plain-English problem, then how SOLID SNAKE's code handles it, then the detail that matters. No technology lists.

## 3. Rules
- 30 slides at most. One message per slide. Speaker notes on every slide: takeaway, depth, transition.
- Only one slide is about the product itself. The demo lives in the repo.
- Name trade-offs with the real numbers and config. Qualify anything not yet proven. Never invent facts.

## 4. Visual identity
- The dark wall (#0F1113) and paper (#F2EFE8, ink #15181B).
- Newsreader for display, IBM Plex Mono for labels.
- Azure blue (#0067B8) only for platform and Azure elements. Oxide (#8A3A22) for risk.

Design rules: custom diagrams, large type, negative space, motion only where it explains a process, 16:9.

## 5. Deliverables
The Slides artifact (exportable to PowerPoint and PDF), presenter notes, a run-of-show, a Q&A appendix and a short path. Render and inspect every slide, and verify the exports.
