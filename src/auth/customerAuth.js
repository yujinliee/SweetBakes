import { supabase } from '../lib/supabase.js'

export async function getCustomerAuthStatus() {
  const { data, error } = await supabase.auth.getSession()
  const user = data?.session?.user || null
  if (error || !user) return { status: 'unauthenticated', user: null, role: null }
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError) return { status: 'unauthenticated', user: null, role: null }
  const role = profile?.role || null
  return { status: role === 'admin' ? 'admin' : role === 'customer' ? 'customer' : 'unauthenticated', user, role }
}
