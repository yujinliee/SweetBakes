import { useState } from 'react'
import CakePage from '../cakepage/CakePage.jsx'
import CakeTabs from '../cakepage/components/CakeTabs.jsx'
import CupcakePage from '../cupcakepage/CupcakePage.jsx'
import { SiteFooter, SiteTopbar } from '../landingpage/LandingPage.jsx'
import PackagePage from '../packagepage/PackagePage.jsx'
import './CustomizationPage.css'

const productLabels = {
  cakes: 'Cakes',
  cupcakes: 'Cupcakes',
  packages: 'Party Packages',
}

const productFromLabel = {
  Cakes: 'cakes',
  Cupcakes: 'cupcakes',
  'Party Packages': 'packages',
}

const productRoutes = {
  cakes: '/cakes',
  cupcakes: '/cupcakes',
  packages: '/customize?type=packages',
}

const getInitialProduct = (initialProduct) => {
  if (initialProduct) {
    return initialProduct
  }

  const searchType = new URLSearchParams(window.location.search).get('type')

  if (searchType === 'cakes' || searchType === 'cupcakes' || searchType === 'packages') {
    return searchType
  }

  if (window.location.pathname === '/cupcakes') {
    return 'cupcakes'
  }

  return 'cakes'
}

function CustomizationPage({
  initialProduct,
  latestRequest,
  onRequestSubmitted,
  onTrackOrder,
  onNavigate,
  isCustomerAuthenticated = false,
}) {
  const [activeProduct, setActiveProduct] = useState(() => getInitialProduct(initialProduct))

  const handleProductChange = (nextProduct) => {
    if (!nextProduct || nextProduct === activeProduct) {
      return
    }

    setActiveProduct(nextProduct)
    window.history.replaceState({}, '', productRoutes[nextProduct])
  }

  return (
    <div className="page-shell cake-page-shell">
      <SiteTopbar
        forceScrolled
        homeHref="/"
        locationHref="/#location"
        contactHref="#contact"
        latestRequest={latestRequest}
        onTrackOrder={onTrackOrder}
        onNavigate={onNavigate}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />

      <main className="cake-main customization-main">
        <header className="cake-page-header">
          <h1>Custom Creations</h1>
          <CakeTabs
            activeTab={productLabels[activeProduct]}
            onTabChange={(tab) => handleProductChange(productFromLabel[tab])}
          />
        </header>

        <div
          className={`customization-product-panel${
            activeProduct === 'cakes' ? ' customization-product-panel--active' : ''
          }`}
          hidden={activeProduct !== 'cakes'}
        >
          <CakePage
            embedded
            latestRequest={latestRequest}
            onRequestSubmitted={onRequestSubmitted}
            onTrackOrder={onTrackOrder}
          />
        </div>

        <div
          className={`customization-product-panel${
            activeProduct === 'cupcakes' ? ' customization-product-panel--active' : ''
          }`}
          hidden={activeProduct !== 'cupcakes'}
        >
          <CupcakePage
            embedded
            latestRequest={latestRequest}
            onRequestSubmitted={onRequestSubmitted}
            onTrackOrder={onTrackOrder}
          />
        </div>

        <div
          className={`customization-product-panel${
            activeProduct === 'packages' ? ' customization-product-panel--active' : ''
          }`}
          hidden={activeProduct !== 'packages'}
        >
          <PackagePage
            embedded
            latestRequest={latestRequest}
            onRequestSubmitted={onRequestSubmitted}
            onTrackOrder={onTrackOrder}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

export default CustomizationPage
