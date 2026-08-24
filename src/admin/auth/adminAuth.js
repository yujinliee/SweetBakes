import { supabase } from '../../lib/supabase.js'

const adminAccessDeniedMessage = 'Admin access is restricted to authorized staff accounts.'
const invalidCredentialsMessage = 'Invalid email or password.'
const isDevelopment = import.meta.env.DEV

const logAuthDebug = (...values) => {
  if (isDevelopment) {
    console.debug('[AUTH]', ...values)
  }
}

const logAuthError = (...values) => {
  if (isDevelopment) {
    console.error('[AUTH]', ...values)
  }
}

const logAdminLoginDebug = (...values) => {
  if (isDevelopment) {
    console.log('[ADMIN LOGIN]', ...values)
  }
}

async function getAdminProfileRole(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      logAuthError('profile query error:', error.message)
      logAdminLoginDebug('profile error:', error)
      return { role: null, error }
    }

    logAuthDebug('profile role:', profile?.role || null)
    logAdminLoginDebug('profile:', profile)
    logAdminLoginDebug('role:', profile?.role || null)
    return { role: profile?.role || null, error: null }
  } catch (error) {
    logAuthError('profile query failed:', error)
    logAdminLoginDebug('profile error:', error)
    return { role: null, error }
  }
}

export async function getAdminAuthStatus() {
  try {
    const { data, error } = await supabase.auth.getSession()
    const session = data?.session || null
    const user = session?.user || null

    logAuthDebug('session exists:', Boolean(session))
    logAuthDebug('user id:', user?.id || null)

    if (error) {
      logAuthError('session error:', error.message)
      return { status: 'unauthenticated', isAuthenticated: false, user: null, error }
    }

    if (!user) {
      return { status: 'unauthenticated', isAuthenticated: false, user: null, error: null }
    }

    const { role, error: profileError } = await getAdminProfileRole(user.id)

    if (profileError || role !== 'admin') {
      await supabase.auth.signOut()
      return {
        status: 'unauthorized',
        isAuthenticated: false,
        user,
        role,
        error: profileError,
      }
    }

    return { status: 'admin', isAuthenticated: true, user, role }
  } catch (error) {
    logAuthError('auth status check failed:', error)
    return { status: 'unauthenticated', isAuthenticated: false, user: null, error }
  }
}

export async function signInAdmin(email, password) {
  try {
    logAuthDebug('admin login submit started')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    logAuthDebug('signInWithPassword success:', Boolean(data?.user && !error))
    logAuthDebug('authenticated user id:', data?.user?.id || null)
    logAdminLoginDebug('Supabase auth success:', Boolean(data?.user && !error))
    logAdminLoginDebug('user id:', data?.user?.id || null)

    if (error || !data?.user) {
      if (error) {
        logAuthError('sign in error:', error.message)
        logAdminLoginDebug('auth error:', error)
      }

      return { success: false, message: invalidCredentialsMessage }
    }

    const { role, error: profileError } = await getAdminProfileRole(data.user.id)

    if (profileError || role !== 'admin') {
      await supabase.auth.signOut()
      return { success: false, message: adminAccessDeniedMessage }
    }

    return { success: true, user: data.user, role }
  } catch (error) {
    logAuthError('admin login failed:', error)
    return { success: false, message: invalidCredentialsMessage }
  }
}

export async function signOutAdmin() {
  await supabase.auth.signOut()
}
