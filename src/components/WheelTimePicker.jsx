import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './WheelTimePicker.css'

const ROW_HEIGHT = 40
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

const buildHourOptions = () => Array.from({ length: 12 }, (_, index) => index + 1)
const buildPeriodOptions = () => ['AM', 'PM']

const getHourIndex = (hours, hour) => Math.max(0, hours.indexOf(hour))
const getMinuteIndex = (minute) => MINUTES.indexOf(minute)
const getPeriodIndex = (periods, period) => Math.max(0, periods.indexOf(period))

const resolveIndexes = (hourIndex, minuteIndex, periodIndex, hours, periods) => ({
  hourIndex: clamp(hourIndex, 0, hours.length - 1),
  minuteIndex: clamp(minuteIndex, 0, MINUTES.length - 1),
  periodIndex: clamp(periodIndex, 0, periods.length - 1),
})

const WHEEL_CYCLES = 101
const WHEEL_EDGE_CYCLES = 8

function WheelColumn({ label, options, getLabel, valueIndex, onSelect, loop = false }) {
  const wheelRef = useRef(null)
  const selectedIndexRef = useRef(valueIndex)
  const isInitializedRef = useRef(false)
  const dragRef = useRef(null)
  const didDragRef = useRef(false)
  const cycleLength = options.length
  const virtualCount = loop ? cycleLength * WHEEL_CYCLES : cycleLength
  const middleIndex = loop ? Math.floor(WHEEL_CYCLES / 2) * cycleLength + valueIndex : valueIndex
  const [centerIndex, setCenterIndex] = useState(middleIndex)
  const [isDragging, setIsDragging] = useState(false)

  const settleToIndex = (index) => {
    const node = wheelRef.current
    if (!node) return
    const maxIndex = loop ? virtualCount - 1 : cycleLength - 1
    node.scrollTo({
      top: clamp(index, 0, maxIndex) * ROW_HEIGHT,
      behavior: 'auto',
    })
  }

  useLayoutEffect(() => {
    const node = wheelRef.current
    if (!node || isInitializedRef.current) return
    node.scrollTop = middleIndex * ROW_HEIGHT
    selectedIndexRef.current = valueIndex
    setCenterIndex(middleIndex)
    isInitializedRef.current = true
  }, [middleIndex, valueIndex])

  useEffect(() => {
    const node = wheelRef.current
    if (!node) return undefined

    const handleScroll = () => {
      const virtualIndex = Math.max(0, Math.round(node.scrollTop / ROW_HEIGHT))
      const logicalIndex = loop ? virtualIndex % cycleLength : clamp(virtualIndex, 0, cycleLength - 1)
      setCenterIndex(virtualIndex)

      if (logicalIndex !== selectedIndexRef.current) {
        selectedIndexRef.current = logicalIndex
        onSelect(logicalIndex)
      }

      const edgeDistance = Math.min(virtualIndex, virtualCount - virtualIndex - 1)
      if (loop && edgeDistance < WHEEL_EDGE_CYCLES * cycleLength) {
        const recenteredIndex = Math.floor(WHEEL_CYCLES / 2) * cycleLength + logicalIndex
        node.scrollTop = recenteredIndex * ROW_HEIGHT
        setCenterIndex(recenteredIndex)
      }
    }

    node.addEventListener('scroll', handleScroll, { passive: true })
    return () => node.removeEventListener('scroll', handleScroll)
  }, [cycleLength, loop, onSelect, virtualCount])

  useEffect(() => {
    const node = wheelRef.current
    if (!node) return undefined

    const handleWheel = (event) => {
      event.preventDefault()
      const direction = event.deltaY > 0 ? 1 : -1
      const currentIndex = Math.max(0, Math.round(node.scrollTop / ROW_HEIGHT))
      settleToIndex(currentIndex + direction)
    }

    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  })

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const node = wheelRef.current
    if (!node) return
    event.preventDefault()
    didDragRef.current = false
    dragRef.current = {
      startY: event.clientY,
      startScrollTop: node.scrollTop,
    }
    node.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    const node = wheelRef.current
    if (!drag || !node) return
    event.preventDefault()
    if (Math.abs(event.clientY - drag.startY) > 4) didDragRef.current = true
    const maxScroll = node.scrollHeight - node.clientHeight
    node.scrollTop = clamp(drag.startScrollTop - (event.clientY - drag.startY), 0, maxScroll)
  }

  const handlePointerEnd = (event) => {
    const drag = dragRef.current
    const node = wheelRef.current
    if (!drag || !node) return
    const nearestIndex = Math.round(node.scrollTop / ROW_HEIGHT)
    dragRef.current = null
    if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId)
    setIsDragging(false)
    settleToIndex(nearestIndex)
  }

  const handleOptionClick = (index) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    settleToIndex(index)
  }

  return (
    <div className="wtp-col">
      <span className="wtp-col-label">{label}</span>
      <div
        className={`wtp-wheel${isDragging ? ' is-dragging' : ''}`}
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div className="wtp-wheel-inner">
          {Array.from({ length: virtualCount }, (_, index) => (
            <div
              className={`wtp-option${index === centerIndex ? ' wtp-option--selected' : ''}`}
              key={`${index}-${options[index % cycleLength]}`}
              onClick={() => handleOptionClick(index)}
            >
              {getLabel(options[index % cycleLength])}
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
  const hours = buildHourOptions()
  const periods = buildPeriodOptions()
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
    const selectedIsValid = isTimeAllowed(
      hours[time.hourIndex],
      MINUTES[time.minuteIndex],
      periods[time.periodIndex],
      normalizedMinTime,
      normalizedMaxTime,
    )

    if (!selectedIsValid) {
      return
    }

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

  const selectedTimeIsValid = isTimeAllowed(
    hours[time.hourIndex],
    MINUTES[time.minuteIndex],
    periods[time.periodIndex],
    normalizedMinTime,
    normalizedMaxTime,
  )

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
              loop
            />
            <WheelColumn
              label="MINUTE"
              options={MINUTES}
              getLabel={(minute) => pad(minute)}
              valueIndex={time.minuteIndex}
              onSelect={selectMinute}
              loop
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
            <button
              type="button"
              className="wtp-btn wtp-btn--done"
              disabled={!selectedTimeIsValid}
              onClick={handleDone}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default WheelTimePicker
