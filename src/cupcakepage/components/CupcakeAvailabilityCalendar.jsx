import { useEffect, useMemo, useState } from 'react'
import {
  formatDateValue,
  getTodayDate,
} from '../../admin/services/availabilityService.js'
import { useAvailability } from '../../hooks/useAvailability.js'

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

function CupcakeAvailabilityCalendar({ selectedDate, validationError = '', onDateChange }) {
  const availability = useAvailability()
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = getTodayDate()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  useEffect(() => {
    if (
      selectedDate &&
      !availability.loading &&
      (!availability.settings || !availability.isDateAvailable(selectedDate))
    ) {
      onDateChange('')
    }
  }, [availability, onDateChange, selectedDate])

  const calendarDays = useMemo(() => {
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
        const dateStatus = availability.getDateStatus(value)
        const todayValue = formatDateValue(getTodayDate())

        return {
          key: value,
          day: index + 1,
          value,
          isToday: value === todayValue,
          isSelected: value === selectedDate,
          isDisabled: availability.loading || availability.error || !dateStatus || dateStatus.isDisabled,
        }
      }),
    ]
  }, [availability, selectedDate, visibleMonth])

  const moveMonth = (direction) => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + direction, 1),
    )
  }

  return (
    <section
      className="cake-availability"
      data-validation-field="preferredDate"
      aria-label="Available dates"
    >
      <h2>Available Dates</h2>
      <div className="cake-calendar" aria-invalid={validationError ? 'true' : undefined}>
        <div className="cake-calendar-header">
          <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
            &larr;
          </button>
          <h3>
            {monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
          </h3>
          <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
            &rarr;
          </button>
        </div>

        <div className="cake-calendar-weekdays" aria-hidden="true">
          {weekdayLabels.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="cake-calendar-grid">
          {calendarDays.map((date) =>
            date.day ? (
              <button
                className={`cake-calendar-day${date.isToday ? ' cake-calendar-day--today' : ''}${
                  date.isSelected ? ' cake-calendar-day--selected' : ''
                }`}
                type="button"
                disabled={date.isDisabled}
                onClick={() => onDateChange(date.value)}
                key={date.key}
              >
                {date.day}
              </button>
            ) : (
              <span className="cake-calendar-day cake-calendar-day--blank" key={date.key} />
            ),
          )}
        </div>
      </div>
      {validationError ? <p className="cake-field-error">* {validationError}</p> : null}
      {availability.error ? (
        <p className="cake-field-error">* Available dates are temporarily unavailable. Please try again shortly.</p>
      ) : null}
      <p className="cake-lead-time">
        {availability.loading
          ? 'Loading available dates...'
          : `Current lead time for custom orders: ${availability.minimumLeadTime} days. Please order early to secure your preferred pickup or delivery date.`}
      </p>
    </section>
  )
}

export default CupcakeAvailabilityCalendar
