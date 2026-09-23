import { assertSafeIdentifier, quoteIdentifier } from './identifier.ts'
import type { TableSchema } from './schema.ts'
import { ROW_CAP } from './customerDb.ts'

export interface QueryRule {
  field: string
  operator: string
  value?: unknown
}

export interface QueryRuleGroup {
  combinator: 'and' | 'or'
  rules: (QueryRule | QueryRuleGroup)[]
}

export interface StructuredQuery {
  table: string
  columns: string[]
  filter?: QueryRuleGroup
  limit?: number
}

function isRuleGroup(rule: QueryRule | QueryRuleGroup): rule is QueryRuleGroup {
  return 'rules' in rule
}

const OPERATORS: Record<string, (col: string, paramIndex: () => number) => { sql: string; needsValue: boolean }> = {
  '=': (col, next) => ({ sql: `${col} = $${next()}`, needsValue: true }),
  '!=': (col, next) => ({ sql: `${col} != $${next()}`, needsValue: true }),
  '<': (col, next) => ({ sql: `${col} < $${next()}`, needsValue: true }),
  '<=': (col, next) => ({ sql: `${col} <= $${next()}`, needsValue: true }),
  '>': (col, next) => ({ sql: `${col} > $${next()}`, needsValue: true }),
  '>=': (col, next) => ({ sql: `${col} >= $${next()}`, needsValue: true }),
  contains: (col, next) => ({ sql: `${col} ILIKE $${next()}`, needsValue: true }),
  beginsWith: (col, next) => ({ sql: `${col} ILIKE $${next()}`, needsValue: true }),
  endsWith: (col, next) => ({ sql: `${col} ILIKE $${next()}`, needsValue: true }),
  null: (col) => ({ sql: `${col} IS NULL`, needsValue: false }),
  notNull: (col) => ({ sql: `${col} IS NOT NULL`, needsValue: false }),
  in: (col, next) => ({ sql: `${col} = ANY($${next()})`, needsValue: true }),
}

function transformValueForOperator(operator: string, value: unknown): unknown {
  if (operator === 'contains') return `%${value}%`
  if (operator === 'beginsWith') return `${value}%`
  if (operator === 'endsWith') return `%${value}`
  if (operator === 'in') return Array.isArray(value) ? value : [value]
  return value
}

/**
 * Builds a parameterized SQL statement from a structured query, validating
 * every table/column reference against the live schema allowlist. Only
 * literal values ever flow through as parameters ($1, $2, ...); identifiers
 * are checked, then interpolated as quoted, allowlisted strings.
 */
export function buildSelectQuery(
  query: StructuredQuery,
  schema: TableSchema
): { text: string; params: unknown[] } {
  const tableColumns = schema[query.table]
  if (!tableColumns) {
    throw new Error(`Unknown table: ${query.table}`)
  }
  const validColumnNames = new Set(tableColumns.map((c) => c.columnName))

  assertSafeIdentifier(query.table, 'table name')
  const quotedTable = quoteIdentifier(query.table)

  const columns = query.columns.length > 0 ? query.columns : Array.from(validColumnNames)
  const quotedColumns = columns.map((col) => {
    if (!validColumnNames.has(col)) throw new Error(`Unknown column: ${col}`)
    assertSafeIdentifier(col, 'column name')
    return quoteIdentifier(col)
  })

  const params: unknown[] = []
  let paramCount = 0
  const nextParam = () => {
    paramCount += 1
    return paramCount
  }

  function renderGroup(group: QueryRuleGroup): string {
    const parts = group.rules
      .map((rule) => (isRuleGroup(rule) ? `(${renderGroup(rule)})` : renderRule(rule)))
      .filter((s): s is string => s !== null)
    if (parts.length === 0) return ''
    const joiner = group.combinator === 'or' ? ' OR ' : ' AND '
    return parts.join(joiner)
  }

  function renderRule(rule: QueryRule): string | null {
    if (!validColumnNames.has(rule.field)) {
      throw new Error(`Unknown column in filter: ${rule.field}`)
    }
    assertSafeIdentifier(rule.field, 'column name')
    const quotedCol = quoteIdentifier(rule.field)
    const op = OPERATORS[rule.operator]
    if (!op) throw new Error(`Unsupported operator: ${rule.operator}`)
    const rendered = op(quotedCol, nextParam)
    if (rendered.needsValue) {
      params.push(transformValueForOperator(rule.operator, rule.value))
    }
    return rendered.sql
  }

  let whereClause = ''
  if (query.filter && query.filter.rules.length > 0) {
    const rendered = renderGroup(query.filter)
    if (rendered) whereClause = ` WHERE ${rendered}`
  }

  const limit = Math.min(query.limit ?? ROW_CAP, ROW_CAP)
  const limitParam = nextParam()
  params.push(limit)

  const text = `SELECT ${quotedColumns.join(', ')} FROM ${quotedTable}${whereClause} LIMIT $${limitParam}`

  return { text, params }
}
