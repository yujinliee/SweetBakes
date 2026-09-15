export function RewardsTagIcon() {
  return (
    <svg
      className="rewards-tag-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" />
      <path d="M7 7h.01" />
    </svg>
  )
}

export function RewardsHeader({ isExpanded = false, label, onClick, ariaControls }) {
  return (
    <button
      type="button"
      className={`rewards-launch${isExpanded ? ' is-expanded' : ''}`}
      onClick={onClick}
      aria-expanded={isExpanded}
      aria-controls={ariaControls}
    >
      <RewardsTagIcon />
      <span className="rewards-launch-label">{label}</span>
      <svg
        className="rewards-caret"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  )
}

export function RewardsReveal({ id, isOpen = false, children }) {
  return (
    <div
      id={id}
      className={`rewards-reveal${isOpen ? ' is-open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div className="rewards-reveal-inner">
        <div className="rewards-reveal-body">{children}</div>
      </div>
    </div>
  )
}

export function RewardsEmpty({ title, sub }) {
  return (
    <div className="rewards-empty">
      <p className="rewards-empty-title">{title}</p>
      {sub ? <p className="rewards-empty-sub">{sub}</p> : null}
    </div>
  )
}