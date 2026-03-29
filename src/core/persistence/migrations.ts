// Each key is a source version; the function migrates to version + 1.
export const migrations: Record<
  number,
  (data: Record<string, unknown>) => Record<string, unknown>
> = {
  1: (data) => {
    const edges = (data.edges as Array<Record<string, unknown>>) ?? [];
    return {
      ...data,
      schemaVersion: 2,
      edges: edges.map((e) => ({ ...e, confidence: e.confidence ?? 'high' })),
    };
  },
  2: (data) => {
    const settings = (data.settings as Record<string, unknown> | undefined) ?? {};
    return {
      ...data,
      schemaVersion: 3,
      settings: {
        ...settings,
        edgeRoutingMode: settings.edgeRoutingMode ?? 'dynamic',
      },
    };
  },
};
