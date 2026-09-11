import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  isTimeWithinWindow,
  pad2,
  parseTimeValue,
  timeToMinutes,
  to24hTime,
  wheelIndexForScrollTop,
} from './timeUtils.js'
import './WheelTimePicker.css'

const ROW_HEIGHT = 40
const MINUTES = [0, 15, 30, 45]
const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '19:00'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const parseTimeForWheel = (value) => {
  const parsed = parseTimeValue(value)

  if (!parsed) {
    return null
  }

  return {
    hour12: parsed.hour % 12 === 0 ? 12 : parsed.hour % 12,
    minute: parsed.minute,
    period: parsed.hour < 12 ? 'AM' : 'PM',
  }
}

const isTimeAllowed = (hour12, minute, period, minTime, maxTime) => {
  const value = to24hTime(hour12, minute, period)
  return isTimeWithinWindow(value, minTime, maxTime)
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

function WheelColumn({ label, options, getLabel, valueIndex, onSelect, loop = false, onNode }) {
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

  const commitLogical = (index) => {
    const logical = loop
      ? ((index % cycleLength) + cycleLength) % cycleLength
      : clamp(index, 0, cycleLength - 1)
    if (logical !== selectedIndexRef.current) {
      selectedIndexRef.current = logical
      onSelect(logical)
    }
  }

  useLayoutEffect(() => {
    const node = wheelRef.current
    if (!node || isInitializedRef.current) return
    node.scrollTop = middleIndex * ROW_HEIGHT
    selectedIndexRef.current = valueIndex
    setCenterIndex(middleIndex)
    isInitializedRef.current = true
  }, [middleIndex, valueIndex])

  useLayoutEffect(() => {
    const node = wheelRef.current
    if (node) {
      onNode(node)
    }
  }, [onNode])

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
      commitLogical(currentIndex + direction)
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
    commitLogical(nearestIndex)
    settleToIndex(nearestIndex)
  }

  const handleOptionClick = (index) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    commitLogical(index)
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
  const normalizedMinTime = parseTimeForWheel(minTime) ? minTime : DEFAULT_START_TIME
  const normalizedMaxCandidate = parseTimeForWheel(maxTime) ? maxTime : DEFAULT_END_TIME
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
      getHourIndex(hours, parseTimeForWheel(normalizedMinTime).hour12),
      getMinuteIndex(parseTimeForWheel(normalizedMinTime).minute),
      getPeriodIndex(periods, parseTimeForWheel(normalizedMinTime).period),
      hours,
      periods,
      normalizedMinTime,
      normalizedMaxTime,
    ),
  )
  const containerRef = useRef(null)
  const panelRef = useRef(null)
  const hourNodeRef = useRef(null)
  const minuteNodeRef = useRef(null)
  const periodNodeRef = useRef(null)
  const registerHourNode = useCallback((node) => {
    hourNodeRef.current = node
  }, [])
  const registerMinuteNode = useCallback((node) => {
    minuteNodeRef.current = node
  }, [])
  const registerPeriodNode = useCallback((node) => {
    periodNodeRef.current = node
  }, [])

  const deriveSelectionFromWheels = () => {
    const hourNode = hourNodeRef.current
    const minuteNode = minuteNodeRef.current
    const periodNode = periodNodeRef.current

    if (!hourNode || !minuteNode || !periodNode) {
      return null
    }

    return {
      hourIndex: clamp(wheelIndexForScrollTop(hourNode.scrollTop, hours.length), 0, hours.length - 1),
      minuteIndex: clamp(wheelIndexForScrollTop(minuteNode.scrollTop, MINUTES.length), 0, MINUTES.length - 1),
      periodIndex: clamp(wheelIndexForScrollTop(periodNode.scrollTop, periods.length), 0, periods.length - 1),
    }
  }

  const openPicker = () => {
    const parsed = parseTimeForWheel(value)
    const fallback = parseTimeForWheel(normalizedMinTime)
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
    const wheelSelection = deriveSelectionFromWheels() ?? time
    const next = resolveIndexes(wheelSelection.hourIndex, wheelSelection.minuteIndex, wheelSelection.periodIndex, hours, periods)

    const selectedIsValid = isTimeAllowed(
      hours[next.hourIndex],
      MINUTES[next.minuteIndex],
      periods[next.periodIndex],
      normalizedMinTime,
      normalizedMaxTime,
    )

    if (!selectedIsValid) {
      return
    }

    const committed = to24hTime(
      hours[next.hourIndex],
      MINUTES[next.minuteIndex],
      periods[next.periodIndex],
    )

    if (import.meta.env.DEV) {
      console.log('[TIME PICKER] raw wheel selection', {
        hour12: hours[next.hourIndex],
        minute: MINUTES[next.minuteIndex],
        period: periods[next.periodIndex],
      })
      console.log('[TIME PICKER] state after change', committed)
    }

    setTime(next)
    onChange(committed)
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

  const parsedDisplay = parseTimeForWheel(value)
  const displayValue = parsedDisplay
    ? `${parsedDisplay.hour12}:${pad2(parsedDisplay.minute)} ${parsedDisplay.period}`
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
              onNode={registerHourNode}
              loop
            />
            <WheelColumn
              label="MINUTE"
              options={MINUTES}
              getLabel={(minute) => pad2(minute)}
              valueIndex={time.minuteIndex}
              onSelect={selectMinute}
              onNode={registerMinuteNode}
              loop
            />
            <WheelColumn
              label="AM/PM"
              options={periods}
              getLabel={(period) => period}
              valueIndex={time.periodIndex}
              onSelect={selectPeriod}
              onNode={registerPeriodNode}
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
