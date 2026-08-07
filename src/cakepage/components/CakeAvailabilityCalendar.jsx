import { useMemo, useState } from 'react'

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
const leadTimeDays = 5
const today = new Date(2026, 7, 7)
const unavailableDates = new Set(['2026-08-10', '2026-08-17', '2026-08-24'])

const formatDateValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function CakeAvailabilityCalendar({ selectedDate, validationError = '', onDateChange }) {
  const [visibleMonth, setVisibleMonth] = useState(new Date(2026, 7, 1))

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
        const isPast = date < today
        const isUnavailable = unavailableDates.has(value)

        return {
          key: value,
          day: index + 1,
          value,
          isToday: value === formatDateValue(today),
          isSelected: value === selectedDate,
          isDisabled: isPast || isUnavailable,
        }
      }),
    ]
  }, [selectedDate, visibleMonth])

  const moveMonth = (direction) => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + direction, 1),
    )
  }

  return (
    <section className="cake-availability" data-validation-field="preferredDate" aria-label="Available dates">
      <h2>Available Dates</h2>
      <div className="cake-calendar" aria-invalid={validationError ? 'true' : undefined}>
        <div className="cake-calendar-header">
          <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
            ←
          </button>
          <h3>
            {monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
          </h3>
          <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
            →
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
      <p className="cake-lead-time">
        Current lead time for custom orders: {leadTimeDays} days. Please order early to secure
        your preferred pickup or delivery date.
      </p>
    </section>
  )
}

export default CakeAvailabilityCalendar
