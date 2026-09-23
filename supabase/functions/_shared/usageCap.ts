import { serviceClient } from './supabaseClient.ts'

export const DAILY_QUERY_CAP = 200

// Increments today's count via the service-role client (bypasses RLS by
// design — this table has no user-writable policy) and throws if the caller
// is already at the daily cap.
export async function enforceDailyQueryCap(userId: string): Promise<void> {
  const { data, error } = await serviceClient().rpc('increment_query_usage', {
    p_user_id: userId,
  })
  if (error) throw new Error(`Usage check failed: ${error.message}`)
  if ((data as number) > DAILY_QUERY_CAP) {
    throw new Error(`Daily query limit of ${DAILY_QUERY_CAP} reached`)
  }
}
