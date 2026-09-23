export interface QueryRule {
  field: string
  operator: string
  value?: unknown
}

export interface QueryRuleGroup {
  combinator: 'and' | 'or'
  rules: (QueryRule | QueryRuleGroup)[]
}
