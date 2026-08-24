import { useEffect, useRef } from 'react'
import { fetchAuthenticatedCustomerProfile } from '../services/customerProfileService.js'

export function useCustomerProfileAutofill({ onDetailsChange, ready = true }) {
  const loadedUserIdRef = useRef(null)

  useEffect(() => {
    if (!ready || loadedUserIdRef.current) return
    let isMounted = true

    fetchAuthenticatedCustomerProfile()
      .then((profile) => {
        if (!profile || !isMounted) return

        loadedUserIdRef.current = profile.userId
        const profileValues = {
          customerLastName: profile.lastName,
          customerFirstName: profile.firstName,
          contactNumber: profile.contactNumber,
          email: profile.email,
          fullName: [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim(),
        }

        onDetailsChange((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(profileValues).filter(
              ([field, value]) => value && !String(current[field] || '').trim(),
            ),
          ),
        }))
      })
      .catch((error) => {
        console.error('[CUSTOMER PROFILE] autofill failed:', error)
      })

    return () => {
      isMounted = false
    }
  }, [onDetailsChange, ready])
}
