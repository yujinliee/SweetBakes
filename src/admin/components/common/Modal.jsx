import './common.css'

function Modal({ title, children, onClose }) {
  return (
    <div className="admin-modal-overlay" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="Close modal" onClick={onClose}>
            X
          </button>
        </header>
        <div>{children}</div>
      </section>
    </div>
  )
}

export default Modal
