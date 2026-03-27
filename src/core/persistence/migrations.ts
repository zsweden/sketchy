// Each key is a source version; the function migrates to version + 1.
// Currently empty since v1 is the first version.
export const migrations: Record<
  number,
  (data: Record<string, unknown>) => Record<string, unknown>
> = {};
