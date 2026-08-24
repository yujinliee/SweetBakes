import { useEffect, useState } from 'react'
import {
  ensureGoogleProfile,
  consumeGoogleRedirect,
  getRedirectForRole,
  waitForSupabaseSession,
} from './googleOAuth.js'
import { clearAuthReturnTo } from './authReturnTo.js'
import { supabase } from '../lib/supabase.js'
import '../loginpage/LoginPage.css'

function AuthCallbackPage({ onNavigate, onCustomerLogin }) {
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function finishGoogleSignIn() {
      try {
        const url = new URL(window.location.href)

        if (url.searchParams.has('error') || url.searchParams.has('error_description')) {
          throw new Error(url.searchParams.get('error_description') || 'Google sign-in was cancelled.')
        }

        const authCode = url.searchParams.get('code')

        if (authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode)

          if (exchangeError) {
            throw exchangeError
          }
        }

        const session = await waitForSupabaseSession()
        const user = session?.user || null

        if (!user) {
          throw new Error('No Supabase session found after Google sign-in.')
        }

        const profile = await ensureGoogleProfile(user)
        const role = profile?.role || 'customer'

        if (role === 'admin') {
          clearAuthReturnTo()
          onNavigate?.(getRedirectForRole(role), { replace: true })
          return
        }

        if (role === 'customer') {
          const redirectParam = url.searchParams.get('redirect')
          onCustomerLogin?.(redirectParam ? decodeURIComponent(redirectParam) : consumeGoogleRedirect(), { replace: true })
          return
        }

        await supabase.auth.signOut()
        throw new Error('Unsupported account role.')
      } catch (callbackError) {
        console.error('[GOOGLE AUTH CALLBACK]', callbackError)

        if (isMounted) {
          setError('Unable to finish Google sign-in. Please try again.')
        }
      }
    }

    finishGoogleSignIn()

    return () => {
      isMounted = false
    }
  }, [onCustomerLogin, onNavigate])

  return (
    <main className="login-page">
      <div className="login-page-content">
        <section className="login-card" aria-live="polite">
          <div className="login-brand">
            <span className="login-brand-name">Sweet Bakes</span>
          </div>
          <div className="login-heading">
            <p className="login-description">
              {error || 'Finishing Google sign-in...'}
            </p>
          </div>
          {error ? (
            <button
              type="button"
              className="login-submit"
              onClick={() => onNavigate?.('/login', { replace: true })}
            >
              Back to Login
            </button>
          ) : null}
        </section>
      </div>
    </main>
  )
}

export default AuthCallbackPage
