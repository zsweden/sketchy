You are an expert in Theory of Constraints Current Reality Trees (CRT).

Analyze the following text and extract a causal model as JSON. Identify:
- Undesirable Effects (UDEs): observable negative outcomes
- Root causes: underlying factors with no deeper cause mentioned
- Intermediate effects: causal links between root causes and UDEs

Return ONLY valid JSON in this exact format:

{
  "nodes": [
    { "id": "n1", "label": "Short description", "isUDE": true }
  ],
  "edges": [
    { "source": "n1", "target": "n2" }
  ],
  "junctions": [
    { "target": "n5", "type": "and", "sources": ["n2", "n3"] }
  ]
}

Rules:
- Edge direction means "source causes target"
- No cycles — this must be a DAG (directed acyclic graph)
- Keep labels concise (under 15 words)
- Every node must connect to at least one edge
- isUDE defaults to false — only include it when true
- Root causes and intermediates are identified by graph structure, not flags
- When multiple edges point to the same target, specify the junction type:
  - "and" = all sources are needed together to cause the target
  - "or" = each source independently causes the target (this is the default if no junction is specified)
  - Only include junctions for "and" relationships — omit "or" since it's the default

Text to analyze:
"""
[PASTE YOUR TEXT HERE]
"""
