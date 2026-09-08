import { useEffect, useState } from 'react'
import { passwordPattern, passwordValidationMessage } from '../auth/passwordReset.js'
import { SiteTopbar } from '../landingpage/LandingPage.jsx'
import { supabase } from '../lib/supabase.js'
import './LoginPage.css'

function hasRecoveryLink() {
  const url = new URL(window.location.href)
  return Boolean(
    url.searchParams.get('code') ||
      url.searchParams.get('type') === 'recovery' ||
      new URLSearchParams(url.hash.replace(/^#/, '')).get('type') === 'recovery',
  )
}

function ResetPasswordPage({ onNavigate, onCustomerLogout, isCustomerAuthenticated = false }) {
  const [pageState, setPageState] = useState('loading')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true
    let recoveryEventReceived = false

    const checkRecoverySession = async () => {
      if (!hasRecoveryLink()) {
        if (isMounted) setPageState('invalid')
        return
      }

      const code = new URL(window.location.href).searchParams.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (isMounted) setPageState('invalid')
          return
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (isMounted) {
        setPageState(!sessionError && data.session ? 'ready' : recoveryEventReceived ? 'ready' : 'invalid')
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryEventReceived = true
        if (isMounted) setPageState('ready')
      }
    })

    checkRecoverySession()

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!passwordPattern.test(newPassword)) {
      setError(passwordValidationMessage)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setIsSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setIsSubmitting(false)

    if (updateError) {
      setError('Unable to update your password. The reset link may have expired.')
      return
    }

    setPageState('updated')
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
        <form className="login-card" aria-label="Reset password" onSubmit={handleSubmit}>
          <div className="login-brand"><span className="login-brand-name">Sweet Bakes</span></div>

          {pageState === 'loading' ? <p className="login-description">Verifying your reset link...</p> : null}

          {pageState === 'invalid' ? (
            <>
              <div className="login-heading">
                <p className="login-description">This password reset link is invalid or has expired.</p>
              </div>
              <button className="login-submit" type="button" onClick={() => onNavigate?.('/forgot-password')}>
                Request a New Link
              </button>
            </>
          ) : null}

          {pageState === 'updated' ? (
            <>
              <div className="login-heading">
                <p className="login-description">Your password has been updated successfully.</p>
              </div>
              <button className="login-submit" type="button" onClick={() => onNavigate?.('/login')}>
                Back to Login
              </button>
            </>
          ) : null}

          {pageState === 'ready' ? (
            <>
              <div className="login-heading">
                <p className="login-description">Choose a new password for your account.</p>
              </div>
              <div className="login-fields">
                <label className="login-field-group">
                  <span>New Password</span>
                  <input
                    className="login-field"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => { setNewPassword(event.target.value); setError('') }}
                  />
                </label>
                <label className="login-field-group">
                  <span>Confirm New Password</span>
                  <input
                    className="login-field"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => { setConfirmPassword(event.target.value); setError('') }}
                  />
                </label>
              </div>
              {error ? <p className="login-error reset-password-error" role="alert">{error}</p> : null}
              <button className="login-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </>
          ) : null}
        </form>
      </div>
    </main>
  )
}

export default ResetPasswordPage
