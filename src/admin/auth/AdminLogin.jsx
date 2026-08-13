import { useEffect, useState } from 'react'
import logo from '../../assets/landingpage/sweetbakes_logo.svg'
import {
  adminCredentials,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from './adminAuth.js'
import './AdminLogin.css'

function AdminLogin({ onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAdminAuthenticated()) {
      onNavigate?.('/admin/dashboard')
    }
  }, [onNavigate])

  const handleSubmit = (event) => {
    event.preventDefault()

    if (email.trim() === adminCredentials.email && password === adminCredentials.password) {
      setAdminAuthenticated()
      setError('')
      onNavigate?.('/admin/dashboard')
      return
    }

    setError('Invalid email or password.')
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <img className="admin-login-logo" src={logo} alt="Sweet Bakes" />
        <div className="admin-login-heading">
          <h1 id="admin-login-title">Admin Login</h1>
          <p>Sign in to access the Sweet Bakes management system.</p>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email Address</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setError('')
              }}
            />
          </label>

          <label>
            <span>Password</span>
            <span className="admin-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="m4 4 16 16M9.9 9.9A3 3 0 0 0 14.1 14.1M7.2 7.8C5.3 8.9 3.9 10.4 3 12c2 3.6 5.2 6 9 6 1.5 0 2.9-.4 4.1-1.1M12 6c4 0 7 2.4 9 6-.5.9-1.1 1.8-1.9 2.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M3 12c2-3.6 5.2-6 9-6s7 2.4 9 6c-2 3.6-5.2 6-9 6s-7-2.4-9-6Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </span>
          </label>

          {error ? (
            <p className="admin-login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="admin-login-submit" type="submit">
            Sign In
          </button>
        </form>
      </section>
    </main>
  )
}

export default AdminLogin
