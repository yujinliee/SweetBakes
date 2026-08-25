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

const normalizeProduct = (value) => {
  if (!value) {
    return null
  }

  const normalizedValue = String(value).trim().toLowerCase()

  if (normalizedValue === 'cake' || normalizedValue === 'cakes') {
    return 'cakes'
  }

  if (normalizedValue === 'cupcake' || normalizedValue === 'cupcakes') {
    return 'cupcakes'
  }

  if (
    normalizedValue === 'package' ||
    normalizedValue === 'packages' ||
    normalizedValue === 'party-package' ||
    normalizedValue === 'party packages'
  ) {
    return 'packages'
  }

  return null
}

const getVisibleProducts = (initialProduct) => {
  if (initialProduct) {
    const normalizedProduct = normalizeProduct(initialProduct)
    return normalizedProduct ? [normalizedProduct] : ['cakes', 'cupcakes', 'packages']
  }

  const searchParams = new URLSearchParams(window.location.search)
  const categoryParam = normalizeProduct(searchParams.get('category') || searchParams.get('type'))

  if (categoryParam) {
    return [categoryParam]
  }

  return ['cakes', 'cupcakes', 'packages']
}

const getInitialProduct = (initialProduct) => {
  if (initialProduct) {
    return normalizeProduct(initialProduct) || 'cakes'
  }

  const searchParams = new URLSearchParams(window.location.search)
  const categoryParam = normalizeProduct(searchParams.get('category') || searchParams.get('type'))

  if (categoryParam) {
    return categoryParam
  }

  if (window.location.pathname === '/cupcakes') {
    return 'cupcakes'
  }

  return 'cakes'
}

function CustomizationPage({
  initialProduct,
  onNavigate,
  onCustomerLogout,
  isCustomerAuthenticated = false,
}) {
  const [activeProduct, setActiveProduct] = useState(() => getInitialProduct(initialProduct))
  const visibleProducts = getVisibleProducts(initialProduct)
  const visibleProductSet = new Set(visibleProducts)

  const handleProductChange = (nextProduct) => {
    const normalizedProduct = normalizeProduct(nextProduct)

    if (!normalizedProduct || !visibleProductSet.has(normalizedProduct)) {
      return
    }

    if (normalizedProduct === activeProduct) {
      return
    }

    setActiveProduct(normalizedProduct)
  }

  return (
    <div className="page-shell cake-page-shell">
      <SiteTopbar
        forceScrolled
        homeHref="/"
        locationHref="/#location"
        contactHref="#contact"
        onNavigate={onNavigate}
        onCustomerLogout={onCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />

      <main className="cake-main customization-main">
        <header className="cake-page-header">
          <h1>Custom Creations</h1>
          <CakeTabs
            activeTab={productLabels[activeProduct]}
            onTabChange={(tab) => handleProductChange(productFromLabel[tab])}
            visibleTabs={visibleProducts.map((product) => productLabels[product])}
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
            onNavigate={onNavigate}
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
            onNavigate={onNavigate}
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
            onNavigate={onNavigate}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

export default CustomizationPage
