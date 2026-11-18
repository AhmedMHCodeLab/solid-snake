# 0001 Host in UAE North; region is one variable

**Context.** Owner rule: Qatar Central first, UAE North if Qatar Central cannot host every component. Front Door's Private Link, which the private-first posture requires (0002), lists UAE North and not Qatar Central among its supported regions (learn.microsoft.com/azure/frontdoor/private-link). Container Apps availability in Qatar Central for this subscription could not be confirmed without a sign-in. The data is synthetic, so there is no residency constraint.

**Decision.** Every regional resource is in UAE North. `location` is a validated variable accepting `uaenorth` or `qatarcentral`.

**Consequences.** One region, three availability zones available, no cross-region hop between the Front Door Private Link endpoint and the origin. The demo is not "hosted in Qatar".

**Revisit when** Front Door Private Link lists Qatar Central and the owner's subscription can create Container Apps there. Then switch the variable and run the verification scripts.
