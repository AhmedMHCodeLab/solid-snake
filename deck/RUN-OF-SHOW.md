# Terraform on Azure: run of show (presenter only)

Slides carry the theory. Demos run in the repo at the "In the repo" dividers. Beat numbers refer to the talk doc.

## 90-minute plan
| Min | Stage | Slides | Repo beats |
|---|---|---|---|
| 0-8 | Hook: thread, hands up, how we got here, the founder, the question | cover to question | none |
| 8-12 | Stage 4: what IaC is | iac-def, solved, teaches | none |
| 12-21 | Stage 5: Terraform and the three worlds | tf-loop to room-wins | none |
| 21-37 | Stage 6: lifecycle, providers | lifecycle-verbs to repo-lifecycle (room-plan inside) | 25, 1, 2, 3, 5, 6, 7 |
| 37-47 | Stage 7: state and isolation | state-five to wrong-workspace | 9, 19 |
| 47-56 | Stage 8: drift | drift-def to repo-state | 8, 20 |
| 56-66 | Stage 9: guardrails and modules | not-boundary to repo-guardrails (room-attack inside) | 10, 13, 16, 17, 21, 22 |
| 66-74 | Stage 10: CI/CD | cicd-flow to repo-cicd (room-pause inside) | 14, 26 |
| 74-77 | Judgement | merits, when-not, bicep, room-stack | none |
| 77-80 | Close | engineering-shift to questions | 15 |
| 80-90 | Questions | questions | none |

If a block runs long, cut branch material first (beats 11, 12, 18, the migration trap, beats 23 and 24), then shrink beats 10 and 13 to a sentence.

## 45-minute path
The route slide is gone. Spine at half pace, one beat per stage. One slide each for providers, modules and isolation. Keep: thread, question, iac-def, three-worlds, lifecycle-verbs, three-way, state-five, isolation, drift-def, lost-state, layers, opinionated, cicd-flow, when-not, outcomes.

## Room moments (yellow slides; answers appear on click)
- hands (hook): hands up if you have clicked Create in the portal; keep it up if you could rebuild it.
- room-wins (stage 5): variable precedence. Answer: prod. Without the flag, dev.
- room-plan (stage 6): new code, empty state, what will plan say? Answer: create, plus on every resource.
- room-attack (stage 9): you hold write rights and run az cosmosdb update to enable public access. Answer: Azure Policy Deny stops it.
- room-pause (stage 10): three pauses in the workflow. Answer: apply the saved plan, not a fresh one.
- room-stack (judgement): stand or sit by what you use today.
Commit first, then reveal. Cut order if short on time: room-stack, room-wins, room-pause.

## Demo blocks
See the speaker notes of repo-lifecycle, repo-state, repo-guardrails and repo-cicd. Pre-night checklist: register resource providers on the demo subscription (azurerm 5.0 no longer does by default); keep the repo public so required reviewers work; check which licence PIM needs; confirm Cosmos free tier is unused (one per subscription); delete snake-legacy afterwards.

## Q&A appendix
- Which value wins? TF_VAR_env=staging exported, terraform.tfvars says dev, command passes -var="env=prod": prod. Without the flag, dev, because tfvars outrank environment variables. Order high to low: -var and -var-file, *.auto.tfvars, terraform.tfvars.json, terraform.tfvars, TF_VAR_, default.
- Licence: BSL since August 2023; OpenTofu is the open-source fork; concepts apply to both; features from 1.14 onward need a parity check.
- Bicep: strong if everything is Azure and always will be; Terraform earns its keep beyond one cloud control plane.
- AzAPI everywhere? AVM spec says new modules use AzAPI for control plane; your root module can stay azurerm-primary.
- Deny and plan: plan never sends the create request, so a policy Deny shows at apply.
- Remaining hole: the apply identity. Contributor on its own scope plus conditioned RBAC Administrator, never Owner.
