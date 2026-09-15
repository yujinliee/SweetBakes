import { useId, useState } from 'react'
import './savedAddressSelector.css'

function AddressSummary({ address }) {
  return <span className="saved-address-copy">
    <span className="saved-address-badge">{address.is_default ? 'Default Address' : 'Saved Address'}</span>
    <span>{address.address}</span>
    {address.apartment_unit && <span>{address.apartment_unit}</span>}
    <span>{[address.barangay, address.city_municipality].filter(Boolean).join(', ')}</span>
    <span>{[address.province, address.postal_code].filter(Boolean).join(', ')}</span>
    {address.phone_number && <span>{address.phone_number}</span>}
  </span>
}

export default function SavedAddressSelector({ addresses, selectedAddress, onSelect }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <>
    <legend className="saved-address-legend">
      <span className="saved-address-heading">
        <span>Delivery Details</span>
        {addresses.length > 0 && <span className="saved-address-actions">
          <span className="saved-address-status">{selectedAddress?.is_default ? 'Default' : selectedAddress ? 'Selected' : 'Saved Address'}</span>
          <span className="saved-address-separator" aria-hidden="true">|</span>
          <button type="button" className="saved-address-change" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>Change</button>
        </span>}
      </span>
    </legend>
    {addresses.length > 0 && open && <div id={id} className="saved-address-options" role="group" aria-label="Choose a saved address">
      {addresses.map((address) => <button key={address.id} type="button" className="saved-address-option" aria-pressed={selectedAddress?.id === address.id} onClick={() => { onSelect(address); setOpen(false) }}>
        <span aria-hidden="true">{selectedAddress?.id === address.id ? '●' : '○'}</span>
        <AddressSummary address={address} />
      </button>)}
    </div>}
  </>
}
