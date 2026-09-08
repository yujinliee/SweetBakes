import { supabase } from '../lib/supabase.js'

const deployedAppUrl = 'https://sweetbakes-ten.vercel.app'

export const passwordPattern = /^.{6,}$/
export const passwordValidationMessage = 'Password must be at least 6 characters.'

export function getAppUrl() {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return origin
    }
  }

  return import.meta.env.VITE_APP_URL || import.meta.env.VITE_SITE_URL || deployedAppUrl
}

export function getPasswordResetRedirectUrl() {
  return `${getAppUrl().replace(/\/$/, '')}/reset-password`
}

export async function sendPasswordResetEmail(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  })
}
