import { createServerClient } from '@/lib/supabase-server'

const DAILY_CREDIT_AMOUNT = 50
const SIGNUP_CREDIT_AMOUNT = 500
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

export async function grantDailyCredits(userId: string): Promise<number> {
  const supabase = await createServerClient(true)
  const { data, error } = await supabase.rpc('grant_daily_credits', {
    p_user_id: userId,
  })

  if (error) {
    console.error('Failed to grant daily credits:', error)
    return 0
  }
  return data ?? 0
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

export async function ensureCredits(userId: string): Promise<{ ok: boolean; credits: number }> {
  const credits = await grantDailyCredits(userId)
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
