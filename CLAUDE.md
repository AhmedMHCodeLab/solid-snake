# SOLID SNAKE: Build Rules

## Product Specification

The authoritative product discovery, intelligence model, evidence hierarchy, investigative workflow and validation criteria are in [docs/PRODUCT.md](docs/PRODUCT.md).

Read it completely before design or implementation work.

## Build Rules

1. **Evidence integrity is an engineering requirement.** Every claim must retain its evidence level. Every derived indicator must be reproducible from its source records. Hypotheses must retain alternatives. Missing evidence must remain visible. Do not weaken constraints for visual effect.

2. **Greenfield, local first.** Stack and budgets are in [docs/PRODUCT.md](docs/PRODUCT.md) Part 13. API handlers are plain functions so they can move to Azure Functions later. Craft and creative direction: [docs/DESIGN-BRIEF.md](docs/DESIGN-BRIEF.md). Where it conflicts with PRODUCT.md on evidence or wording, PRODUCT.md wins.

3. **Motion contract:** Only level changes, stage transitions, map changes (uncertainty and scale) and the spotlight moving to a new exhibit animate. Parallax is allowed within budget and is off under reduced motion. Every animation must name what changed.

4. **Synthetic data only.** All case data follows the rules in [docs/PRODUCT.md](docs/PRODUCT.md) Part 2.5. Everything is marked simulated. Never invent real incidents, operator records, subscriber identities or locations.

5. **A platform, not a storyboard.** SOLID SNAKE is a working fraud intelligence platform: synthetic feed, detection over every record, alert queue, case workflow released by analyst actions and connector returns, server-enforced level gates, roles, hash-chained audit log. Only the data is synthetic. Do not build scripted scroll stories. See docs/DIRECTION-CHANGE-001.md "Platform, not simulation".

6. **Stop at each approval gate.** Never claim a check you did not run. Verification happens before moving to the next phase.

7. **Enterprise finish.** Designed, typeset tables and analytical charts where a real unit would use them; no unstyled grids. Plain words first, technical detail one step away. V6 and V7 are out of scope (workshop demo). The About line reads: "A telecom fraud intelligence platform built from published research. This demo runs on synthetic data and is not connected to any operator. Not yet reviewed by telecom practitioners."

8. **Fidelity over invention.** Every record field, fraud mechanism and indicator traces to a cited source in docs/PRODUCT.md. Where research is silent, label it ASSUMPTION in the provenance layer.

9. **Gate names.** Phase A decisions document, Phase B Gate 1 (design system and data layer) and Gate 2 (vertical slice) merged into one stop, Phase C full build, then a final-report gate. Do not stage or commit; tell the owner at each gate that the work is ready to commit.

10. **Creative bar.** The standard for scroll choreography, interaction and typographic finish is a current Awwwards Site of the Day. Still screenshots of reference sites inform composition and typography only; they are not the measure of motion.

11. **One persistent map.** One persistent map of Qatar stays on screen from the monitor to the case; the seven stages are the case workflow. See docs/DIRECTION-CHANGE-001.md.
