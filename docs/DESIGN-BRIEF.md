# Creative & Engineering Brief: SOLID SNAKE — Awwwards-Level Digital Intelligence Experience

## Your role

Act as an elite digital design studio combining a world-class creative director, award-winning product designer, UX specialist, information designer, motion designer, geospatial visualisation specialist, and senior frontend engineer.

Your benchmark is the quality of work featured in [Awwwards — Sites of the Day](https://www.awwwards.com/websites/sites_of_the_day/) and [PeachWeb Gallery](https://peachweb.io/gallery).

Do not interpret this as permission to add gradients, glass cards, animations, 3D objects, or trendy UI components to an ordinary template.

The objective is to create an original, highly art-directed, production-quality digital experience that feels designed by an exceptional human-led agency.

The finished product should feel intentional, distinctive, polished and memorable on first viewing, while remaining genuinely usable as an interactive intelligence investigation experience.

---

## 1. Understand the product before designing it

**Greenfield project** in this folder.  
**Product specification:** [docs/PRODUCT.md](docs/PRODUCT.md).  
**Build rules:** [CLAUDE.md](CLAUDE.md).  
**Brand:** SOLID SNAKE.  
**Setting:** Fictional national telecommunications fraud intelligence operation, based in Qatar.  
**Design benchmark:** Awwwards Sites of the Day and PeachWeb Gallery.

Before doing anything, read [docs/PRODUCT.md](docs/PRODUCT.md) completely and review [CLAUDE.md](CLAUDE.md).

It is the authoritative product discovery and story definition. It establishes the mission, telecom fraud context, intelligence model, investigative workflow, evidence hierarchy, geographic constraints, creative principles, safety boundaries and validation criteria.

Do not replace its product decisions with your own interpretation.

SOLID SNAKE is a fictional telecom fraud intelligence operation. Its first investigation concerns SIM-box bypass fraud.

The central experience is the journey from an unusual telecom signal to a defensible investigative assessment:

**Anomaly → Intelligence → Correlation → Geographic understanding → Investigation → Assessment.**

The product is about making the reasoning behind an investigation visible.

It must help users understand:

- What was actually observed in the records.
- Which analytical indicators were derived from those observations.
- Which independent evidence sources support or contradict an explanation.
- What competing hypotheses remain plausible.
- What the geography can and cannot establish.
- What additional investigation would be needed.
- What can reasonably be concluded.

The distinction between observation, inference, hypothesis and verified finding is fundamental to the product.

The product is not:

- A conventional security operations centre dashboard.
- A generic telecom monitoring interface.
- A map covered in red markers.
- A device-tracking application.
- An automated fraud accusation or enforcement system.
- A representation of a real Qatari agency, operator or regulator.
- A live surveillance system or a claim to possess real operator data.

The experience should feel like entering a sophisticated fictional intelligence operation and following a real investigative case, not browsing a collection of dashboard widgets.

**Important:** The product specification contains explicit assumptions and unresolved decisions. Do not silently convert them into facts. Preserve the distinctions between FACT, RESEARCH, PRACTICE, ASSUMPTION, FICTION and PROPOSAL.

The screens and interactions needed for the case journey are established in the Phase A decisions document—not assumed from this brief.

---

## 2. Establish a real creative direction

Before coding, establish the Phase A decisions document and the product specification.

Study at least five relevant Awwwards Site of the Day projects (record what was taken and rejected), prioritising exceptional experiences in:

- Data storytelling.
- Editorial and documentary-style digital experiences.
- Geospatial and cartographic interfaces.
- Technology and intelligence-themed experiences.
- Interactive investigations and immersive narratives.
- Sophisticated information visualisation.

Use PeachWeb as an additional source of visual and interaction references.

Choose references for their specific design qualities rather than copying their appearance.

Identify what makes them successful:

- Composition and typography.
- Information hierarchy.
- Art direction.
- Narrative progression.
- Interaction choreography.
- Transitions and motion.
- Data presentation.
- Spatial relationships.
- Use of negative space.
- Attention to detail.

Develop one coherent creative concept for SOLID SNAKE.

Write a concise design rationale explaining:

1. The central creative idea.
2. Why it fits the intelligence and investigative subject.
3. How it makes the evidence and reasoning understandable.
4. What makes the experience recognisably different from a generic SaaS or SOC interface.

Do not start by selecting a component library and arranging its default components.

Start with the experience and visual concept. Implement components to support that concept.

### Visual direction

Aim for a contemporary, premium intelligence experience with:

**Exceptional typography**

A deliberate type pairing or family, expressive hierarchy, considered line lengths, precise weights and strong typographic composition.

Typography should contribute to the identity rather than merely display information.

**Confident composition**

Editorial layouts, deliberate asymmetry where appropriate, unexpected but logical proportions, generous negative space and a rigorous underlying grid.

Avoid filling every available area with cards, panels and widgets.

**A distinctive intelligence aesthetic**

The interface should communicate precision, investigation, evidence, geography and analytical discipline.

It may draw from cartography, intelligence dossiers, archival records, technical documentation, investigative reports and specialist analytical instruments.

These are reference points, not a requirement to imitate military software or historical intelligence interfaces.

**A recognisable visual identity**

Develop a coherent identity for SOLID SNAKE through colour, typography, language, visual motifs and interaction design.

Avoid relying on stereotypical military green, terminal text, red alerts, neon accents or tactical imagery to communicate intelligence.

**Refined surfaces**

Use borders, depth, subtle transparency, shadows and glass effects only where they improve hierarchy or spatial understanding.

Glassmorphism is optional, not the identity of the interface.

**Purposeful motion**

Transitions should communicate meaningful changes in the investigation:

- An observation becoming an analytical indicator.
- Independent evidence being correlated.
- A hypothesis gaining or losing support.
- A geographic uncertainty area becoming clearer.
- An assessment being recorded.

Motion must help users understand what changed and why.

**Editorial-quality details**

Precise spacing, consistent radii, beautiful empty states, meaningful iconography, restrained copy, carefully considered separators and alignment that remains correct at every viewport.

**A coherent experience**

The public introduction, investigative narrative, evidence ledger, geographic visualisation, case assessment and supporting states must belong to the same design system.

The overall impression should be premium and distinctive—not cold enterprise software, a generic SOC dashboard, a cyberpunk game interface or an AI-generated analytics template.

---

## 3. Create a signature experience

An exceptional experience needs a coherent idea people remember—not twenty unrelated visual effects.

Develop at least one distinctive interaction or visual moment that makes sense for SOLID SNAKE.

Potential directions to explore:

- An investigative case that unfolds as evidence is introduced.
- A persistent evidence ledger that changes as the user examines the case.
- A geographic view that communicates uncertainty rather than pretending to show exact locations.
- A visual correlation experience connecting independent evidence sources.
- A transition from an initial anomaly to a structured investigative hypothesis.
- A final assessment that makes the difference between suspicion and verified findings unmistakable.

These are prompts for thinking, not mandatory features.

Inspect the actual product and select the concept that creates the strongest experience without inventing backend capabilities.

The signature moment should be integrated into the product's identity. It should enhance understanding, reinforce the investigative narrative or make an important analytical decision more satisfying.

### Motion hierarchy

- Important narrative transitions receive deliberate choreography.
- Supporting interactions remain subtle and responsive.
- Nothing animates merely to demonstrate technical capability.
- Evidence changes must be understandable without animation.
- Avoid unnecessary scroll-jacking, forced intro sequences, long loading screens, excessive parallax, gratuitous 3D and animations that delay access to the investigation.

Do not copy another website's signature interaction.

Use references to inform the quality of the work, then create an original expression suited to SOLID SNAKE.

---

## 4. Design the actual investigative experience

Design the screens the case journey needs as established in Phase A.

Use the investigative arc and three-act structure in [docs/PRODUCT.md](docs/PRODUCT.md) as the conceptual foundation.

### Act One — Signal

Introduce the initial anomaly.

The user should understand:

- What unusual activity was observed.
- Which records produced the observation.
- What baseline it was compared against.
- Why the pattern deserves further examination.
- Why an anomaly is not proof of fraud.

Make the initial discovery compelling without exaggerating the evidence.

### Act Two — Case

This is the core of the experience.

The user follows the investigation through intelligence, correlation, geographic understanding and competing hypotheses.

Where supported by the product, design the following:

**Intelligence and fraud context**

Explain the relevant fraud mechanism in a clear, technically credible way.

SIM-box bypass should be the primary case. Contrast cases and legitimate lookalikes should be included where the dataset supports them.

**Evidence correlation**

Present relationships between independent evidence sources.

Make provenance visible. Users should be able to understand which records support an observation and which rules produced a derived indicator.

**Evidence ledger**

The ledger is a persistent part of the experience, not an ordinary table buried in a secondary page.

It should make the evidence-to-claim model understandable:

1. Observed fact.
2. Analytical indicator.
3. Correlated evidence.
4. Investigative hypothesis.
5. Verified finding.

Every claim should have traceable provenance.

Missing evidence, contradictions and alternative explanations must remain visible.

**Geographic understanding**

The Qatar map should be a meaningful investigative instrument.

It should help users understand where activity could have occurred and how geographic observations relate to the evidence.

It must never imply that a cell association establishes an exact device location.

Use areas, ranges, sectors and uncertainty where appropriate.

All geography and infrastructure must follow the fictional and synthetic-data constraints in [docs/PRODUCT.md](docs/PRODUCT.md).

**Competing hypotheses**

The experience must not push every investigation towards fraud.

Include plausible legitimate explanations, such as call centres or IoT/M2M activity, where supported by the case data.

The interface should make it possible to understand why an explanation is strengthened, weakened or remains inconclusive.

### Act Three — Assessment

The final experience should present an investigative assessment.

Make clear:

- What the evidence establishes.
- What it suggests.
- Which hypotheses remain plausible.
- What was not established.
- What additional evidence would be needed.
- Whether the case ends in a simulated verified finding, an unresolved hypothesis or a legitimate explanation.

Do not turn the final screen into a simplistic fraud score or success animation.

The assessment should feel like the conclusion of a disciplined investigation.

### One continuous experience

The public and analyst experiences should remain one product, with two levels of depth:

- **Guided depth:** A clear, compelling narrative that teaches the user how the investigation develops.
- **Open depth:** The ability to inspect records, indicators, relationships, alternative explanations and evidence provenance.

Both must use the same underlying evidence model.

Do not build these as unrelated applications or duplicate experiences.

Prioritise the core investigative journey over adding unnecessary pages.

---

## 5. Eliminate the generic AI-generated look

Treat the following as quality failures:

- A standard SOC dashboard with a sidebar, header and grid of identical cards.
- A conventional cybersecurity interface with dark backgrounds, neon green text and red threat indicators.
- Purple-blue gradients, glowing accents, blurred backgrounds and excessive glass panels used as shortcuts to make a UI appear premium.
- The same rounded rectangle repeated for every section.
- Overuse of pills, badges, oversized headings, floating decorations and meaningless icons.
- Arbitrary abstract shapes, generic illustrations and decorative network diagrams.
- Fake intelligence feeds, invented incident statistics, fabricated operators and false claims of live activity.
- A map with arbitrary red markers presented as meaningful intelligence.
- Geographical precision unsupported by the underlying data.
- Evidence that appears authoritative without traceable provenance.
- Animation applied everywhere without a clear relationship to user actions.
- A beautiful opening screen followed by unfinished, inconsistent investigation screens.
- Design decisions that look sophisticated in screenshots but make the investigation harder to understand.

Do not deliberately make the interface strange to prove originality.

Make it recognisable through art direction, composition, information hierarchy and quality of execution.

---

## 6. Build stack and architecture

This is a greenfield build, local first, with a future path to Azure Static Web Apps and Functions Flex.

### Proposed stack

- **Frontend:** Vite + TypeScript with no framework (small state, GSAP-friendly).
- **API:** Small Node.js API with plain-function handlers for future Azure Functions Flex migration.
- **Styling:** HTML, CSS and SVG with GSAP animation.
- **Build output:** Compatible with Azure Static Web Apps.
- **Fonts:** Self-hosted open-licence fonts with licence named.

### Approved dependencies

- **GSAP:** core, ScrollTrigger, Flip, SplitText.
- **GSAP optional:** DrawSVG, MorphSVG if justified by the design.
- **Maps:** d3-geo for projection.
- **Scroll:** Lenis for smooth scroll (no scroll-jacking).
- **3D (if needed):** Three.js or OGL only for one justified moment, behind prefers-reduced-motion and a performance budget.
- **Note:** Check gsap.com for current licensing; believed to be free as of 2025, but verify.

### Constraints

0. Fidelity target: build as close to the real telecom model as the research allows. Every record field, fraud mechanism and indicator traces to a cited source in [docs/PRODUCT.md](docs/PRODUCT.md). Where research is silent, label it ASSUMPTION in the provenance layer instead of inventing detail.
1. Do not invent real incidents, operator records, subscriber identities, infrastructure, locations or investigative findings.
2. All case data must follow the synthetic-data requirements in [docs/PRODUCT.md](docs/PRODUCT.md) Part 2.5.
3. Every screen, export and shared visual must clearly communicate that it is simulated.
4. Preserve security, accessibility, maintainability and performance as defined in [docs/PRODUCT.md](docs/PRODUCT.md) Part 13.

### Evidence integrity is an engineering requirement

The evidence model in [docs/PRODUCT.md](docs/PRODUCT.md) is not merely copywriting guidance.

Preserve its logic throughout the implementation.

- Every claim must retain its evidence level.
- Every derived indicator must be reproducible from its source records and stated rule.
- Every correlated claim must identify the evidence sources involved.
- Hypotheses must retain competing explanations.
- Missing evidence must not be silently hidden.
- A finding cannot become verified without the specified simulated ground truth.
- A risk score must not be presented as a probability of fraud.
- Cell association must never be presented as exact device location.
- Synthetic data must never be confused with real telecom intelligence.

Do not weaken these constraints to create a more dramatic visual experience.

The outcome must remain the same product, with a substantially better user experience.

---

## 7. Implementation workflow

### Checkpoint gates

Build in three phases with explicit approval gates.

**Phase A — Decisions document**

Read [docs/PRODUCT.md](docs/PRODUCT.md) completely.

Write a one-page decisions document addressing:

- Creative concept: the central idea and why it fits the investigation.
- Visual direction: colour, typography, composition and distinctive elements.
- Motion contract: which state changes get animation, what each animation names.
- Case structure: which four cases are included, how they differ in outcome.
- Geographic language: how uncertainty and cell associations are shown.
- Evidence-to-claim visual chain: how the five levels are made visible.
- Stack: technology choices, key dependencies, performance budgets.
- Record model decision (U13): open TS 32.260 and TS 32.298 on 3GPP. If readable, use IMS records. If not, keep TS 32.250 MOC fields and label the CS-fallback assumption. Write the choice as settled.
- References: five Awwwards Sites of the Day studied, each with what was taken and what was rejected.
- Scope: V6 and V7 are out of scope. No plain table baseline is built. Record views are designed and typeset, never spreadsheet-style grids.
- Concerns or conflicts with the product spec.

**APPROVAL GATE:** You review and approve the decisions document.

**Phase B — Design system, data layer and vertical slice**

Part 1: design system and data layer.

Establish a compact design system, shown on a static page:

- Brand colours and neutral palette.
- Typography and type scale (self-hosted open-licence fonts, licence named).
- Layout grid, spacing scale and responsive behaviour.
- Surface, border, elevation and radius rules.
- Iconography and imagery treatment.
- Map and geographic visual language.
- Evidence-level visual language.
- Motion principles, easing and transition durations.
- Interactive states and accessibility standards.

Build the seeded, reproducible generator in seed/ with the four cases, and the API with the evidence model: claims with level, sources, alternatives and missing evidence, plus persisted promote/hold/reject judgements with reason and timestamp. Add tests for provenance (V1) and wording (V2).

**APPROVAL GATE 1:** You review and approve the design system and data layer.

Part 2: vertical slice.

Build one complete vertical slice: Act One (Signal) plus the evidence ledger plus the map view for case A, wired to real generated data. Test interactions, navigation and the evidence chain end-to-end. Screenshots at desktop, tablet and mobile.

**APPROVAL GATE 2:** You review and approve the vertical slice.

**Phase C — Full implementation**

Build the remaining acts and cases.

Focus on carrying the same level of craft through all relevant screens and states.

Make the interface feel complete:

- Navigation and progression across all cases.
- Case introduction, evidence inspection and relationships.
- Geographic exploration with uncertainty.
- Hypothesis assessment and alternatives.
- Final conclusions and assessments.
- Loading, error and inconclusive states.
- Responsive layouts.

Ensure the user can understand the investigation without relying on colour, animation or unexplained technical terminology.

### Verification

Run the build and tests. Inspect the interface at desktop, tablet and mobile widths.

Check:

- Typography, alignment, rhythm and spacing.
- Visual consistency across all cases.
- Evidence hierarchy and provenance.
- Whether claims are at the correct evidence level.
- Whether alternative explanations remain visible.
- Geographic accuracy and uncertainty representation.
- Synthetic-data labelling.
- Hover, focus, active, disabled, loading, error and success states.
- Keyboard operation and accessible labels.
- Reduced-motion preferences and fallback readability.
- Small-screen layouts, touch targets and overflow.
- Console errors, broken assets and layout shifts.
- Performance against the budgets in [docs/PRODUCT.md](docs/PRODUCT.md) Part 13.

Validate against the independent criteria in Part 10 of [docs/PRODUCT.md](docs/PRODUCT.md).

Fix issues discovered during verification.

---

## 8. Motion principles

The spec wins on evidence and wording. The brief wins on craft.

### Motion contract

- **Level changes, act transitions and map-uncertainty changes** get full choreography via GSAP.
- **Everything else** is instant and quiet.
- **Every animation must name the thing that changed.** If it cannot, cut it.

### How GSAP serves the evidence model

Immersion has to carry meaning. The strongest ideas are:

1. **A scroll timeline that is the case timeline.** The scroll position maps to the narrative arc: Anomaly → Intelligence → Correlation → Geographic understanding → Investigation → Assessment. GSAP ScrollTrigger pins key moments.

2. **Claims that evolve as they rise in level.** A claim starts as an unfinished dashed outline. When it gains evidence and rises a level, it morphs into a solid, fixed form. GSAP Flip relocates it into the evidence ledger, making the state change physical and clear.

3. **Expected-not-observed shown as absence.** Records that should have arrived but did not are shown as ghosts or transparent outlines. When a new evidence source fills the gap or removes the expectation, the ghost changes state.

4. **Map uncertainty areas morph and tighten.** As each independent evidence source is added, the geographic uncertainty area grows or shrinks, never collapsing to a point. GSAP MorphSVG morphs the area geometry. The final verified finding shows a marked site, not a cell association.

### Reduced motion and accessibility

- Use gsap.matchMedia() with a fully readable, unpinned fallback for all pinned scroll sections.
- Pinned scroll sections must remain legible and navigable without JavaScript animation.
- Every claim level must be visually distinct without relying on colour or motion alone (WCAG 2.2 AA).
- Motion must be removable without destroying the evidence chain.

### Avoid

- Neon and glow, glass panels, gradient washes, decorative particle fields, performing loaders, red-marker maps.
- Animation without informational purpose.
- Scroll-jacking or forced intro sequences.
- Excessive parallax or gratuitous 3D.

### Reference study

If web access is flaky, record the five references studied with one line each on what was taken and what was rejected.

## 9. The acceptance bar

Evaluate the finished result as if it were being reviewed by a demanding creative director, a senior product designer, a telecom fraud specialist and a senior software engineer.

**Design quality:** Does it have a convincing creative concept, exceptional typography, deliberate composition and polished detail? Is the interface recognisably its own?

**Originality:** Is there a distinctive, memorable idea appropriate to SOLID SNAKE, rather than a collection of current design trends?

**Narrative quality:** Does the user understand how the investigation progresses from an anomaly to an assessment?

**Investigative clarity:** Can the user distinguish observed facts, analytical indicators, correlated evidence, hypotheses and verified findings?

**Evidence integrity:** Can claims be traced to their underlying synthetic records and rules? Are contradictions and missing evidence represented honestly?

**Geographic honesty:** Does the map communicate uncertainty correctly? Does it avoid implying exact locations where only cell associations exist?

**Usability:** Can a user follow the investigation, inspect evidence and understand the final assessment without confusion?

**Consistency:** Does the same level of craft extend beyond the opening screen to every relevant page and state?

**Technical integrity:** Does the app build, run locally and stay portable to Static Web Apps and Functions?

**Mobile quality:** Does the layout feel intentionally designed for small screens instead of simply shrinking a desktop composition?

**Performance and accessibility:** Are visual effects proportionate, interactions responsive, and essential functionality available to users with different needs and input methods?

**Credibility:** Would a technically informed telecom professional recognise the underlying concepts as responsibly represented, while understanding that the operation and dataset are fictional?

If the result looks like a competent SOC template with a new colour palette, it has not met the brief.

If it is visually spectacular but misrepresents the evidence, it has not met the brief.

If it tells a compelling story but breaks the actual application, it has not met the brief.

Aim for the intersection of exceptional art direction, original interaction design, investigative clarity and disciplined engineering.

The standard is Awwwards-calibre craftsmanship, applied intelligently to a credible fictional telecom intelligence experience.

---

## 10. Final handover

After each checkpoint gate and at final completion, report:

**After Phase A (Decisions document):**
- Creative direction and what differentiates it.
- Motion contract: which state changes get animation and what each names.
- Case structure and key design decisions.
- Any conflicts with the product spec.

**After Phase B (Vertical slice):**
- Design system: colours, typography, layout, evidence-level visual language.
- One complete vertical slice (Act One, ledger, map for case A).
- Interactive verification: scroll timeline, claim evolution, map morphing.
- Results against the acceptance bar for this slice.

**After Phase C (Full implementation):**
- All four cases and their outcomes.
- How the investigative narrative is represented across all cases.
- How the evidence ledger and evidence hierarchy are implemented.
- How geographic uncertainty is communicated.
- How reduced-motion fallback works without breaking evidence clarity.
- The important files changed.
- Any new dependencies, with licensing verified.
- The build, tests and manual checks completed, including any that could not be run.
- Results against the relevant validation criteria in [docs/PRODUCT.md](docs/PRODUCT.md) Part 10.
- Performance results against budgets in [docs/PRODUCT.md](docs/PRODUCT.md) Part 13.
- Any product assumptions or unresolved decisions (record U13 decision).
- Reference study: five references and what was taken from each.

Be specific about what was implemented and verified.

Do not claim an Awwwards award, real telecom access, real fraud detection capability or test results that were not obtained.

**The governing principle: make the reasoning visible. The experience should make users feel that they are investigating a case, not looking at a dashboard.**