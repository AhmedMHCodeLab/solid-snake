# SOLID SNAKE: Phase A Decisions

Status: approved 2026-11-16, revision 4, stage structure. Revision 2 followed three independent reviews. Revision 3 reworked the plan around [DIRECTION-CHANGE-001.md](DIRECTION-CHANGE-001.md). Revision 4 records the owner's approval of Phase A and replaces the seven-room structure with one persistent map of Qatar carrying seven stages. Nothing is built yet.

Authority: [PRODUCT.md](PRODUCT.md) wins on evidence rules, wording, map rules, boundaries, privacy and validation. DIRECTION-CHANGE-001 wins on look and feel over [DESIGN-BRIEF.md](DESIGN-BRIEF.md). Every decision here was approved by the owner on 2026-11-16 (section 0), with the stage structure overriding any earlier room wording.

Research marks: DOCUMENTED (the source was opened this phase; PRODUCT.md's FACT, RESEARCH and PRACTICE labels still describe the strength of the claim), MEASURED (a command was run), INFERRED (reasoning, no source). Sources are in Appendix A.

## 0. Decisions approved on 2026-11-16

Record of what the owner approved. O1 to O14 and DC-1 to DC-17 are approved as recommended, except where the stage structure overrides them. Phase A is approved; stop planning and build.

Later the same day, during the build, the owner made SOLID SNAKE a platform, not a simulation (DIRECTION-CHANGE-001.md "Platform, not simulation"). Where this document describes a scroll walk, prerendered case pages, a guided depth, or a scripted supervisor (O14), read it as the platform flow: monitor, alert, case workflow released by actions, server-enforced gates, a supervisor who is a second user. Evidence rules, wording, map rules, budgets and the motion contract stand.

| # | Decision | Approved reading | Section |
|---|---|---|---|
| O1 | Case A ground truth wording | Amend Part 12 case A to the Appendix B text (edit 6): calls to domestic subscribers, with the inbound international shortfall on one high-cost route. | 11 (B-02), App. B |
| O2, DC-13 | What "promote / hold / reject" does below level 5 | Reading (a): signatures (analyst promote, supervisor sign-off) exist only at level 5. Below level 5 the visitor may record an assessment (hold or reject, with a reason). It is never called a signature and never produces a referral. Nothing a visitor records moves a level. | 6, 11 |
| O3 | Budgets | Approved: first load under 150 KB gzipped JavaScript, each later stage chunk at most 25 KB, WebGL chunk at most 45 KB, whole walk at most 320 KB, and the paint-timing definition in section 9. | 9 |
| O4 | Look and feel | OWNER-CHANGED: dark by default, a spotlit map with lit areas, paper-and-ink exhibit cards. Light means attention, never certainty; level is always carried by marks. A light alternative is shown beside the dark default on the design-system page; if a light theme reads better in the prototype, the owner is told. | 1, 2 |
| O5 | Qatar and the case grid | OWNER-CHANGED: real Qatar outline from open licensed data (d3-geo); towers, cells and case locations are FICTION and appear only as areas of stated uncertainty, with one exception, the verified-site mark on the fictional case plate (DC-14). | 5 |
| O6 | Timing advance (U12) | Approved: a separate radio-measurement source, ASSUMPTION, case A only. | 5, 8 |
| O7 | Depth and 3D | OWNER-CHANGED: layered depth, light and shadow, a spotlight, and at most one lazy-loaded WebGL moment, decided by looking at a prototype. "None" is allowed. | 2, 3, 9 |
| O8 | PRODUCT.md and CLAUDE.md edits | Approved: the sixteen edits in Appendix B, applied 2026-11-16. | App. B |
| O9 | Phase C approval stop | Approved: the final report is a gate. | 11, 12 |
| O10 | Motion contract | Approved and widened: CLAUDE.md rule 3 and PRODUCT.md Part 8 principle 2 carry the new list (section 3). A creative-bar rule (a current Awwwards Site of the Day for scroll choreography, interaction and typographic finish) was added to CLAUDE.md. | 3, 11 |
| O11 | Gate scope | Approved: Gate 1 and Gate 2 merged into one stop. | 12 |
| O12 | Seventeen points where the direction change or this plan meets PRODUCT.md or the build rules | DC-1 to DC-17 approved as recommended. DC-1 and DC-3 are resolved by the persistent map. DC-18 is added. | 11 |
| O13 | Parallax and WebGL | Parallax is allowed inside stages as well as in transitions, within budget, and is off under reduced motion. The WebGL moment is decided by prototype; "none" is allowed. | 2, 3 |
| O14 | Who gives the supervisor sign-off | A scripted fictional supervisor whose check the visitor watches. | 6 |
| DC-14 | Marks on the map | Reading (a): one verified-site mark on the fictional case plate only. Cell sites are not marked. | 5, 11 |

Structure decision (OWNER, supersedes the seven-room structure of revisions 1 to 3): the app is one persistent, interactive map of Qatar that stays on screen for the whole case. The case is seven stages played on that map. The old rooms map to stages as follows: The Signal is stage 1; The Map and The Evidence Hall merge into stage 2 (the map is always on screen, and the descent from the national plate to the fictional case plate happens in the transition from stage 1 to stage 2); The Rival Room is stage 3; The Test is stage 4; The Sign-off is stage 5; The Referral is stage 6; stage 7, Outcome, is new. See [DIRECTION-CHANGE-001.md](DIRECTION-CHANGE-001.md).

## 1. Creative concept: The Proof Sheet, on one persistent map

The idea is unchanged: a claim is set only as far as its evidence allows. What changes is where it lives. The app is one persistent map of Qatar that stays on screen for the whole case, dark and spotlit. The case is a sequence of seven stages played on that map (section 7). Panels, overlays and camera moves carry each stage. The evidence is on exhibit cards as lit paper-and-ink artefacts: record slips, a ruled time strip, proof sheets with marks in the margin. The museum feel comes from pacing, light, depth and exhibit-style cards, not from walking between rooms.

1. **Central idea.** A record is printed plainly. An indicator carries its measuring rule. A hypothesis is a dashed frame drawn around the evidence it rests on, with its rivals beside it. A verified finding is that frame inked solid and signed.
2. **Why it fits.** A museum already separates the object from the label and the label from the interpretation. That is the evidence model: what was observed, what was derived, what is only proposed.
3. **How it makes reasoning legible.** One stage, one step of the argument. The catalogue stays beside the map throughout as the ledger of everything on show, each entry at a level.
4. **Why it is not a SOC template.** One map, exhibits and light in place of dashboards, widgets and status colours.

Mechanisms, not mood:
- **Light means attention, never certainty.** The spotlight shows what is being examined. Level is carried by marks. A level 1 record and a level 5 finding are lit the same way.
- **Evidence continuity.** Nothing appears from nowhere. Records are ticks on a strip, ticks gather into a measured bar, the bar becomes a catalogue entry, a hypothesis frames the entries it cites.
- **Absence is an exhibit.** The expected inbound lane is drawn as a pale construction lane, the observed traffic is printed over it, and the unprinted gap is bracketed. The same bracket marks every absence, including an empty plate and an unsigned finding.
- **Proof marks.** Countersign and sign-off are written on the sheet as marks with the reason beside them.
- **Type does the setting.** A claim's level line moves from a light weight to its settled weight on the typeface's own axes.
- **The tombstone label is the provenance layer.** Every exhibit carries a museum label: accession number (the record or entry id), medium (the source system), collection point, date window, level, basis. The museum's own convention does the work of V1.
- **Depth carries scale.** The three map scales are three plates stacked in depth. Moving from Qatar to the region to the case plate is a descent through them, and that descent is part of the stage 1 to 2 transition, so the depth move is the named scale change.
- **Outside evidence comes from outside.** In the Test (stage 4), the survey result arrives as an exhibit from the margin of the plate, not from the case's own layers. "Outside the analytic chain" is made literal.
- **Rivals are shapes.** In stage 3 the rival explanations are drawn on the map as dashed shapes showing what each explanation predicts about where activity would be seen (basis ASSUMPTION), bound to their level 4 hypothesis entries. At the Test the surviving one is inked solid and the others dissolve.

Signature moment (OWNER): **the Test (stage 4).** Evidence from outside the analytic chain arrives and a claim rises, holds or falls in full view; the area hardens or dissolves, and a dashed claim is inked solid.

Quality bar: a current Awwwards Site of the Day in scroll choreography, interaction and typographic finish (CLAUDE.md rule 10). Still screenshots of reference sites inform composition and typography only; they are not the measure of motion.

## 2. Visual direction

Dark by default, with a light alternative. The design-system page (`/system`) shows both side by side. Values below are provisional until that page exists. If a light theme reads better in the prototype, the owner is told and both are shown.

**Two material families.**

| Family | Token | Provisional value (dark default) | Use |
|---|---|---|---|
| Ground | Wall | #0F1113 | Map and page ground |
| Ground | Bone | #E9E4D8 | Text on the ground |
| Ground | Dim | #9A968C | Secondary text on the ground, rails |
| Artefact | Paper | #F2EFE8 | Lit sheets and slips |
| Artefact | Plate | #E8E4DA | Map plate ground |
| Artefact | Ink | #15181B | Text and established marks on paper |
| Artefact | Graphite | #4A4F55 | Dashed strokes, secondary text on paper |
| Artefact | Construction blue | #1E3F66 | Derived marks, expected lanes, map construction lines |
| Artefact | Oxide | #8A3A22 | One use: the level 5 sign-off |

**Light rules.**
- The spotlight is the map's light falling on an artefact. No interface element (text, line, icon, mark) is itself a light source. No glowing text, no neon lines, no bloom.
- An unlit artefact is the same sheet at lower lightness with full text contrast kept. It is never blurred or made transparent.
- Shadows are cast shadows of physical artefacts only.
- Still banned: glass, colour gradient washes, particle fields, performing loaders, red markers.

**Depth.** Each stage has three layers: the map, the exhibit cards, and a foreground rail with sheet furniture. Parallax between layers is allowed inside stages and in transitions, within budget, and is off under reduced motion (O13, approved). The scale descent is a named depth move.

**The one WebGL moment.** Not chosen yet. A candidate must pass four tests: it names a state change; it cannot make a claim look more certain than its level; it has a reduced-motion still and a text equivalent; it fits the 45 KB chunk. The moment is decided by looking at a prototype, and "none" is allowed (O13). No WebGL is built in the merged gate (section 12). Candidates so far: (a) the descent through the three stacked plates in the stage 1 to 2 transition, rendered with real depth; (b) the owner's signal rays, drawn as sector fans on the fictional case plate only, never from a point on the real outline. If neither passes, the moment is not built.

**Typography** (self-hosted; licences DOCUMENTED): Newsreader variable (SIL OFL 1.1) for exhibit text and narrative, roman for what is established and italic for hypotheses; IBM Plex Mono 400 and 500 (SIL OFL 1.1) for record values, identifiers and labels. Any value quoted from a record is set in mono inside the serif sentence. Fallback pairing: Fraunces with JetBrains Mono.

**Themes to show.** Dark default and light alternative, both shown on the design-system page.

**Record views.** Never a grid. One record is a typeset slip. Many records are a ruled time strip with the slips as a list behind it; on narrow screens the strip becomes hourly bins.

## 3. Motion contract

The contract is: only level changes, stage transitions (including the scale descent), map changes (uncertainty and scale) and the spotlight moving to a new exhibit animate. Parallax is allowed inside stages and in transitions, within budget, and is off under reduced motion. This widens the earlier CLAUDE.md rule 3 (O10, approved; Appendix B edit 12). Each animation still has a sentence naming what changed, which doubles as the reduced-motion text and the screen-reader announcement.

| Change | Choreography | What it names |
|---|---|---|
| Level rises | The entry's mark gains its next stroke, the level line settles in weight, the entry moves once into its catalogue register. | "A-1 rose from level 2 to level 3: interconnect indicator I-2 added." |
| Level falls | The frame breaks and is struck; "was 4" stays printed. | "H-C1 fell from level 4: registration evidence E4 contradicts it." |
| Stage transition (seven stages, which replace act transitions) | The map camera moves, the overlays of the outgoing stage part at different depths, the next stage's light comes up, its title is set in weight. The stage 1 to 2 transition includes the scale descent from the national plate to the case plate. | "Stage 3: Rivals." |
| Map change: uncertainty or scale | The area polygon interpolates between two generated shapes with the same point count, never to a point. Crossing from one of the three scales to the next is a descent between plates. | "Observation area narrowed: radio measurement E5 added." / "Now viewing: case plate, fictional grid." |
| Spotlight moves | The light crosses to the exhibit now under examination. | "Now examining: exhibit E2, interconnect records." |

Parallax inside a stage stays within the budgets in section 9 and is off under reduced motion.

Everything else is instant: hover, focus, opening a slip, panning and zooming the map by hand within a scale, switching reading depth, recording a sign-off, text updates that do not change a level.

In stage 1 the lit region on the Qatar plate comes up as part of the opening transition. It is lit because the visitor is examining it, and the record window is printed beside it ("72 hours of records, examined after the fact"). It never pulses or arrives like a ping.

**Architecture: two layers** (from a spike this phase, MEASURED: Flip stores document coordinates, so it fails inside a scrubbed timeline; a one-shot Flip from a held scene into a sticky column lands correctly with Lenis running).
- **Geometry layer, scrubbed and reversible.** Scroll drives shapes only: ticks gathering into the bar, the expected lane and its gap, hatch and area growth, stage overlays parting. Plain SVG and layer transforms from data-derived positions.
- **Persisted actions are neither layer.** Signatures, assessment records and the send log are shown only from rows the server has stored, and only from stage 5 on. Scrolling never creates or removes them.
- **State layer, discrete.** Level, catalogue entries and frames are a function of the step reached. A state change plays once, only on a forward arrival with the scene in view. On a jump, a reload or a restored scroll position it sets instantly. Scrolling back restores the earlier state instantly, because a rise played in reverse would look like a fall.

**Rules.**
- Stages are held with scrubbed pinning only: native scroll drives progress one to one, no snapping, no wheel capture, no timed sequence that holds the page, a "next stage" link in each. Reading text stays in the unpinned flow.
- Proposed: one smoother only. Lenis smooths the scroll and scrubbed timelines follow it directly, with the feel judged by hand at the merged gate.
- Transforms go on leaf layers only, never on an ancestor of a held stage or of the ledger (MEASURED: a transformed ancestor breaks pinning).
- No focusable control inside a held scene except "next stage" and the map's own controls. Stages 5 and 6 are never held, because they contain forms.
- Narrow screens: no pins; stages stack, the plate is sticky, the ledger is a bottom bar.
- Reduced motion (`gsap.matchMedia`): no pins, no smoothing, no tweens, no parallax, no WebGL fetch. Every stage is a complete lit still with its catalogue changes written inline.
- Triggered moves last 0.4 s to 1.1 s on one shared easing set, with no overshoot.

## 4. The four cases

On-screen titles are neutral. The catalogue role and ground truth from Part 12 are never shown inside the experience for B and D, because doing so would turn an open case into a conclusion (V4).

| Case | On-screen title | Reaches | Sign-off | Referral |
|---|---|---|---|---|
| A | Unusual outbound voice volume on one cell | Level 5, verified (simulated) | Can be countersigned and signed | Packet assembled and sent up the fictional chain |
| B | Dense SIM group on one cell | Two hypotheses open at level 4. The V4 inconclusive case. | Unsignable; the stage says why | None |
| C | Uniform short calls from one device family | The SIM-box hypothesis falls; a level 4 hypothesis and a level 3 claim remain | Unsignable | None. Ends captioned "Not fraud on this evidence". |
| D | Burst of calls to one high-cost number range | Hypothesis at level 4 | Unsignable | None |

Cases B, C and D end in stage 7 as assessment records with no referral; case A ends signed and referred. Three of four cases end without a referral. That is deliberate: Part 5 says a product in which every case ends in fraud teaches the wrong lesson. Each case has 500 to 2000 records; in case A about 400 belong to the group of interest. V3 runs on B and C.

**Evidence sources.**

| Code | Source | Basis |
|---|---|---|
| E1 | Call records: S-CSCF records, originating and terminating | Field model DOCUMENTED; values FICTION |
| E2 | Interconnect records: IBCF, inbound international sessions per route | Field model DOCUMENTED; that the fictional operator's inbound traffic arrives this way is ASSUMPTION |
| E3 | Device metadata from signalling, never from call records (P2) | Method RESEARCH (NDSS); that the fictional network collects it is ASSUMPTION |
| E4 | Subscriber registration data | ASSUMPTION |
| E5 | Radio measurement: LTE timing advance | ASSUMPTION |
| E6 | Field survey and controlled test call, outside the analytic chain | FICTION, scripted ground truth |
| E7 | Number-range and tariff reference data | FICTION; the need for it is PRACTICE (BICS, via PRODUCT.md 2.2) |

**Independence, stated per pair** (shown on screen with every level 3 claim):

| Pair | Different system | Different method | Different collection point | Shared failure modes |
|---|---|---|---|---|
| E1 and E2 | No, both are charging records | No | Yes: serving node and network border | Mediation outage, clock skew. This pair qualifies on collection point only, the weakest of the three forms PRODUCT.md 2.4 accepts. A-1's level 3 rests on it and says so on screen. |
| E1 and E3 | Yes | Yes: signalling capture | Yes | Subscriber identity mapping |
| E1 and E4 | Yes | Yes: administrative record | Yes | Registration data can be false |
| E1 and E5 | Yes | Yes: radio measurement | Yes | Cell configuration data |
| E1 and E7 | Yes | Yes: reference data | Yes | None in traffic |

The interconnect indicator is computed from E2 against the route's own history, not from E1's called parties. The generator gives each source its own gaps.

**Evidence chains by stage.** An evidence claim (levels 1 to 3) has a fixed subject. A hypothesis (level 4 or 5) is a separate entry citing the claims it rests on. Every rise names what was added.

Case A

| Stage | Entry | Move | Named evidence added | Still open |
|---|---|---|---|---|
| 1 Signal | A-1, voice activity of SIM group G | 1, then 1 to 2 | E1 records; indicator I-1 against baseline B1 for cells of this type | Innocent explanations that produce the same indicator are named in the panel from here on |
| 1 Signal | A-2, where G was observed | Opens at 1 | E1 cell identities fall inside region R. This entry is what the lit region is bound to. | |
| 2 Evidence | A-2 | 1 to 2 to 3 | The descent from the national plate to the case plate. Observation area derived from E1; then the E5 band | Geography stops at level 3 by analysis |
| 2 Evidence | A-1 | 2 to 3 | Indicator I-2 from E2: inbound international volume on route R below R's own baseline | Lacuna: inbound sessions expected on R, not observed |
| 2 Evidence | A-3, devices used by G | 1 | E3: G attaches from few devices in one fingerprint class | Cannot settle device type (P3) |
| 3 Rivals | H-A1, SIM-box operation | Opens at 4 | Cites A-1, A-2 and A-3 | Rivals: call centre using cellular gateways; M2M fleet. Missing: E4, test call |
| 4 Test | H-A1 | 4 to 5 | E6: field survey and test call (simulated). The verified site is marked on the case plate. | Not established: who registered the SIMs |
| 5 Sign-off | H-A1 | Countersign, then supervisor sign-off | | |
| 6 Referral | | Packet assembled and sent (simulated) | | |
| 7 Outcome | | Case A ends signed and referred | | |

The same stage rule holds in cases B, C and D: the first indicator rises in stage 1; device, interconnect and reference evidence (E2, E3, E7) is shown and raises claims in stage 2; hypotheses open in stage 3; whatever returns, or fails to return, does so in stage 4. Stage 7 closes each of B, C and D as an assessment record with no referral.

Case B: B-1 rises 1 to 2 (E1, indicator) and 2 to 3 (E3: the SIMs sit in a few multi-SIM gateway-type devices, ASSUMPTION). H-B1 (SIM-box operation) and H-B2 (call centre using cellular gateways) both open at 4. In the Test, an expectation of H-B1 is not met (no route in E2 shows a shortfall), the group receives calls back (E1 terminating), E4 is requested and never arrives, and no test call returns. Both hold. Nothing can be signed.

Case C: C-1 rises to 3 (E1, indicator, E3: one device family, ASSUMPTION, see N-01). H-C1 (SIM-box operation) opens at 4. In the Test, E4 returns one enterprise M2M contract, indicator I-3 shows a very small called-party set and E2 shows no shortfall. H-C1 falls and is struck. H-C2 (registered M2M fleet) stands at 4, not verified outside the chain.

Case D: D-1 rises 1 to 2 (E1: burst to range token `RANGE-HC-07` against the identity's own history) and 2 to 3 (E7: a high-tariff revenue-share range). No location field is present, so the map stays unlit with a lacuna bracket. H-D1 (revenue-share abuse through a compromised PBX) opens at 4 with rivals (a legitimate campaign, a misconfigured dialler). In the Test, PBX logs and partner settlement data do not arrive. It holds. The outbound interconnect record of the same calls is not used as a second source: it is a second view of one event.

**Ground truth** lives in the published seed. The walk reveals it only where the story does: case A's survey and case C's registration evidence.

## 5. Map language

- **National plate (OWNER).** A real, recognisable Qatar outline: Natural Earth 1:10m, public domain (DOCUMENTED; MEASURED: 241 points, 1.2 KB gzipped as a path). No tiles, roads, place names or real infrastructure.
- **Three scales.** Qatar, then a broad region, then the case plate. The region is an area tens of kilometres across. The case plate is a fictional local grid in kilometres that says: "Positions on this plate are fictional and do not correspond to real places." The seed stores only the region and plate-local offsets, so nothing fictional can be resolved to real ground more finely than the region.
- **What each scale may carry.** The Qatar and region scales carry the region outline and nothing else: no sectors, no site marks, nothing drawn from a point. Sectors, bands, rival shapes and the verified site exist only on the fictional case plate. The recipient rail of stage 6 sits in the plate margin, not on the map ground.
- **The Signal is an area.** The "light appearing on the Qatar plate" in stage 1 is the broad region lit and hatched, bound to entry A-2 at level 1. It is never a point (V5). In case D no record carries a location, so the stage 1 plate stays unlit with a lacuna bracket.
- **Interactive (OWNER).** Free pan and zoom by pointer, touch and keyboard within each scale, with a floor: zoom never goes finer than the smallest uncertainty area on show. Selecting an area lists the evidence that supports it and its level. There is no coordinate readout. A list of the selectable areas mirrors the plate for keyboard and screen-reader use.
- **What is drawn.**

| Object | Drawn as | Label carries |
|---|---|---|
| Cell site | Not marked. It is only the apex of its hatched sector, on the case plate. | "Fictional site" in the sector's label |
| Cell association | Hatched sector with a dashed outer limit | "Cell association, not a position"; "sector shape and range are ASSUMPTION"; supplier and moment; level |
| Observation area | Union of sectors, hatched | Derivation and record count |
| Suspected activity cluster | Region outline; the count sits in the label, not inside the region | Level of its entry |
| Radio-measurement band | Arc band inside a sector, with a minimum drawn width | "Distance from the antenna, N steps plus stated error. ASSUMPTION: modelled source." |
| Verified site | Solid survey mark in ink, on the fictional case plate only (the PRODUCT.md reading; DC-14 gives the alternative) | "Verified (simulated)" |
| No location evidence | Empty plate with a lacuna bracket | "No geographic claim available" |
| Rival explanation (stage 3) | Dashed shape showing what the explanation predicts about where activity would be seen, on the fictional case plate | "Prediction basis: ASSUMPTION"; the level 4 hypothesis entry it is bound to. At the Test the surviving shape is inked solid and the others dissolve. |
| Seal (stage 5) | Bound to the sealed area, not placed as a point | The signed entry and "Verified (simulated)" |
| Referral path (stage 6) | A path from the case region to a rail of recipient roles in the plate margin, so no fictional desk is placed on real ground (DC-18) | Each recipient role, marked "(fictional)" |

- **Supplier and moment.** In IMS records the location is captured at answer and may be network-provided or device-reported (DOCUMENTED: TS 32.260 clause 5.1.9, TS 24.229 clause 7.2A.4). Device-reported is drawn lighter and worded "the device reported cell X".
- **Timing advance.** Case A's cells are LTE. One step is about 78 m of distance from the antenna (INFERRED arithmetic from TS 36.213 clause 4.2.3 and TS 36.211). The band is several steps wide with a stated error margin.
- Every geometry is bound to a catalogue entry and shows its level. Every plate carries "SIMULATED". Uncertainty is line hatching, never a gradient. Light on the plate shows which area is being examined, not how sure the claim is.

## 6. The five levels made visible

Every entry shows its level three ways: a numeral, the level name in words, and a mark. The marks are cumulative strokes on the paper artefact.

| Level | Name | Mark | Text |
|---|---|---|---|
| 1 | Observed fact | A corner tick with the record id | Record values in mono |
| 2 | Analytical indicator | The tick extends into a graduated measuring rule; baseline stated | Roman |
| 3 | Correlated evidence | A second rule tied to the first, each end naming its source and the independence statement | Roman |
| 4 | Investigative hypothesis | A dashed frame around the entries it cites, open where rivals hang | Italic |
| 5 | Verified finding | The same frame inked solid; signature lines appear | Roman |
| n/a | Expected, not observed | Square brackets around an empty hatched slot | What was expected, from which system |

Other states: fallen ("was 4" stays printed), struck by evidence, awaiting evidence, unsignable.

**Claim identity.** An evidence claim has a fixed subject and a version per level. Each version holds one level, its template wording, and the evidence and rule that produced it. A hypothesis is its own entry with links to the claims it cites. V1 traces every version to record ids and a rule.

**Two vocabularies.** "Level" (1 to 5) applies to claims. "Basis" (FACT, RESEARCH, PRACTICE, ASSUMPTION, FICTION, PROPOSAL) applies to rules, fields, mechanisms, recipients and roles, and appears in the provenance layer.

**Sign-off (O2, O14, with the OWNER's stage 5).**
- Levels are computed from attached evidence and nothing else. Nothing a visitor records moves a level.
- All judgement is recorded in stage 5. This is narrower than the earlier reading of PRODUCT.md Part 8 principle 7, which asked for judgement through the case; it follows from the owner's stage structure and is now stated in principle 7 itself (DC-13, Appendix B edit 13).
- **Signatures exist only at level 5.** Step one, analyst countersign: promote. Step two, supervisor sign-off. Neither is offered or accepted for an entry below level 5.
- **Below level 5 the stage offers an assessment record, not a signature.** Hold or reject, with a reason. It is labelled "assessment, not a sign-off". The stage states in words why nothing can be signed: the level each open entry holds and the evidence each one lacks. Where two hypotheses are open, as in case B, both are listed with equal weight and neither is called the finding.
- **Reasons are chosen, not typed.** Each entry carries a short list of prepared reasons drawn from the case data (for example "registration data never arrived"). There is no free-text field anywhere in the sign-off or referral, so visitor text cannot reach the packet or another visitor's screen. Free text was considered and cut for that reason.
- **Supervisor (O14).** Recommended: a scripted fictional supervisor, basis FICTION, whose check runs in view: the entry is at level 5, an analyst promote with a reason exists, and the packet's "not established" list is complete. It signs or returns the case with the failed check named. Alternative: the visitor takes both roles.
- **State.** Rows are stored per anonymous browser id. The latest row per entry and role counts. A later analyst reject withdraws a promote and with it the supervisor sign-off. A referral already sent stays in the log as sent, with the withdrawal logged after it.
- **Server rule.** The server checks the entry's level in the case data, the order of rows and the reason code. It checks the final level only: it does not track which stage a visitor has reached. The interface offers signing only in stage 5.

**Referral (OWNER's stage 6).**
- Exists only when the entry is at level 5, the latest analyst row is promote and the latest supervisor row is sign-off.
- The packet is built only from templated fields of the case data, the signature rows with their reason codes, and the role registry. It holds: the assessment captions with the entries they are bound to, the evidence list with levels, assumptions with their basis, what was expected and not observed, what was not established, the two signatures. Indicators are worded "above the baseline stated in the simulation", with no numbers. It holds no thresholds, no personal names, no contact details and no legal statement.
- It is one self-contained HTML file named `SIMULATED-referral-case-a.html`, stamped SIMULATED in every section, with no scripts, no external addresses and no mail links, generated by a plain API handler so tests can read it.
- The chain uses the owner's four recipients as role titles: unit lead, agency head, regulator desk, law-enforcement desk. Each comes from a fixed registry with basis FICTION and the visible suffix "(fictional)". None is given an organisation name, a person's name, an address or a number.
- "Sending" appends rows to a local send log shown in the stage. No network request leaves the app. The packet travels as a path on the map to the rail of recipient roles (section 5).

**Outcome (OWNER's stage 7).** Case A ends signed and referred. B, C and D end as assessment records with no referral; the closing page lists what was established, what was suggested and what was not established, and for C is captioned "Not fraud on this evidence".

**Depth of reading.** One walk, one data model. Guided depth shows exhibit text and catalogue. Open depth unfolds each exhibit to its records, rule, baseline and basis. Guided is primary (U10).

**Wording.** Claim text is generated from level templates taken from Part 2.4. The V2 test fails the build if "confirmed", "fraudster", "caught" or "perpetrator" appears below level 5, or if any statement lacks a level. Captions are headings bound to entries. Interface copy says "support or refute".

**Accessibility.** One polite live region fed only by state changes. A "jump to catalogue" skip link and a stage list. Marks are exposed as text. The map and the sign-off have full keyboard and screen-reader paths. Record ticks are not tab stops; the slip list is the accessible path.

## 7. Stages and screens

One continuous scroll-and-click walk per case (OWNER), played as seven stages on one persistent map of Qatar. The map is not a stage: it stays on screen for the whole case, and panels, overlays and camera moves carry each stage. The catalogue (the evidence ledger) is likewise present in every stage, beside the map, as PRODUCT.md Part 6 requires.

| Stage | PRODUCT.md arc step | Act | What is on show |
|---|---|---|---|
| 1 Signal (trigger) | Anomaly, and the naming of lookalikes from Intelligence | One | A light appears over a region of Qatar. The anomaly and its baseline. The innocent explanations that produce the same pattern, named beside it. The region the records fall in, lit on the Qatar plate (unlit with a bracket when no record carries a location). The statement that detection is after the fact (P4). |
| 2 Evidence | Intelligence, Correlation, Geographic understanding | Two | The scale descent from the national plate to the fictional case plate, as the 1 to 2 transition. Records and device metadata appear as exhibit cards; record slips and the time strip, the interconnect absence, device metadata. The uncertain area tightens or widens as each is added. Each exhibit shows source, level and what is expected but not observed. Pan, zoom and select show the evidence that supports an area. |
| 3 Rivals | Investigation | Two | Competing explanations (SIM box, call centre, IoT fleet) as dashed shapes on the map and as side-by-side cards, each with what would support or refute it. |
| 4 Test (validity) | Investigation into Assessment | Two | Outside evidence arrives; a claim rises, holds or falls. The area hardens or dissolves; a dashed claim is inked solid. |
| 5 Sign-off | Assessment | Three | Analyst countersign, then the scripted fictional supervisor, with the check on view. A seal appears on the map, bound to the sealed area. Only level 5 can be signed; otherwise every open entry is listed with what it lacks, and an assessment record may be made. |
| 6 Referral (simulated) | none; new | Three | The packet travels as a path on the map from the case to the fictional chain (unit lead, agency head, regulator and law-enforcement desks), shown as a rail of recipient roles in the plate margin. The packet download stamped SIMULATED and the in-app send log. Nothing leaves the app. |
| 7 Outcome | Assessment | Three | The closing assessment page. Case A ends signed and referred. B, C and D end as assessment records with no referral. |

Pages: opening and case index (`/`); case walk (`/case/a/` to `/case/d/`); About and provenance, carrying the exact line "A telecom fraud intelligence platform built from published research. This demo runs on synthetic data and is not connected to any operator. Not yet reviewed by telecom practitioners."; design system (`/system`), static, for the merged gate.

Layout: the map fills the screen and stays on it. The catalogue is a side rail from 820 px up and a bottom bar that opens to a modal sheet below that. The bar always shows the count of "expected, not observed" items.

States: loading (static text, no performing loader), API error, empty catalogue, no geographic claim, unsignable finding, no referral.

## 8. Record model (U13): SETTLED on IMS records

**Decision.** Synthetic call records follow the S-CSCF CDR in 3GPP TS 32.260 Table 6.1.3.3.1, with field definitions from TS 32.298 clause 5.1.3.1, Release 19. Records are generated in both roles (Role of Node originating and terminating) for the SIMs in a case.

**Evidence.** Both specifications were opened from ETSI and read this phase (DOCUMENTED). TS 32.250 V19.0.0 was also opened (DOCUMENTED): its mobile-originated record has 2G and 3G columns only and is produced in the MSC. So it cannot describe a VoLTE call in the fiction's 4G and 5G network (INFERRED from those two points).

**Field subset.** Field names and categories are DOCUMENTED. Every value is FICTION. Every generation rule is ASSUMPTION unless a source is named in the seed. Categories: M always present; OM present if the operator enables it; OC present when conditions are met and enabled.

| Story concept | Field | Cat. |
|---|---|---|
| Record type | Record Type = sCSCFRecord | M |
| Leg | Role of Node | OM |
| Recording node | Node Address | OM |
| Call identity | Session ID; IMS Charging Identifier | OM |
| Missing-record check | Local Record Sequence Number | OM |
| Caller | List Of Calling Party Address; List of Subscription Id | OM |
| Called (dialled) | Requested Party Address | OC |
| Called (routed) | Called Party Address | OM |
| Setup requested | Service Request Time Stamp | OM |
| Answer | Service Delivery Start Time Stamp | OM |
| Release | Service Delivery End Time Stamp | OC |
| Outcome | Cause For Record Closing; Service Reason Return Code | OM |
| Location (network) | User Location Info | OC |
| Location (as carried) | Access Network Information | OC |
| Handset | Subscriber Equipment Number; Instance Id | OC |
| Networks | Originating IOI; Terminating IOI | OC |

Supporting record (DOCUMENTED): the IBCF CDR, TS 32.260 Table 6.1.3.10.1, with NNI Information and Session Direction.

**What changes against PRODUCT.md's CS wording** (each point DOCUMENTED from TS 32.260, TS 32.298 or TS 32.250 unless it is a scope decision):
- No dedicated IMSI field. List of Subscription Id can carry one; the fiction uses SIP identities.
- No duration field. Duration is a derived field (End minus Start), shown with its rule and printed "not computable" when the release time is absent. It is not a level 2 claim.
- Location and handset identity are optional, and location is captured at answer with a stated supplier.
- "Seizure" has no equivalent; the nearest is the request time.
- Scope: answered sessions only. Unanswered attempts are a different record (Event CDR) and are not generated, so attempt-based indicators are out of scope. Per-SIM inbound traffic is in scope through the terminating records.

**Identifiers** (Part 2.5):
- Network identity MCC 999 with a two-digit MNC. TS 23.501 clause 5.30.2.1 describes MCC 999 as assigned by ITU for private networks (DOCUMENTED). ITU-T E.212 could not be opened, so the ITU side is INFERRED. Qatar's real codes are never used. 999 is also in use as an emergency number (INFERRED, not sourced this phase), so it appears only inside cell identity fields in open depth.
- Subscribers and destinations are SIP identities on `.invalid`. Number ranges are symbolic tokens such as `RANGE-HC-07`, with a fictional tariff table.
- Handset identity is a token that deliberately breaks the IMEI digit format, such as `SYN-EQ-A-000042`, where the family segment is ASSUMPTION.
- Every generated file and every record carries `simulated: true`.

**Related items settled here as proposals.**
- U6 (DOCUMENTED): the official TS 32.250 clause for the mobile-originated record matches the mirror text PRODUCT.md quoted on the location wording, the conditional IMEI and the mandatory fields. The register should cite the ETSI document.
- U8: each expectation is its own object: what was expected, from which system, by which rule (ASSUMPTION), the window, its state (not observed, observed, withdrawn) and the entries it limits.
- U12: timing advance appears in no charging record (DOCUMENTED by text search of TS 32.240, 32.250, 32.260, 32.275, 32.298). It is source E5.

**Alternatives and what would reopen this.** The TS 32.250 fallback misdescribes the stated network. The MMTel application-server record and the 5G converged-charging record are possible later additions. Reconsider if the fiction keeps a circuit-switched fallback, or if a reviewer shows that converged charging replaces the S-CSCF record in such a network.

**Not verified.** Categories were read from text extracted from the PDFs, not from page images. Other TS 32.260 tables and the Event CDR contents were not read. That an enterprise PBX trunk produces S-CSCF records (case D) is INFERRED; TS 24.525 was not opened.

## 9. Stack, data model and budgets

Stack as Part 13: Vite and TypeScript with no framework, multi-page build, GSAP, Lenis, d3-geo, small Node API.

| Dependency | Version | Licence (DOCUMENTED) | Gzipped (MEASURED) |
|---|---|---|---|
| GSAP core | 3.15.1 | Standard "No Charge" GSAP License; plugins ship in the public npm package | 27.8 KB |
| ScrollTrigger | | same | +17.5 KB |
| Flip | | same | +8.8 KB |
| Lenis | 1.3.27 | MIT | 5.4 KB |
| OGL (the one WebGL moment) | 1.0.11 | Unlicense | 12.7 KB, in its own lazy chunk |
| d3-geo | 3.1.2 | ISC | 0 at runtime (build-time only) |
| Natural Earth outline | n/a | Public domain | 1.2 KB of path data |

Not used: SplitText (listed in Part 13; the weight-axis setting replaces it), MorphSVG, DrawSVG, Three.js. Map pan and zoom is a small hand-written viewBox control, so no zoom library is added. GSAP licence condition (DOCUMENTED, clause III.3): do not strip its notices.

**Loading.** First load is the shell, the map, the catalogue and stage 1. Stages 2 to 7 load as stage chunks as the visitor approaches. The WebGL chunk, if one is decided, loads only at the stage its moment belongs to and never under reduced motion. All seven stages are in the prerendered HTML as readable stills, in order, before any script runs. A reader without scripts meets the Test's result where the story reaches it, in stage 4. The hidden ground truth of cases B and D is in neither the HTML nor any API response.

**Budgets (O3, approved 2026-11-16).**

| Budget | Value | Source |
|---|---|---|
| First-load JavaScript (shell, map, catalogue, stage 1) | under 150 KB gzipped | OWNER; Part 13 |
| Each later stage chunk | at most 25 KB gzipped | Approved |
| WebGL chunk | at most 45 KB gzipped | Approved |
| All JavaScript for a full walk | at most 320 KB gzipped. This cap binds: the per-chunk ceilings add up to 345 KB, so not every chunk may reach its ceiling. | Approved |
| First paint | Largest Contentful Paint under 2.0 s at 1.6 Mbps down, 750 Kbps up, 150 ms latency, 4x CPU slowdown; the LCP element is static text in the HTML | Approved reading of "first meaningful paint under 2 s on 4G"; that the older metric is no longer reported is INFERRED |
| Responsiveness | Interaction to Next Paint under 200 ms | Approved |
| Missing evidence for case A | under 3 clicks and under 8 s of reading | Part 13 |
| Fonts | at most 200 KB of woff2, at most 100 KB preloaded | Approved. Newsreader with optical size is 129 KB before subsetting (MEASURED), so it is subset at build. |
| Case summary payload | at most 40 KB gzipped; full records on demand | Approved |
| Layout shift, console | under 0.1; no errors | Approved |

**Prerender.** Each case walk is generated at build time as real HTML from the same case JSON the tests read. Scripts enhance it. A parity test checks that the reduced-motion text equals the animated end state.

**Case data model** (one JSON per case, produced by the generator):
- `records`: E1 and E2 records with ids.
- `sources`: E1 to E7 with basis and the independence statements.
- `claims`: evidence claims with versions (level, wording, evidence ids, rule id, stage).
- `hypotheses`: entries citing claims, with rivals, tests, and state (open, fallen, verified).
- `expectations`: the "expected, not observed" objects.
- `mapStates`: polygons per step with the entry each is bound to.
- `steps`: the ordered steps of the walk, each carrying a stage (1 to 7). There is no `rooms` field.
- `signoff`: which entry, if any, is signable; the worded reason when none is; the prepared reason codes per entry; the scripted supervisor's checks.
- `referral`: the packet template with an allowlist of fields, and the recipient chain drawn from a fixed registry of fictional roles.
- `groundTruth`: kept apart and served only where the story reveals it.

**API.** Handlers are plain functions `(req) => { status, body }` with no HTTP or Azure types. One route table feeds a local `node:http` server and, later, a thin Azure Functions v4 adapter. The local shape ran in a prototype (MEASURED); the Azure adapter was written but not executed. Routes live under `/api` in development too.

| Endpoint | Rule enforced on the server |
|---|---|
| List cases; get one case; get records behind a claim | The `groundTruth` object is never in a response. Evidence the story reveals (E6, E4) is ordinary case data in its stage. |
| Append and list sign-off and assessment rows | Promote and supervisor sign-off are refused unless the entry is at level 5. Supervisor sign-off is refused without a current analyst promote. Hold and reject are stored as assessment rows, never as signatures. The reason must be one of the entry's prepared codes. Listing returns only the caller's own rows. |
| Create referral; get the packet file; list the send log | Refused unless the three referral conditions in section 6 hold. Recipients come only from the fictional registry. |

**Persistence and the trust boundary.** Rows append to local NDJSON files with case, entry, kind (signature or assessment), role, action, reason code, timestamp, an anonymous random per-browser id and `simulated: true`. The latest row per entry and role counts. Endpoints accept only known ids, actions and reason codes. No endpoint accepts free text. The packet is escaped on output. Azure mapping is Table Storage (INFERRED; infrastructure task).

**Generator.** TypeScript in `server/seed/`, a small seeded PRNG, stable key order and fixed-precision numbers. It writes one JSON per case and a manifest with the seed and a content hash.

**Tests.**

| Test | Fails if |
|---|---|
| V1 provenance | Any claim version lacks record ids or a rule |
| V2 wording | A reserved word appears below level 5, or a statement lacks a level |
| Reproducibility | Regenerating with the same seed changes the hash |
| Unsignable below 5 (OWNER) | For any entry below level 5 in any case, a signature row can be created by any call, or the refusal carries no reason. Also fails if the copy of stages 5 to 7 uses "sign" for an assessment record. |
| Sign-off order | Supervisor sign-off succeeds without a current analyst promote |
| Levels are untouched | For every case and entry, the levels in the case response differ before and after any sequence of sign-off, assessment and referral calls |
| Referral gating | A referral exists for any entry unless it is at level 5, its latest analyst row is promote and its latest supervisor row is sign-off |
| Referral recipients (OWNER) | Any recipient in a packet or send-log row is missing from the fictional registry, lacks basis FICTION or lacks the visible "(fictional)" label; or the packet text matches a list of real operator, regulator and agency names |
| Hostile input | Posting an unknown reason code, a script tag, an address or any extra field is accepted, or any of it appears in a later response or packet |
| Packet content | A packet field is outside the allowlist; any section lacks the SIMULATED stamp; the text contains an email, a web address, a phone-number shape, a script or a numeric baseline; V1 or V2 fails when run over the packet text and over the copy of stages 5 to 7 |
| Browser (merged gate on) | Playwright with axe at 1440, 820 and 390 widths and several scroll states: reduced motion, keyboard, layout shift, console, the four ways of arriving at a step, a held stage sitting where it should |

MEASURED: a Playwright and axe smoke run passed on this machine.

**Flags for the infrastructure task, not acted on.** No Microsoft page opened confirms that a Flex Consumption function app can be linked as a Static Web Apps backend; bring-your-own functions need the Standard plan (DOCUMENTED: Static Web Apps documentation).

## 10. Reference study

Five Awwwards Sites of the Day. Award status was read on each site's Awwwards page (DOCUMENTED). Each live site was opened in a real browser on 2026-11-16 at 1440 by 900 and inspected as still screenshots at three scroll positions.

| Site (award date) | What was seen | Taken | Rejected |
|---|---|---|---|
| Mosby's Files, Tubik (13 Aug 2026) | Dark ground, stacked file-folder tabs as an index, a mono classification label on each band, north arrows and a scale bar as footer furniture | Sheet furniture as identity; an index organised by classification; paper-like objects on a dark ground | Saturated primary colour fields, including a full red ground; colour as the only category carrier |
| AI in Design Report 2026, ++hellohello (26 Aug 2026) | Hairline rule, small mono label, one large statement; method stated before findings | The rule, label, statement rhythm for wall text; provenance before findings | The blurred collage hero; statistic counters |
| Lidar Drone Scanning, Riotters (6 Oct 2026) | Hairline cells, bracketed mono labels, a value printed with its tolerance, a thin ticked arc, a lit 3D object as the centre of the page | A number always printed with its tolerance; ticked arcs as instrument language; one lit object carrying a scene | A 3D object that is only a product shot; a spinner-like centre mark |
| Creative Reference Library, Bimo Tri and Josh Bendall (10 Nov 2026) | Two tones, numbered paragraphs, holdings counts | Counts as a holdings index (the catalogue counts by level); numbered passages | Body text laid over large shapes at the cost of legibility; the intro loader listed on its Awwwards page |
| Signal-A Studio (18 Oct 2026) | Six-column navigation on hairlines, cases coded with fixed field names, two type voices in one sentence | Case codes with fixed fields; two voices in one sentence (ours: mono record values inside serif prose) | Forced-justified capitals; the hover text scramble listed on its Awwwards page |

Limits: stills cannot show scroll choreography or interaction feel. None of the five is a walk-through gallery, a geospatial piece or a scroll-driven data story, so none of them sets the bar for the new direction. By the owner's direction the references informed composition, typography and structure only, and the bar is the Site of the Day standard itself. The design-system page, with the dark default beside the light alternative, is where the look gets judged. Not usable (MEASURED): Grids by Obys returned HTTP 403; Clouds Over Cuba (2012) no longer resolves. PeachWeb was not studied.

## 11. Conflicts

CL = CLAUDE.md, PR = PRODUCT.md, DB = DESIGN-BRIEF.md, OP = OPERATING-PROMPT.md, DC = DIRECTION-CHANGE-001.md. "Proposed" is a recommendation, not a silent resolution.

**Raised by DIRECTION-CHANGE-001 against PRODUCT.md and the build rules (O12, approved as recommended except where the stage structure overrides)**

| ID | Conflict | Approved reading |
|---|---|---|
| DC-1 | As first raised against the seven-room structure: rooms are places. PR Preface P8 and Part 4 replaced a four-place structure with three acts and one ledger because "separate places invite browsing, and browsing invites the dashboard behaviour". PR Part 6 also calls act two "one investigation with no section walls". | RESOLVED by the persistent map (2026-11-16). There are no rooms and no section walls: the case is seven stages on one persistent map, an ordered walk mapped onto the three acts (section 7). There is nothing to browse; the stage list is a progress rail. |
| DC-2 | As first raised, the room order put the Map second. PR Part 5 puts geographic understanding after correlation, and its Intelligence step requires lookalikes, "including the innocent ones", to be named at level 2. In the owner's order rivals first appear in stage 3. | Follow the owner's order. The innocent explanations are named from stage 1. The map is always on screen and shows only what records and radio measurement support at that point. |
| DC-3 | As first raised: "each room is one stage and nothing else" against a ledger "present throughout" (PR Part 6); against a verified site that reaches the map only after the Test; and against the geographic claim rising to level 3 inside the Map room when radio measurement is added. | RESOLVED by the persistent map (2026-11-16). The catalogue and the map both stay throughout. The verified site is marked on the case plate in stage 4, as that stage's result. The geographic claim may rise in stage 2 as radio measurement is added. |
| DC-4 | Spotlight, light and shadow against "neon and glow ... gradient washes" in PR Part 8 (L248), DB section 8 and OP section 7 ("No glow, glass, gradient washes"). A light pool is technically a gradient. | Section 2 light rules: artefacts receive light, nothing emits it, shadows are cast by objects. The PR and OP wording should be amended to say so. |
| DC-5 | Parallax, a moving spotlight, map scale changes and stage transitions against CL rule 3 ("Only level changes, act transitions and map-uncertainty changes animate") and PR Part 8 principle 2. DC itself also says the motion contract still applies. | The widened contract in section 3 (O10, approved). Parallax is allowed inside stages and in transitions, within budget, and is off under reduced motion (O13); every animation names what changed. CL rule 3 and PR Part 8 principle 2 are edited (Appendix B edit 12). |
| DC-6 | "A light appearing on the Qatar plate" and "signal rays" against PR Part 7 (never a point; never real infrastructure) and V5. Rays imply tower positions and coverage. | The light is a lit, hatched region. Rays, if used, are sector fans from hatched areas with stated assumptions. The alternative WebGL moment in section 2 avoids the issue. |
| DC-7 | A referral to a "regulator and law-enforcement desk" against PR Part 1 (not a representation of a real Qatari agency or regulator; not a system that declares guilt), Part 3 (which bodies act, and with what powers, is not established), Part 9 (no regulator imitated; no legal statement) and DB section 1 (not an enforcement system). | The owner's four recipients are kept as bare role titles marked "(fictional)": unit lead, agency head, regulator desk, law-enforcement desk. No organisation is named or invented for them. The packet states findings and limits, names no person, cites no law and uses "referred for consideration". The stage says the chain is invented and that who would act in reality is not established. |
| DC-8 | "Every recipient, name and number is FICTION" against PR 2.5, which avoids realistic identifiers because they may belong to a real person. | No personal names or contact numbers at all. Roles only. |
| DC-9 | The 150 KB budget "applies to the first load only" against PR Part 13, which excludes only the one 3D chunk. | Owner's call, recorded. Section 9 adds per-stage and whole-walk budgets so the total stays bounded. |
| DC-10 | Free pan and zoom against V5, which inspects "every map state". | Pan and zoom are free within a scale, with a floor. V5 inspects the drawn geometries per step and scale, which stay a finite set whatever the viewport shows. |
| DC-11 | A downloadable packet is an export; an earlier revision of this document built none. PR Part 9 requires exports to be marked simulated and the public layer to omit thresholds. | Stamped in every section and in the file name; no thresholds; tested. |
| DC-12 | DC's Rival Room wording "confirm or refute" against the reserved word list. | Interface copy says "support or refute". |
| DC-13 | DC: "Findings below level 5 cannot be signed." PR Part 8 principle 7 asks for a promote, hold or reject judgement with a reason; PR Part 3 counts "a documented decision that the evidence does not support a conclusion" as success; OP puts persisted judgements in Gate 1. Read literally, DC leaves cases B, C and D with nothing recordable. DC also places judgement in the sign-off stage only, where PR has it through the case. | Reading (a), approved (O2): signatures (promote, supervisor sign-off) exist only at level 5; below it the visitor may record an assessment (hold or reject) that is never called a signature and never produces a referral. Reading (b), not chosen: nothing is recordable below level 5. |
| DC-14 | DC: cell sites and case locations are "shown only as areas of stated uncertainty". PR Part 7 allows "a marked site, labelled fictional" and, at level 5, "a place, labelled verified (simulated)"; DB says the verified finding "shows a marked site". | Reading (a), approved: one verified-site mark exists, on the fictional case plate only; cell sites are not marked. Reading (b), not chosen: the verified site is also drawn as a small stated-uncertainty area. |
| DC-15 | PR Part 9: "No real Qatar incident ... is invented." The fictional case now sits in a real, recognisable region of Qatar. | Settled by the owner in DC. The region is deliberately broad, every plate says the case is invented, and nothing finer than the region maps to real ground. |
| DC-16 | DC: "every recipient, name and number is FICTION." MCC 999 is a real ITU allocation for private networks. | It is used because it belongs to no public operator. It is shown only in open depth and labelled as a private-network code. |
| DC-17 | PR Part 13 lists SplitText among the stack; this plan does not use it. | Unused, not removed from the approved list. |
| DC-18 | Stage 6 sends the packet as a path on the map to the chain (unit lead, agency head, regulator and law-enforcement desks). A path ending at a desk drawn on the map would place a fictional desk on real Qatari ground, against PR Part 9 ("No real Qatar incident, operator, regulator, infrastructure or integration is invented or imitated") and V5. | The referral path runs from the case region to a rail of recipient roles in the plate margin, so no fictional desk is placed on real ground. Each role carries "(fictional)". |

**Between the original source files: blocking**

| ID | Conflict | Proposed |
|---|---|---|
| B-01 | PR Part 7 sets a 4G and 5G network (L223); PR 2.2, 2.3, 2.5 specify CS records (L76, L90, L124). | IMS records. Appendix B edits 1, 4, 5. |
| B-02 | PR Part 12 case A "mostly to one high-cost destination" (L305) against P6 "places local calls" (L40); it also matches the IRSF indicator (L77). | Appendix B edit 6 (O1). |
| B-03 | PR 2.4 rule 1 (L111) against "promote" as a user judgement (PR L246, DB L433). | A signature that never moves a level (O2). |

**Between the original source files: material**

| ID | Conflict | Proposed |
|---|---|---|
| R-01 | PR text reads CS records as settled although U13 is conditional. | Same edits as B-01. |
| R-02 | PR labels TS 32.250 content FACT though it came from a mirror (L345). | Now checked against ETSI; update the register. |
| N-01 | PR 2.2 says "NDSS confirms IoT devices can share fingerprints with SIM boxes". The whole paper was read this phase (DOCUMENTED, 18 of 18 pages, text layer). It measures a collision between two SIM boxes, says IoT fingerprints "may not be unique", and designs its access control around an IoT device and a SIM box sharing one. It names no measured IoT to SIM box collision. | Reword to "argues" (Appendix B edits 2, 3). Case C's shared device family stays ASSUMPTION. |
| N-02 | PR 2.2 lists seizure, answer and release times as if always present; they are conditional in CS, and the IMS release time is optional. | Section 8. |
| M-05 | U4 and OP L86 settle "fictional cells on top" of the Natural Earth outline; a verified site at real coordinates could be read as a real place. | Settled by the owner in DC: fictional case plate linked by a broad region. |
| V-01 | DB L145 permits glass and transparency; PR L248, DB L518 and OP L88 ban glass. | No glass. Shadows now allowed as cast shadows only (DC-4). |
| V-02 | PR prefers OGL (L337); DB and OP list Three.js or OGL. | OGL, one moment (OWNER). |
| V-03 | CL L15 allows three animated categories; DB L155, L157, L505 also list hypothesis support, recording an assessment and ghost changes. | Those animate only as part of a level change. See DC-5. |
| V-04 | "Instant and quiet" (PR L241) against "subtle and responsive" (DB L197). | Instant state changes. |
| X-25 | Lenis smooths all scrolling (PR L336); the motion contract lists content changes only. | Treated as scroll behaviour, off under reduced motion. Yours to accept. |
| S-01 | Pinned scenes (DB L501) against "never scroll-jacking" (OP L86, PR L336); no file defines the line. | Definition in section 3. |
| S-02 | Story told in order (PR L162) against "under 3 clicks, under 8 s" (PR L320). | A persistent count that jumps. |
| P-01 | DB L401 "one-page" document against the required contents. | Section 0 is the one-page part. |
| P-02 | DB L413 asks for conflicts with the spec; OP L96 for conflicts among all files. | All files, here. |
| P-03 | DB L66 says Phase A defines screens; neither Phase A list includes them. | Section 7. |
| P-04 | U8 and U12 gate the generator but are not on the Phase A list. | Section 8. |
| G-01 | CL L27 names Phase C among the gates; DB and OP give it no stop. | Final report is a gate (O9, approved). |
| G-02 | Gate report contents differ between DB L571 and OP L108, L118. | Reports merge both lists. |
| G-03 | Gate 2 puts the map with Act One (DB L439); PR puts geography in Act Two (L192). | Resolved by the persistent map: the merged gate builds stages 1 to 4 of case A on the persistent map, with the catalogue. |
| C-01 | PR L86 asks for one lookalike ending as not fraud; Parts 2.5 and 12 require two. | Part 12 followed. |
| C-02 | The "legitimate" outcome has no level in the five-level model. | A caption bound to levelled entries. |
| C-03 | V4 says "the case" with no verified outcome; three qualify. | V4 runs on B. |
| M-01, M-02 | PR L221, L222 cite U5 and U4 for things those items do not cover; Natural Earth has no register entry. | Terms page opened this phase; add to the register. The fitness of official Qatar geographic data stays unknown and unused. |
| M-03 | PR L214 calls timing advance "a choice made" and says it narrows "a position"; U12 leaves it open. | A band of distance from the antenna, never a position. |
| M-04 | Every statement needs one level (PR L100); map objects carry none. | Geometry bound to a catalogue entry. |
| E-02 | "Evidence level" could mean the five levels or the six labels (CL L11, DB L64). | Level and Basis (section 6). |
| V-05 | V8 requires fraud names checked against E.371, whose text was not readable. | Check against the summary page only and say so. Yours to accept. |
| V-06 | "Independent" validation names no reviewers. | Reviewer is always a different agent from the implementer; see the delegation log. |
| V-07 | "Workshop demo" (PR L272) against "production-quality" (DB L11). | Production standards for the build; workshop scope for V6 and V7. |
| U-01 | U9 is "open" in PR L62 and "SETTLED" in L293. | Name kept as the table says. The trademark and association risk has not been assessed and stays open. |
| U-02 | Primary user is the analyst (PR L149); primary depth is guided (L294). | Guided primary, as settled. |
| D-01 to D-03 | No measured budget, GSAP "approved" before verification, no persistence, test or font decisions. | Sections 2 and 9. |
| T-01 | PR L5 says it has no stack choices; Part 13 is one, and CL L13 binds it. | Part 13 followed, as amended by DC. |
| H-01 | Three different statements of the hierarchy (CL L13, DB L489, OP L77), and now DC's. | DC on look; PR on evidence, wording, privacy. |
| H-02 | PR cites an "Initial Project Briefing" that is not in the repository. | Cannot be checked under V9. |
| X-01 | "Not an ordinary table" (DB L250) against a ledger listing five fields per claim. | Typeset catalogue entries with marks. |
| X-02 | Five references "studied" against the one-line fallback (DB L525). | Studied as stills, limits stated. |
| X-04 | Publish the generator (PR L123) against omitting thresholds that aid evasion (L96, L258); also "the baseline is shown" (Part 5). | Generator parameters are invented and labelled. No number is presented as an operating threshold. Residual tension is yours to accept. |

**Minor** (wording and cross-reference drift): G-04 phase count; G-05 "loading, error" against "empty"; R-03 unstated release; C-04 400 calls against 500 to 2000 records (subset and total); E-01 "one label" against double labels; E-03 "confirm" in the level 4 template; X-03 inspection count; X-05 fidelity against synthetic identifiers; X-06 "real investigative case"; X-07 "observed fact" on synthetic records; X-08 level names in DB L50; X-09 hyphenation; X-10 dashed outline for both hypotheses and absences (separated in section 6); X-11 shadow and gradient boundary; X-12 marker wording; X-13 cluster level against the geographic step cap; X-14 cell site drawn as a point (now an apex tick); X-15 U2 resolution path; X-16 settled items in the unresolved list; X-17 Part 10 reference; X-18 U7 indicators used though unverified (each labelled ASSUMPTION); X-19 throttle profile; X-20 loading states against performing loaders; X-21 stamps against badges; X-23 OP omits GSAP core; X-24 DB has no About line.

Checked and consistent: the five level names and order, the six-step arc, gate names for A, Gate 1 and Gate 2, V6 and V7 out of scope, the About line (identical in CL, PR and OP), synthetic-data rules, reduced-motion requirements, Git rules.

## 12. Gate plan, scope and open items

**Merged gate (old Gate 1 plus old Gate 2, O11 approved): design system, data layer and vertical slice.** The owner said to stop planning and start building. It delivers:
1. Design-system page (`/system`) with the dark default and the light alternative shown side by side: tokens for both material families, light and shadow rules, type scale, the level marks on paper artefacts, the tombstone label, lacuna bracket, map language at the three scales, motion principles, interactive states, contrast results.
2. The seeded generator in `server/seed/` with the four cases in the section 9 data model, including steps with stages, sign-off eligibility, reason codes and the referral template with its fictional recipient registry.
3. The API with the endpoints and server-side rules in section 9: sign-off, assessment records, referral, packet file and send log.
4. The tests: every row of the section 9 test table.
5. The prerender of the case walks as readable stills.
6. A vertical slice of case A through stages 1 to 4 on the persistent map, with screenshots at desktop, tablet and mobile.

No WebGL in this gate. The WebGL moment is decided by prototype later, and "none" is allowed.

**Phase C.** Stages 5 to 7 in the interface (sign-off, referral, outcome), cases B to D, the WebGL moment if decided, accessibility, performance, then the final report as a gate.

**Scope and open items.**
- V6 and V7 are out of scope (workshop demo). No plain table baseline is built. V5 is met by section 5; V9 by Appendix A.
- U1, U2, U3, U7, U9's risk question and U11 stay open as PRODUCT.md records them.
- Infrastructure and the demo deck are separate tasks.
- Not done this phase: no real-device mobile run, no paint-timing measurement, fonts not rendered side by side, scroll feel not judged by hand, no motion study of the references, no prototype of the stage transition or of any WebGL moment.
- Review state: revision 3 had one adversarial review and one mechanical audit (delegation log, A14 and A15). Revision 4 applies the owner's decision and has not been reviewed again; the owner asked for no more review rounds before building, so review applies to what is built and running.
- Plausibility note (INFERRED): about 400 calls in 72 hours looks low for a SIM box. It is FICTION from Part 12 and is kept.

## Appendix A. Sources opened this phase

- ETSI TS 132 260 V19.3.0: https://www.etsi.org/deliver/etsi_ts/132200_132299/132260/19.03.00_60/ts_132260v190300p.pdf
- ETSI TS 132 298 V19.6.0: https://www.etsi.org/deliver/etsi_ts/132200_132299/132298/19.06.00_60/ts_132298v190600p.pdf
- ETSI TS 132 250 V19.0.0: https://www.etsi.org/deliver/etsi_ts/132200_132299/132250/19.00.00_60/ts_132250v190000p.pdf
- 3GPP Forge ASN.1, Rel-19: https://forge.3gpp.org/rep/sa5/CH/-/raw/Rel-19/ASN/TS32298_IMSChargingDataTypes.asn
- ETSI TS 124 229 V19.7.0: https://www.etsi.org/deliver/etsi_ts/124200_124299/124229/19.07.00_60/ts_124229v190700p.pdf
- ETSI TS 123 501 V19.9.0: https://www.etsi.org/deliver/etsi_ts/123500_123599/123501/19.09.00_60/ts_123501v190900p.pdf
- ETSI TS 136 213 V19.5.0: https://www.etsi.org/deliver/etsi_ts/136200_136299/136213/19.05.00_60/ts_136213v190500p.pdf
- Oh et al., NDSS 2023 (full paper): https://www.ndss-symposium.org/wp-content/uploads/2023-416-paper.pdf
- BICS Telco Fraud Whitepaper: https://www.bics.com/wp-content/uploads/2022/02/Telco-Fraud-Whitepaper.pdf
- GSAP licence: https://gsap.com/standard-license
- Lenis licence: https://github.com/darkroomengineering/lenis/blob/main/LICENSE
- d3-geo licence: https://github.com/d3/d3-geo/blob/main/LICENSE
- OGL: https://github.com/oframe/ogl
- Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/
- Newsreader: https://github.com/productiontype/Newsreader ; IBM Plex: https://github.com/IBM/plex
- Azure Functions Node.js model: https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node
- Azure Static Web Apps APIs: https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview
- Awwwards pages for the five references, under https://www.awwwards.com/sites/

## Appendix B. Edits to PRODUCT.md and CLAUDE.md (applied 2026-11-16)

1. **PR Part 2.2, SIM-box row, "Records that could show it".** Replace the TS 32.250 field list with: "Originating and terminating S-CSCF call records of the local SIMs: calling and called party addresses, request, answer and release time stamps (release is optional), cause for record closing, location as User Location Info or Access Network Information (optional, captured at answer), handset identity (optional). [FACT: TS 32.260 Table 6.1.3.3.1]"
2. **PR Part 2.2, SIM-box row, lookalikes.** Replace "NDSS confirms IoT devices can share fingerprints with SIM boxes" with "NDSS argues IoT devices are more likely to have overlapping fingerprints and designs its access control around an IoT device and a SIM box sharing one; its only measured collision is between two SIM boxes".
3. **PR Preface P3.** Replace the last sentence with "Two SIM boxes from different vendors share a fingerprint, and IoT device fingerprints may not be unique."
4. **PR Part 2.3, first two bullets.** Replace with the IMS wording: location is optional, is the cell at answer, and is either network-provided or device-reported; handset identity is optional and device-asserted.
5. **PR Part 2.5, second bullet.** "The record shape follows the TS 32.260 Table 6.1.3.3.1 field names (S-CSCF CDR), with only the subset the story uses."
6. **PR Part 12, case A ground truth.** "A SIM box is operating on the target cell, placing approximately 400 calls over 72 hours to domestic subscribers. In the same window, inbound international traffic on one high-cost route is below that route's baseline. [FICTION]"
7. **PR Part 10, V8.** "Check every field name against TS 32.260 and TS 32.298".
8. **PR Part 11.** U6: closed against ETSI TS 132 250 V19.0.0. U8, U12: settled as in DECISIONS.md section 8. U13: IMS records.
9. **PR Part 13.** The first-load budget, per-stage budgets and the Largest Contentful Paint definition from DECISIONS.md section 9 (O3, approved).
10. **PR Part 6.** Add that the three acts are played as seven stages on one persistent map, and that a sign-off and referral stage follows the assessment, citing DIRECTION-CHANGE-001.
11. **PR source register.** Add the ETSI documents, TS 23.501, TS 24.229 and the Natural Earth terms page; replace the itecspec mirror entry; note that the NDSS paper has now been read in full.
12. **CL rule 3 and PR Part 8 principle 2.** "Motion contract: only level changes, stage transitions, map changes (uncertainty and scale) and the spotlight moving to a new exhibit animate. Parallax is allowed within budget and is off under reduced motion. Every animation must name what changed."
13. **PR Part 8 principle 7.** Add: "Judgement is recorded in the Sign-off stage. Only a level 5 finding can be signed. Below level 5 an assessment may be recorded; it is not a signature." (DC-13 reading (a), approved.)
14. **PR Part 7 terms table.** Cell site: "not marked; shown only as the apex of its sector on the fictional case plate". Verified physical location: "a mark on the fictional case plate only". (DC-14 reading (a), approved.)
15. **PR Part 9.** Add: "The referral chain is fictional. Recipients are role titles only. Who would act on such a finding in reality is not established."
16. **PR Part 8 avoid list and OP section 7.** Applied to the PR Part 8 avoid list only; OP section 7 is left unchanged. Replace "neon and glow, glass panels, gradient washes" and "No glow, glass, gradient washes" with "No emitted glow, glass or colour gradient washes; light falls on artefacts and shadows are cast by them".

Also applied to CLAUDE.md on 2026-11-16: rule 9 (gate names: Gate 1 and Gate 2 merged into one stop, then Phase C and a final-report gate), rule 10 (creative bar: a current Awwwards Site of the Day for scroll choreography, interaction and typographic finish; still screenshots inform composition and typography only) and rule 11 (one persistent map of Qatar carries the whole case as seven stages).
