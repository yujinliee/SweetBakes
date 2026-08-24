import { supabase } from '../lib/supabase.js'

function getGoogleNameParts(user) {
  const metadata = user?.user_metadata || {}
  const fullName = metadata.full_name || metadata.name || ''
  const nameParts = String(fullName).trim().split(/\s+/).filter(Boolean)

  return {
    firstName: metadata.given_name || metadata.first_name || nameParts[0] || '',
    lastName:
      metadata.family_name ||
      metadata.last_name ||
      (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''),
  }
}

export async function fetchAuthenticatedCustomerProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const user = sessionData?.session?.user || null

  if (sessionError || !user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, first_name, last_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'customer') return null

  const googleName = getGoogleNameParts(user)

  return {
    userId: user.id,
    firstName: profile.first_name || googleName.firstName,
    lastName: profile.last_name || googleName.lastName,
    email: profile.email || user.email || '',
    contactNumber: profile.contact_number || '',
  }
}
