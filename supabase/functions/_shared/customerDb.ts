import postgres from 'npm:postgres@3'

export const STATEMENT_TIMEOUT_MS = 30_000
export const ROW_CAP = 5_000

export interface ConnectionParams {
  host: string
  port: number
  database: string
  username: string
  password: string
  sslMode: string
}

// Opens a short-lived connection to the customer's database as a read-only
// session. `default_transaction_read_only` rejects any write, even if the
// role has write privileges, as defense-in-depth on top of asking users for
// a read-only role. Statement timeout bounds how long a single query (or
// the connection test) may run.
export function connectCustomerDb(params: ConnectionParams) {
  return postgres({
    host: params.host,
    port: params.port,
    database: params.database,
    username: params.username,
    password: params.password,
    ssl: params.sslMode === 'disable' ? false : 'require',
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
    connection: {
      default_transaction_read_only: true,
      statement_timeout: STATEMENT_TIMEOUT_MS,
    },
  })
}
