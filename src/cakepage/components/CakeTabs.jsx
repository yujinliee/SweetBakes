const tabs = ['Cakes', 'Cupcakes', 'Party Packages']

function CakeTabs({ activeTab = 'Cakes' }) {
  return (
    <div className="cake-tabs" role="tablist" aria-label="Product type">
      {tabs.map((tab) => (
        <button
          className={`cake-tab${tab === activeTab ? ' cake-tab--active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === activeTab}
          key={tab}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export default CakeTabs
