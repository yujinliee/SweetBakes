import { AuthSessionMissingError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'

export async function requireCustomerSession() {
  // getSession waits for SDK restoration and refreshes an expired token.
  // Leave token storage and refresh coordination entirely to the canonical client.
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const session = data?.session
  if (!session?.user?.id || !session.access_token) throw new AuthSessionMissingError()
  return session
}

export function isMissingCustomerSession(error) {
  return error?.name === 'AuthSessionMissingError' || error?.status === 401 ||
    ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error?.code)
}
