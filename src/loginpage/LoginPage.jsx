import { useState } from 'react'
import './LoginPage.css'
import { ADMIN_DASHBOARD_ROUTE } from '../admin/adminRouteConstants.js'
import { signInAdmin } from '../admin/auth/adminAuth.js'
import { clearAuthReturnTo } from '../auth/authReturnTo.js'
import { getCustomerRedirect, googleOAuthErrorMessage, startGoogleOAuth } from '../auth/googleOAuth.js'
import { SiteTopbar } from '../landingpage/LandingPage.jsx'
import { supabase } from '../lib/supabase.js'

function GoogleIcon() {
  return (
    <svg className="google-login-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.43Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.75-5.59-4.11H3.08v2.59A9.99 9.99 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.91A6.02 6.02 0 0 1 6.1 12c0-.66.11-1.3.31-1.91V7.5H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.5l3.33-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.96 3.01 14.7 2 12 2A9.99 9.99 0 0 0 3.08 7.5l3.33 2.59C7.2 7.73 9.4 5.98 12 5.98Z"
      />
    </svg>
  )
}

function LoginPage({
  onNavigate,
  onCustomerLogin,
  onCustomerLogout,
  isCustomerAuthenticated = false,
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  const handleGoogleLogin = async () => {
    try {
      setError('')
      setIsGoogleSubmitting(true)
      await startGoogleOAuth()
    } catch (oauthError) {
      console.error('[LOGIN] Google OAuth error:', oauthError)
      setError(googleOAuthErrorMessage)
      setIsGoogleSubmitting(false)
    }
  }

  const handleLoginSubmit = async (event) => {
    event.preventDefault()

    const trimmedEmail = email.trim().toLowerCase()
    const redirectTarget = new URLSearchParams(window.location.search).get('redirect')
    const safeCustomerTarget = getCustomerRedirect(redirectTarget)

    if (trimmedEmail && password) {
      setIsSubmitting(true)
      const adminResult = await signInAdmin(trimmedEmail, password)

      if (adminResult.success) {
        clearAuthReturnTo()

        if (import.meta.env.DEV) {
          console.log('[NAVIGATION] from /login admin auth ->', ADMIN_DASHBOARD_ROUTE)
        }

        setError('')
        setIsSubmitting(false)
        onNavigate?.(ADMIN_DASHBOARD_ROUTE, { replace: true })
        return
      }

      const { data, error: customerAuthError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (customerAuthError || !data?.user) {
        setError('Invalid email or password.')
        setIsSubmitting(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError || profile?.role !== 'customer') {
        await supabase.auth.signOut()
        setError('Invalid email or password.')
        setIsSubmitting(false)
        return
      }

      setError('')
      setIsSubmitting(false)
      onCustomerLogin?.(safeCustomerTarget)
      return
    }

    setError('Invalid email or password.')
  }

  const handleCreateAccount = (event) => {
    event.preventDefault()
    onNavigate?.('/register')
  }

  return (
    <main className="login-page">
      <SiteTopbar
        hideLogin
        homeHref="/"
        locationHref="/#location"
        contactHref="/#contact"
        onNavigate={onNavigate}
        onCustomerLogout={onCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />

      <div className="login-page-content">
        <form
          className="login-card"
          aria-label="Customer login"
          onSubmit={handleLoginSubmit}
        >
          <div className="login-brand">
            <span className="login-brand-name">Sweet Bakes</span>
          </div>

          <div className="login-heading">
            <p className="login-description">
              Sign in to manage your Sweet Bakes orders.
            </p>
          </div>

          <div className="login-fields">
            <label className="login-field-group">
              <span>Email Address</span>
              <input
                id="login-email"
                className="login-field"
                type="email"
                name="email"
                placeholder="Enter your email address"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError('')
                }}
              />
            </label>

            <label className="login-field-group">
              <span>Password</span>
              <span className="login-password-control">
                <input
                  id="login-password"
                  className="login-field login-field--password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError('')
                  }}
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="2.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
              </span>
            </label>
          </div>

          <div className="login-options">
            <label className="remember-option">
              <input type="checkbox" name="remember" />
              <span>Remember me</span>
            </label>
            <button className="forgot-password-link" type="button">
              Forgot Password?
            </button>
          </div>

          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>

          <div className="login-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="google-login-button"
            onClick={handleGoogleLogin}
            disabled={isGoogleSubmitting}
          >
            <GoogleIcon />
            <span>{isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}</span>
          </button>

          <p className="login-create-account">
            Don&apos;t have an account?{' '}
            <a href="/register" onClick={handleCreateAccount}>
              Create Account
            </a>
          </p>
        </form>
      </div>
    </main>
  )
}

export default LoginPage
