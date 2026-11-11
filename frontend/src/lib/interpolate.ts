/**
 * Environment variables in the API Tester use the Postman syntax: `{{name}}`.
 * Values are substituted in the URL, query params, headers, auth fields and body
 * just before a request is sent; unknown names are left as typed and reported.
 */

const VARIABLE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

export type VariableMap = ReadonlyMap<string, string>;

export interface Interpolated {
  value: string;
  /** Variable names that had no value, in order of first appearance. */
  missing: string[];
}

export function interpolate(text: string, variables: VariableMap): Interpolated {
  const missing: string[] = [];
  const value = text.replace(VARIABLE, (match, name: string) => {
    const resolved = variables.get(name);
    if (resolved !== undefined) return resolved;
    if (!missing.includes(name)) missing.push(name);
    return match;
  });
  return { value, missing };
}

/** Every distinct variable name referenced in a piece of text. */
export function findVariables(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(VARIABLE)) names.add(match[1]!);
  return [...names];
}

/**
 * Collects substitutions across many fields so a request reports each missing
 * variable once, wherever it appears.
 */
export function createInterpolator(variables: VariableMap) {
  const missing = new Set<string>();
  return {
    resolve(text: string): string {
      const result = interpolate(text, variables);
      result.missing.forEach((name) => missing.add(name));
      return result.value;
    },
    get missing(): string[] {
      return [...missing];
    },
  };
}
