import { createPortal } from 'react-dom'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  blockAdminDate,
  DEFAULT_AVAILABILITY_SETTINGS,
  fetchAdminAvailabilitySettings,
  formatDateValue,
  formatDisplayDate,
  getAvailabilityStatusForDate,
  getOrderCountForDate,
  getServiceHoursLabel,
  saveAdminAvailabilitySettings,
  unblockAdminDate,
} from '../../services/availabilityService.js'
import './Availability.css'

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function DateActionPopover({
  anchorRect,
  boundaryRect,
  dateLabel,
  details,
  action,
  onAction,
  popoverRef,
}) {
  const popoverElementRef = useRef(null)
  const [popoverSize, setPopoverSize] = useState({ width: 286, height: action ? 340 : 284 })

  useLayoutEffect(() => {
    const element = popoverElementRef.current

    if (!element) {
      return
    }

    const nextRect = element.getBoundingClientRect()
    setPopoverSize((currentSize) => {
      const nextWidth = Math.ceil(nextRect.width)
      const nextHeight = Math.ceil(nextRect.height)

      if (currentSize.width === nextWidth && currentSize.height === nextHeight) {
        return currentSize
      }

      return { width: nextWidth, height: nextHeight }
    })
  }, [action, dateLabel, details])

  if (!anchorRect || typeof document === 'undefined') {
    return null
  }

  const popoverWidth = popoverSize.width
  const popoverHeight = popoverSize.height
  const spacing = 10
  const viewportGutter = 12
  const anchorCenterX = anchorRect.left + anchorRect.width / 2
  const horizontalMin = Math.max(viewportGutter, boundaryRect?.left ?? viewportGutter)
  const horizontalMax = Math.min(
    window.innerWidth - viewportGutter,
    boundaryRect?.right ?? window.innerWidth - viewportGutter,
  )
  const verticalMin = viewportGutter
  const verticalMax = Math.min(
    window.innerHeight - viewportGutter,
    boundaryRect?.bottom ?? window.innerHeight - viewportGutter,
  )
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))
  const canFitRight = anchorRect.right + spacing + popoverWidth <= horizontalMax
  const canFitLeft = anchorRect.left - spacing - popoverWidth >= horizontalMin
  const canFitAbove = anchorRect.top - spacing - popoverHeight >= verticalMin
  const canTopAlign = anchorRect.top + popoverHeight <= verticalMax
  const placement = canFitRight
    ? 'right'
    : canFitLeft
      ? 'left'
      : canFitAbove
        ? 'above'
        : 'below'
  const preferredLeft = placement === 'right'
    ? anchorRect.right + spacing
    : placement === 'left'
      ? anchorRect.left - popoverWidth - spacing
      : anchorCenterX - popoverWidth / 2
  const sidePlacementTop = canTopAlign
    ? anchorRect.top
    : anchorRect.bottom - popoverHeight
  const preferredTop = placement === 'above'
    ? anchorRect.top - popoverHeight - spacing
    : placement === 'below'
      ? anchorRect.bottom + spacing
      : sidePlacementTop
  const left = clamp(preferredLeft, horizontalMin, horizontalMax - popoverWidth)
  const top = clamp(preferredTop, verticalMin, verticalMax - popoverHeight)

  const setPopoverRefs = (element) => {
    popoverElementRef.current = element

    if (popoverRef) {
      popoverRef.current = element
    }
  }

  return createPortal(
    <section
      ref={setPopoverRefs}
      className={`admin-availability-date-popover admin-availability-date-popover--${placement}`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
      aria-label="Selected date action"
    >
      <div className="admin-availability-date-popover-header">
        <h3>{dateLabel}</h3>
      </div>
      <dl className="admin-availability-popover-details">
        {details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
      {action ? (
        <button
          className="admin-availability-primary-btn admin-availability-context-btn"
          type="button"
          onClick={onAction}
        >
          {action.label}
        </button>
      ) : null}
    </section>,
    document.body,
  )
}

const buildMonthDays = (visibleMonth, settings) => {
  const year = visibleMonth.getFullYear()
  const month = visibleMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlankDays = firstDay.getDay()

  return [
    ...Array.from({ length: leadingBlankDays }, (_, index) => ({
      key: `blank-${index}`,
      day: '',
    })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1)
      const value = formatDateValue(date)
      const availability = getAvailabilityStatusForDate(value, settings, settings.orderCounts)

      return {
        key: value,
        value,
        day: index + 1,
        ...availability,
      }
    }),
  ]
}

function Availability() {
  const [settings, setSettings] = useState(null)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => formatDateValue(new Date()))
  const [settingsDraft, setSettingsDraft] = useState(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)
  const [isSavingAvailability, setIsSavingAvailability] = useState(false)
  const [confirmationAction, setConfirmationAction] = useState(null)
  const [datePopoverRect, setDatePopoverRect] = useState(null)
  const [datePopoverBoundaryRect, setDatePopoverBoundaryRect] = useState(null)
  const [feedback, setFeedback] = useState('')
  const calendarCardRef = useRef(null)
  const datePopoverRef = useRef(null)
  const datePopoverTriggerRef = useRef(null)

  const calendarDays = useMemo(
    () => (settings ? buildMonthDays(visibleMonth, settings) : []),
    [settings, visibleMonth],
  )
  const selectedStatus = settings
    ? getAvailabilityStatusForDate(selectedDate, settings, settings.orderCounts)
    : { status: 'invalid', label: 'Unavailable', isDisabled: true, orderCount: 0 }
  const selectedOrderCount = settings ? getOrderCountForDate(selectedDate, settings.orderCounts) : 0
  const selectedCapacityRemaining = settings
    ? Math.max(0, settings.maximumOrdersPerDay - selectedOrderCount)
    : 0
  const selectedDisplayStatus = selectedStatus.status === 'blocked'
    ? { ...selectedStatus, label: 'Manually Blocked' }
    : selectedStatus
  const selectedReasonText = selectedStatus.status === 'full'
    ? 'Maximum daily order capacity reached'
    : selectedStatus.status === 'restricted'
      ? 'Date falls within minimum lead time'
      : selectedStatus.status === 'past'
        ? 'Date has already passed'
        : selectedStatus.status === 'blocked'
          ? 'Closed manually by admin'
          : 'Accepting customer orders'
  const selectedLeadTimeText = selectedStatus.status === 'restricted' && settings
    ? `${settings.minimumLeadTimeDays} days required`
    : selectedStatus.status === 'past'
      ? 'Passed'
      : 'Eligible'
  const selectedAction = selectedStatus.status === 'available'
    ? {
        key: 'close',
        label: 'Close Date for Orders',
        title: `Close ${formatDisplayDate(selectedDate)} for new orders?`,
        body: 'Customers will no longer be able to select this date. Existing orders will not be affected.',
        confirmLabel: 'Close Date',
      }
    : selectedStatus.status === 'blocked'
      ? {
          key: 'reopen',
          label: 'Reopen Date',
          title: `Reopen ${formatDisplayDate(selectedDate)} for new orders?`,
          body: 'The date will become selectable only if it still passes lead-time and capacity rules.',
          confirmLabel: 'Reopen Date',
      }
    : null
  const selectedDateDetails = [
    {
      label: 'Status',
      value: (
        <span className={`admin-availability-status admin-availability-status--${selectedDisplayStatus.status}`}>
          {selectedDisplayStatus.label}
        </span>
      ),
    },
    ...(['available', 'blocked', 'full'].includes(selectedStatus.status)
      ? [
          {
            label: 'Orders',
            value: `${selectedOrderCount} / ${settings?.maximumOrdersPerDay ?? 0}`,
          },
          {
            label: 'Capacity',
            value: `${selectedCapacityRemaining} slots remaining`,
          },
        ]
      : []),
    ...(['available', 'blocked', 'restricted'].includes(selectedStatus.status)
      ? [
          {
            label: 'Lead Time',
            value: selectedLeadTimeText,
          },
        ]
      : []),
    {
      label: 'Reason',
      value: selectedReasonText,
    },
  ]

  useEffect(() => {
    let isMounted = true

    const loadAvailability = async () => {
      setIsLoadingAvailability(true)

      try {
        const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
        const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
        const loadedSettings = await fetchAdminAvailabilitySettings({
          startDate: formatDateValue(monthStart),
          endDate: formatDateValue(monthEnd),
        })

        if (!isMounted) {
          return
        }

        setSettings(loadedSettings)
        setSettingsDraft(loadedSettings)
        setFeedback('')
      } catch {
        if (isMounted) {
          const fallbackSettings = {
            ...DEFAULT_AVAILABILITY_SETTINGS,
            orderCountsUnavailable: true,
          }
          setSettings(fallbackSettings)
          setSettingsDraft(fallbackSettings)
          setFeedback('Unable to load availability settings.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingAvailability(false)
        }
      }
    }

    loadAvailability()

    return () => {
      isMounted = false
    }
  }, [visibleMonth])

  useEffect(() => {
    if (!datePopoverRect) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (
        datePopoverRef.current?.contains(event.target) ||
        datePopoverTriggerRef.current?.contains(event.target)
      ) {
        return
      }

      setDatePopoverRect(null)
      setDatePopoverBoundaryRect(null)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDatePopoverRect(null)
        setDatePopoverBoundaryRect(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [datePopoverRect])

  const moveMonth = (direction) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1))
    datePopoverTriggerRef.current = null
    setDatePopoverRect(null)
    setDatePopoverBoundaryRect(null)
    setConfirmationAction(null)
  }

  const handleSelectDate = (dateValue, element) => {
    if (!settings) {
      return
    }

    if (datePopoverRect && selectedDate === dateValue) {
      datePopoverTriggerRef.current = null
      setDatePopoverRect(null)
      setDatePopoverBoundaryRect(null)
      setConfirmationAction(null)
      setFeedback('')
      return
    }

    datePopoverTriggerRef.current = element
    setSelectedDate(dateValue)
    setDatePopoverRect(element.getBoundingClientRect())
    setDatePopoverBoundaryRect(calendarCardRef.current?.getBoundingClientRect() ?? null)
    setConfirmationAction(null)
    setFeedback('')
  }

  const showFeedback = (message) => {
    setFeedback(message)
    window.setTimeout(() => setFeedback(''), 2600)
  }

  const handleSaveSettings = async (event) => {
    event.preventDefault()

    if (!settings || !settingsDraft) {
      return
    }

    setIsSavingAvailability(true)

    try {
      const savedSettings = await saveAdminAvailabilitySettings({
        ...settings,
        minimumLeadTimeDays: settingsDraft.minimumLeadTimeDays,
        maximumOrdersPerDay: settingsDraft.maximumOrdersPerDay,
        serviceStartTime: settingsDraft.serviceStartTime,
        serviceEndTime: settingsDraft.serviceEndTime,
      })

      setSettings(savedSettings)
      setSettingsDraft(savedSettings)
      showFeedback('Availability settings updated.')
    } catch {
      setFeedback('Unable to save availability settings.')
    } finally {
      setIsSavingAvailability(false)
    }
  }

  const handleConfirmDateAction = async () => {
    if (!confirmationAction || !settings) {
      return
    }

    setIsSavingAvailability(true)

    try {
      if (confirmationAction === 'close') {
        const nextSettings = await blockAdminDate(
          settings,
          selectedDate,
          'Closed manually by admin',
        )

        setSettings(nextSettings)
        setSettingsDraft(nextSettings)
        setConfirmationAction(null)
        showFeedback('Date closed for new orders.')
        return
      }

      const nextSettings = await unblockAdminDate(settings, selectedDate)

      setSettings(nextSettings)
      setSettingsDraft(nextSettings)
      setConfirmationAction(null)
      showFeedback('Date reopened for automatic availability evaluation.')
    } catch {
      setFeedback(
        confirmationAction === 'close'
          ? 'Unable to close this date.'
          : 'Unable to reopen this date.',
      )
    } finally {
      setIsSavingAvailability(false)
    }
  }

  return (
    <section className="admin-page admin-availability-page">
      <div className="admin-page-heading admin-availability-heading">
        <div>
          <h2>Availability</h2>
          <p>Manage order dates, daily capacity, lead time, and service hours.</p>
        </div>
        {isLoadingAvailability ? (
          <p className="admin-availability-feedback">Loading availability...</p>
        ) : feedback ? (
          <p className="admin-availability-feedback">{feedback}</p>
        ) : null}
      </div>

      <div className="admin-availability-layout">
        <section
          ref={calendarCardRef}
          className="admin-availability-card admin-availability-calendar-card"
          aria-label="Availability calendar"
        >
          <div className="admin-availability-card-header">
            <div>
              <h3>Availability Calendar</h3>
              <p>
                {settings ? `${getServiceHoursLabel(settings)} service window` : 'Loading service window...'}
              </p>
            </div>
            <div className="admin-availability-calendar-nav">
              <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
                &larr;
              </button>
              <strong>{monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</strong>
              <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
                &rarr;
              </button>
            </div>
          </div>

          <div className="admin-availability-weekdays" aria-hidden="true">
            {weekdayLabels.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="admin-availability-calendar-grid">
            {calendarDays.map((date) =>
              date.day ? (
                <button
                  type="button"
                  key={date.key}
                  className={`admin-availability-day admin-availability-day--${date.status}${
                    datePopoverRect && selectedDate === date.value ? ' admin-availability-day--selected' : ''
                  }`}
                  aria-pressed={Boolean(datePopoverRect && selectedDate === date.value)}
                  onClick={(event) => handleSelectDate(date.value, event.currentTarget)}
                >
                  <span>{date.day}</span>
                  <small>{date.status === 'blocked' ? 'Manually Blocked' : date.label}</small>
                </button>
              ) : (
                <span className="admin-availability-day admin-availability-day--blank" key={date.key} />
              ),
            )}
          </div>

          <div className="admin-availability-legend" aria-label="Calendar legend">
            <span><i className="admin-availability-dot admin-availability-dot--available" />Available</span>
            <span><i className="admin-availability-dot admin-availability-dot--blocked" />Blocked</span>
            <span><i className="admin-availability-dot admin-availability-dot--full" />Fully Booked</span>
            <span><i className="admin-availability-dot admin-availability-dot--restricted" />Past / Restricted</span>
          </div>
        </section>

        <div className="admin-availability-right-column">
          <section className="admin-availability-card admin-availability-settings" aria-label="Availability settings">
            <div className="admin-availability-card-header">
              <div>
                <h3>Availability Settings</h3>
                <p>Controls all customer calendars and time pickers.</p>
              </div>
            </div>

            <form className="admin-availability-settings-form" onSubmit={handleSaveSettings}>
              <div className="admin-availability-settings-section">
                <h4>Order Rules</h4>
                <div className="admin-availability-settings-number-row">
                  <label>
                    <span>Minimum Lead Time</span>
                    <div className="admin-availability-inline-field admin-availability-inline-field--days">
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={settingsDraft?.minimumLeadTimeDays ?? ''}
                        disabled={isLoadingAvailability || isSavingAvailability || !settingsDraft}
                        onChange={(event) =>
                          setSettingsDraft((current) => ({
                            ...current,
                            minimumLeadTimeDays: event.target.value,
                          }))
                        }
                      />
                      <small>days</small>
                    </div>
                  </label>

                  <label>
                    <span>Maximum Orders / Day</span>
                      <input
                        type="number"
                        min="1"
                        max="2"
                      value={settingsDraft?.maximumOrdersPerDay ?? ''}
                      disabled={isLoadingAvailability || isSavingAvailability || !settingsDraft}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          maximumOrdersPerDay: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="admin-availability-settings-section admin-availability-service-hours">
                <span className="admin-availability-field-title">Service Hours</span>
                <div className="admin-availability-time-range">
                  <label>
                    <span>Service Start</span>
                    <input
                      type="time"
                      value={settingsDraft?.serviceStartTime ?? ''}
                      disabled={isLoadingAvailability || isSavingAvailability || !settingsDraft}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          serviceStartTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <span className="admin-availability-time-separator" aria-hidden="true">
                    -
                  </span>
                  <label>
                    <span>Service End</span>
                    <input
                      type="time"
                      value={settingsDraft?.serviceEndTime ?? ''}
                      disabled={isLoadingAvailability || isSavingAvailability || !settingsDraft}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          serviceEndTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="admin-availability-settings-actions">
                <button
                  className="admin-availability-primary-btn"
                  type="submit"
                  disabled={isLoadingAvailability || isSavingAvailability || !settingsDraft}
                >
                  {isSavingAvailability ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </section>

        </div>
      </div>

      <DateActionPopover
        anchorRect={settings ? datePopoverRect : null}
        boundaryRect={datePopoverBoundaryRect}
        dateLabel={formatDisplayDate(selectedDate)}
        details={selectedDateDetails}
        action={selectedAction}
        onAction={() => setConfirmationAction(selectedAction?.key)}
        popoverRef={datePopoverRef}
      />

      {confirmationAction && selectedAction ? (
        <div className="admin-availability-confirm-backdrop" role="presentation">
          <section
            className="admin-availability-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-availability-confirm-title"
          >
            <div>
              <h3 id="admin-availability-confirm-title">{selectedAction.title}</h3>
              <p>{selectedAction.body}</p>
            </div>
            <div className="admin-availability-confirm-actions">
              <button
                className="admin-availability-secondary-btn"
                type="button"
                onClick={() => setConfirmationAction(null)}
              >
                Cancel
              </button>
              <button
                className="admin-availability-primary-btn"
                type="button"
                onClick={handleConfirmDateAction}
              >
                {selectedAction.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

export default Availability
