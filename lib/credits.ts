import { createServerClient } from '@/lib/supabase-server'

const SIGNUP_CREDIT_AMOUNT = 50000
const DAILY_CREDIT_AMOUNT = 50
const CHAT_CREDIT_COST = 1

export async function getCredits(userId: string): Promise<number> {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('user_id', userId)
    .single()

  if (error || !data) return 0
  return data.credits ?? 0
}

export async function claimDailyCredit(userId: string) {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase.rpc('claim_daily_credit', {
    p_user_id: userId,
  })

  if (error) {
    console.error('Failed to claim daily credit:', error)
    return { success: false, message: 'Failed to claim credit', credits: 0 }
  }
  return data
}

export async function getClaimStatus(userId: string, startDate: string, endDate: string) {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase.rpc('get_claim_status', {
    p_user_id: userId,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) {
    console.error('Failed to get claim status:', error)
    return []
  }
  return data || []
}

export async function deductCredits(userId: string, amount: number): Promise<boolean> {
  const supabase = await createServerClient(true)
  const { error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
  })
  if (error) {
    console.error('Failed to deduct credits:', error)
    return false
  }
  return true
}

export async function checkCredits(userId: string): Promise<{ ok: boolean; credits: number }> {
  const credits = await getCredits(userId)
  if (credits < CHAT_CREDIT_COST) {
    return { ok: false, credits }
  }
  const deducted = await deductCredits(userId, CHAT_CREDIT_COST)
  if (!deducted) {
    return { ok: false, credits }
  }
  return { ok: true, credits: credits - CHAT_CREDIT_COST }
}

export { SIGNUP_CREDIT_AMOUNT, DAILY_CREDIT_AMOUNT, CHAT_CREDIT_COST }
