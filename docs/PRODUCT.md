# SOLID SNAKE: Product Discovery and Story Definition

Status: authoritative brief, version 1, written after source discovery.
Baseline: no earlier `claude.md` was reachable, so the "Initial Project Briefing: SOLID SNAKE" is treated as the conceptual foundation. Where discovery changes it, the change is named in the Preface.
Scope: story, intelligence model, workflow, boundaries and validation. It contains no screen designs, stack choices, roadmap or database design.

North star: build an experience that makes invisible telecom fraud patterns understandable, investigable and explainable, without pretending that suspicion is proof.

## How to read the evidence labels

Every non-trivial claim carries one label.

| Label | Meaning |
|---|---|
| FACT | Stated in a primary or official source that was opened in this discovery. Source in the register. |
| RESEARCH | Reported by a peer-reviewed or preprint paper. Read directly, or known only through another paper's citation (marked "via"). |
| PRACTICE | Described in industry or vendor material. Treated as a claim by that source, not as independent proof. |
| ASSUMPTION | A working premise of this brief. Nothing in the sources confirms it. Listed again in Part 11. |
| FICTION | An invented element of the SOLID SNAKE world. Never presented as real. |
| PROPOSAL | A product decision made here. It can be reversed by the people who own the product. |

## What discovery did not have

- No operator, regulator or investigator was interviewed. No operator data was available. Nothing below describes observed analyst behaviour.
- The ITU-T E.371 full text was not readable (the page exposed only a summary). ITU-T E.371 definitions are therefore not quoted.
- ECC Report 275 returned binary data and was not read.
- The NDSS paper was read to character 100,000 of 111,903 in discovery. It was later read in full in Phase A (see the source register).
- No official Qatar geographic or infrastructure dataset was opened or licence-checked. Part 7 names what is and is not known.
- Two award-gallery sites were opened live. That is a small sample, not a survey.

## Preface: what discovery changed in the briefing

| # | Finding | Label | Effect on the product |
|---|---|---|---|
| P1 | The link given for CDR structure, ETSI TS 132 297, defines the CDR file format and transfer (binary file header, per-CDR header, file naming, FTP transport). CDR parameters live in TS 32.298, and circuit-switched charging in TS 32.250. | FACT | Field names in this brief come from TS 32.250 §6.1.3.1, not from TS 32.297. The product must not claim 32.297 as its record model. |
| P2 | The NDSS device-model fingerprinting method uses signalling messages (NAS ATTACH Request and RRC UECapabilityInformation), not call records. | FACT | SOLID SNAKE cannot present device-model identification as something derived from CDRs. It is a separate evidence source with its own access requirements. |
| P3 | The NDSS dataset is a lab LTE testbed: 279 traces, 102 devices (85 smartphones, 6 LTE SIM boxes from 5 vendors, 11 IoT devices). Two SIM boxes from different vendors share a fingerprint, and IoT device fingerprints may not be unique. | FACT | Fingerprint evidence can narrow, never settle. A lookalike must exist in the fiction. |
| P4 | The same paper states that CDR-based and call-quality detection works only after calls have been made. | FACT | The "anomaly" at the start of the story is retrospective. The product must not imply real-time prevention. |
| P5 | ITU-T E.371 (02/2026) lists several categories of deemed impermissible traffic: call refiling and masking, SIMbox misuse, OTT bypass, premium-rate abuse, wangiri, international callback, sender ID spoofing, unknown-CLI incoming international calls and flash calls. | FACT (summary page only) | "SIM-box fraud" is one category among several. The briefing's single-subject focus is kept as the main case, with others used as contrast cases (Part 2). |
| P6 | A SIM box places local calls from local SIMs. The international leg of the call is not in those SIMs' records. | PRACTICE (BICS definition) plus ASSUMPTION on record visibility | Evidence of bypass is partly an absence (expected inbound international traffic that did not arrive). The model needs a place for evidence that is missing. |
| P7 | A single operator sees only its own subscribers. A cross-operator "national" view is not a normal data position for anyone in the sources read. | ASSUMPTION | The "national operation" is a FICTION and is labelled as one. No claim is made that a Qatari body has this view. |
| P8 | The briefing's four-part structure (Briefing, Operation Qatar, Intelligence Operations, Investigation Room) risks presenting analysis as places to visit. | PROPOSAL | Replaced by three acts and one persistent evidence ledger (Part 6). |

## 1. Identity and mission

SOLID SNAKE is a telecom fraud intelligence platform for Qatar. It ingests call records, detects anomalies, and carries each case from the alert to a defensible conclusion, sign-off and referral. It is not connected to any operator; the demo runs on a synthetic feed. [PROPOSAL: owner direction 2026-11-16, see DIRECTION-CHANGE-001.md "Platform, not simulation"]

Its first subject is SIM-box bypass fraud. [PROPOSAL, from the briefing]

The story in one passage: an unusual signal becomes an intelligence lead; correlated observations become an investigative hypothesis; an investigator examines the evidence and decides what can reasonably be concluded. [briefing]

Mission: show the chain of reasoning, including where it stops. A user leaves able to say what the records proved, what they only suggested, and what evidence was still missing.

SOLID SNAKE is not any of the following:
- a dashboard that ends at a score (alerts open cases; cases carry the reasoning)
- a map of red markers
- a device tracker
- a system that declares guilt
- a representation of a real Qatari agency, operator or regulator
- connected to real operator data in this version

The name is the codename of a character from Konami's Metal Gear Solid series. No character art, quotation or imagery is used. Whether the name carries trademark or association risk is open (Part 11, U9).

## 2. The problem and the intelligence model

### 2.1 The problem

Telecom fraud leaves its trace as records and absences spread over systems, hours and places. The people who must decide what happened see those records through alerts and scores. The reasoning that links an alert to a conclusion is the hard part, and it is the part interfaces usually hide. [ASSUMPTION: not tested with practitioners]

### 2.2 Fraud types considered

Definitions come from vendor material (BICS whitepaper) unless stated. E.371 is the taxonomy of record for names; its definitions were not readable.

| Type | Mechanism | Records that could show it | Indicators proposed for the fiction | Legitimate lookalikes | Cannot be inferred from those records alone | Extra evidence an investigator needs |
|---|---|---|---|---|---|---|
| SIM-box bypass (main case) | International VoIP calls are diverted onto the local mobile network through SIMs in a box. [PRACTICE: BICS; RESEARCH: NDSS threat model] | Originating and terminating S-CSCF call records of the local SIMs: calling and called party addresses, request, answer and release time stamps (release is optional), cause for record closing, location as User Location Info or Access Network Information (optional, captured at answer), handset identity (optional). [FACT: TS 32.260 Table 6.1.3.3.1] | Per-SIM aggregates such as total calls and minutes on one cell (RESEARCH via Elmi 2013, Sallehuddin 2014). Further indicators (many SIMs on one cell, low inbound traffic, near-static location, many short calls, one IMEI across SIMs) are widely repeated but were not verified here. [ASSUMPTION] | Call centres, enterprise SIM pools, IoT and M2M devices, shared-handset heavy users. [ASSUMPTION; NDSS argues IoT devices are more likely to have overlapping fingerprints and designs its access control around an IoT device and a SIM box sharing one; its only measured collision is between two SIM boxes] | Intent, operator identity, that the calls were international, or where the box physically is. | Interconnect-side traffic that should have arrived and did not; test calls to see how the caller identity presents; field survey; device recovery. [ASSUMPTION; test calls are mentioned in the Ighneiwa paper] |
| International revenue share fraud (IRSF) | High-volume calls to premium or high-termination destinations, with a share of the revenue taken by the fraudster. Access via PBX hacking or roaming. [PRACTICE: BICS] | Call records by destination prefix and rate; roaming files, which can arrive 3 to 4 hours late, with detection delays up to 3 days. [PRACTICE: BICS] | Burst of calls to one high-cost range. | Legitimate call centres, diaspora calling peaks, events. | Who receives the revenue share. | Number-range ownership, partner settlement data. |
| Call refiling and CLI manipulation | The calling line identity is altered to benefit from lower termination rates. [PRACTICE: BICS] | Gateway-side signalling and routing records. A subscriber-side record rarely shows it. [ASSUMPTION] | CLI country inconsistent with the route. | Legitimate CLI presentation: roaming, forwarding, enterprise trunks. | Intent. | Signalling captures, route logs, test calls. |
| False answer supervision (FAS) | A carrier in the chain returns a false answer signal, so billing starts early or ends late. [PRACTICE: BICS, which calls it particularly difficult to detect] | Per-route answer and disconnect timing, answer-to-seizure ratios. | Calls "answered" with near-zero real conversation. | Voicemail, IVR and network announcements that answer calls. | Which carrier in the chain did it. | Test calls with audio or signalling capture. [ASSUMPTION] |
| Wangiri, OTT bypass, flash calls, sender ID spoofing | Listed by E.371. [FACT: summary page] | Out of scope. | | | | |
| SMS and one-time-password abuse with SIM farms | Same hardware family as SIM boxes. | Out of scope. [ASSUMPTION, not verified] | | | | |

Product decisions that follow:
- SIM-box bypass is the main case. [PROPOSAL]
- One contrast case (IRSF or FAS) appears inside the story so the investigator must tell fraud types apart. [PROPOSAL]
- One legitimate-lookalike case (a call centre or IoT fleet) appears in the story and ends as "not fraud on this evidence". [PROPOSAL]

### 2.3 What the records can and cannot say

- In an IMS call record, location is optional, is the cell at answer, and is either network-provided or device-reported. It identifies a cell, not a position. [FACT: TS 32.260; TS 32.298; TS 24.229 clause 7.2A.4]
- Handset identity is optional and device-asserted, so a missing value is a normal state, not an anomaly. [FACT for the optional category: TS 32.260 Table 6.1.3.3.1; that the value is device-asserted is ASSUMPTION, not checked against a source here]
- IMEI can be changed on many SIM boxes, so it is a weak identifier. [RESEARCH: NDSS]
- The device-model fingerprint in the NDSS paper made 83 of 85 smartphones unique (97.6%) in a lab set, and left residual risk from IMEI spoofing of a registered IoT device. [RESEARCH] Those figures describe that dataset only. They are not used as accuracy targets for SOLID SNAKE.
- Detection from call records and call quality works only after calls are made. [RESEARCH: NDSS]
- Reported detection results in the literature vary widely: an ANN at 98.7% on one cell's data with 20 false positives (Elmi 2013, via Ighneiwa), AT&T data with 93,000 legitimate and 500 fraudulent accounts at 99.95% (Murynets 2014, via Ighneiwa), and a Libyan operator study that reports no metrics at all (Ighneiwa and Mohamed). [RESEARCH] Class imbalance and unreported metrics make these figures unusable as targets here.
- Smart SIM boxes simulate human behaviour to evade detection. [RESEARCH: Ighneiwa and Mohamed] Any public layer must avoid publishing thresholds that work as evasion guidance.

### 2.4 The evidence-to-claim model

Five levels. Each on-screen statement belongs to exactly one level.

| Level | Name | What it is | Allowed wording | Cannot be said |
|---|---|---|---|---|
| 1 | Observed fact | A record exists with these field values. | "Record R shows SIM S placed 412 calls on date D, all associated with cell C." | That the record is complete, correctly timed, or describes the world. |
| 2 | Analytical indicator | A reproducible measure derived from level 1 against a stated baseline. | "Outbound call count is above the baseline for cells of this type (baseline B, window W)." | That the cause is fraud. A score is a sort key here, never a probability. |
| 3 | Correlated evidence | Two or more independent evidence sources point the same way. Independence is stated (different system, different method, different collection point). | "Call records and inbound-traffic shortfall both indicate X." | That the explanation is unique. |
| 4 | Investigative hypothesis | A named explanation, with the alternatives it competes with, and what observation would confirm or refute it. | "Hypothesis H: SIM-box operation. Alternatives: call centre, IoT fleet. Test: ..." | That H is true. |
| 5 | Verified finding | Confirmed by evidence outside the analytic chain (field survey, device recovery, controlled test call, legal or operator confirmation). In the fiction this comes from scripted ground truth and is labelled simulated. | "Verified (simulated): a SIM box was found at site Z." | Anything about real people or places. |

Rules:
1. A statement cannot rise a level without a named piece of evidence added.
2. A statement can fall a level when new evidence contradicts it. Falling is shown, not hidden.
3. Missing evidence is a first-class item ("expected, not observed") and is attached to the claims it limits.
4. A risk score appears only as an ordering at level 2.
5. A cell association is never drawn or worded as a location (Part 7).
6. The words "confirmed", "fraudster", "caught" and "perpetrator" are reserved for level 5 and only in simulated context.
7. Every item carries a record identifier that traces back to the synthetic source.

### 2.5 Synthetic data approach

No real operator data is available, and none is used. [FACT of this discovery]

- Records are generated from written generative rules, each rule labelled with its source or marked ASSUMPTION. The generator and its seed are published so any reviewer can reproduce the data.
- The record shape follows the TS 32.260 Table 6.1.3.3.1 field names (S-CSCF CDR), with only the subset the story uses.
- Identifiers follow real 3GPP and ITU structure but sit only on code spaces no public network or subscriber can hold: network code 999 (private networks), country code +999 (reserved, unassigned), and device codes in the test range that no allocator issues. A real person's number can therefore never be generated. [PROPOSAL: owner enterprise direction 2026-11-16; sources in the generator's provenance notes]
- Cells, sites and sectors are fictional objects. They are not placed on real named buildings.
- The dataset must contain hard negatives: at least a call-centre pattern and an IoT or M2M pattern that resemble the fraud on the main indicators and differ on others.
- The dataset must contain a contrast fraud type and a case that stays inconclusive.
- Nothing about detection performance is reported from synthetic data. It can test the interface's handling of evidence, not an algorithm's accuracy.
- Every record, screen and export is marked simulated.

## 3. Investigative workflow (reconstructed)

No analyst was observed. The sequence below is a reconstruction from the sources and from general practice. Every step is ASSUMPTION unless marked.

| Stage | Reconstruction | Status |
|---|---|---|
| Trigger | An alert from monitoring or a revenue-assurance anomaly. E.371 names real-time monitoring, AI/ML detection, filtering and audits as mitigation. | Monitoring named by FACT (E.371 summary); the trigger sequence is ASSUMPTION |
| First inspection | The analyst reads the alert's underlying records and the baseline it was compared against. | ASSUMPTION |
| Records requested | Further call records, signalling or interconnect records, subscriber registration data, handset identity data, and cell identity tables. Each may sit with a different team. | ASSUMPTION |
| Correlation | Group SIMs by shared cell, shared handset identity, time pattern and registration source; compare against lookalike populations. | ASSUMPTION |
| Escalation | Controlled test calls, a field check, a report to the regulator or to law enforcement. Which bodies act, and with what powers, is not established. | ASSUMPTION; legal side in Part 9 |
| Success | A finding that survives an attempt to explain it innocently, or a documented decision that the evidence does not support a conclusion. | PROPOSAL |

Open questions for real practitioners are in Part 11.

## 4. The product promise

Primary user: an analyst or analyst-in-training working one case from anomaly to assessment. [PROPOSAL] Real analysts were not consulted, so how well this matches practice is untested.

Secondary user: a public learner following the same case at lower depth.

Promise: take one anomaly through the whole chain of evidence and see, at every step, what the records prove, what they only suggest, and what would be needed to say more.

Why existing approaches fall short: alert-first interfaces tend to end at a score or a red marker. [ASSUMPTION: not tested; no specific product was reviewed] Reading about fraud types teaches the taxonomy and not the reasoning.

Why immersion is needed: the difficulty sits in the links between records, time and place. Record views are designed and typeset. Spreadsheet-style grids are not used.

### Does the public experience and the analyst environment belong in one product?

Decision: yes, as one case at two depths. [PROPOSAL]
- Guided depth: the story is told in order, with the evidence ledger visible.
- Open depth: the same case, with the records, indicators and alternatives open to inspection.
- Both read from one evidence model, so the public version cannot say more than the analyst version.

Risk: the workflow is designed without real analyst input. Until practitioners review it, the About line says so. The product is a platform (owner direction 2026-11-16); its demo runs on synthetic data.

### Challenge to the four-part architecture

Briefing, Operation Qatar, Intelligence Operations and Investigation Room are four places. The investigation is one continuous chain. Separate places invite browsing, and browsing invites the dashboard behaviour the briefing rejects. Replace with the arc in Part 5 and the structure in Part 6.

## 5. Investigative narrative

Arc: Anomaly, Intelligence, Correlation, Geographic understanding, Investigation, Assessment.

| Step | What happens | Highest claim level allowed | Required honesty |
|---|---|---|---|
| Anomaly | A pattern in records differs from a stated baseline. | 2 | The baseline is shown. After-the-fact detection is stated (P4). |
| Intelligence | The analyst learns which fraud types could produce the pattern. | 2 | Lookalikes named, including the innocent ones. |
| Correlation | A second, independent source is brought in. | 3 | Independence is explained. Missing evidence is listed. |
| Geographic understanding | The pattern is placed in space as uncertainty, not as a point. | 3 | Cell association is shown as an area of possibility (Part 7). |
| Investigation | The analyst states hypotheses, with alternatives and tests. | 4 | Alternatives stay visible until a test removes them. |
| Assessment | The analyst records what can reasonably be concluded. Some cases end at 4, and one ends as legitimate. | 4, or 5 only through simulated ground truth | The assessment lists what was not established. |

The narrative has at least three outcomes across the case set: a simulated verified finding, a case that remains a hypothesis, and a legitimate pattern. A product in which every case ends in fraud teaches the wrong lesson. [PROPOSAL]

## 6. Experience architecture (structure only)

Three acts and one ledger. No screens are specified.

- Act one, Signal: the anomaly and the baseline.
- Act two, Case: intelligence, correlation, geography and hypotheses, as one investigation with no section walls.
- Act three, Assessment: the written conclusion and its limits.
- Evidence ledger: present throughout. It lists each claim, its level, its sources, the alternatives, and the missing evidence. It is the single source for everything shown elsewhere.

The three acts are played as seven stages on one persistent map of Qatar (Signal, Evidence, Rivals, Test, Sign-off, Referral, Outcome); the map stays on screen for the whole case and panels, overlays and camera moves carry each stage. A sign-off and referral stage follows the assessment, and the closing outcome page ends the case. [PROPOSAL: owner direction, see DIRECTION-CHANGE-001.md]

The "Briefing" is folded into the opening of act one. "Operation Qatar" becomes a lens inside the case (Part 7). "Intelligence Operations" and "Investigation Room" merge into act two.

## 7. The role of the Qatar map

The map answers a question that records raise and cannot settle: where could this activity be? It is a tool for reasoning about uncertainty, not a display of positions.

### Terms

| Term | Meaning in SOLID SNAKE | Source of position | Can be drawn as |
|---|---|---|---|
| Cell site | A fictional radio site. | FICTION | Not marked; shown only as the apex of its sector on the fictional case plate. |
| Cell or sector | The radio cell whose identity appears in the record's location field. | FACT (field definition); coverage geometry is ASSUMPTION | An area of possible service, with its limits stated. |
| Observation area | The union of cells in which records of interest appeared. | Derived | An area, with the derivation shown. |
| Suspected activity cluster | A group of SIMs sharing observation areas and other traits. | Derived, level 3 or 4 | A region plus a count. Never a single marker. |
| Verified physical location | A place confirmed by evidence outside the analytic chain. | Simulated level 5 only | A mark on the fictional case plate only, labelled "verified (simulated)". |

Rules:
- A cell association is not an exact location, and it is never plotted as a point.
- Timing advance can narrow a position within a sector where a network records it. Whether it is recorded in the fiction is a choice made and labelled. [ASSUMPTION]
- Every map view carries a visible "simulated" mark.
- The map never shows real infrastructure of a real operator.

### Geography and licensing

- OpenStreetMap data is under the Open Database Licence, with an attribution requirement. [FACT]
- OpenCelliD positions are crowd-sourced estimates: its own page says markers show "estimated cell locations, not confirmed tower sites", and several cell IDs can map to one tower. [FACT] Its licence page was not read (U5).
- No official Qatar geographic dataset was opened. Their licensing, accuracy and fitness are unknown (U4).
- The CRA ordered 3G to end by 31 December 2025, for Ooredoo Qatar and Vodafone Qatar, with 4G, 5G and VoLTE remaining. [FACT: Gulf Times, 19 Aug 2024] The fictional network is 4G and 5G. NDSS studied LTE SIM boxes, which is consistent with that setting. [ASSUMPTION on relevance]

## 8. Creative and interaction principles

### What was inspected

- The Awwwards Sites of the Day listing, opened live. It lists agencies and studios; the names appear without further description.
- Active Theory's own site, opened live: a black screen, a loader counter, a glowing ring with a particle field, and a pill-shaped navigation.
- The PeachWeb gallery, opened live: a dark page with 3D hero templates in categories (Tech, Ecommerce, Automotive, Entertainment and Gaming, Storytelling). Individual gallery sites did not expose names or links in the page text.

Limits: two sites, one viewport size, no systematic review. An earlier WebFetch of the Awwwards list returned July 2025 entries, which a live check showed to be stale. The conclusions below are a reading of those two pages and not a survey of the genre.

### Thesis: proof has to be earned on screen

The visual and interactive language comes from casework and cartographic uncertainty: tolerance, provenance, stamps of status. [PROPOSAL]

Principles:
1. Confidence is visible. An unverified thing looks unfinished; a verified thing looks fixed. The change in appearance is the animation that matters.
2. Motion contract: only level changes, stage transitions, map changes (uncertainty and scale) and the spotlight moving to a new exhibit animate. Parallax is allowed within budget and is off under reduced motion. Every animation must name what changed.
3. Uncertainty is a shape. Areas, ranges and gaps are drawn. Precise points appear only where precision exists.
4. Absences are drawn. "Expected, not observed" has a visual form.
5. Text carries the argument. Labels use the wording rules in Part 2.4.
6. Reading order follows the evidence chain.
7. Interaction asks the user to make a judgement (promote, hold, reject) with a reason. Judgements persist per case with reason and timestamp. Judgement is recorded in the Sign-off stage. Only a level 5 finding can be signed. Below level 5 an assessment may be recorded; it is not a signature. [PROPOSAL]

Avoid: emitted glow, glass or colour gradient washes (light falls on artefacts and shadows are cast by them), decorative particle fields, loaders that perform, red marker maps, and animation without informational purpose. The two inspected sites show why: the glow-and-particle language reads as spectacle and says nothing about evidence.

## 9. Trust, privacy and boundaries

- Synthetic data only. No real subscriber, number, device or incident is used or implied.
- No real Qatar incident, operator, regulator, infrastructure or integration is invented or imitated. No logos or names of Ooredoo, Vodafone Qatar, or the CRA appear as participants.
- Everything is marked simulated, including exports and shared images.
- The referral chain is fictional. Recipients are role titles only. Who would act on such a finding in reality is not established. [PROPOSAL]
- **About:** A telecom fraud intelligence platform built from published research. This demo runs on synthetic data and is not connected to any operator. Not yet reviewed by telecom practitioners.
- Legal context, as read: Decree-Law No. 34/2006 (with By-Law No. 1/2009 and Law No. 17/2017) is the telecom framework. The CRA, established 2014, licenses and regulates. Licences are required to provide public services for a fee, including resale, and Chapter 16 provides imprisonment of up to two years and/or fines up to QAR 2 million for contraventions, plus financial sanctions of QAR 2,000 to 5 million. [FACT via Pinsent Masons, secondary source] That guide does not mention bypass, interference or data protection. Whether SIM-box operation is addressed by a specific provision is unverified, and the product makes no legal statement about it. [ASSUMPTION; needs legal review]
- Personal data protection law in Qatar was not checked in this discovery. It matters if any future version touches real data. [ASSUMPTION]
- The demo uses illustrative rule parameters, not tuned production thresholds, and omits timings and tuning detail that could help someone evade detection. Tuned thresholds belong in a client's own deployment.
- The product describes methods at the level of the cited literature and adds nothing that works as an operating guide for building or hiding a SIM box.

## 10. Independent validation criteria

None of these invent an accuracy target. Where a threshold is needed, the reviewers set it in writing before the test, and the test fails if it is set afterwards.

| # | Criterion | Method | Fails if |
|---|---|---|---|
| V1 | Provenance | Sample every claim shown in a case and trace it to a record identifier and a rule. | Any claim has no trace. |
| V2 | Level discipline | Audit all strings against the wording rules in 2.4. | A reserved word appears below level 5, or a statement shows no level. |
| V3 | Hard negatives | Run the synthetic lookalike cases through the full journey. | A lookalike reaches level 4 without its innocent explanation listed. |
| V4 | Inconclusive handling | Run the case that has no verified outcome. | The product pushes it to a conclusion. |
| V5 | Geospatial honesty | Inspect every map state. | A point is drawn where only a cell association exists, or the simulated mark is missing. |
| V6 | Value of immersion | **Out of scope, workshop demo.** Built from cited research, not A/B tested with users. | N/A |
| V7 | Practitioner review | **Out of scope, workshop demo.** Not reviewed by independent telecom practitioners. | N/A |
| V8 | Standards fidelity | Check every field name against TS 32.260 and TS 32.298, and every fraud name against E.371. | A field or category is invented or mislabelled. |
| V9 | Source register | A reviewer re-opens each cited source. | A cited statement is absent from its source. |
| V10 | Accessibility | Test to WCAG 2.2 level AA, including keyboard-only use and screen-reader reading of the ledger. | The evidence level of any item is conveyed by colour or motion alone. |
| V11 | Performance and usability | Budgets in Part 13 approved by the owner at the Phase A gate. | Budgets not approved, or the experience misses them. |

Not validated by anything in this brief: any claim that the product detects real fraud. It does not make such a claim.

## 11. Unresolved decisions and assumptions

| ID | Item | Type | Status |
|---|---|---|---|
| U1 | Whether real telecom fraud analysts recognise the reconstructed workflow. | ASSUMPTION | **Out of scope, workshop demo.** Not reviewed by practitioners. |
| U2 | Whether any body in Qatar can see a cross-operator picture. | ASSUMPTION; treated as FICTION | Regulator or operator confirmation. |
| U3 | ITU-T E.371 definitions and scope. | Gap | Access to the full text. |
| U4 | Map base data: use Natural Earth simplified coastline with fictional cells on top. No OpenCelliD. | PROPOSAL | SETTLED. |
| U5 | Attribution: Natural Earth is public domain; no OpenCelliD licensing risk. | SETTLED | N/A |
| U6 | TS 32.250 version used. The field list came from a third-party mirror (itecspec) showing a Rel-19 table of contents. | Gap | CLOSED 2026-11-16: compared against ETSI TS 132 250 V19.0.0; the mobile-originated clause matches the mirror on the location wording, the conditional IMEI and the mandatory fields (DOCUMENTED, DECISIONS.md section 8). |
| U7 | Indicator list for SIM-box behaviour beyond what the cited papers describe. | ASSUMPTION | **Out of scope, workshop demo.** Not verified by practitioners. |
| U8 | How invisible "expected, not observed" evidence is generated in the fiction. | PROPOSAL | SETTLED 2026-11-16: each expectation is its own object (what was expected, from which system, by which rule, the window, its state, the entries it limits), as in DECISIONS.md section 8. |
| U9 | The name SOLID SNAKE and its trademark or association risk. | Open | SETTLED: keep working title. |
| U10 | Which depth is the primary experience, guided or open. | PROPOSAL | SETTLED: guided depth is primary. |
| U11 | Qatar data-protection and telecom law implications if real data is ever used. | Gap | Legal review. |
| U12 | Whether timing advance is modelled in the fiction. | PROPOSAL | SETTLED 2026-11-16: timing advance appears in no charging record, so it is a separate radio-measurement source, ASSUMPTION, case A only (DECISIONS.md section 8). |
| U13 | Record model: TS 32.250 covers CS-domain charging. IMS/VoLTE charging is TS 32.260. Try TS 32.260 and TS 32.298 in Phase A. If readable, use IMS records. If not, keep TS 32.250 MOC fields and label as CS-fallback assumption. Either way, write the choice as settled in the decisions document. | PROPOSAL | SETTLED in Phase A: IMS records (TS 32.260, TS 32.298). |

## 12. Case catalogue and ground truth

The product includes four cases, each with hidden ground truth, synthetic records and expected-not-observed items. [PROPOSAL]

| Case | Title | Main outcome | Ground truth | Role |
|---|---|---|---|---|
| A | SIM-box bypass on one cell | Simulated verified finding (level 5) | A SIM box is operating on the target cell, placing approximately 400 calls over 72 hours to domestic subscribers. In the same window, inbound international traffic on one high-cost route is below that route's baseline. [FICTION] | Primary case: the full investigative journey. |
| B | Call-centre lookalike | Hypothesis remains (level 4) | A legitimate call centre with approximately 50 SIMs, all on one cell, generating similar call patterns. No evidence contradicts this explanation; the hypothesis survives. [FICTION] | Hard negative: shows that indicators alone cannot settle intent. |
| C | IoT/M2M fleet | Claim falls from level 4; case ends legitimate | Cellular-connected IoT devices from one vendor sharing a radio footprint with SIM-box indicators. Evidence correlation reveals the lookalike. Case ends as legitimate. [FICTION] | Demonstration that additional evidence can exonerate. |
| D | International revenue share fraud (IRSF) contrast case | Hypothesis with different indicators (level 4) | Revenue-share charges to premium destinations routed through a compromised PBX. Shows that fraud types have different records and require different reasoning. [FICTION] | Teaches fraud-type distinction. |

Each case provides: 500-2000 synthetic call records, derived indicators, independent evidence sources (inbound traffic observation, device metadata), geographic cell associations, and the evidence-to-claim chain to level 4 or 5.

## 13. Build constraints

[PROPOSAL]

### Performance budgets

- First meaningful paint: < 2s on 4G throttle. Measured as Largest Contentful Paint under 2.0 s at 1.6 Mbps down, 750 Kbps up, 150 ms latency and 4x CPU slowdown, with the LCP element being static text in the HTML. [PROPOSAL: reading of the older metric; approved 2026-11-16]
- JavaScript budget: < 150KB gzipped for the first load (shell, catalogue and stage 1). Each later stage chunk is at most 25 KB gzipped, the WebGL chunk at most 45 KB, and the whole walk at most 320 KB gzipped. The core bundle excludes the one lazy-loaded chunk for the optional 3D moment (OGL preferred, far smaller), and "none" is allowed for that moment. [Approved 2026-11-16; DECISIONS.md section 9]
- Time to find missing evidence for case A: < 3 clicks, < 8s of reading.

### Reduced motion and accessibility

- gsap.matchMedia() with a fully readable, unpinned fallback for all pinned scroll sections.
- Pinned scroll sections must make sense without JavaScript animation.
- Every claim level visually distinct without relying on colour or motion alone (WCAG 2.2 AA).

### Local-first stack

- Vite + TypeScript with no framework (small state, GSAP-friendly).
- Small Node API with plain-function handlers for future Azure Functions Flex migration.
- Build output compatible with Azure Static Web Apps.
- Self-hosted open-licence fonts with licence named.
- GSAP core, ScrollTrigger, Flip, SplitText; DrawSVG/MorphSVG if justified.
- d3-geo for map projection.
- Lenis for smooth scroll (no scroll-jacking).
- OGL preferred (far smaller than Three.js) only for one justified moment, behind prefers-reduced-motion and lazy-loaded separately from core bundle.

## Source register

| Source | Link | Used for | Limits |
|---|---|---|---|
| ITU-T E.371 (02/2026), Deemed impermissible traffic | https://www.itu.int/epublications/en/publication/itu-t-e-371-2026-02-deemed-impermissible-traffic | Category list (P5) | Summary page only; no definitions or access terms read. |
| ETSI TS 132 297 V17.3.0 (Release 17, May 2024) | https://www.etsi.org/deliver/etsi_ts/132200_132299/132297/17.03.00_60/ts_132297v170300p.pdf | Confirms it is CDR file format and transfer (P1) | Does not contain CDR content. |
| ETSI TS 132 250 V19.0.0, charging management, CS domain (replaces the itecspec mirror) | https://www.etsi.org/deliver/etsi_ts/132200_132299/132250/19.00.00_60/ts_132250v190000p.pdf | Mobile-originated record clause checked against the mirror (U6); shows the CS record has 2G and 3G columns only | Describes CS only, so it cannot describe a VoLTE call. Text read, not page images. |
| ETSI TS 132 260 V19.3.0, IMS charging | https://www.etsi.org/deliver/etsi_ts/132200_132299/132260/19.03.00_60/ts_132260v190300p.pdf | S-CSCF CDR (Table 6.1.3.3.1), IBCF CDR (Table 6.1.3.10.1), location clause 5.1.9 | Categories read from text extracted from the PDF, not page images; other tables and the Event CDR not read. |
| ETSI TS 132 298 V19.6.0, charging data record parameter description | https://www.etsi.org/deliver/etsi_ts/132200_132299/132298/19.06.00_60/ts_132298v190600p.pdf | Field definitions, clause 5.1.3.1 | Text read, not page images. |
| ETSI TS 124 229 V19.7.0, IMS call control (SIP) | https://www.etsi.org/deliver/etsi_ts/124200_124299/124229/19.07.00_60/ts_124229v190700p.pdf | Network-provided or device-reported access network information, clause 7.2A.4 | Only the cited clause was used. |
| ETSI TS 123 501 V19.9.0, 5G system architecture | https://www.etsi.org/deliver/etsi_ts/123500_123599/123501/19.09.00_60/ts_123501v190900p.pdf | Clause 5.30.2.1: MCC 999 as assigned by ITU for private networks | ITU-T E.212 could not be opened, so the ITU side is INFERRED. |
| ETSI TS 136 213 V19.5.0, LTE physical layer procedures | https://www.etsi.org/deliver/etsi_ts/136200_136299/136213/19.05.00_60/ts_136213v190500p.pdf | Timing advance step size (clause 4.2.3, with TS 36.211) | The step size in metres is INFERRED arithmetic. |
| Natural Earth, terms of use | https://www.naturalearthdata.com/about/terms-of-use/ | Public-domain status of the 1:10m coastline | Official Qatar geographic data stays unopened and unused. |
| Oh et al., NDSS 2023, Preventing SIM Box Fraud Using Device Model Fingerprinting | https://www.ndss-symposium.org/ndss-paper/preventing-sim-box-fraud-using-device-model-fingerprinting/ | Threat model, lab results, residual risk, CDR timing limit | Lab LTE testbed. Read in full in Phase A (18 of 18 pages, text layer), after the first discovery read to character 100,000 of 111,903. |
| Ighneiwa and Mohamed, Bypass Fraud Detection: Artificial Intelligence Approach | https://arxiv.org/pdf/1711.04627 | Operator-CDR approach, cited prior work | No year stated in the text; dataset size and metrics not reported. Cited papers read only through this one. |
| BICS, Telco Fraud Whitepaper | https://www.bics.com/wp-content/uploads/2022/02/Telco-Fraud-Whitepaper.pdf | Definitions of bypass, IRSF, refiling, FAS; IRSF timings | Vendor source. Little on detection indicators or false positives. |
| Pinsent Masons, Telecoms regulation in Qatar | https://www.pinsentmasons.com/out-law/guides/telecoms-regulation-in-qatar | Legal framework, CRA role, penalties | Secondary source. No coverage of bypass, interference or data protection. |
| Gulf Times, CRA 3G cessation (19 Aug 2024) | https://www.gulf-times.com/article/688896/qatar/cra-announces-cessation-of-3g-mobile-telecommunications-services-by-december-31-2025/amp | 3G end date and what remains | News report of the CRA decision. |
| OpenCelliD | https://opencellid.org/ | Crowd-sourced, estimated cell positions | Licence page not read. |
| OpenStreetMap copyright | https://www.openstreetmap.org/copyright | ODbL and attribution | None material. |
| Awwwards Sites of the Day | https://www.awwwards.com/websites/sites_of_the_day/ | Reference inspection | Names only; sample is small. |
| Active Theory | https://activetheory.net/ | Reference inspection | One viewport, one visit. |
| PeachWeb gallery | https://peachweb.io/gallery | Reference inspection | Individual gallery sites not opened. |
| ECC Report 275 | https://docdb.cept.org/download/1321 | Not used | Returned binary data; not read. |
