const tabs = ['Cakes', 'Cupcakes', 'Party Packages']

function CupcakeTabs({ activeTab = 'Cupcakes', onTabChange }) {
  return (
    <div className="cake-tabs" role="tablist" aria-label="Product type">
      {tabs.map((tab) => (
        <button
          className={`cake-tab${tab === activeTab ? ' cake-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === activeTab}
          onClick={() => onTabChange?.(tab)}
          key={tab}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export default CupcakeTabs
