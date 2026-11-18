# Owner direction change 001: one persistent map of Qatar, seven stages, and a sign-off at the end

Status: owner direction, 2026-11-16, given during the Phase A gate. Revised on 2026-11-16 by owner decision: the seven-room structure is superseded by one persistent map and seven stages. It SUPERSEDES decisions O4, O5 and O7 in DECISIONS.md and ADDS a new final stage to the case journey. PRODUCT.md still wins on evidence rules, wording and privacy. Where this file and DESIGN-BRIEF.md disagree on look and feel, this file wins.

## What the owner asked for
The app must feel like an immersive museum experience, not a flat 2D website. It is one persistent, interactive map of Qatar that stays on screen for the whole case. The case is a sequence of seven stages played on that map, from the trigger to its validity. Once a finding is verified it is signed off and sent up the chain to the authorities. (All of this is a simulation.) The museum feel comes from pacing, light, depth and exhibit-style evidence cards, not from walking between rooms. Panels, overlays and camera moves carry each stage.

## Changes to Phase A decisions
- O4 (light paper-and-ink "Proof Sheet"): CHANGED. Keep the Proof Sheet idea (a claim is set only as far as its evidence allows; dashed outline becomes solid when evidence earns it). Look: dark by default, a spotlit map with lit areas, paper-and-ink exhibit cards. Light means attention, never certainty. Level is always carried by marks. A light alternative is shown beside the dark default on the design-system page, and the owner is told if a light theme reads better in the prototype.
- O5 (fictional grid, no real Qatar): CHANGED. The map is a real Qatar outline from open licensed data (d3-geo). Towers, cells and case locations are FICTION and appear only as areas of stated uncertainty, with one exception: one verified-site mark on the fictional zoomed case plate. Scale descent from the national plate to the fictional case grid is part of the stage 1 to 2 transition. Pan, zoom and selecting an area show the evidence that supports it.
- O7 (no 3D): CHANGED. Depth is wanted. Allowed: parallax inside stages and in transitions, within budget, light and shadow, a spotlight on the active exhibit, and at most one lazy-loaded WebGL moment, decided by looking at a prototype ("none" is allowed). Not allowed: 3D for its own sake, or anything that makes a claim look more certain than its level.
- O3 budgets: the 150 KB JS budget applies to the first load only. Later stage chunks and the one WebGL chunk are budgeted separately, and every stage must still render a readable still on reduced motion.

## The journey: seven stages on one persistent map
The map stays on screen for the whole case. Claims, levels and wording come from PRODUCT.md unchanged.
1. Signal (trigger): a light appears over a region of Qatar. Retrospective, never real-time prevention (PRODUCT.md P4).
2. Evidence: records and device metadata appear as exhibit cards. The uncertain area on the map tightens or widens as each is added. Show what was expected but not observed.
3. Rivals: competing explanations (SIM box, call centre, IoT fleet) appear as different shapes on the map and as side-by-side cards, each with what would support or refute it.
4. Test (validity): outside evidence arrives and the claim rises, holds or falls in full view. The area hardens or dissolves. This is the signature moment: a dashed claim is inked solid.
5. Sign-off: only level 5 can be signed. Analyst countersign, then the scripted fictional supervisor. A seal appears on the map, bound to the sealed area.
6. Referral: the packet travels as a path on the map from the case to the fictional chain (unit lead, agency head, regulator and law-enforcement desks), which sits as a rail of recipient roles in the plate margin so no fictional desk is placed on real ground. Nothing leaves the app. The packet is a download stamped SIMULATED, plus an in-app send log.
7. Outcome: case A ends signed and referred. B, C and D end as assessment records with no referral.

The catalogue (the evidence ledger) stays present throughout, beside the map. Rival explanations are drawn on the map as dashed shapes showing what each explanation predicts about where activity would be seen (basis ASSUMPTION), bound to their level 4 hypothesis entries. At the Test the surviving one is inked solid and the others dissolve.

## Rules that do not change
- Nothing is sent to any real person, authority or system. Every recipient, name and number is FICTION and marked so.
- No real subscriber data, no real tower locations, no thresholds that work as evasion guidance.
- No word such as "confirmed", "fraudster" or "caught" below level 5 (V2 test stays).
- Motion contract still applies: an animation must name what changed. Museum feel comes from depth, light, pacing and interactivity, not decoration. Only level changes, stage transitions (including the scale descent), map changes (uncertainty and scale) and the spotlight moving to a new exhibit animate.
- Reduced motion gives a full still version of every stage, and parallax is off. Keyboard and screen-reader paths exist for the map and the sign-off.
- Full experience only, no plain table version.

## Enterprise presentation (owner, 2026-11-16, during the build)
Owner's words: "This isn't supposed to be treated as some throwaway demo but a real agency. The visuals, diagrams, tables and intelligence should show a real-world agency whose clients are government and service providers like Ooredoo and Vodafone, so the data should make sense as an intelligence unit. Don't make it too fictional and made up. Just the data is; its format and shape and graphs, everything else, should be enterprise level."

How the build reads this:
- SOLID SNAKE presents as the working product of a professional telecom fraud intelligence unit. Its audience is government bodies and mobile operators. It must look and read like something an operator's fraud team or a regulator would recognise as enterprise-grade, not a game or a museum piece.
- Only the data is synthetic. Record and identifier formats follow real 3GPP structure, built on code spaces that belong to no public network or subscriber, so the privacy rule in PRODUCT.md 2.5 still holds. No toy tokens.
- Evidence is shown with professional analytical graphics: time series against a baseline band, distributions with the subject's position, route volume against history, a SIM, device and cell link diagram, and designed, typeset data tables.
- Written output uses intelligence-product structure: case reference, originator and tasking, key judgements bound to levels, collection gaps (the "expected, not observed" items), dissemination (the referral), and a handling line.
- The simulation stays marked in the idiom a real unit uses for training material: a persistent handling line "SIMULATED // EXERCISE DATA" and the About line. The words "fictional" and "fiction" stay in provenance blocks as basis labels and are not sprinkled across the interface.
- Entities are named the way a real unit minimises them: MNO-1, MNO-2, IPX-3, EC-0147. No real company or authority is named as a client, a source or a recipient. Naming Ooredoo, Vodafone or the CRA as participants would state a relationship that does not exist, and PRODUCT.md Part 9 forbids it.
- Unchanged: the five levels and their wording, the map rules, the seven stages on one persistent map, the motion contract, nothing sent to any real recipient.

Tension recorded, not resolved silently: CLAUDE.md rule 7 says "no spreadsheet-style grids". Designed, typeset data tables are now used where a real unit would use one. The plain table baseline is still not built.

## Platform, not simulation (owner, 2026-11-16, during the build)
Owner's words: "It's going to be a platform, cause calling it a simulation is making you build a storyboard, not an agency's interactive case trigger flow from a detected anomaly to final sign-off. It's supposed to operate as a real-world platform with synthetic data for the demo to trigger it, since it's not connected to any providers as of now."

This supersedes the scripted-walk reading of the seven stages and the "investigation simulation" framing in PRODUCT.md Part 4 and Part 9.

What SOLID SNAKE is now: a telecom fraud intelligence platform. It ingests call records, runs detection rules over every record, raises alerts, and carries each case from the detected anomaly to sign-off and referral. It is not connected to any operator. The demo is driven by a synthetic feed in the same record format an operator would export.

The flow:
1. Monitor: the national map and a feed of call records being ingested (the demo replays a synthetic window at speed). Detection rules run over the feed. When one fires, an alert appears in the queue with its rule, value, baseline and region.
2. Alert to case: the analyst opens a case from an alert. The case gets a reference, an assignee and an audit trail. The map descends from the national plate to the case plate.
3. The seven stages are the case workflow, released by actions, not by scrolling: Signal (the alert), Evidence (request records from each source; each source connector returns after a stated turnaround), Rivals (record the competing explanations), Test (request the outside check), Sign-off (analyst, then a supervisor who is a different user), Referral (dissemination to recipient roles, in-app only), Outcome.
4. Levels are enforced by the server: only level 5 can be signed, the supervisor must be a different user from the analyst, a referral needs both signatures, and every action writes a hash-chained audit event.

What is live and what is prepared in the demo:
- Live: ingestion, detection over every record, the alert queue, case creation, the workflow state machine, the level gates, roles, the audit log, the referral packet. These work on any feed in the record format.
- Prepared: what each outside source returns (device records, radio measurements, the field survey). With no operator connected there is no one to ask, so each source has a demo connector that serves synthetic data. A real connector replaces it later; nothing else changes.
- Levels shown in a case are recomputed by the platform's assessment rules from the evidence present, and tests check they match the scenario data.

Users: demo accounts with fictional names and role titles (analyst, supervisor, unit lead). One demo workspace per browser, with a reset. This replaces the scripted supervisor the visitor watches (O14): the supervisor is now a second role the demo user signs in as.

Unchanged: the evidence levels and wording, the reserved words, the map rules, the persistent map, the motion contract, enterprise presentation and plain language, nothing sent to any real recipient, every view marked "SIMULATED // EXERCISE DATA" while the data is synthetic.

## Instruction to the lead
Build around the seven stages on one persistent map. DECISIONS.md carries the stage structure, the approved readings and the merged gate. Add the sign-off and referral stage to the case data model and the tests (a level below 5 must be unsignable; a referral must never contain an unlabelled real-world recipient). Report anything here that conflicts with PRODUCT.md rather than resolving it silently.
