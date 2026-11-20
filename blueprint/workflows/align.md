# Align: report where the blueprint documents disagree

**Run:** on demand ("follow `blueprint/workflows/align.md`"), and after a specification change that touches more than one of 01–07.
**Changes:** nothing. This task is read-only. The product owner decides each finding; a later edit applies only those decisions.
**Ends with:** a rectification list as your final message.

## Goal

`00-product-core.md` is the constitution. Documents 01–07 have to be able to deliver it, and they have to agree with each other. This pass finds the sentences that make that false.

`sync`, `audit` and `review` compare the blueprint to code or to a change. This one never reads the code. It also does not rewrite the documents: several findings in a real pass are resolved in the opposite direction from the first suggestion, and that decision belongs to the owner.

Report only a contradiction that requires a sentence to change or be removed. Do not report wording that could be clearer, missing cross-references, or a paragraph that would restate a rule another document already owns. One fact has one owner. Prefer deleting the extra sentence over adding a clarification.

## Steps

1. Read `blueprint/00-product-core.md` fully. Do not edit it. Read `blueprint/README.md` for which document owns what.
2. Check 01–07, each against 00 and against the documents it depends on. A finding names the document that should change.
   - **01 Product.** Behaviour, scope, personas or constraints that contradict 00, or a function 01 requires that neither 02 nor 05 can reach. If the function is only missing from 02 or 05, the finding belongs there.
   - **02 UX.** A user-facing function that no interface in 05 can perform, or a function 00 or 01 does not include. If 05 already provides it under another name, it is not a finding.
   - **03 Domain.** An entity, invariant or term that contradicts 00, or that makes a behaviour required by 01 impossible. Detail that is consistent with 00 is not a finding.
   - **04 Architecture.** A design that cannot deliver a capability required by 00 or 01, or that adds a runtime, trust boundary or behaviour 00 rules out. If the missing piece is an interface, the finding belongs in 05.
   - **05 Interfaces.** An interface for something 00 or 01 excludes. A missing interface only when 00 and 01 require the function and 02 shows it. If 02 invented the function, the finding belongs in 02.
   - **06 Deployment.** Hosting, tenancy, network, update or trust that contradicts a hard constraint in 00, or that makes a required capability impossible.
   - **07 Roadmap.** A phase or task inside the stated v1 boundary that commits to something 00 places out of scope. Later phases for later scope are not findings.
3. Where 01–07 cannot be made true without changing 00, quote the 00 sentence under *Needs a decision*. Do not propose a patch to 00 in the body of 01–07.

## Report

Keep it short. If a document has no finding, say so in one line.

```
# Blueprint alignment · <date>

| Document | Section | Contradiction | Rectification (one sentence) |
|---|---|---|---|

## Needs a decision in 00
- "<quote>" — <one-sentence change only the product owner can make>
```

Every row is a sentence to change or delete, in the document that owns it. No clarifications section.
