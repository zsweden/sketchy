import { listFrameworks } from '../../frameworks/registry';

export const modifyDiagramTool = {
  type: 'function' as const,
  function: {
    name: 'modify_diagram',
    description:
      'Apply changes to the diagram: add, update, or remove nodes and edges. Use this when the user asks you to change the diagram.',
    parameters: {
      type: 'object',
      properties: {
        explanation: {
          type: 'string',
          description: 'Brief explanation of what changes are being made and why.',
        },
        addNodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique id for the new node (e.g. "new_1")' },
              label: { type: 'string', description: 'Node text (under 15 words)' },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tag IDs to apply',
              },
              notes: {
                type: 'string',
                description: 'Optional node notes or reasoning',
              },
              value: {
                type: ['number', 'null'],
                description: 'Numeric metric value for the node (e.g. 3000000). Only for frameworks that support node values.',
              },
              unit: {
                type: ['string', 'null'],
                description: 'Unit prefix/suffix displayed with the value (e.g. "$", "%", "users"). Only for frameworks that support node values.',
              },
              color: {
                type: ['string', 'null'],
                description: 'Optional node background color as a hex code like "#FDE68A"',
              },
              textColor: {
                type: ['string', 'null'],
                description: 'Optional node text color as a hex code like "#1A1A1A"',
              },
              junctionType: {
                type: 'string',
                enum: ['and', 'or', 'add', 'multiply'],
                description: "For Value Driver Trees: 'add' (children summed) or 'multiply' (children multiplied). For logic trees: 'and' or 'or'.",
              },
            },
            required: ['id', 'label'],
          },
        },
        updateNodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Existing node ID to update' },
              label: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              notes: { type: 'string' },
              value: {
                type: ['number', 'null'],
                description: 'Numeric metric value, or null to clear it. Only for frameworks that support node values.',
              },
              unit: {
                type: ['string', 'null'],
                description: 'Unit prefix/suffix, or null to clear it. Only for frameworks that support node values.',
              },
              color: {
                type: ['string', 'null'],
                description: 'Set the node background color with a hex code, or null to clear it',
              },
              textColor: {
                type: ['string', 'null'],
                description: 'Set the node text color with a hex code, or null to clear it',
              },
              junctionType: {
                type: 'string',
                enum: ['and', 'or', 'add', 'multiply'],
                description: "For Value Driver Trees: 'add' (children summed) or 'multiply' (children multiplied). For logic trees: 'and' or 'or'.",
              },
            },
            required: ['id'],
          },
        },
        removeNodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of nodes to remove',
        },
        addEdges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Source node ID (cause)' },
              target: { type: 'string', description: 'Target node ID (effect)' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence level (default: high)' },
              polarity: { type: 'string', enum: ['positive', 'negative'], description: 'For signed diagrams: positive = same-direction influence, negative = opposite-direction influence' },
              delay: { type: 'boolean', description: 'Whether the source affects the target with a delay' },
              notes: { type: 'string', description: 'Optional annotation or reasoning for this edge' },
            },
            required: ['source', 'target'],
          },
        },
        updateEdges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Existing edge ID to update' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              polarity: { type: 'string', enum: ['positive', 'negative'] },
              delay: { type: 'boolean' },
              notes: { type: 'string', description: 'Annotation or reasoning for this edge' },
            },
            required: ['id'],
          },
          description: 'Update properties of existing edges',
        },
        removeEdgeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of edges to remove',
        },
      },
      required: ['explanation'],
    },
  },
};

export const anthropicModifyDiagramTool = {
  name: modifyDiagramTool.function.name,
  description: modifyDiagramTool.function.description,
  input_schema: modifyDiagramTool.function.parameters,
};

export const suggestFrameworksTool = {
  type: 'function' as const,
  function: {
    name: 'suggest_frameworks',
    description:
      'Recommend 1-3 thinking frameworks that best fit the user\'s problem, ranked from best to worst fit. Call this when the user describes a problem or situation that would benefit from structured diagramming.',
    parameters: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          description: 'Ranked framework suggestions, best fit first.',
          items: {
            type: 'object',
            properties: {
              frameworkId: {
                type: 'string',
                enum: listFrameworks().map((fw) => fw.id),
                description: 'The framework ID',
              },
              frameworkName: {
                type: 'string',
                description: 'The display name of the framework',
              },
              reason: {
                type: 'string',
                description: 'Why this framework fits the user\'s situation (1-2 sentences)',
              },
            },
            required: ['frameworkId', 'frameworkName', 'reason'],
          },
        },
      },
      required: ['suggestions'],
    },
  },
};

export const anthropicSuggestFrameworksTool = {
  name: suggestFrameworksTool.function.name,
  description: suggestFrameworksTool.function.description,
  input_schema: suggestFrameworksTool.function.parameters,
};
