import { isMissingCustomerSession } from '../auth/customerSession.js'
import { useEffect, useState } from 'react'
import { ADMIN_DASHBOARD_ROUTE } from '../admin/adminRouteConstants.js'
import AutocompleteTextInput from '../cartpage/components/AutocompleteTextInput.jsx'
import addressData from '../cartpage/data/philippineAddressData.js'
import { SiteTopbar } from '../landingpage/LandingPage.jsx'
import { supabase } from '../lib/supabase.js'
import { ToastNotification } from '../components/ToastNotification.jsx'
import DeleteAddressModal from '../components/DeleteAddressModal.jsx'
import {
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  setDefaultCustomerAddress,
  updateCustomerAddress,
} from '../services/customerAddressService.js'
import { formatPhoneDisplay, isValidPhoneNumber, sanitizePhoneNumber, normalizePhoneNumber, handlePhonePaste } from '../utils/phoneNumber.js'
import './ProfilePage.css'

const PROFILE_SELECT = 'id, email, first_name, last_name, role, created_at, updated_at'

const emptyAddressDraft = {
  province: 'Cavite',
  cityMunicipality: '',
  barangay: '',
  postalCode: '',
  address: '',
  apartmentUnit: '',
  landmark: '',
  phoneNumber: '',
}

const provinceOptions = addressData.map((province) => province.province)

function safeValue(value) {
  return value || '—'
}

function ProfileField({ label, value }) {
  return (
    <div className="profile-field-row">
      <dt>{label}</dt>
      <dd>{safeValue(value)}</dd>
    </div>
  )
}

function ProfileSection({ title, action, children }) {
  return (
    <section className="profile-section" aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-title`}>
      <div className="profile-section-header">
        <h2 id={`${title.toLowerCase().replace(/\s+/g, '-')}-title`}>{title}</h2>
        {action}
      </div>
      <div className="profile-card">{children}</div>
    </section>
  )
}

function ProfilePage({
  onNavigate,
  onCustomerLogout,
  isCustomerAuthenticated = false,
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState({ firstName: '', lastName: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [toastNonce, setToastNonce] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [addressError, setAddressError] = useState('')
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [addressDraft, setAddressDraft] = useState(emptyAddressDraft)
  const [addressFormErrors, setAddressFormErrors] = useState({})
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [isDeletingAddressId, setIsDeletingAddressId] = useState(null)
  const [pendingDeleteAddress, setPendingDeleteAddress] = useState(null)
  const [isDeletingAddress, setIsDeletingAddress] = useState(false)
  const [isSettingDefaultId, setIsSettingDefaultId] = useState(null)
  const selectedProvince =
    addressData.find(
      (province) => province.province.toLowerCase() === addressDraft.province.trim().toLowerCase(),
    ) || null
  const cityOptions = selectedProvince?.cities || []
  const selectedCity =
    cityOptions.find(
      (city) => city.name.toLowerCase() === addressDraft.cityMunicipality.trim().toLowerCase(),
    ) || null
  const barangayOptions = selectedCity?.barangays || []

  const notify = (text) => {
    setToastMessage(text)
    setToastNonce((current) => current + 1)
  }

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      try {
        setIsLoading(true)
        setError('')

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        const user = sessionData?.session?.user || null

        if (sessionError || !user) {
          onNavigate?.('/login?redirect=/profile', { replace: true })
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          throw profileError
        }

        if (profileData?.role === 'admin') {
          onNavigate?.(ADMIN_DASHBOARD_ROUTE, { replace: true })
          return
        }

        if (!profileData || profileData.role !== 'customer') {
          await supabase.auth.signOut()
          onNavigate?.('/login', { replace: true })
          return
        }

        if (isMounted) {
          setProfile({
            ...profileData,
            email: profileData.email || user.email || '',
          })
          setDraft({
            firstName: profileData.first_name || '',
            lastName: profileData.last_name || '',
          })
        }

        try {
          const { addresses: addressRows } = await fetchCustomerAddresses()

          if (isMounted) {
            setAddresses(addressRows || [])
            setAddressError('')
          }
        } catch (addressLoadError) {
          console.error('[PROFILE] address load error:', addressLoadError)

          if (isMounted) {
            setAddresses([])
            setAddressError('Addresses are temporarily unavailable.')
          }
        }
      } catch (loadError) {
        console.error('[PROFILE] load error:', loadError)

        if (isMounted) {
          setError('Unable to load your profile. Please try again.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [onNavigate])

  const handleEdit = () => {
    setDraft({
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
    })
    setMessage('')
    setError('')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setMessage('')
    setError('')
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()

    const firstName = draft.firstName.trim()
    const lastName = draft.lastName.trim()

    if (!firstName || !lastName) {
      setError('First name and last name are required.')
      setMessage('')
      return
    }

    try {
      setIsSaving(true)
      setError('')
      setMessage('')

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .select(PROFILE_SELECT)
        .single()

      if (updateError) {
        throw updateError
      }

      setProfile((current) => ({
        ...current,
        ...data,
        email: data.email || current?.email || '',
      }))
      setDraft({
        firstName: data.first_name || '',
        lastName: data.last_name || '',
      })
      setIsEditing(false)
      setMessage('Profile updated successfully.')
    } catch (saveError) {
      console.error('[PROFILE] save error:', saveError)
      setError('Unable to save your profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateAddressDraft = (field, value) => {
    setAddressDraft((current) => {
      if (field === 'province') {
        return {
          ...current,
          province: value,
          cityMunicipality: '',
          barangay: '',
          postalCode: '',
        }
      }

      if (field === 'cityMunicipality') {
        const nextCity = cityOptions.find((city) => city.name === value)

        return {
          ...current,
          cityMunicipality: value,
          barangay: '',
          postalCode: nextCity?.postalCode || '',
        }
      }

      return {
        ...current,
        [field]: value,
      }
    })

    setAddressFormErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
    setAddressError('')
  }

  const sortAddresses = (list) =>
    [...list].sort((a, b) => {
      const aDefault = Boolean(a.is_default)
      const bDefault = Boolean(b.is_default)

      if (aDefault !== bDefault) return aDefault ? -1 : 1

      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })

  const handleOpenAddressForm = () => {
    setEditingAddressId(null)
    setAddressDraft(emptyAddressDraft)
    setAddressFormErrors({})
    setAddressError('')
    setIsAddressFormOpen(true)
  }

  const handleEditAddress = (address) => {
    setEditingAddressId(address.id)
    setAddressDraft({
      province: address.province || 'Cavite',
      cityMunicipality: address.city_municipality || '',
      barangay: address.barangay || '',
      postalCode: address.postal_code || '',
      address: address.address || '',
      apartmentUnit: address.apartment_unit || '',
      landmark: address.landmark || '',
      phoneNumber: sanitizePhoneNumber(normalizePhoneNumber(address.phone_number)),
    })
    setAddressFormErrors({})
    setAddressError('')
    setIsAddressFormOpen(true)
  }

  const handleCloseAddressForm = () => {
    if (isSavingAddress) return

    setIsAddressFormOpen(false)
    setEditingAddressId(null)
    setAddressFormErrors({})
    setAddressError('')
  }

  const validateAddressDraft = () => {
    const nextErrors = {}

    if (!addressDraft.province.trim()) nextErrors.province = 'Province is required.'
    if (!addressDraft.cityMunicipality.trim()) nextErrors.cityMunicipality = 'City / Municipality is required.'
    if (!addressDraft.barangay.trim()) nextErrors.barangay = 'Barangay is required.'
    if (!addressDraft.postalCode.trim()) nextErrors.postalCode = 'Postal code is required.'
    if (!addressDraft.address.trim()) nextErrors.address = 'Address is required.'
    if (!isValidPhoneNumber(addressDraft.phoneNumber)) nextErrors.phoneNumber = 'Enter a valid 11-digit phone number.'

    return nextErrors
  }

  const handleSaveAddress = async (event) => {
    event.preventDefault()

    const nextErrors = validateAddressDraft()

    if (Object.keys(nextErrors).length > 0) {
      setAddressFormErrors(nextErrors)
      return
    }

    try {
      setIsSavingAddress(true)
      setAddressError('')

      const payload = {
        province: addressDraft.province.trim(),
        city_municipality: addressDraft.cityMunicipality.trim(),
        barangay: addressDraft.barangay.trim(),
        postal_code: addressDraft.postalCode.trim(),
        address: addressDraft.address.trim(),
        apartment_unit: addressDraft.apartmentUnit.trim() || null,
        landmark: addressDraft.landmark.trim() || null,
        phone_number: addressDraft.phoneNumber.trim(),
      }

      let data
      let statusMessage

      if (editingAddressId) {
        data = await updateCustomerAddress(editingAddressId, payload)
        statusMessage = 'Address updated successfully.'
      } else {
        data = await createCustomerAddress(payload)
        statusMessage = 'Address added successfully.'
      }

      setAddresses((current) =>
        sortAddresses(
          editingAddressId
            ? current.map((address) => (address.id === data.id ? data : address))
            : [data, ...current],
        ),
      )
      setIsAddressFormOpen(false)
      setEditingAddressId(null)
      setAddressDraft(emptyAddressDraft)
      setAddressFormErrors({})
      notify(statusMessage)
    } catch (saveAddressError) {
      console.error('[PROFILE] address save error:', {
        message: saveAddressError?.message,
        code: saveAddressError?.code,
        details: saveAddressError?.details,
        hint: saveAddressError?.hint,
        status: saveAddressError?.status,
      })
      setAddressError(isMissingCustomerSession(saveAddressError)
        ? 'Your session has expired. Please sign in and try again.'
        : 'Unable to save address. Please try again.')
    } finally {
      setIsSavingAddress(false)
    }
  }

  const handleRequestDeleteAddress = (address) => {
    setAddressError('')
    setPendingDeleteAddress(address)
  }

  const handleCancelDeleteAddress = () => {
    if (isDeletingAddress) return
    setPendingDeleteAddress(null)
  }

  const handleConfirmDeleteAddress = async () => {
    if (!pendingDeleteAddress || isDeletingAddress) return

    const address = pendingDeleteAddress

    try {
      setIsDeletingAddress(true)
      setIsDeletingAddressId(address.id)
      setAddressError('')

      await deleteCustomerAddress(address.id)

      const remaining = addresses.filter((addressEntry) => addressEntry.id !== address.id)
      let next = remaining

      if (address.is_default && remaining.length > 0) {
        const promoted = sortAddresses(remaining)[0]
        await setDefaultCustomerAddress(promoted.id)
        next = remaining.map((addressEntry) => ({
          ...addressEntry,
          is_default: addressEntry.id === promoted.id,
        }))
      }

      setAddresses(sortAddresses(next))
      setPendingDeleteAddress(null)
      notify('Address deleted successfully.')
    } catch (deleteAddressError) {
      console.error('[PROFILE] address delete error:', deleteAddressError)
      setAddressError(isMissingCustomerSession(deleteAddressError)
        ? 'Your session has expired. Please sign in and try again.'
        : 'Unable to delete address. Please try again.')
    } finally {
      setIsDeletingAddressId(null)
      setIsDeletingAddress(false)
    }
  }

  const handleSetDefaultAddress = async (address) => {
    if (address.is_default || isSettingDefaultId) return

    try {
      setIsSettingDefaultId(address.id)
      setAddressError('')

      await setDefaultCustomerAddress(address.id)

      setAddresses((current) =>
        sortAddresses(current.map((addressEntry) => ({ ...addressEntry, is_default: addressEntry.id === address.id }))),
      )
      notify('Default address updated.')
    } catch (setDefaultError) {
      console.error('[PROFILE] set default error:', setDefaultError)
      setAddressError(isMissingCustomerSession(setDefaultError)
        ? 'Your session has expired. Please sign in and try again.'
        : 'Unable to update default address. Please try again.')
    } finally {
      setIsSettingDefaultId(null)
    }
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await supabase.auth.signOut()
      onCustomerLogout?.()
      onNavigate?.('/login', { replace: true })
    } catch (signOutError) {
      console.error('[PROFILE] sign out error:', signOutError)
      setError('Unable to sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <main className="profile-page">
      <SiteTopbar
        forceScrolled
        homeHref="/"
        locationHref="/#location"
        contactHref="/#contact"
        onNavigate={onNavigate}
        onCustomerLogout={onCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />

      <div className="profile-page-content">
        <section className="profile-shell" aria-labelledby="profile-title">
          <div className="profile-heading">
            <p className="profile-eyebrow">Sweet Bakes Account</p>
            <h1 id="profile-title">Profile</h1>
          </div>

          {isLoading ? (
            <div className="profile-card profile-state-card">Loading profile...</div>
          ) : error && !profile ? (
            <div className="profile-card profile-state-card profile-state-card--error">{error}</div>
          ) : (
            <>
              <ProfileSection
                title="Personal Information"
                action={
                  !isEditing ? (
                    <button className="profile-link-button" type="button" onClick={handleEdit}>
                      Edit
                    </button>
                  ) : null
                }
              >
                {isEditing ? (
                  <form className="profile-edit-form" onSubmit={handleSaveProfile}>
                    <label>
                      <span>First Name</span>
                      <input
                        type="text"
                        value={draft.firstName}
                        onChange={(event) => {
                          setDraft((current) => ({ ...current, firstName: event.target.value }))
                          setError('')
                          setMessage('')
                        }}
                        autoComplete="given-name"
                      />
                    </label>
                    <label>
                      <span>Last Name</span>
                      <input
                        type="text"
                        value={draft.lastName}
                        onChange={(event) => {
                          setDraft((current) => ({ ...current, lastName: event.target.value }))
                          setError('')
                          setMessage('')
                        }}
                        autoComplete="family-name"
                      />
                    </label>

                    <div className="profile-edit-actions">
                      <button className="profile-secondary-button" type="button" onClick={handleCancelEdit}>
                        Cancel
                      </button>
                      <button className="profile-primary-button" type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="profile-field-list">
                    <ProfileField label="First Name" value={profile?.first_name} />
                    <ProfileField label="Last Name" value={profile?.last_name} />
                  </dl>
                )}
              </ProfileSection>

              <ProfileSection title="Contact">
                <dl className="profile-field-list">
                  <ProfileField label="Email" value={profile?.email} />
                </dl>
              </ProfileSection>

              <ProfileSection
                title="Addresses"
                action={
                  <button
                    className="profile-link-button"
                    type="button"
                    onClick={handleOpenAddressForm}
                    disabled={isAddressFormOpen}
                  >
                    Add
                  </button>
                }
              >
                {isAddressFormOpen ? (
                  <form className="profile-address-form" onSubmit={handleSaveAddress}>
                    <div className="profile-address-form-heading">
                      <h3>{editingAddressId ? 'Edit Address' : 'Add Address'}</h3>
                    </div>

                    <label className="profile-address-form-wide">
                      <span>Phone Number</span>
                      <input
                        type="tel"
                        value={addressDraft.phoneNumber}
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="09123456789"
                        onPaste={(event) => handlePhonePaste(event, (value) => updateAddressDraft('phoneNumber', value))}
                        onChange={(event) => updateAddressDraft('phoneNumber', sanitizePhoneNumber(event.target.value))}
                      />
                      {addressFormErrors.phoneNumber ? <small>{addressFormErrors.phoneNumber}</small> : null}
                    </label>

                    <label>
                      <span>Province</span>
                      <AutocompleteTextInput
                        options={provinceOptions}
                        value={addressDraft.province}
                        placeholder="Enter province"
                        onChange={(value) => updateAddressDraft('province', value)}
                      />
                      {addressFormErrors.province ? <small>{addressFormErrors.province}</small> : null}
                    </label>

                    <label>
                      <span>City / Municipality</span>
                      <AutocompleteTextInput
                        options={cityOptions.map((city) => city.name)}
                        value={addressDraft.cityMunicipality}
                        placeholder="Enter city or municipality"
                        onChange={(value) => updateAddressDraft('cityMunicipality', value)}
                      />
                      {addressFormErrors.cityMunicipality ? <small>{addressFormErrors.cityMunicipality}</small> : null}
                    </label>

                    <label>
                      <span>Barangay</span>
                      <AutocompleteTextInput
                        options={barangayOptions}
                        value={addressDraft.barangay}
                        placeholder="Enter barangay"
                        onChange={(value) => updateAddressDraft('barangay', value)}
                      />
                      {addressFormErrors.barangay ? <small>{addressFormErrors.barangay}</small> : null}
                    </label>

                    <label>
                      <span>Postal Code</span>
                      <input
                        type="text"
                        value={addressDraft.postalCode}
                        placeholder="Postal code"
                        onChange={(event) => updateAddressDraft('postalCode', event.target.value)}
                      />
                      {addressFormErrors.postalCode ? <small>{addressFormErrors.postalCode}</small> : null}
                    </label>

                    <label className="profile-address-form-wide">
                      <span>Address</span>
                      <input
                        type="text"
                        value={addressDraft.address}
                        placeholder="House no., street, subdivision"
                        onChange={(event) => updateAddressDraft('address', event.target.value)}
                      />
                      {addressFormErrors.address ? <small>{addressFormErrors.address}</small> : null}
                    </label>

                    <label>
                      <span>Apartment / Suite / Unit <em>Optional</em></span>
                      <input
                        type="text"
                        value={addressDraft.apartmentUnit}
                        placeholder="Unit, floor, building"
                        onChange={(event) => updateAddressDraft('apartmentUnit', event.target.value)}
                      />
                    </label>

                    <label>
                      <span>Landmark <em>Optional</em></span>
                      <input
                        type="text"
                        value={addressDraft.landmark}
                        placeholder="Nearby landmark"
                        onChange={(event) => updateAddressDraft('landmark', event.target.value)}
                      />
                    </label>

                    {addressError ? <p className="profile-address-form-error">{addressError}</p> : null}

                    <div className="profile-address-form-actions">
                      <button className="profile-secondary-button" type="button" onClick={handleCloseAddressForm}>
                        Cancel
                      </button>
                      <button className="profile-primary-button" type="submit" disabled={isSavingAddress}>
                        {isSavingAddress ? 'Saving...' : editingAddressId ? 'Save Changes' : 'Save Address'}
                      </button>
                    </div>
                  </form>
                ) : addressError ? (
                  <p className="profile-address-error">{addressError}</p>
                ) : addresses.length === 0 ? (
                  <div className="profile-empty-row">
                    <span className="profile-empty-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                      </svg>
                    </span>
                    <span>No addresses added</span>
                  </div>
                ) : (
                  <div className="profile-address-list">
                    {addresses.map((address) => {
                      const isBusy =
                        isSavingAddress || Boolean(isDeletingAddressId) || Boolean(isSettingDefaultId)

                      return (
                        <div className="profile-address-item" key={address.id}>
                          <span className="profile-address-item-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"
                                stroke="currentColor"
                                strokeWidth="1.7"
                              />
                            </svg>
                          </span>
                          <div className="profile-address-item-body">
                            <div className="profile-address-item-copy">
                              <p className="profile-address-item-line profile-address-item-line--primary">
                                <strong>{address.address}</strong>
                              </p>
                              {address.apartment_unit ? (
                                <p className="profile-address-item-line">{address.apartment_unit}</p>
                              ) : null}
                              <p className="profile-address-item-line">
                                {[address.barangay, address.city_municipality].filter(Boolean).join(', ')}
                              </p>
                              <p className="profile-address-item-line">
                                {[address.province, address.postal_code].filter(Boolean).join(', ')}
                              </p>
                              {address.phone_number ? (
                                <p className="profile-address-item-line">{formatPhoneDisplay(address.phone_number)}</p>
                              ) : null}
                              {address.landmark ? (
                                <p className="profile-address-item-line">Landmark: {address.landmark}</p>
                              ) : null}
                            </div>
                            <div className="profile-address-item-actions">
                              <div className="profile-address-item-links">
                                <button
                                  className="profile-address-link"
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleEditAddress(address)}
                                >
                                  Edit
                                </button>
                                <span className="profile-address-link-separator" aria-hidden="true">
                                  |
                                </span>
                                <button
                                  className="profile-address-link profile-address-link--danger"
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleRequestDeleteAddress(address)}
                                >
                                  Delete
                                </button>
                              </div>
                              {address.is_default ? (
                                <span className="profile-address-badge">Default Address</span>
                              ) : (
                                <button
                                  className="profile-default-address-button"
                                  type="button"
                                  disabled={isBusy || isSettingDefaultId === address.id}
                                  onClick={() => handleSetDefaultAddress(address)}
                                >
                                  {isSettingDefaultId === address.id ? 'Setting...' : 'Set as Default'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ProfileSection>

              <ProfileSection title="Account Actions">
                <div className="profile-actions-card">
                  <p>Sign out of your Sweet Bakes account on this browser.</p>
                  <button className="profile-signout-button" type="button" onClick={handleSignOut} disabled={isSigningOut}>
                    {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                  </button>
                </div>
              </ProfileSection>

              {message ? <p className="profile-feedback profile-feedback--success">{message}</p> : null}
              {error ? <p className="profile-feedback profile-feedback--error">{error}</p> : null}
            </>
          )}
        </section>
      </div>

      {toastMessage ? (
        <ToastNotification
          key={toastNonce}
          nonce={toastNonce}
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      ) : null}

      {pendingDeleteAddress ? (
        <DeleteAddressModal
          address={pendingDeleteAddress}
          isDeleting={isDeletingAddress}
          onCancel={handleCancelDeleteAddress}
          onConfirm={handleConfirmDeleteAddress}
        />
      ) : null}
    </main>
  )
}

export default ProfilePage
