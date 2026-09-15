import { useEffect, useRef } from 'react'
import { fetchAuthenticatedCustomerProfile } from '../services/customerProfileService.js'
import { sanitizePhoneNumber, normalizePhoneNumber } from '../utils/phoneNumber.js'

const SENTINEL_FALLBACKS = {
  province: 'Cavite',
}

function shouldFill(current, field, value) {
  if (!value) return false

  const existing = String(current[field] || '').trim()

  if (!existing) return true

  const sentinel = SENTINEL_FALLBACKS[field]
  return Boolean(sentinel) && existing === sentinel
}

export function useCustomerProfileAutofill({ onDetailsChange, ready = true }) {
  const loadedUserIdRef = useRef(null)

  useEffect(() => {
    if (!ready || loadedUserIdRef.current) return
    let isMounted = true

    const applyValues = (values) => {
      if (!isMounted) return

      onDetailsChange((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(values).filter(([field, value]) => shouldFill(current, field, value)),
        ),
      }))
    }

    fetchAuthenticatedCustomerProfile()
      .then(async (profile) => {
        if (!profile || !isMounted) return

        loadedUserIdRef.current = profile.userId

        applyValues({
          customerLastName: profile.lastName,
          customerFirstName: profile.firstName,
          email: profile.email,
          fullName: [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim(),
        })

        applyValues({ contactNumber: sanitizePhoneNumber(normalizePhoneNumber(profile.contactNumber)) })
      })
      .catch((error) => {
        console.error('[CUSTOMER PROFILE] autofill failed:', error)
      })

    return () => {
      isMounted = false
    }
  }, [onDetailsChange, ready])
}