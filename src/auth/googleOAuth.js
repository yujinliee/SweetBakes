import { ADMIN_DASHBOARD_ROUTE } from '../admin/adminRouteConstants.js'
import { supabase } from '../lib/supabase.js'
import {
  consumeAuthReturnTo,
  getCustomerAuthReturnPath,
  peekAuthReturnTo,
  setAuthReturnTo,
} from './authReturnTo.js'

const PROFILE_SELECT = 'id, email, first_name, last_name, role'
const googleOAuthErrorMessage = 'Unable to continue with Google. Please try again.'

export const getCustomerRedirect = (value) => {
  return getCustomerAuthReturnPath(value) || '/'
}

const delay = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

const getGoogleNameParts = (user) => {
  const metadata = user?.user_metadata || {}
  const fullName = metadata.full_name || metadata.name || ''
  const fallbackParts = String(fullName).trim().split(/\s+/).filter(Boolean)

  return {
    firstName: metadata.given_name || metadata.first_name || fallbackParts[0] || '',
    lastName:
      metadata.family_name ||
      metadata.last_name ||
      (fallbackParts.length > 1 ? fallbackParts.slice(1).join(' ') : ''),
  }
}

export async function startGoogleOAuth() {
  const redirect = getCustomerRedirect(new URLSearchParams(window.location.search).get('redirect'))
  setAuthReturnTo(peekAuthReturnTo() || redirect)

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('[GOOGLE AUTH] OAuth start error:', error)
    throw new Error(googleOAuthErrorMessage)
  }
}

export function consumeGoogleRedirect() {
  return consumeAuthReturnTo() || '/'
}

export async function waitForSupabaseSession() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    if (data?.session?.user) {
      return data.session
    }

    await delay(250)
  }

  return null
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

async function waitForProfile(userId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const profile = await getProfile(userId)

    if (profile) {
      return profile
    }

    await delay(250)
  }

  return null
}

async function updateMissingProfileFields(profile, user) {
  const { firstName, lastName } = getGoogleNameParts(user)
  const updates = {}

  if (!profile.email && user.email) {
    updates.email = user.email
  }

  if (!profile.first_name && firstName) {
    updates.first_name = firstName
  }

  if (!profile.last_name && lastName) {
    updates.last_name = lastName
  }

  if (Object.keys(updates).length === 0) {
    return profile
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select(PROFILE_SELECT)
    .maybeSingle()

  if (error) {
    console.error('[GOOGLE AUTH] profile update skipped:', error)
    return profile
  }

  return data || profile
}

export async function ensureGoogleProfile(user) {
  if (!user?.id) {
    throw new Error('Missing authenticated user.')
  }

  const existingProfile = await waitForProfile(user.id)

  if (existingProfile) {
    return updateMissingProfileFields(existingProfile, user)
  }

  const { firstName, lastName } = getGoogleNameParts(user)
  const payload = {
    id: user.id,
    email: user.email || '',
    first_name: firstName,
    last_name: lastName,
    role: 'customer',
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select(PROFILE_SELECT)
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return getProfile(user.id)
    }

    throw error
  }

  return data
}

export function getRedirectForRole(role) {
  return role === 'admin' ? ADMIN_DASHBOARD_ROUTE : '/'
}

export { googleOAuthErrorMessage }
