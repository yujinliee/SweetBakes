import { useEffect, useMemo, useState } from 'react'
import { fetchAdminLoyaltyOverview } from '../../services/customerService.js'
import './LoyaltyRewards.css'

const moneyCount = (value) => Number(value) || 0

export default function LoyaltyRewards({ onNavigate }) {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const load = () => {
    setLoading(true); setError('')
    fetchAdminLoyaltyOverview().then(setOverview).catch(() => setError('Unable to load loyalty rewards.')).finally(() => setLoading(false))
  }
  useEffect(() => {
    let mounted = true
    fetchAdminLoyaltyOverview().then((value) => { if (mounted) setOverview(value) }).catch(() => { if (mounted) setError('Unable to load loyalty rewards.') }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const customers = useMemo(() => {
    const value = search.trim().toLowerCase()
    return (overview?.customers || []).filter((customer) => {
      const matchesSearch = !value || [customer.first_name, customer.last_name, customer.email].filter(Boolean).join(' ').toLowerCase().includes(value)
      const matchesFilter = filter === 'all'
        || (filter === 'available' && moneyCount(customer.available_rewards) > 0)
        || (filter === 'reserved' && moneyCount(customer.reserved_rewards) > 0)
        || (filter === 'used' && moneyCount(customer.used_rewards) > 0)
        || (filter === 'none' && moneyCount(customer.total_rewards) === 0)
      return matchesSearch && matchesFilter
    })
  }, [overview, search, filter])
  const pageCount = Math.max(1, Math.ceil(customers.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = customers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const summary = overview?.summary || {}

  return <section className="admin-page admin-loyalty-page">
    <div className="admin-loyalty-heading"><div><p className="admin-loyalty-eyebrow">Customer Monitoring</p><h2>Loyalty Rewards</h2><p>Monitor customer reward progress, availability, and usage.</p></div><button type="button" className="admin-loyalty-refresh" onClick={load} disabled={loading}>Refresh</button></div>
    {loading ? <div className="admin-loyalty-state">Loading loyalty rewards...</div> : error ? <div className="admin-loyalty-state admin-loyalty-state--error" role="alert">{error} <button type="button" onClick={load}>Retry</button></div> : <>
      <div className="admin-loyalty-summary">{[['Total Rewards', summary.total_rewards], ['Available', summary.available_rewards], ['Reserved', summary.reserved_rewards], ['Used', summary.used_rewards]].map(([label, value]) => <div className="admin-loyalty-summary-card" key={label}><span>{label}</span><b>{moneyCount(value)}</b></div>)}</div>
      <section className="admin-loyalty-table-card"><div className="admin-loyalty-toolbar"><input aria-label="Search customer" placeholder="Search customer..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /><select aria-label="Filter loyalty status" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }}><option value="all">All Rewards</option><option value="available">Has Available Reward</option><option value="reserved">Has Reserved Reward</option><option value="used">Has Used Reward</option><option value="none">No Reward Yet</option></select></div><div className="admin-loyalty-table-wrap"><table className="admin-loyalty-table"><thead><tr><th>Customer</th><th>Completed</th><th>Progress</th><th>Available</th><th>Reserved</th><th>Used</th><th>Total Earned</th><th /></tr></thead><tbody>{visible.length ? visible.map((customer) => <tr key={customer.customer_id}><td><strong>{[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Customer'}</strong><small>{customer.email || '—'}</small></td><td>{customer.completed_orders}</td><td>{customer.progress} / {customer.threshold}</td><td>{customer.available_rewards}</td><td>{customer.reserved_rewards}</td><td>{customer.used_rewards}</td><td>{customer.total_rewards}</td><td><button type="button" className="admin-loyalty-details" onClick={() => onNavigate(`/admin/customers/${customer.customer_id}`)}>View Details</button></td></tr>) : <tr><td colSpan="8" className="admin-loyalty-empty">No loyalty activity yet.</td></tr>}</tbody></table></div><div className="admin-loyalty-pagination"><span>{customers.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, customers.length)} of ${customers.length}` : '0 customers'}</span><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>‹</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>›</button></div></section>
    </>}
  </section>
}
