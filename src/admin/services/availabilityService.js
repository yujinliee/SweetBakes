import { getOrders } from './orderService.js'
import { supabase } from '../../lib/supabase.js'

const STORAGE_KEY = 'sweetbakes:availability-settings-v1'
const AVAILABILITY_EVENT = 'sweetbakes:availability-updated'
let cachedSettingsRaw = null
let cachedSettings = null

export const DEFAULT_AVAILABILITY_SETTINGS = {
  minimumLeadTimeDays: 5,
  maximumOrdersPerDay: 2,
  serviceStartTime: '09:00',
  serviceEndTime: '19:00',
  blockedDates: {},
  orderCounts: {},
  orderCountsUnavailable: false,
}

const SWEET_BAKES_MAXIMUM_ORDERS_PER_DAY = 2

const inactiveOrderStatuses = new Set([
  'cancelled',
  'canceled',
  'rejected',
  'declined',
  'void',
  'refunded',
])

export const blockReasonOptions = [
  'Fully Booked',
  'Holiday',
  'Closed',
  'Private Event',
  'Maintenance',
  'Other',
]

const clampInteger = (value, fallback, min, max) => {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.round(numberValue)))
}

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const normalizeTimeValue = (value, fallback) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ''))

  if (!match) {
    return fallback
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export const timeToMinutes = (value) => {
  const normalized = normalizeTimeValue(value, '00:00')
  const [hour, minute] = normalized.split(':').map(Number)
  return hour * 60 + minute
}

const normalizeBlockedDates = (blockedDates) => {
  if (!isPlainObject(blockedDates)) {
    return {}
  }

  return Object.entries(blockedDates).reduce((dates, [dateValue, rule]) => {
    if (!isIsoDateValue(dateValue)) {
      return dates
    }

    dates[dateValue] = {
      reason: String(rule?.reason || 'Closed'),
      customReason: String(rule?.customReason || ''),
      updatedAt: String(rule?.updatedAt || new Date().toISOString()),
    }

    return dates
  }, {})
}

const normalizeDatabaseTimeValue = (value, fallback) =>
  normalizeTimeValue(String(value ?? '').slice(0, 5), fallback)

export const normalizeAvailabilitySettings = (settings = {}) => {
  const serviceStartTime = normalizeTimeValue(
    settings.serviceStartTime,
    DEFAULT_AVAILABILITY_SETTINGS.serviceStartTime,
  )
  const serviceEndTime = normalizeTimeValue(
    settings.serviceEndTime,
    DEFAULT_AVAILABILITY_SETTINGS.serviceEndTime,
  )

  return {
    minimumLeadTimeDays: clampInteger(
      settings.minimumLeadTimeDays,
      DEFAULT_AVAILABILITY_SETTINGS.minimumLeadTimeDays,
      0,
      60,
    ),
    maximumOrdersPerDay: clampInteger(
      settings.maximumOrdersPerDay,
      DEFAULT_AVAILABILITY_SETTINGS.maximumOrdersPerDay,
      1,
      SWEET_BAKES_MAXIMUM_ORDERS_PER_DAY,
    ),
    serviceStartTime:
      timeToMinutes(serviceStartTime) <= timeToMinutes(serviceEndTime)
        ? serviceStartTime
        : DEFAULT_AVAILABILITY_SETTINGS.serviceStartTime,
    serviceEndTime:
      timeToMinutes(serviceStartTime) <= timeToMinutes(serviceEndTime)
        ? serviceEndTime
        : DEFAULT_AVAILABILITY_SETTINGS.serviceEndTime,
    blockedDates: normalizeBlockedDates(settings.blockedDates),
    orderCounts: isPlainObject(settings.orderCounts) ? settings.orderCounts : {},
    orderCountsUnavailable: Boolean(settings.orderCountsUnavailable),
  }
}

const mapAvailabilitySettingsRow = (settingsRow, blockedDates = {}) =>
  normalizeAvailabilitySettings({
    minimumLeadTimeDays: settingsRow?.minimum_lead_time,
    maximumOrdersPerDay: settingsRow?.maximum_orders_per_day,
    serviceStartTime: normalizeDatabaseTimeValue(
      settingsRow?.service_start,
      DEFAULT_AVAILABILITY_SETTINGS.serviceStartTime,
    ),
    serviceEndTime: normalizeDatabaseTimeValue(
      settingsRow?.service_end,
      DEFAULT_AVAILABILITY_SETTINGS.serviceEndTime,
    ),
    blockedDates,
    orderCounts: settingsRow?.orderCounts,
    orderCountsUnavailable: settingsRow?.orderCountsUnavailable,
  })

const mapBlockedDateRows = (blockedDateRows = []) =>
  blockedDateRows.reduce((dates, row) => {
    const dateValue = String(row?.blocked_date || '')

    if (!isIsoDateValue(dateValue)) {
      return dates
    }

    dates[dateValue] = {
      reason: String(row?.reason || 'Closed manually by admin'),
      customReason: '',
      updatedAt: new Date().toISOString(),
    }

    return dates
  }, {})

const ensureDatabaseMaximumOrdersPerDay = async (settingsRow) => {
  if (
    !settingsRow ||
    Number(settingsRow.maximum_orders_per_day) === SWEET_BAKES_MAXIMUM_ORDERS_PER_DAY
  ) {
    return settingsRow
  }

  const { data, error } = await supabase
    .from('availability_settings')
    .update({
      maximum_orders_per_day: SWEET_BAKES_MAXIMUM_ORDERS_PER_DAY,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('id, minimum_lead_time, maximum_orders_per_day, service_start, service_end')
    .single()

  if (error) {
    return {
      ...settingsRow,
      maximum_orders_per_day: SWEET_BAKES_MAXIMUM_ORDERS_PER_DAY,
    }
  }

  return data
}

export async function fetchOrderCountsByDate(startDate, endDate) {
  let query = supabase
    .from('orders')
    .select('preferred_date, order_status')
    .not('preferred_date', 'is', null)

  if (startDate) {
    query = query.gte('preferred_date', startDate)
  }

  if (endDate) {
    query = query.lte('preferred_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    throw new Error('Unable to load order counts.')
  }

  return (data || []).reduce((counts, order) => {
    const dateValue = parseRequestedDate(order?.preferred_date)

    if (!dateValue || !isOrderActiveForCapacity({ status: order?.order_status })) {
      return counts
    }

    counts[dateValue] = (counts[dateValue] || 0) + 1
    return counts
  }, {})
}

export async function fetchAdminAvailabilitySettings(options = {}) {
  const { startDate, endDate } = options
  const [settingsResult, blockedDatesResult] = await Promise.all([
    supabase
      .from('availability_settings')
      .select('id, minimum_lead_time, maximum_orders_per_day, service_start, service_end')
      .eq('id', 1)
      .single(),
    supabase
      .from('blocked_dates')
      .select('id, blocked_date, reason'),
  ])

  if (settingsResult.error) {
    throw new Error('Unable to load availability settings.')
  }

  if (blockedDatesResult.error) {
    throw new Error('Unable to load blocked dates.')
  }

  const settingsRow = await ensureDatabaseMaximumOrdersPerDay(settingsResult.data)
  const orderCounts = await fetchOrderCountsByDate(startDate, endDate)

  return mapAvailabilitySettingsRow({
    ...settingsRow,
    orderCounts,
  }, mapBlockedDateRows(blockedDatesResult.data || []))
}

export const fetchAvailabilitySettings = fetchAdminAvailabilitySettings

export async function saveAdminAvailabilitySettings(settings) {
  const normalizedSettings = normalizeAvailabilitySettings(settings)
  const { data, error } = await supabase
    .from('availability_settings')
    .update({
      minimum_lead_time: normalizedSettings.minimumLeadTimeDays,
      maximum_orders_per_day: normalizedSettings.maximumOrdersPerDay,
      service_start: normalizedSettings.serviceStartTime,
      service_end: normalizedSettings.serviceEndTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('id, minimum_lead_time, maximum_orders_per_day, service_start, service_end')
    .single()

  if (error) {
    throw new Error('Unable to save availability settings.')
  }

  return mapAvailabilitySettingsRow(data, normalizedSettings.blockedDates)
}

export async function blockAdminDate(settings, dateValue, reason = 'Closed manually by admin') {
  const { error } = await supabase
    .from('blocked_dates')
    .upsert(
      {
        blocked_date: dateValue,
        reason,
      },
      { onConflict: 'blocked_date' },
    )

  if (error) {
    throw new Error('Unable to close this date.')
  }

  return normalizeAvailabilitySettings({
    ...settings,
    blockedDates: {
      ...settings.blockedDates,
      [dateValue]: {
        reason,
        customReason: '',
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

export async function unblockAdminDate(settings, dateValue) {
  const { error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('blocked_date', dateValue)

  if (error) {
    throw new Error('Unable to reopen this date.')
  }

  const nextBlockedDates = { ...settings.blockedDates }
  delete nextBlockedDates[dateValue]

  return normalizeAvailabilitySettings({
    ...settings,
    blockedDates: nextBlockedDates,
  })
}

const emitAvailabilityUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AVAILABILITY_EVENT))
  }
}

export function getAvailabilitySettings() {
  if (typeof window === 'undefined') {
    if (!cachedSettings) {
      cachedSettings = normalizeAvailabilitySettings(DEFAULT_AVAILABILITY_SETTINGS)
    }

    return cachedSettings
  }

  try {
    const rawSettings = window.localStorage.getItem(STORAGE_KEY)
    const cacheKey = rawSettings || ''

    if (cachedSettings && cachedSettingsRaw === cacheKey) {
      return cachedSettings
    }

    const storedSettings = rawSettings ? JSON.parse(rawSettings) : {}
    cachedSettings = normalizeAvailabilitySettings({
      ...DEFAULT_AVAILABILITY_SETTINGS,
      ...storedSettings,
      blockedDates: {
        ...DEFAULT_AVAILABILITY_SETTINGS.blockedDates,
        ...(storedSettings.blockedDates || {}),
      },
    })
    cachedSettingsRaw = cacheKey

    return cachedSettings
  } catch {
    if (!cachedSettings || cachedSettingsRaw !== 'default') {
      cachedSettings = normalizeAvailabilitySettings(DEFAULT_AVAILABILITY_SETTINGS)
      cachedSettingsRaw = 'default'
    }

    return cachedSettings
  }
}

export function saveAvailabilitySettings(settings) {
  const normalizedSettings = normalizeAvailabilitySettings(settings)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings))
    cachedSettings = normalizedSettings
    cachedSettingsRaw = JSON.stringify(normalizedSettings)
    emitAvailabilityUpdate()
  }

  return normalizedSettings
}

export function subscribeAvailabilitySettings(callback) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      callback()
    }
  }

  window.addEventListener(AVAILABILITY_EVENT, callback)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(AVAILABILITY_EVENT, callback)
    window.removeEventListener('storage', handleStorage)
  }
}

export const formatDateValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const isIsoDateValue = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))

export const parseDateValue = (value) => {
  if (!isIsoDateValue(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const getTodayDate = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export const addDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

export const formatDisplayDate = (value) => {
  const date = parseDateValue(value)

  if (!date) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export const formatTimeLabel = (value) => {
  const normalized = normalizeTimeValue(value, '00:00')
  const [hourValue, minuteValue] = normalized.split(':').map(Number)
  const period = hourValue >= 12 ? 'PM' : 'AM'
  const hour12 = hourValue % 12 === 0 ? 12 : hourValue % 12

  return `${hour12}:${String(minuteValue).padStart(2, '0')} ${period}`
}

export const getServiceHoursLabel = (settings = getAvailabilitySettings()) =>
  `${formatTimeLabel(settings.serviceStartTime)} - ${formatTimeLabel(settings.serviceEndTime)}`

export const isTimeWithinServiceHours = (timeValue, settings = getAvailabilitySettings()) => {
  if (!timeValue) {
    return false
  }

  const timeMinutes = timeToMinutes(timeValue)
  return (
    timeMinutes >= timeToMinutes(settings.serviceStartTime) &&
    timeMinutes <= timeToMinutes(settings.serviceEndTime)
  )
}

const parseRequestedDate = (value) => {
  if (isIsoDateValue(value)) {
    return value
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return formatDateValue(parsedDate)
}

export const getOrderPreferredDate = (order) =>
  parseRequestedDate(
    order?.preferred_date ||
      order?.preferredDate ||
      order?.customerInfo?.preferredDate ||
      order?.requestedDate ||
      '',
  )

export const isOrderActiveForCapacity = (order) =>
  !inactiveOrderStatuses.has(String(order?.status || '').trim().toLowerCase())

export function getOrderCountForDate(dateValue, orders = getOrders()) {
  if (isPlainObject(orders)) {
    return Number(orders[dateValue] || 0)
  }

  return orders.filter(
    (order) => isOrderActiveForCapacity(order) && getOrderPreferredDate(order) === dateValue,
  ).length
}

export function getAvailabilityStatusForDate(
  dateValue,
  settings = getAvailabilitySettings(),
  orders = null,
) {
  const date = parseDateValue(dateValue)
  const today = getTodayDate()
  const orderCount = getOrderCountForDate(
    dateValue,
    orders ?? settings.orderCounts ?? getOrders(),
  )
  const blockRule = settings.blockedDates[dateValue]

  if (!date) {
    return { status: 'invalid', label: 'Unavailable', isDisabled: true, orderCount }
  }

  if (date < today) {
    return { status: 'past', label: 'Past Date', isDisabled: true, orderCount }
  }

  if (date < addDays(today, settings.minimumLeadTimeDays)) {
    return {
      status: 'restricted',
      label: 'Lead-Time Restricted',
      isDisabled: true,
      orderCount,
    }
  }

  if (blockRule) {
    return {
      status: 'blocked',
      label: 'Blocked',
      isDisabled: true,
      orderCount,
      reason: blockRule.reason,
      customReason: blockRule.customReason,
    }
  }

  if (settings.orderCountsUnavailable) {
    return { status: 'invalid', label: 'Unavailable', isDisabled: true, orderCount }
  }

  if (orderCount >= settings.maximumOrdersPerDay) {
    return { status: 'full', label: 'Fully Booked', isDisabled: true, orderCount }
  }

  return { status: 'available', label: 'Available', isDisabled: false, orderCount }
}

export function canAcceptOrderForDate(
  dateValue,
  settings = getAvailabilitySettings(),
  orders = getOrders(),
) {
  const status = getAvailabilityStatusForDate(dateValue, settings, orders)

  return Boolean(status && !status.isDisabled)
}

export function assertCanAcceptOrderForDate(
  dateValue,
  settings = getAvailabilitySettings(),
  orders = getOrders(),
) {
  if (!canAcceptOrderForDate(dateValue, settings, orders)) {
    throw new Error('Selected date is no longer available.')
  }
}

export function setDateBlocked(dateValue, reason = 'Closed', customReason = '') {
  const settings = getAvailabilitySettings()

  return saveAvailabilitySettings({
    ...settings,
    blockedDates: {
      ...settings.blockedDates,
      [dateValue]: {
        reason,
        customReason,
        updatedAt: new Date().toISOString(),
      },
    },
  })
}

export function setDateAvailable(dateValue) {
  const settings = getAvailabilitySettings()
  const nextBlockedDates = { ...settings.blockedDates }
  delete nextBlockedDates[dateValue]

  return saveAvailabilitySettings({
    ...settings,
    blockedDates: nextBlockedDates,
  })
}
