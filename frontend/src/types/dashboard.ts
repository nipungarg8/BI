export interface Dashboard {
  id: string
  user_id: string
  name: string
  layout: unknown
  created_at: string
}

export type ChartType = 'bar' | 'line' | 'pie' | 'table'

export interface ChartConfig {
  xField: string
  yField: string
}

export interface DashboardCard {
  id: string
  dashboard_id: string
  saved_query_id: string
  chart_type: ChartType
  config: ChartConfig
  created_at: string
  saved_queries?: { name: string }
}

export interface QueryCache {
  saved_query_id: string
  result: Record<string, unknown>[]
  row_count: number
  cached_at: string
}
