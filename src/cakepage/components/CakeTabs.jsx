const tabs = ['Cakes', 'Cupcakes', 'Party Packages']

function CakeTabs({ activeTab = 'Cakes', onTabChange, visibleTabs = tabs }) {
  const renderedTabs = (visibleTabs || tabs).filter((tab) => tabs.includes(tab))

  return (
    <div className="cake-tabs" role="tablist" aria-label="Product type">
      {renderedTabs.map((tab) => (
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

export default CakeTabs
