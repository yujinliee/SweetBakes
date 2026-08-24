import { useEffect, useMemo, useState } from 'react'
import {
  fetchAvailabilitySettings,
  getAvailabilityStatusForDate,
  getServiceHoursLabel,
  isTimeWithinServiceHours,
} from '../admin/services/availabilityService.js'

let cachedSettings = null
let cachedError = null
let pendingAvailabilityRequest = null

async function loadAvailabilitySettings() {
  if (cachedSettings) {
    return cachedSettings
  }

  if (!pendingAvailabilityRequest) {
    pendingAvailabilityRequest = fetchAvailabilitySettings()
      .then((settings) => {
        cachedSettings = settings
        cachedError = null
        return settings
      })
      .catch((error) => {
        cachedError = error
        throw error
      })
      .finally(() => {
        pendingAvailabilityRequest = null
      })
  }

  return pendingAvailabilityRequest
}

export function useAvailability() {
  const [state, setState] = useState(() => ({
    settings: cachedSettings,
    loading: !cachedSettings && !cachedError,
    error: cachedError,
  }))

  useEffect(() => {
    let isMounted = true

    if (cachedSettings) {
      return () => {
        isMounted = false
      }
    }

    loadAvailabilitySettings()
      .then((settings) => {
        if (isMounted) {
          setState({ settings, loading: false, error: null })
        }
      })
      .catch((error) => {
        if (isMounted) {
          setState({ settings: null, loading: false, error })
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return useMemo(() => {
    const { settings, loading, error } = state
    const getDateStatus = (dateValue) =>
      settings ? getAvailabilityStatusForDate(dateValue, settings) : null

    return {
      settings,
      loading,
      error,
      minimumLeadTime: settings?.minimumLeadTimeDays ?? null,
      maximumOrdersPerDay: settings?.maximumOrdersPerDay ?? null,
      serviceStart: settings?.serviceStartTime ?? '',
      serviceEnd: settings?.serviceEndTime ?? '',
      serviceHoursLabel: settings ? getServiceHoursLabel(settings) : '',
      getDateStatus,
      isDateAvailable: (dateValue) => {
        const status = getDateStatus(dateValue)
        return Boolean(status && !status.isDisabled)
      },
      isTimeAvailable: (timeValue) =>
        Boolean(settings && isTimeWithinServiceHours(timeValue, settings)),
    }
  }, [state])
}
