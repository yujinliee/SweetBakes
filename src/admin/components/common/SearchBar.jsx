import './common.css'

function SearchBar({ value = '', placeholder = 'Search', showLabel = true, onChange }) {
  return (
    <label className="admin-search-bar">
      {showLabel ? <span>Search</span> : null}
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  )
}

export default SearchBar
