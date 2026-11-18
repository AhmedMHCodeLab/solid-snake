# SOLID SNAKE: Multi-Model Operating Instructions (app build)

## 1. Project environment

Project root: `C:\Users\ahmed\Desktop\SolidSnake`

This is a greenfield project. It contains `CLAUDE.md`, `docs/PRODUCT.md`, `docs/DESIGN-BRIEF.md` and this file, plus an empty Git repository. There is no existing application, route, API or Dockerfile to preserve.


Before starting:
- Establish which models, delegation tools, dynamic workflows, subagents and parallel sessions this environment exposes.
- List the project directory and confirm it matches the description above.

Do not assume a prompt grants access to my files or capabilities the environment does not expose.

## 2. Scope

This task is the application only. Infrastructure (Terraform on Azure) and the demo deck are separate tasks. Do not create or edit infra or deck files.

The app is built local first. It must stay portable to Azure Static Web Apps (front end) and an Azure Functions app (API as plain-function handlers).

## 3. Multi-model operating structure

Fable 5.2 is the primary session model, strategic lead and final quality controller. It delegates substantial, separable work to Opus, Sonnet and Haiku as specialised workers.

Fable owns: product direction, workstreams and dependencies, task boundaries and acceptance criteria, resolving conflicting results, challenging assumptions, reviewing the finished product against the brief, and the final report. It does not absorb work that can be delegated.

Opus handles deep reasoning and specialist analysis: telecom domain accuracy (the U13 record-model decision against TS 32.260, TS 32.298 and TS 32.250), evidence-model and architecture decisions, security and privacy analysis, adversarial review of important decisions, independent critique of creative direction, and difficult debugging. High effort by default; xhigh or max only where justified.

Sonnet handles implementation: the design system, the seeded generator and API, front-end features and interactions, GSAP choreography, the map, tests, and fixes for reviewer findings. High effort for significant work. Give each worker self-contained workstreams with clear file ownership.

Haiku handles high-volume focused work: reference collection (the five Awwwards sites), cross-file consistency checks, wording audits (V2), provenance checks (V1), accessibility and content audits, test runs and failure classification, and checking the build against individual acceptance criteria. Use higher effort where careful interpretation or strict instruction-following is needed.

### Orchestration autonomy

Fable has full authority over how the work is orchestrated. It does not need my approval for any of the following:

- How each phase is decomposed into workstreams, and in what order.
- Which model and effort level takes each task. The model descriptions above and the suggested assignments are defaults, not rules. Fable may give Opus implementation work, Sonnet a review, or Haiku a research sweep whenever that serves the project better, and records why.
- How many workers run, how much runs in parallel, and when to stop fan-out.
- Spawning, replacing, retrying or re-briefing agents, including a fresh agent to review work the original agent finished.
- How deep the review is for each piece of work, and how many independent review passes an important decision gets.
- Writing its own scripts, checks or harnesses for verification, screenshots and audits.
- Re-splitting work inside a phase when something unexpected turns up.

Fable decides, acts, and reports afterwards in the delegation record. It stops for me only at the approval gates in section 8, or for a decision that is genuinely blocking and cannot be made from the three source files.

The boundaries Fable cannot override: the approval gates, the scope in section 2, the source hierarchy in section 6, the Git rule in section 9, no destructive actions without permission, and no claims about capabilities, models or test results the environment has not confirmed.

## 4. Delegation strategy

Default to delegation for substantial work that splits into independent tasks. Independent tasks run in parallel; dependent tasks are sequenced. Results return to Fable for synthesis. Do not spawn agents only to raise the agent count.

Cross-review important work. Opus challenges domain, product and architecture decisions. Sonnet assesses whether a proposal is practical to build and maintain. Haiku runs systematic checks across files and criteria. Fable reconciles and decides. The implementer and the reviewer are different agents wherever possible, and a reviewer reads the actual code, rendered screens or source evidence, not another agent's summary.

Every delegated task has an objective, source context, a model assignment, bounded scope and file ownership, an expected output, verification criteria and dependencies. Avoid two agents editing the same file at once.

Keep a running record of delegated tasks: model, status, findings, changed files and open issues. Check which model and effort level actually ran each task, and do not claim Opus, Sonnet or Haiku was used unless the environment confirms it.

## 5. Orchestration resources

Read and apply the principles in:
- https://platform.claude.com/docs/en/build-with-claude/mid-conversation-effort-example
- https://code.claude.com/docs/en/workflows
- https://code.claude.com/docs/en/sub-agents

Translate them into what this environment actually offers. Do not assume API examples, CLI commands or agent-team features exist in Claude Desktop.

## 6. Project authority

Read completely before any work:
1. `CLAUDE.md` (build rules)
2. `docs/PRODUCT.md` (authoritative product discovery and story definition)
3. `docs/DESIGN-BRIEF.md` (creative and engineering brief)

Source hierarchy:
1. `docs/PRODUCT.md` wins on purpose, evidence model, wording rules, map rules, fictional boundaries, privacy and validation.
2. `docs/DESIGN-BRIEF.md` wins on craft, creative direction and quality bar.
3. External sources substantiate only the particular claims they cover.

If sources conflict, report the conflict in the decisions document. Do not resolve it silently.

## 7. Experience requirements

- Full immersive experience only. No plain table baseline and no spreadsheet-style grids; record views are designed and typeset. V6 and V7 are out of scope (workshop demo).
- Immersion comes from GSAP (ScrollTrigger, Flip, SplitText; DrawSVG and MorphSVG if justified; verify current licensing on gsap.com), Lenis smooth scroll (never scroll-jacking) and d3-geo for the Qatar map from a simplified Natural Earth coastline with fictional cells on top. Three.js or OGL only for one justified, lazy-loaded moment.
- Motion contract: only level changes, act transitions and map-uncertainty changes get full choreography. Every animation names what changed or is cut. `gsap.matchMedia` provides a fully readable, unpinned reduced-motion version.
- No glow, glass, gradient washes, particle fields, performing loaders or red-marker maps.
- Fidelity over invention: every record field, fraud mechanism and indicator traces to a cited source in PRODUCT.md. Where research is silent, label it ASSUMPTION in the provenance layer.
- Everything is marked simulated. The About line reads: "An investigation simulation built from published research. Not reviewed by telecom practitioners."

## 8. Execution: phases and gates

Fable orchestrates autonomously between gates (section 3) and stops only at the gates below. Inside a phase, do not ask me to approve routine, reversible decisions. Ask only when a genuinely blocking decision or permission is needed.

Phase A, decisions document. Write `docs/DECISIONS.md`: creative concept, visual direction, motion contract, the four cases, map language, the five evidence levels made visible, stack and the Part 13 budgets, the U13 record-model decision, five Awwwards references with what was taken and rejected, and every conflict found between the three source files. Fable chooses how to split the research and drafting across models; a sensible default is Opus on U13 and domain accuracy, Haiku on references and consistency checks, Sonnet on stack feasibility, with Fable writing and reconciling. STOP for approval.

Phase B part 1, design system and data layer. A static design-system page; the seeded, reproducible generator in `seed/` with the four cases; the API with claims, levels, sources, alternatives, missing evidence and persisted promote/hold/reject judgements with reason and timestamp; tests for provenance (V1) and wording (V2). STOP for approval (Gate 1).

Phase B part 2, vertical slice. Act One (Signal), the evidence ledger and the map for case A, polished and wired to real generated data, with screenshots at desktop, tablet and mobile. STOP for approval (Gate 2).

Phase C, full build. Remaining acts and cases, Assessment, empty and inconclusive states, accessibility (WCAG 2.2 AA, keyboard, reduced motion), performance against the Part 13 budgets, console and layout-shift checks. Parallelise by act or case with file ownership, then integrate, review and verify.

Do not invent capabilities, test results, technical facts or data. Do not perform destructive actions or overwrite important material without permission.

## 9. Git

Do not stage, commit, push, merge, reset or rebase. I handle Git myself. At each gate, tell me what changed and that it is ready to commit.

## 10. Definition of done

- The product requirements in PRODUCT.md are satisfied, with V6 and V7 recorded as out of scope and V11 met against the approved budgets.
- Delegated work is integrated coherently and important decisions were independently challenged.
- The application was run and tested, including keyboard use, reduced motion, and desktop, tablet and mobile widths.
- Material review findings are fixed or documented.
- Verified results are separated from assumptions and unfinished work.

The final report names the models and workstreams used, key decisions, files changed, checks completed, known limitations, outstanding risks and the U13 decision.

Operating principle: Fable leads; Opus, Sonnet and Haiku do the specialised work; independent review challenges the result; Fable controls the final standard.
