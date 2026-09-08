import { useEffect, useRef, useState } from 'react'
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
  cakes: '/customize?tab=cakes',
  cupcakes: '/customize?tab=cupcakes',
  packages: '/customize?tab=party-packages',
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
    normalizedValue === 'party-packages' ||
    normalizedValue === 'party packages'
  ) {
    return 'packages'
  }

  return null
}

const getVisibleProducts = (initialProduct) => {
  void initialProduct
  return ['cakes', 'cupcakes', 'packages']
}

const getInitialProduct = (initialProduct, locationKey = window.location.href) => {
  const url = new URL(locationKey, window.location.origin)
  const searchParams = new URLSearchParams(url.search)
  const categoryParam = normalizeProduct(
    searchParams.get('tab') || searchParams.get('category') || searchParams.get('type'),
  )

  if (categoryParam) {
    return categoryParam
  }

  if (url.pathname === '/cupcakes') {
    return 'cupcakes'
  }

  return normalizeProduct(initialProduct) || 'cakes'
}

function CustomizationPage({
  initialProduct,
  locationKey,
  onNavigate,
  onCustomerLogout,
  isCustomerAuthenticated = false,
}) {
  const [activeProduct, setActiveProduct] = useState(() => getInitialProduct(initialProduct, locationKey))
  const [isTabTransitionEnabled, setIsTabTransitionEnabled] = useState(false)
  const userTabNavigationRef = useRef(false)
  const visibleProducts = getVisibleProducts(initialProduct)
  const visibleProductSet = new Set(visibleProducts)

  useEffect(() => {
    const nextProduct = getInitialProduct(initialProduct, locationKey)
    const wasUserTabNavigation = userTabNavigationRef.current
    userTabNavigationRef.current = false

    if (!wasUserTabNavigation) {
      setIsTabTransitionEnabled(false)
    }

    setActiveProduct((currentProduct) => currentProduct === nextProduct ? currentProduct : nextProduct)
  }, [initialProduct, locationKey])

  const handleProductChange = (nextProduct) => {
    const normalizedProduct = normalizeProduct(nextProduct)

    if (!normalizedProduct || !visibleProductSet.has(normalizedProduct)) {
      return
    }

    if (normalizedProduct === activeProduct) {
      return
    }

    userTabNavigationRef.current = true
    setIsTabTransitionEnabled(true)
    setActiveProduct(normalizedProduct)
    onNavigate?.(productRoutes[normalizedProduct])
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
            animateActiveTab={isTabTransitionEnabled}
          />
        </header>

        <div className="customization-product-content">
        <div
          className={`customization-product-panel${
            activeProduct === 'cakes' ? ' customization-product-panel--active' : ''
          }`}
          aria-hidden={activeProduct !== 'cakes'}
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
          aria-hidden={activeProduct !== 'cupcakes'}
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
          aria-hidden={activeProduct !== 'packages'}
        >
          <PackagePage
            embedded
            onNavigate={onNavigate}
          />
        </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

export default CustomizationPage
