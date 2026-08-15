import { useEffect } from 'react'
import './LegalModal.css'

function LegalModal({ title, content, isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="legal-modal-backdrop" onMouseDown={onClose}>
      <section
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="legal-modal-header">
          <div>
            <p>Sweet Bakes</p>
            <h2 id="legal-modal-title">{title}</h2>
          </div>
          <button
            className="legal-modal-close"
            type="button"
            aria-label="Close legal information"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="legal-modal-content">
          {content.map((section) => (
            <section className="legal-modal-section" key={section.heading}>
              <h3>{section.heading}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="legal-modal-footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  )
}

export default LegalModal
