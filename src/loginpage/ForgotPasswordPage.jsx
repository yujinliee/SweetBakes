import { useEffect, useRef, useState } from 'react'
import { SiteTopbar } from '../landingpage/LandingPage.jsx'
import { sendPasswordResetEmail } from '../auth/passwordReset.js'
import './LoginPage.css'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const defaultRateLimitSeconds = 30

function getRetryAfterSeconds(error) {
  const headerValue = typeof error?.headers?.get === 'function'
    ? error.headers.get('retry-after')
    : error?.headers?.['retry-after']
  const retryValue = error?.retryAfter ?? error?.retry_after ?? error?.details?.retry_after ?? headerValue

  if (retryValue === undefined || retryValue === null || retryValue === '') return null

  const numericValue = Number(retryValue)
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.ceil(numericValue)
  }

  const retryDate = Date.parse(String(retryValue))
  if (Number.isFinite(retryDate)) {
    const secondsUntilRetry = Math.ceil((retryDate - Date.now()) / 1000)
    return secondsUntilRetry > 0 ? secondsUntilRetry : null
  }

  return null
}

function isRateLimitError(error) {
  const status = Number(error?.status)
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()

  return status === 429 || [code, message].some((value) => (
    value.includes('over_email_send_rate_limit') ||
    value.includes('email rate limit') ||
    value.includes('rate limit') ||
    value.includes('rate-limit') ||
    value.includes('too many requests') ||
    value.includes('429')
  ))
}

function isHourlyEmailRateLimitError(error) {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()

  return code.includes('over_email_send_rate_limit') ||
    message.includes('email rate limit') ||
    message.includes('hourly email') ||
    message.includes('email send rate limit')
}

function isShortCooldownError(error) {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()

  return [code, message].some((value) => (
    value.includes('resend') ||
    value.includes('cooldown') ||
    value.includes('retry-after') ||
    value.includes('retry after') ||
    value.includes('seconds')
  ))
}

function ForgotPasswordPage({ onNavigate, onCustomerLogout, isCustomerAuthenticated = false }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0)
  const [isRapidSubmitLocked, setIsRapidSubmitLocked] = useState(false)
  const rapidSubmitTimerRef = useRef(null)

  useEffect(() => {
    if (rateLimitSeconds <= 0) return undefined

    const timerId = window.setTimeout(() => {
      setRateLimitSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          setError('')
          return 0
        }

        return currentSeconds - 1
      })
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [rateLimitSeconds])

  useEffect(() => () => {
    if (rapidSubmitTimerRef.current) window.clearTimeout(rapidSubmitTimerRef.current)
  }, [])

  const temporarilyLockSubmissions = () => {
    setIsRapidSubmitLocked(true)
    if (rapidSubmitTimerRef.current) window.clearTimeout(rapidSubmitTimerRef.current)
    rapidSubmitTimerRef.current = window.setTimeout(() => {
      setIsRapidSubmitLocked(false)
      rapidSubmitTimerRef.current = null
    }, 2000)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (rateLimitSeconds > 0 || isRapidSubmitLocked) return

    const trimmedEmail = email.trim().toLowerCase()

    if (!emailPattern.test(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }

    setError('')
    setIsSubmitting(true)
    const { error: resetError } = await sendPasswordResetEmail(trimmedEmail)
    setIsSubmitting(false)

    if (resetError) {
      if (import.meta.env.DEV) {
        console.error('[FORGOT PASSWORD]', {
          status: resetError?.status ?? null,
          code: resetError?.code ?? null,
          message: resetError?.message ?? null,
        })
      }

      if (isRateLimitError(resetError)) {
        temporarilyLockSubmissions()
        const retrySeconds = getRetryAfterSeconds(resetError)

        if (isHourlyEmailRateLimitError(resetError)) {
          setRateLimitSeconds(0)
          setError('Too many reset emails have been sent. Please try again later.')
          return
        }

        if (retrySeconds || isShortCooldownError(resetError)) {
          const cooldownSeconds = retrySeconds ?? defaultRateLimitSeconds
          setRateLimitSeconds(cooldownSeconds)
          setError('')
          return
        }

        setRateLimitSeconds(0)
        setError('Too many reset requests. Please try again later.')
        return
      }

      setError('Unable to send the reset link. Please try again.')
      return
    }

    setIsSubmitted(true)
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
        <form className="login-card forgot-password-card" aria-label="Forgot password" onSubmit={handleSubmit}>
          <div className="login-brand">
            <span className="login-brand-name">Sweet Bakes</span>
          </div>

          {isSubmitted ? (
            <>
              <div className="forgot-password-heading-group forgot-password-success-content">
                <h1 className="forgot-password-heading" role="status">Check Your Email</h1>
                <p className="forgot-password-description">
                  If an account exists for that email, we&apos;ve sent a password reset link.
                </p>
              </div>
              <button className="login-submit" type="button" onClick={() => onNavigate?.('/login')}>
                Back to Login
              </button>
            </>
          ) : (
            <>
              <div className="forgot-password-heading-group">
                <h1 className="forgot-password-heading">Forgot Password</h1>
                <p className="forgot-password-description">
                  Enter your email address and we&apos;ll send you a secure link to reset your password.
                </p>
              </div>

              <div className="login-fields">
                <label className="login-field-group">
                  <span>Email Address</span>
                  <input
                    id="forgot-password-email"
                    className="login-field"
                    type="email"
                    name="email"
                    placeholder="Enter your email address"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (rateLimitSeconds <= 0) setError('')
                    }}
                  />
                </label>
              </div>

              {(rateLimitSeconds > 0 || error) ? (
                <p
                  className="login-error forgot-password-form-error"
                  role="alert"
                >
                  {rateLimitSeconds > 0
                    ? `Too many reset requests. Please try again in ${rateLimitSeconds} seconds.`
                    : error}
                </p>
              ) : null}

              <button className="login-submit" type="submit" disabled={isSubmitting || rateLimitSeconds > 0 || isRapidSubmitLocked}>
                {isSubmitting
                  ? 'Sending...'
                  : rateLimitSeconds > 0
                    ? `Try Again in ${rateLimitSeconds}s`
                    : 'Send Reset Link'}
              </button>

              <button className="forgot-password-back" type="button" onClick={() => onNavigate?.('/login')}>
                Back to Login
              </button>
            </>
          )}
        </form>
      </div>
    </main>
  )
}

export default ForgotPasswordPage
