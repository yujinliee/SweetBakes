import './common.css'

function StatusBadge({ status = 'Pending Review' }) {
  return <span className="admin-status-badge">{status}</span>
}

export default StatusBadge
