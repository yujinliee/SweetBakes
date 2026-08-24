import { useEffect, useMemo, useRef, useState } from 'react'

const PANEL_MAX_HEIGHT = 240

function AutocompleteTextInput({ options, value, placeholder, onChange, onSelect }) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState('bottom')
  const [highlighted, setHighlighted] = useState(-1)
  const containerRef = useRef(null)

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase()

    if (!query) {
      return []
    }

    const tokens = query.split(/\s+/).filter(Boolean)

    return options.filter((option) => {
      const target = option.toLowerCase()

      return tokens.every((token) => target.includes(token))
    })
  }, [options, value])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleViewportChange = () => {
      const node = containerRef.current

      if (!node) {
        return
      }

      const rect = node.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      setPlacement(spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow ? 'top' : 'bottom')
    }

    handleViewportChange()
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [open])

  const selectOption = (option) => {
    if (onSelect) {
      onSelect(option)
    } else {
      onChange(option)
    }
    setOpen(false)
    setHighlighted(-1)
  }

  const handleKeyDown = (event) => {
    if (matches.length === 0) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlighted((current) => Math.min(current + 1, matches.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (highlighted >= 0 && highlighted < matches.length) {
        selectOption(matches[highlighted])
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const handleChange = (event) => {
    onChange(event.target.value)
    setOpen(true)
    setHighlighted(0)
  }

  return (
    <div className="cart-autocomplete-field" ref={containerRef}>
      <input
        className="cake-text-input"
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {open && matches.length > 0 ? (
        <ul
          className={`cart-autocomplete cart-autocomplete--${placement}`}
          role="listbox"
          aria-label="Suggestions"
        >
          {matches.map((option, index) => (
            <li key={option} role="option" aria-selected={index === highlighted}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectOption(option)
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default AutocompleteTextInput
