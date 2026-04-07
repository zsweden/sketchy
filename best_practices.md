# Framework Best Practices

Expert-level best practices for each Sketchy framework. Combines established guidance with practitioner-level rigor tests.

---

## 1. Current Reality Tree (CRT)

**Origin:** Theory of Constraints (Eliyahu Goldratt)

**Core Practices:**
- Start with Undesirable Effects (UDEs) at the top, trace cause-and-effect downward to root causes
- Use "If… Then…" logic rigorously for every connection
- Focus on finding the 1-2 core root causes that explain most UDEs — don't treat symptoms
- Collaborate with stakeholders — multiple perspectives improve causal accuracy
- Read bottom-up, build top-down — root causes at the bottom, effects at the top
- Apply the Categories of Legitimate Reservation (CLR) to validate every causal link

**Rigor Upgrades:**
- **Sufficiency test on every link** — not just "If A then B" but: is A alone enough to cause B? If not, what else is required?
- **Explicit AND/OR causality discipline** — OR = independent causes, AND = co-dependent causes. Most CRTs silently mix these, which breaks the model.
- **Time ordering constraint** — causes must precede effects. Sounds obvious; almost always violated.
- **Ban vague nodes** — "Poor strategy" / "bad communication" are invalid. Nodes must be observable, falsifiable states.
- **Causality ≠ correlation** — most CRTs are storytelling graphs, not causal systems. Force rigor on every link.

**Sources:** [iSixSigma](https://www.isixsigma.com/dictionary/current-reality-tree/), [SixSigma.us](https://www.6sigma.us/six-sigma-in-focus/current-reality-tree/), [Optimal Service Management](https://www.optimalservicemanagement.com/blog/theory-of-constraints-using-a-current-reality-tree/)

---

## 2. Future Reality Tree (FRT)

**Origin:** Theory of Constraints (Goldratt)

**Core Practices:**
- Start with injections (proposed solutions) and build upward to Desirable Effects
- Actively search for negative side-effects (UDEs) in every branch
- Focus on the whole system, not individual parts
- Use FRTs to stress-test other people's proposals — map their suggestion as an injection and trace consequences
- Pair with a CRT: the CRT identifies what to change, the FRT validates what to change *to*

**Rigor Upgrades:**
- **Injection minimality test** — what is the smallest set of changes that achieves the outcome?
- **Negative Branch Reservation (NBR) discipline** — systematically generate failure modes for each injection. This is not optional; it is the core of FRT rigor.
- **Feasibility constraint** — can this injection actually be implemented given organizational constraints?
- **Avoid loops** — FRTs are not CLDs. Loops reduce clarity in solution validation.
- **Reinforcing loops emphasis is misleading** — prioritize clear linear causality over self-sustaining loop narratives.

**Sources:** [SixSigma.us](https://www.6sigma.us/six-sigma-in-focus/future-reality-tree-frt/), [Flying Logic](https://flyinglogic.com/1158/how-to-create-a-future-reality-tree-with-flying-logic/), [Vithanco](https://vithanco.com/notations/TOC/future-reality-tree/)

---

## 3. Prerequisite Tree (PRT)

**Origin:** Theory of Constraints (Goldratt)

**Core Practices:**
- State the target clearly first, then list all obstacles blocking it
- For each obstacle, define an Intermediate Objective (IO) that overcomes it
- Sequence IOs in prerequisite order — what must happen before what
- Build collaboratively — the PRT's main value is the team discussion it generates
- Validate with Categories of Legitimate Reservation (CLR)

**Rigor Upgrades:**
- **Obstacle quality test** — obstacles must be specific, actionable, and real. "Lack of alignment" is useless.
- **Distinguish obstacle vs constraint vs assumption** — these are different things and require different responses.
- **Critical path identification** — not all IOs are equal. Identify bottleneck IOs explicitly.
- **Parallel vs sequential logic** — many PRTs over-sequence when IOs could run in parallel, causing slow execution.

**Sources:** [TOC Institute](https://www.tocinstitute.org/prerequisite-tree.html), [BPIR](https://www.bpir.com/tools-techniques/the-prerequisite-tree-prt/), [Chris Hohmann](https://hohmannchris.wordpress.com/2015/07/11/thinking-processes-prerequisite-tree/)

---

## 4. Strategy & Tactics Tree (STT)

**Origin:** Theory of Constraints (Goldratt's last TP tool)

**Core Practices:**
- Each entry has 5 parts: Necessary Assumption, Strategy, Parallel Assumption, Tactic, Sufficiency Assumption
- Strategy = the objective; Tactic = the action — always pair them
- Use for large-scale change initiatives (new product lines, market entry)
- Focus on communication and synchronized execution — the tree makes logic visible to all stakeholders
- Tailor tactics to your organization's unique constraints

**Rigor Upgrades:**
- **Vertical coherence test** — every tactic must clearly support the strategy above it.
- **Horizontal consistency test** — tactics across branches must not conflict with each other.
- **Resource realism** — can all tactics actually be executed simultaneously given real resource constraints?
- **Communication and logic are co-equal** — the 5-part structure enforces logic discipline in service of communication. Neither dominates.

**Sources:** [Goldratt Marketing](https://www.toc-goldratt.com/en/toc-application/strategy-and-tactic-tree), [Harmony Apps](https://webapp.harmonyapps.com/What-Is-TOC-Strategy-and-Tactic-Trees)

---

## 5. Goal Tree

**Origin:** Theory of Constraints / Dettmer's Logical Thinking Process

**Core Practices:**
- Start with one top-level goal, decompose into Critical Success Factors (CSFs), then into Necessary Conditions (NCs)
- Every NC must be met — if one fails, the goal is at risk
- Use necessity logic: "In order to have X, I must have Y"
- Verify links for clarity, entity existence, and sufficiency
- Use the tree as a living roadmap — monitor progress at each level

**Rigor Upgrades:**
- **Distinguish necessary vs sufficient conditions** — these are different logical relationships and Goal Trees often conflate them.
- **Constraint identification** — which NC is currently limiting the system? Focus there first.
- **Non-linear contribution** — not all NCs matter equally. Some are binding constraints, others have slack.
- **Test for redundancy** — many Goal Trees include duplicate logic disguised with different wording.

**Sources:** [20tab Goal Tree Guide](https://www.20tab.com/20blog/goal-tree-strategic-planning-corporate-roadmaps), [Splunk TOC Guide](https://www.splunk.com/en_us/blog/learn/theory-of-constraints.html), [Vithanco TOC](https://vithanco.com/notations/TOC/index/)

---

## 6. Success Tree

**Origin:** Variation of Fault Tree Analysis (inverted — focuses on what went right)

**Core Practices:**
- Identify a good outcome you want to reproduce, then map its pre-conditions
- Work backward from the success to discover what made it possible
- Document assumptions transparently so reasoning is auditable
- Great for safety huddles and retrospectives — structured way to learn from wins

**Rigor Upgrades:**
- **Treat as a reverse CRT on a success outcome** — this reframing provides the missing rigor.
- **Counterfactual test** — for every success factor, ask: if this factor were removed, would success still occur? If yes, it's not a true cause.
- **Drop probabilistic estimates** unless backed by real data — hand-wavy probability guidance does more harm than good.
- **Avoid overlap with generic root cause analysis** — the value is in the structured precondition mapping, not in labeling things as "success factors."

**Sources:** [ResearchGate - Success Tree Analysis](https://www.researchgate.net/publication/287151075_Success_Tree_Analysis), [Investigations Quality](https://investigationsquality.com/2021/11/28/tree-analysis-fault-cause-question-and-success/)

---

## 7. Causal Loop Diagram (CLD)

**Origin:** Systems Dynamics / Systems Thinking (Jay Forrester, Peter Senge)

**Core Practices:**
- Variables must be quantitatively increasable/decreasable states — not just named elements
- Label as positive states ("trust") not absences ("lack of trust")
- Odd number of minus signs = balancing loop; even = reinforcing loop
- Filter test: "If I doubled this variable, would it significantly affect the system?" If not, omit it
- Involve diverse perspectives — different departments see different parts of the system
- Keep diagrams focused: 5-15 variables per diagram; split larger systems into sub-diagrams
- Distinguish delays in causal links — they often explain counterintuitive behavior

**Rigor Upgrades:**
- **Loop dominance analysis** — which loop actually drives system behavior over time? Not all loops are equal.
- **Transition to stock & flow models** — CLDs are qualitative. For quantitative analysis, you must convert to stock-and-flow.
- **Avoid "diagram as art"** — many CLDs become unreadable spaghetti. If you can't trace a loop in 5 seconds, simplify.
- **Guard against overfitting complexity** — more variables ≠ more insight.

**Sources:** [Daniel Kim - Guidelines for Drawing CLDs](https://www.cs.toronto.edu/~sme/SystemsThinking/GuidelinesforDrawingCausalLoopDiagrams.pdf), [Cascade Institute CLD Handbook](https://cascadeinstitute.org/wp-content/uploads/2024/06/Causal-Loop-Diagrams-Handbook-June-27-2024.pdf), [The Systems Thinker](https://thesystemsthinker.com/causal-loop-construction-the-basics/)

---

## 8. Value Driver Tree (VDT)

**Origin:** Management consulting / Financial planning & analysis

**Core Practices:**
- Start with the North Star metric (what stakeholders care about), decompose into operational drivers
- For each node: define unit of measure, formula, data source, and owner
- Focus on leading indicators (predictive) over lagging indicators (retrospective)
- Every KPI needs an owner — metrics without owners don't drive action
- Combine with OKRs, Balanced Scorecards, or ROIC/EVA for full strategic alignment
- A VDT is a decision model, not a dashboard — it shows how changing one driver impacts outcomes
- Run sensitivity analysis: which drivers have the most leverage?

**Rigor Upgrades:**
- **Full equation integrity** — the tree must mathematically roll up correctly. Every parent = f(children).
- **Elasticity / sensitivity modeling** — ∂Output / ∂Driver matters more than tree structure. Know which drivers have the most leverage.
- **Distinguish causal vs accounting drivers** — many trees mix both. Accounting decompositions (Revenue = Price × Volume) are not causal models. Confusing them leads to bad decisions.
- **Guard against metric gaming** — Goodhart's Law applies. When a measure becomes a target, it ceases to be a good measure.

**Sources:** [Umbrex VDT Guide](https://umbrex.com/resources/frameworks/strategy-frameworks/value-driver-tree-analysis/), [Workpath KPI Trees](https://www.workpath.com/en/magazine/kpi-trees), [CaseBasix Driver Trees](https://www.casebasix.com/pages/driver-tree-business-decision-making)

---

## 9. Value Stream Map (VSM)

**Origin:** Toyota Production System / Lean Manufacturing

**Core Practices:**
- Map the current state first (what actually happens), then design the future state
- Form a cross-functional team of ~10 from across the organization
- Focus on identifying waste (muda): waiting, overprocessing, handoffs, rework
- Measure lead time, cycle time, and process time at each step
- Distinguish value-adding vs non-value-adding steps explicitly
- Use Gemba walks (go observe the actual work) — don't map from a conference room
- Follow up with a future state map and a concrete implementation plan with dates
- Applies beyond manufacturing: software, healthcare, admin processes

**Rigor Upgrades:**
- **Flow efficiency metric** — value-added time / total lead time. This single number tells you how much of your process is waste.
- **WIP is the hidden killer** — most waste comes from queueing, not processing. Make WIP visible.
- **Tie to Little's Law** — Lead time = WIP / Throughput. This is the fundamental equation of flow. If you don't know it, your VSM is incomplete.
- **Explicit link to flow efficiency** — without this metric, VSMs become descriptive artifacts rather than improvement tools.

**Sources:** [Lean Enterprise Institute](https://www.lean.org/lexicon-terms/value-stream-mapping/), [KAIZEN Institute](https://kaizen.com/insights/guide-vsm-lean-manufacturing/), [ASQ VSM Tutorial](https://asq.org/quality-resources/value-stream-mapping)

---

## 10. Team Topology

**Origin:** Matthew Skelton & Manuel Pais (2019 book, 2nd ed. 2025)

**Core Practices:**
- Use exactly 4 team types: Stream-Aligned, Platform, Enabling, Complicated-Subsystem
- Use exactly 3 interaction modes: Collaboration, X-as-a-Service, Facilitation
- Stream-Aligned teams should be the majority — they deliver end-to-end customer value
- Manage cognitive load as a first-class design constraint
- Apply Conway's Law intentionally — org structure mirrors architecture, so design both together
- Interaction modes should evolve over time (e.g., Collaboration → X-as-a-Service as a platform matures)
- Enabling teams are temporary by design — they upskill stream-aligned teams, then move on

**Rigor Upgrades:**
- **Topology drift is inevitable** — must be actively managed. Review interaction modes quarterly.
- **Platform team failure mode** — platforms become bottlenecks instead of accelerators when they take on too much scope or become gatekeepers.
- **Cognitive load is measurable** — use proxies like PRs per team, incident rate, number of domains owned, and context-switching frequency.
- **Evolution over time** — the topology at launch should differ from the topology at scale. Plan for transitions.

**Sources:** [Team Topologies Key Concepts](https://teamtopologies.com/key-concepts), [Martin Fowler on Team Topologies](https://martinfowler.com/bliki/TeamTopologies.html), [IT Revolution](https://itrevolution.com/product/team-topologies-second-edition/)

---

## 11. Org Structure

**Origin:** Classical organizational design / management theory

**Core Practices:**
- 7-8 direct reports is ideal for knowledge workers; fewer for technical roles, more for routine work
- Every role needs one clear supervisor — avoid ambiguous dual-reporting unless matrix structure is intentional
- Keep the chart current — establish a regular update cadence
- Show roles and decision ownership, not just names and titles
- Align teams around core functions to build subject matter expertise
- Use consistent formatting and readable labels
- Complement the static chart with RACI or decision-rights documentation

**Rigor Upgrades:**
- **Design from value flow, not hierarchy** — org charts should reflect how value is created, not just who reports to whom.
- **Decision latency matters more than reporting lines** — measure how long it takes to make and execute decisions. Optimize for that.
- **Static org charts are insufficient** — need dynamic overlays showing decision rights, workflows, and information flow.
- **Span-of-control numbers are context-dependent** — the 7-8 guideline is a starting point, not a rule. Adjust for complexity, autonomy level, and geographic distribution.

**Sources:** [AIHR Organizational Design Guide](https://www.aihr.com/blog/organizational-design/), [Creately Org Chart Best Practices](https://creately.com/guides/organizational-chart-best-practices/), [OneDirectory 2026 Guide](https://www.onedirectory.com/blog/organizational-structure-guide/)

---

## 12. Issue Tree

**Origin:** Management consulting (McKinsey, BCG, Bain)

**Core Practices:**
- Apply the MECE principle: Mutually Exclusive, Collectively Exhaustive — no gaps, no overlaps
- Frame the root question as a Yes/No question, then split into 2-5 sub-questions per layer
- Aim for 3-4 layers deep, 2-5 branches per layer
- Use four splitting lenses: stakeholder, process, segment, or math
- Follow a hypothesis-driven approach: hypothesize which branch contains the root cause, then test with data
- If data disproves the hypothesis, move to the next branch — don't force-fit

**Rigor Upgrades:**
- **Math-first decomposition when possible** — Revenue = Price × Volume is always superior to intuitive splits. Use arithmetic identities before qualitative breakdowns.
- **Kill branches aggressively** — experts prune fast, novices over-explore. Time spent on dead branches is the #1 efficiency killer.
- **Distinguish hypothesis tree vs logic tree** — a logic tree explores all possibilities; a hypothesis tree starts with a point of view. Know which one you're building.
- **MECE is a tool, not a religion** — the discipline of forced MECE reveals blind spots, but experienced practitioners know that sometimes overlap is necessary for insight. Master the rule before you break it.

**Sources:** [Crafting Cases Issue Tree Guide](https://www.craftingcases.com/issue-tree-guide/), [CaseBasix](https://www.casebasix.com/pages/issue-trees), [MConsultingPrep](https://mconsultingprep.com/issue-tree)
