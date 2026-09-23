import type { Sql } from 'npm:postgres@3'

export interface TableSchema {
  [tableName: string]: { columnName: string; dataType: string }[]
}

// Live allowlist of tables/columns, read from the customer DB itself on
// every request. Nothing here is trusted from the client.
export async function introspectSchema(sql: Sql): Promise<TableSchema> {
  const rows = await sql<{ table_name: string; column_name: string; data_type: string }[]>`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `

  const schema: TableSchema = {}
  for (const row of rows) {
    if (!schema[row.table_name]) schema[row.table_name] = []
    schema[row.table_name].push({ columnName: row.column_name, dataType: row.data_type })
  }
  return schema
}
