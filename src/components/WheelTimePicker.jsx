import { useCallback, useEffect, useRef, useState } from 'react'
import './WheelTimePicker.css'

const ROW_HEIGHT = 40
const VISIBLE_ROWS = 5
const CENTER_ROW = 2
const MINUTES = [0, 15, 30, 45]
const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '19:00'

const pad = (n) => String(n).padStart(2, '0')
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const parseValue = (value) => {
  if (!value) {
    return null
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const hour24 = Number(match[1])
  const minute = Number(match[2])

  if (hour24 > 23 || minute > 59) {
    return null
  }

  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    period: hour24 < 12 ? 'AM' : 'PM',
  }
}

const timeToMinutes = (value) => {
  const parsed = parseValue(value)

  if (!parsed) {
    return 0
  }

  const hour24 =
    parsed.period === 'PM'
      ? (parsed.hour12 % 12) + 12
      : parsed.hour12 === 12
        ? 0
        : parsed.hour12

  return hour24 * 60 + parsed.minute
}

const to24h = (hour12, minute, period) => {
  let hour24 = hour12 % 12

  if (period === 'PM') {
    hour24 += 12
  }

  return `${pad(hour24)}:${pad(minute)}`
}

const isTimeAllowed = (hour12, minute, period, minTime, maxTime) => {
  const value = to24h(hour12, minute, period)
  const minutes = timeToMinutes(value)

  return minutes >= timeToMinutes(minTime) && minutes <= timeToMinutes(maxTime)
}

const buildHourOptions = (minTime, maxTime) => {
  const minMinutes = timeToMinutes(minTime)
  const maxMinutes = timeToMinutes(maxTime)
  const options = []
  const seen = new Set()

  for (let minutes = minMinutes; minutes <= maxMinutes; minutes += 15) {
    const hour24 = Math.floor(minutes / 60)
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

    if (!seen.has(hour12)) {
      seen.add(hour12)
      options.push(hour12)
    }
  }

  return options.length ? options : [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7]
}

const buildPeriodOptions = (minTime, maxTime) => {
  const minMinutes = timeToMinutes(minTime)
  const maxMinutes = timeToMinutes(maxTime)
  const options = []

  if (minMinutes < 12 * 60) {
    options.push('AM')
  }

  if (maxMinutes >= 12 * 60) {
    options.push('PM')
  }

  return options.length ? options : ['AM', 'PM']
}

const getHourIndex = (hours, hour) => Math.max(0, hours.indexOf(hour))
const getMinuteIndex = (minute) => MINUTES.indexOf(minute)
const getPeriodIndex = (periods, period) => Math.max(0, periods.indexOf(period))

const resolveIndexes = (hourIndex, minuteIndex, periodIndex, hours, periods, minTime, maxTime) => {
  const hour = hours[clamp(hourIndex, 0, hours.length - 1)]
  const minute = MINUTES[clamp(minuteIndex, 0, MINUTES.length - 1)]
  const period = periods[clamp(periodIndex, 0, periods.length - 1)]

  if (isTimeAllowed(hour, minute, period, minTime, maxTime)) {
    return { hourIndex, minuteIndex, periodIndex }
  }

  const selectedMinutes = timeToMinutes(to24h(hour, minute, period))
  const boundaryTime =
    selectedMinutes < timeToMinutes(minTime) ? parseValue(minTime) : parseValue(maxTime)
  const boundaryHourIndex = getHourIndex(hours, boundaryTime.hour12)
  const boundaryMinuteIndex = Math.max(0, getMinuteIndex(boundaryTime.minute))
  const boundaryPeriodIndex = getPeriodIndex(periods, boundaryTime.period)

  return {
    hourIndex: boundaryHourIndex,
    minuteIndex: boundaryMinuteIndex,
    periodIndex: boundaryPeriodIndex,
  }
}

function WheelColumn({ label, options, getLabel, valueIndex, onSelect }) {
  const innerRef = useRef(null)
  const dragRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const node = innerRef.current?.parentElement

    if (!node) {
      return undefined
    }

    const handleWheel = (event) => {
      event.preventDefault()
      onSelect(valueIndex + (event.deltaY > 0 ? 1 : -1))
    }

    node.addEventListener('wheel', handleWheel, { passive: false })

    return () => node.removeEventListener('wheel', handleWheel)
  }, [valueIndex, onSelect])

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    dragRef.current = {
      startY: event.clientY,
      startIndex: valueIndex,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      preview: valueIndex,
    }

    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current

    if (!drag) {
      return
    }

    const now = performance.now()
    const dt = now - drag.lastTime

    if (dt > 0) {
      drag.velocity = (event.clientY - drag.lastY) / dt
    }

    drag.lastY = event.clientY
    drag.lastTime = now

    const deltaRows = (event.clientY - drag.startY) / ROW_HEIGHT
    const preview = clamp(Math.round(drag.startIndex - deltaRows), 0, options.length - 1)

    drag.preview = preview

    if (innerRef.current) {
      innerRef.current.style.transform = `translateY(${-preview * ROW_HEIGHT}px)`
    }
  }

  const handlePointerEnd = () => {
    const drag = dragRef.current

    if (!drag) {
      return
    }

    const fling = clamp(Math.round(drag.velocity * 120), -2, 2)
    const preview = clamp(drag.preview - fling, 0, options.length - 1)

    dragRef.current = null
    setIsDragging(false)

    if (innerRef.current) {
      innerRef.current.style.transform = ''
    }

    onSelect(preview)
  }

  return (
    <div className="wtp-col">
      <span className="wtp-col-label">{label}</span>
      <div
        className="wtp-wheel"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className={`wtp-wheel-inner${isDragging ? ' is-dragging' : ''}`}
          ref={innerRef}
          style={{
            paddingTop: CENTER_ROW * ROW_HEIGHT,
            paddingBottom: (VISIBLE_ROWS - 1 - CENTER_ROW) * ROW_HEIGHT,
            transform: `translateY(${-valueIndex * ROW_HEIGHT}px)`,
          }}
        >
          {options.map((option, index) => (
            <div
              className={`wtp-option${index === valueIndex ? ' wtp-option--selected' : ''}`}
              key={option}
            >
              {getLabel(option)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WheelTimePicker({
  value,
  onChange,
  placeholder = 'Select your preferred time',
  dataValidationField,
  invalid,
  onBlur,
  minTime = DEFAULT_START_TIME,
  maxTime = DEFAULT_END_TIME,
}) {
  const normalizedMinTime = parseValue(minTime) ? minTime : DEFAULT_START_TIME
  const normalizedMaxCandidate = parseValue(maxTime) ? maxTime : DEFAULT_END_TIME
  const normalizedMaxTime =
    timeToMinutes(normalizedMinTime) <= timeToMinutes(normalizedMaxCandidate)
      ? normalizedMaxCandidate
      : DEFAULT_END_TIME
  const hours = buildHourOptions(normalizedMinTime, normalizedMaxTime)
  const periods = buildPeriodOptions(normalizedMinTime, normalizedMaxTime)
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState('bottom')
  const [time, setTime] = useState(() =>
    resolveIndexes(
      getHourIndex(hours, parseValue(normalizedMinTime).hour12),
      getMinuteIndex(parseValue(normalizedMinTime).minute),
      getPeriodIndex(periods, parseValue(normalizedMinTime).period),
      hours,
      periods,
      normalizedMinTime,
      normalizedMaxTime,
    ),
  )
  const containerRef = useRef(null)
  const panelRef = useRef(null)

  const openPicker = () => {
    const parsed = parseValue(value)
    const fallback = parseValue(normalizedMinTime)
    const hour =
      parsed && hours.includes(parsed.hour12) && MINUTES.includes(parsed.minute)
        ? parsed.hour12
        : fallback.hour12
    const minute =
      parsed && hours.includes(parsed.hour12) && MINUTES.includes(parsed.minute)
        ? parsed.minute
        : fallback.minute
    const period =
      parsed && hours.includes(parsed.hour12) && MINUTES.includes(parsed.minute)
        ? parsed.period
        : fallback.period

    setTime(
      resolveIndexes(
        getHourIndex(hours, hour),
        getMinuteIndex(minute),
        getPeriodIndex(periods, period),
        hours,
        periods,
        normalizedMinTime,
        normalizedMaxTime,
      ),
    )
    setOpen(true)
  }

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleViewportChange = () => {
      const node = containerRef.current
      const panel = panelRef.current

      if (!node) {
        return
      }

      const panelHeight = panel ? panel.offsetHeight : 260
      const rect = node.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      setPlacement(spaceBelow < panelHeight && spaceAbove > spaceBelow ? 'top' : 'bottom')
    }

    handleViewportChange()
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [open])

  const handleDone = () => {
    onChange(to24h(hours[time.hourIndex], MINUTES[time.minuteIndex], periods[time.periodIndex]))
    setOpen(false)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const parsedDisplay = parseValue(value)
  const displayValue = parsedDisplay
    ? `${parsedDisplay.hour12}:${pad(parsedDisplay.minute)} ${parsedDisplay.period}`
    : ''

  const selectHour = useCallback((rawIndex) => {
    setTime((current) =>
      resolveIndexes(
        clamp(rawIndex, 0, hours.length - 1),
        current.minuteIndex,
        current.periodIndex,
        hours,
        periods,
        normalizedMinTime,
        normalizedMaxTime,
      ),
    )
  }, [hours, normalizedMaxTime, normalizedMinTime, periods])

  const selectMinute = useCallback((rawIndex) => {
    setTime((current) =>
      resolveIndexes(
        current.hourIndex,
        clamp(rawIndex, 0, MINUTES.length - 1),
        current.periodIndex,
        hours,
        periods,
        normalizedMinTime,
        normalizedMaxTime,
      ),
    )
  }, [hours, normalizedMaxTime, normalizedMinTime, periods])

  const selectPeriod = useCallback((rawIndex) => {
    setTime((current) =>
      resolveIndexes(
        current.hourIndex,
        current.minuteIndex,
        clamp(rawIndex, 0, periods.length - 1),
        hours,
        periods,
        normalizedMinTime,
        normalizedMaxTime,
      ),
    )
  }, [hours, normalizedMaxTime, normalizedMinTime, periods])

  return (
    <div className="wtp-field" ref={containerRef}>
      <input
        className="cake-text-input wtp-input"
        data-validation-field={dataValidationField}
        aria-invalid={invalid ? 'true' : undefined}
        type="text"
        readOnly
        placeholder={placeholder}
        value={displayValue}
        onBlur={onBlur}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
      />
      <span className="wtp-clock" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {open ? (
        <div className={`wtp-panel wtp-panel--${placement}`} ref={panelRef} role="dialog" aria-label="Select time">
          <div className="wtp-columns">
            <div className="wtp-band" aria-hidden="true" />
            <WheelColumn
              label="HOUR"
              options={hours}
              getLabel={(hour) => String(hour)}
              valueIndex={time.hourIndex}
              onSelect={selectHour}
            />
            <WheelColumn
              label="MINUTE"
              options={MINUTES}
              getLabel={(minute) => pad(minute)}
              valueIndex={time.minuteIndex}
              onSelect={selectMinute}
            />
            <WheelColumn
              label="AM/PM"
              options={periods}
              getLabel={(period) => period}
              valueIndex={time.periodIndex}
              onSelect={selectPeriod}
            />
          </div>
          <div className="wtp-actions">
            <button type="button" className="wtp-btn wtp-btn--cancel" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="wtp-btn wtp-btn--done" onClick={handleDone}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default WheelTimePicker
