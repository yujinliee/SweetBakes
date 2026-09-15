import { useEffect, useState } from 'react'
import { fetchCustomerAddresses } from '../services/customerAddressService.js'
import { normalizePhoneNumber, sanitizePhoneNumber } from '../utils/phoneNumber.js'

export function addressFormValues(address) {
  return {
    savedAddressId: address.id,
    savedAddressInitialized: true,
    province: address.province,
    city: address.city_municipality,
    barangay: address.barangay,
    postalCode: address.postal_code,
    address: address.address,
    deliveryAddress: address.address,
    apartment: address.apartment_unit || '',
    landmark: address.landmark || '',
    ...(address.phone_number ? { contactNumber: sanitizePhoneNumber(normalizePhoneNumber(address.phone_number)) } : {}),
  }
}

export function useSavedAddressSelection({ enabled, details, onDetailsChange }) {
  const [addresses, setAddresses] = useState([])

  useEffect(() => {
    if (!enabled) return
    let active = true
    fetchCustomerAddresses().then(({ addresses: loaded }) => {
      if (!active) return
      setAddresses(loaded)
      const initial = loaded.find((address) => address.is_default)
      if (initial) onDetailsChange((current) => {
        // Preserve selections and manual edits, including across form remounts.
        if (current.savedAddressInitialized || current.savedAddressId) return current
        if (current.address?.trim()) return { ...current, savedAddressInitialized: true }
        return { ...current, ...addressFormValues(initial) }
      })
    }).catch((error) => console.error('[SAVED ADDRESSES] load failed:', error))
    return () => { active = false }
  }, [enabled, onDetailsChange])

  return {
    addresses: enabled ? addresses : [],
    selectedAddress: addresses.find((address) => address.id === details.savedAddressId),
    onSelect: (address) => onDetailsChange((current) => ({ ...current, ...addressFormValues(address) })),
  }
}
