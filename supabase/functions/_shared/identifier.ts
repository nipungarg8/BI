// Only simple, unquoted-Postgres-style identifiers are ever allowed through
// as table/column names. Combined with the allowlist check against live
// information_schema results, this keeps identifiers out of the injection
// surface entirely — only literal values are ever parameterized.
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export function assertSafeIdentifier(name: string, kind: string): string {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Invalid ${kind}: ${name}`)
  }
  return name
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}
