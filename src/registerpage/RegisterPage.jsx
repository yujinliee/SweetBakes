import { useState } from 'react'
import { SiteTopbar } from '../landingpage/LandingPage.jsx'
import LegalModal from './components/LegalModal.jsx'
import './RegisterPage.css'

const termsContent = [
  {
    heading: '1. Account Registration',
    body: 'Customers may create an account to make ordering and tracking Sweet Bakes purchases easier. Please provide accurate account information and keep your sign-in details private.',
  },
  {
    heading: '2. Orders and Custom Orders',
    body: 'Sweet Bakes may offer standard and custom bakery items. Custom orders depend on the details submitted by the customer, including theme, message, quantity, and selected product options.',
  },
  {
    heading: '3. Product Information',
    body: 'Product descriptions, images, and examples are provided to help customers choose items. Final handmade products may vary slightly in color, decoration, or finish.',
  },
  {
    heading: '4. Pricing',
    body: 'Displayed prices or estimates may depend on selected options and custom details. If a final price is not available online, Sweet Bakes may confirm pricing before the order proceeds.',
  },
  {
    heading: '5. Payments',
    body: 'Payment requirements may vary by order type and available checkout options. Customers should review the payment instructions shown during ordering or provided by Sweet Bakes.',
  },
  {
    heading: '6. Order Confirmation',
    body: 'An order is considered submitted when the customer completes the required order steps. Sweet Bakes may still need to review custom details before confirming production.',
  },
  {
    heading: '7. Changes and Cancellations',
    body: 'Requests to change or cancel an order should be sent as soon as possible. Availability of changes may depend on whether preparation or production has already started.',
  },
  {
    heading: '8. Pickup and Delivery',
    body: 'Pickup and delivery information should be reviewed during the order process. If details are not available online, customers should contact Sweet Bakes for assistance.',
  },
  {
    heading: '9. Customer Responsibilities',
    body: 'Customers are responsible for providing correct contact details, order details, spelling for cake messages, and any pickup or delivery information requested.',
  },
  {
    heading: '10. Intellectual Property',
    body: 'Sweet Bakes branding, website content, product photos, and design materials belong to Sweet Bakes or their respective owners and should not be copied without permission.',
  },
  {
    heading: '11. Limitation of Liability',
    body: 'Sweet Bakes aims to provide accurate information and quality products. To the extent allowed by applicable rules, responsibility is limited to the order or service provided.',
  },
  {
    heading: '12. Changes to These Terms',
    body: 'Sweet Bakes may update these terms as the website and ordering process changes. The latest version shown on the website will apply when customers use the service.',
  },
  {
    heading: '13. Contact Information',
    body: 'For questions about these terms or a specific order, customers may contact Sweet Bakes through the contact details provided on the website.',
  },
]

const privacyContent = [
  {
    heading: '1. Information We Collect',
    body: 'Sweet Bakes may collect information customers provide through the website, such as account details, contact details, order requests, and messages submitted for support.',
  },
  {
    heading: '2. How We Use Your Information',
    body: 'Information is used to support account access, process orders, respond to inquiries, track requests, and improve the customer experience on the Sweet Bakes website.',
  },
  {
    heading: '3. Account Information',
    body: 'If account features are used, account information may include a customer name, email address, and sign-in related details needed to identify the account.',
  },
  {
    heading: '4. Order Information',
    body: 'Order information may include selected products, custom design details, messages, quantities, request numbers, and details needed to prepare or track an order.',
  },
  {
    heading: '5. Payment Information',
    body: 'If payment features are added or used, payment handling may be provided through the available checkout method. Sweet Bakes should not request unnecessary payment details outside the proper process.',
  },
  {
    heading: '6. Google Sign-In',
    body: 'If Google Sign-In is connected, Sweet Bakes may receive basic account information allowed by Google and the customer, such as a name or email address.',
  },
  {
    heading: '7. Cookies and Website Data',
    body: 'The website may use browser storage or similar website data to support features such as navigation, saved request references, or user experience improvements.',
  },
  {
    heading: '8. How Information May Be Shared',
    body: 'Customer information is used for Sweet Bakes services and may be shared only when needed to operate the website, support an order, comply with applicable requirements, or with customer direction.',
  },
  {
    heading: '9. Data Security',
    body: 'Sweet Bakes aims to handle customer information carefully. No website can guarantee perfect security, so customers should also protect their account access information.',
  },
  {
    heading: '10. Data Retention',
    body: 'Customer information may be kept as needed for accounts, orders, service records, and reasonable business purposes unless deletion or changes are requested where available.',
  },
  {
    heading: '11. Customer Choices',
    body: 'Customers may choose what information they provide, update account or order details when available, and contact Sweet Bakes with privacy-related questions.',
  },
  {
    heading: '12. Changes to This Privacy Policy',
    body: 'Sweet Bakes may update this policy as website features and ordering services change. The current version will be available through the register page.',
  },
  {
    heading: '13. Contact Information',
    body: 'For questions about privacy or customer information, customers may contact Sweet Bakes using the contact details provided on the website.',
  },
]

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

function PasswordEyeIcon() {
  return (
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
  )
}

function RegisterPage({ latestRequest, onTrackOrder, onNavigate, isCustomerAuthenticated = false }) {
  const [showPassword, setShowPassword] = useState(false)
  const [legalModal, setLegalModal] = useState(null)

  const handleRegisterSubmit = (event) => {
    event.preventDefault()
    console.log('Customer registration will be connected later.')
  }

  const handleGoogleRegister = () => {
    console.log('Google registration will be connected later.')
  }

  const handleSignIn = (event) => {
    event.preventDefault()
    onNavigate?.('/login')
  }

  const currentLegalContent = legalModal === 'terms' ? termsContent : privacyContent

  return (
    <main className="login-page register-page">
      <SiteTopbar
        forceScrolled
        hideLogin
        homeHref="/"
        locationHref="/#location"
        contactHref="/#contact"
        latestRequest={latestRequest}
        onTrackOrder={onTrackOrder}
        onNavigate={onNavigate}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />

      <div className="login-page-content">
        <form
          className="login-card register-card"
          aria-label="Customer registration"
          onSubmit={handleRegisterSubmit}
        >
          <div className="login-brand">
            <span className="login-brand-name">Sweet Bakes</span>
          </div>

          <div className="login-heading">
            <p className="login-description register-description">
              Create your account to start ordering.
            </p>
          </div>

          <div className="login-fields register-fields">
            <div className="name-row">
              <label className="login-field-group">
                <span>First Name</span>
                <input
                  className="login-field"
                  type="text"
                  name="firstName"
                  placeholder="Enter first name"
                  autoComplete="given-name"
                />
              </label>

              <label className="login-field-group">
                <span>Last Name</span>
                <input
                  className="login-field"
                  type="text"
                  name="lastName"
                  placeholder="Enter last name"
                  autoComplete="family-name"
                />
              </label>
            </div>

            <label className="login-field-group">
              <span>Email Address</span>
              <input
                className="login-field"
                type="email"
                name="email"
                placeholder="Enter your email address"
                autoComplete="email"
              />
            </label>

            <label className="login-field-group">
              <span>Password</span>
              <span className="login-password-control">
                <input
                  className="login-field login-field--password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <PasswordEyeIcon />
                </button>
              </span>
            </label>
          </div>

          <label className="remember-option register-terms-option">
            <input type="checkbox" name="terms" />
            <span>
              I agree to the{' '}
              <button type="button" onClick={() => setLegalModal('terms')}>
                Terms of Service
              </button>{' '}
              and{' '}
              <button type="button" onClick={() => setLegalModal('privacy')}>
                Privacy Policy
              </button>
            </span>
          </label>

          <button className="login-submit register-submit" type="submit">
            Create Account
          </button>

          <div className="login-divider register-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="google-login-button"
            onClick={handleGoogleRegister}
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          <p className="login-create-account register-sign-in">
            Already have an account?{' '}
            <a href="/login" onClick={handleSignIn}>
              Sign In
            </a>
          </p>
        </form>
      </div>

      <LegalModal
        title={legalModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
        content={currentLegalContent}
        isOpen={Boolean(legalModal)}
        onClose={() => setLegalModal(null)}
      />
    </main>
  )
}

export default RegisterPage
