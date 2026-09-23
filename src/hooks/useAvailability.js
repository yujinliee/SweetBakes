import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchAvailabilitySettings,
  getAvailabilityStatusForDate,
  getServiceHoursLabel,
  isTimeWithinServiceHours,
} from '../admin/services/availabilityService.js'

let cachedSettings = null
let cachedError = null
let pendingAvailabilityRequest = null
let lastForcedRefreshAt = 0
const FRESHNESS_WINDOW_MS = 5000
const availabilityListeners = new Set()

const notifyAvailabilityListeners = () => {
  availabilityListeners.forEach((listener) => listener(cachedSettings, cachedError))
}

async function loadAvailabilitySettings(force = false) {
  if (!force && cachedSettings) return cachedSettings

  if (!pendingAvailabilityRequest) {
    if (force) lastForcedRefreshAt = Date.now()
    pendingAvailabilityRequest = fetchAvailabilitySettings()
      .then((settings) => {
        cachedSettings = settings
        cachedError = null
        notifyAvailabilityListeners()
        return settings
      })
      .catch((error) => {
        cachedError = error
        notifyAvailabilityListeners()
        throw error
      })
      .finally(() => {
        pendingAvailabilityRequest = null
      })
  }

  return pendingAvailabilityRequest
}

export function useAvailability({ active = false } = {}) {
  const [state, setState] = useState(() => ({
    settings: cachedSettings,
    loading: !cachedSettings && !cachedError,
    error: cachedError,
  }))

  const refresh = useCallback(async () => {
    if (Date.now() - lastForcedRefreshAt < FRESHNESS_WINDOW_MS && cachedSettings) {
      return cachedSettings
    }

    setState((current) => ({ ...current, loading: !current.settings, error: null }))

    try {
      const settings = await loadAvailabilitySettings(true)
      setState({ settings, loading: false, error: null })
      return settings
    } catch (error) {
      setState({ settings: cachedSettings, loading: false, error })
      throw error
    }
  }, [])

  useEffect(() => {
    const handleAvailabilityUpdate = (settings, error) => {
      setState({ settings, loading: false, error })
    }

    availabilityListeners.add(handleAvailabilityUpdate)
    return () => availabilityListeners.delete(handleAvailabilityUpdate)
  }, [])

  useEffect(() => {
    if (cachedSettings || cachedError) return undefined

    let isMounted = true
    loadAvailabilitySettings()
      .then((settings) => {
        if (isMounted) setState({ settings, loading: false, error: null })
      })
      .catch((error) => {
        if (isMounted) setState({ settings: null, loading: false, error })
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!active) return undefined

    const refreshActiveAvailability = () => {
      if (document.visibilityState !== 'visible') return
      refresh().catch(() => {})
    }

    refreshActiveAvailability()
    window.addEventListener('focus', refreshActiveAvailability)
    document.addEventListener('visibilitychange', refreshActiveAvailability)

    return () => {
      window.removeEventListener('focus', refreshActiveAvailability)
      document.removeEventListener('visibilitychange', refreshActiveAvailability)
    }
  }, [active, refresh])

  return useMemo(() => {
    const { settings, loading, error } = state
    const getDateStatus = (dateValue, settingsOverride = settings) =>
      settingsOverride ? getAvailabilityStatusForDate(dateValue, settingsOverride) : null

    return {
      settings,
      loading,
      error,
      refresh,
      minimumLeadTime: settings?.minimumLeadTimeDays ?? null,
      maximumOrdersPerDay: settings?.maximumOrdersPerDay ?? null,
      serviceStart: settings?.serviceStartTime ?? '',
      serviceEnd: settings?.serviceEndTime ?? '',
      serviceHoursLabel: settings ? getServiceHoursLabel(settings) : '',
      getDateStatus,
      isDateAvailable: (dateValue, settingsOverride = settings) => {
        const status = getDateStatus(dateValue, settingsOverride)
        return Boolean(status && !status.isDisabled)
      },
      isTimeAvailable: (timeValue, settingsOverride = settings) =>
        Boolean(settingsOverride && isTimeWithinServiceHours(timeValue, settingsOverride)),
    }
  }, [refresh, state])
}
