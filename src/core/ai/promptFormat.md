# AI Prompt Format

Reference for how Sketchy builds AI chat prompts. See `openai-client.ts` for implementation.

## System Prompt

Built dynamically per request by `buildSystemPrompt(diagram, framework)`.

```
You are an AI assistant for Sketchy, a thinking-frameworks diagram editor.

The user is working on a "{framework.name}" diagram called "{diagram.name}".
{framework.description}

Current diagram state:
Nodes:
  - id="n1", label="...", tags=[UDE], notes="...", junction=and
  - ...

Edges (source {edgeVerb} target):
  - id="e1", "n1" → "n2", confidence=medium, polarity=positive, delay=true, notes="..."
  - ...

{loop analysis if cyclic framework}

You can either:
1. Answer questions about the diagram.
2. Make changes by calling the modify_diagram tool.

Only modify what the user asks for.

Rules for modifications:
- {DAG rule or cycle rule, depending on framework}
- Keep node labels concise (under 15 words).
- New node IDs: "new_1", "new_2", etc.
- Available tags: {from framework.nodeTags}.
- Do NOT set color/textColor unless the user asks.
- {junction rule if framework supports junctions}
- {polarity or confidence rule}
- {delay rule}
- {loop reasoning rule if cyclic}
- Edges can have notes for causal reasoning.
- Mention elements as: [Label][kind:id] (e.g. [Demand][node:n1], [R1][loop:n1>n2>n3]).
- Reply in plain text only. No Markdown formatting.
- Always explain your reasoning.
```

## Tool: modify_diagram

Single tool call with optional arrays:

```json
{
  "explanation": "Brief description of changes and why",
  "addNodes": [
    { "id": "new_1", "label": "...", "tags": ["ude"], "notes": "...", "color": "#FDE68A", "textColor": "#1A1A1A" }
  ],
  "updateNodes": [
    { "id": "n1", "label": "...", "tags": [...], "notes": "...", "color": null, "textColor": null }
  ],
  "removeNodeIds": ["n3"],
  "addEdges": [
    { "source": "n1", "target": "new_1", "confidence": "medium", "polarity": "positive", "delay": true, "notes": "..." }
  ],
  "updateEdges": [
    { "id": "e1", "confidence": "low", "polarity": "negative", "delay": false, "notes": "..." }
  ],
  "removeEdgeIds": ["e2"]
}
```

Only `explanation` is required. All arrays are optional.

## Framework-Dependent Rules

| Feature | DAG frameworks (CRT, FRT, PRT, etc.) | Cyclic frameworks (CLD) |
|---------|---------------------------------------|-------------------------|
| Cycles | Forbidden | Allowed |
| Edge polarity | Not used | positive / negative |
| Edge delay | Not used | Supported |
| Junctions | and / or (if supported) | Not used |
| Loop analysis | Omitted | R#/B# loop listing with signed edges |

## Conversation Handling

- History is pruned to the last 16 messages (~8 exchanges).
- Supports OpenAI, Anthropic, and generic OpenAI-compatible providers.
- Responses are streamed via SSE.
