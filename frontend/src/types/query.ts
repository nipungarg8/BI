export interface TableSchema {
  [tableName: string]: { columnName: string; dataType: string }[]
}

export interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
  rowCapped: boolean
  generatedSql: string
}

export interface SavedQuery {
  id: string
  user_id: string
  connection_id: string
  name: string
  structured_query: unknown
  generated_sql: string
  created_at: string
}
