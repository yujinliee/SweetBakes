import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import logo from '../assets/landingpage/sweetbakes_logo.svg'
import loginIcon from '../assets/landingpage/login.svg'
import loginIconBlack from '../assets/landingpage/login_black.svg'
import cartIcon from '../assets/landingpage/cart.svg'
import cartIconBlack from '../assets/landingpage/cart_black.svg'
import heroImage from '../assets/landingpage/main_hero.svg'
import happinessLine from '../assets/landingpage/happiness_line.svg'
import dividerLine from '../assets/landingpage/divider.svg'
import cakesImage from '../assets/landingpage/cakes.svg'
import cupcakesImage from '../assets/landingpage/cupcakes.svg'
import partyImage from '../assets/landingpage/party_package.svg'
import textureBackground from '../assets/landingpage/texture_background.svg'
import mapsImage from '../assets/landingpage/maps.png'
import footerMark from '../assets/landingpage/sweetbakes_footer.svg'
import footerChecker from '../assets/landingpage/footer_checker.png'
import chocolateCakeImage from '../assets/othersweettreats/regular_chocolate.jpg'
import redVelvetCakeImage from '../assets/othersweettreats/regular_redvelvet.png'
import halfDozenCheesecakeImage from '../assets/othersweettreats/halfordozen_cheesecake.png'
import wholeBlueberryImage from '../assets/othersweettreats/whole_blueberry_cheesecake.png'
import wholeMangoImage from '../assets/othersweettreats/whole_mango_cheesecake.png'
import wholeStrawberryImage from '../assets/othersweettreats/whole_strawberry_cheesecake.png'
import wholeOreoImage from '../assets/othersweettreats/whole_oreo_cheesecake.png'
import ubeImage from '../assets/othersweettreats/ube.png'
import grahamImage from '../assets/othersweettreats/graham de leche.png'
import lecheFlanImage from '../assets/othersweettreats/leche_flan.png'
import putoImage from '../assets/othersweettreats/puto.jpg'
import Chatbot from '../components/Chatbot/Chatbot.jsx'
import { ADMIN_DASHBOARD_ROUTE } from '../admin/adminRouteConstants.js'
import { isCustomerCustomizationRoute, setAuthReturnTo } from '../auth/authReturnTo.js'
import { supabase } from '../lib/supabase.js'
import {
  CHEESECAKE_FLAVORS,
  CHEESECAKE_FLAVOR_TYPES,
  CHEESECAKE_MINI_PRICES,
  CHEESECAKE_SIZES,
  CHEESECAKE_WHOLE_PRICE,
} from '../sweettreats/sweetTreatsData.js'
import {
  getActiveSweetTreatsCategories,
  getActiveSweetTreatsProducts,
} from '../admin/services/sweetTreatsProductsService.js'
import { subscribeCart, getCartCount, addToCart } from '../cartStore.js'
import './LandingPage.css'

const masonryModules = import.meta.glob('../assets/landingpage/masonry/*.png', { eager: true })
const masonryImages = Object.fromEntries(
  Object.entries(masonryModules).map(([path, mod]) => [
    path.split('/').pop(),
    mod.default,
  ])
)

function toTitle(filename) {
  return filename
    .replace(/\.png$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const FACEBOOK_URLS = {
  'Hello Kitty Birthday Cake.png':        'https://www.facebook.com/share/p/1GYwZUipdd/',
  'Chocolate Birthday Cake.png':          'https://www.facebook.com/share/p/1cdYQQhABe/',
  'Wedding Cake.png':                     'https://www.facebook.com/share/p/1KQEaE8yGL/',
  'Yellow Theme Birthday Cake.png':       'https://www.facebook.com/share/p/1Bg7VwhedK/',
  'Birthday Cake.png':                    'https://www.facebook.com/share/1J2qUTpiF1/',
  'Flower Birthday Cake.png':             'https://www.facebook.com/share/1HQJG9Lc1r/',
  'Pilot Theme Cucpcake.png':             'https://www.facebook.com/share/1S3HJrHipm/',
  'Pink Theme Bed Cake.png':              'https://www.facebook.com/share/p/19Mf5ZwEig/',
  'RaceCar Birthday Cake.png':            'https://www.facebook.com/share/p/1E5XctNPbz/',
  'Piano Birthday Cake.png':              'https://www.facebook.com/share/p/1EfFsGHQvy/',
  'Love Theme Birthday Cake.png':         'https://www.facebook.com/share/p/1EZBcMYMMo/',
  'Blue Gown Debut Cake.png':             'https://www.facebook.com/share/p/1EsiCL8ST8/',
  'Among Us Birthday Cake.png':           'https://www.facebook.com/share/p/18s3fRiP7d/',
  'White Chocolate Birthday Cake.png':    'https://www.facebook.com/share/p/195xBqvtQS/',
  'Orange Theme Debut Cake.png':          'https://www.facebook.com/share/p/1CaQvhhx2N/',
  'Police Theme Birthday Cake.png':       'https://www.facebook.com/share/p/1MJhsNBVu7/',
  'Unicorn Theme Cupcake.png':            'https://www.facebook.com/share/p/188zvSRSEr/',
  'Blackpink Birthday Cake.png':          'https://www.facebook.com/share/p/1D764oT2LE/',
  'Ferrari Birthday Cake & Cupcake.png':  'https://www.facebook.com/share/p/1Cb3Tp9z5G/',
  'Beer Mug Birthday Cake.png':           'https://www.facebook.com/share/p/1BSA8kfmcE/',
  'Sun & Moon Theme Christening Cake.png':'https://www.facebook.com/share/p/198Lcg1W4R/',
  'Monster Truck Birthday Cake.png':      'https://www.facebook.com/share/p/19TvFNADTZ/',
  'Minecraft Theme Birthday Cake.png':    'https://www.facebook.com/share/p/1an38eFaNk/',
  'Astronaut Birthday Cake.png':          'https://www.facebook.com/share/p/1GuL6wa2pY/',
  'Watermelon Theme Birthday Cake.png':   'https://www.facebook.com/share/p/1GjfDNN9yR/',
}

const CURATED_ITEMS = []

const CURATED_FILES = new Set(CURATED_ITEMS.map((i) => i.file))

const EXTRA_ITEMS = Object.keys(masonryImages)
  .filter((f) => !CURATED_FILES.has(f))
  .sort()
  .map((file) => ({ file, title: toTitle(file) }))

// 5 items per page on a 6-col grid, 2 equal rows:
//  [0] col-span-2 row-span-2  (tall left)
//  [1] col-span-2 row-span-1  (top mid)
//  [2] col-span-2 row-span-1  (top right)
//  [3] col-span-2 row-span-1  (bot mid)
//  [4] col-span-2 row-span-1  (bot right)
const ITEMS_PER_PAGE = 5

const ALL_GALLERY_ITEMS = [...CURATED_ITEMS, ...EXTRA_ITEMS].map((item) => ({
  title: item.title,
  image: masonryImages[item.file],
  facebookUrl: FACEBOOK_URLS[item.file] ?? null,
}))

function buildPages(items) {
  const pages = []
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    pages.push(items.slice(i, i + ITEMS_PER_PAGE))
  }
  return pages
}

const GALLERY_PAGES = buildPages(ALL_GALLERY_ITEMS)

const heroCustomizeHref = '/customize'
const homeCakesHref = '/customize?category=cakes'
const homeCupcakesHref = '/customize?category=cupcakes'
const homePackagesHref = '/customize?category=packages'
const cakesHref = '/cakes'
const cupcakesHref = '/cupcakes'
const packagesHref = '/customize?type=packages'
const loginHref = '/login'
const profileHref = '/profile'
const directionsHref =
  'https://www.google.com/maps/dir/?api=1&destination=Diamond%20Village%20Salawag%20Dasmari%C3%B1as%20Cavite%2C%20Dasmari%C3%B1as%2C%20Philippines%2C%204114'
const topbarScrollThreshold = 5
const topbarExitDuration = 220

const getIsTopbarScrolled = () => window.scrollY > topbarScrollThreshold

export function SiteTopbar({
  forceScrolled = false,
  homeHref = '#home',
  locationHref = '#location',
  contactHref = '#contact',
  latestRequest = '',
  onTrackOrder,
  onNavigate,
  isCustomerAuthenticated = false,
  onCustomerLogout,
}) {
  const [isScrolled, setIsScrolled] = useState(getIsTopbarScrolled)
  const [topbarMotion, setTopbarMotion] = useState('')
  const [isShopOpen, setIsShopOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const shopMenuRef = useRef(null)
  const accountMenuRef = useRef(null)
  const isScrolledRef = useRef(forceScrolled || getIsTopbarScrolled())
  const topbarMotionTimeoutRef = useRef(null)
  const topbarIsScrolled = forceScrolled || isScrolled
  const hasTrackOrder = Boolean(onTrackOrder)
  const showTrackOrder = hasTrackOrder && Boolean(latestRequest)
  const cartCount = useSyncExternalStore(subscribeCart, getCartCount)
  const currentPathname = window.location.pathname
  const isCartActive = currentPathname === '/cart'
  const isAccountMenuEnabled = Boolean(isCustomerAuthenticated)

  const resolveAccountHref = async () => {
    const { data, error } = await supabase.auth.getSession()
    const user = data?.session?.user || null

    if (error || !user) {
      return loginHref
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return loginHref
    }

    if (profile?.role === 'admin') {
      return ADMIN_DASHBOARD_ROUTE
    }

    if (profile?.role === 'customer') {
      return profileHref
    }

    return loginHref
  }

  const handleLoginNavigation = async (event) => {
    event.preventDefault()

    if (isAccountMenuEnabled) {
      setIsAccountMenuOpen((current) => !current)
      return
    }

    const targetHref = await resolveAccountHref()

    if (onNavigate) {
      onNavigate(targetHref)
      return
    }

    window.history.pushState({}, '', targetHref)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }

  const handleCartNavigation = (event) => {
    event.preventDefault()

    if (onNavigate) {
      onNavigate('/cart')
      return
    }

    window.history.pushState({}, '', '/cart')
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }

  const navigateToHref = (href) => {
    if (onNavigate) {
      onNavigate(href)
      return
    }

    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }

  const handleShopNavigation = (event, href) => {
    event.preventDefault()
    setIsShopOpen(false)

    if (isCustomerCustomizationRoute(href) && !isCustomerAuthenticated) {
      setAuthReturnTo(href)
      navigateToHref(`/login?redirect=${encodeURIComponent(href)}`)
      return
    }

    navigateToHref(href)
  }

  const handleAccountMenuNavigation = (href) => {
    setIsAccountMenuOpen(false)
    navigateToHref(href)
  }

  const handleAccountSignOut = async () => {
    try {
      setIsAccountMenuOpen(false)
      await supabase.auth.signOut()
      onCustomerLogout?.()
      navigateToHref('/')
    } catch (error) {
      console.error('[ACCOUNT MENU] sign out error:', error)
    }
  }

  const handleSectionScroll = (event, sectionId) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    event.preventDefault()
    setIsShopOpen(false)

    const target = document.getElementById(sectionId)

    // Already on the Home page: the section exists right here, so glide to it
    // directly. No URL/history change means no popstate → no page remount/refresh.
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    // Other customer pages: go Home once with a one-shot target; the Home page
    // consumes it after mounting and glides to the section.
    if (onNavigate) {
      onNavigate('/', { scrollTo: sectionId })
      return
    }

    // Fallback for topbars rendered without onNavigate: use the app's custom
    // router so the Home page mounts and then glides to the section.
    window.history.pushState({ scrollTo: sectionId }, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  useEffect(() => {
    if (forceScrolled) {
      return undefined
    }

    const handleScroll = () => {
      const nextIsScrolled = getIsTopbarScrolled()

      if (nextIsScrolled === isScrolledRef.current) {
        return
      }

      window.clearTimeout(topbarMotionTimeoutRef.current)
      isScrolledRef.current = nextIsScrolled
      setIsScrolled(nextIsScrolled)

      if (nextIsScrolled) {
        setTopbarMotion('topbar--scrolled-entering')
        return
      }

      setTopbarMotion('topbar--scrolled-exiting')
      topbarMotionTimeoutRef.current = window.setTimeout(() => {
        setTopbarMotion('')
      }, topbarExitDuration)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.clearTimeout(topbarMotionTimeoutRef.current)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [forceScrolled])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!shopMenuRef.current?.contains(event.target)) {
        setIsShopOpen(false)
      }

      if (!accountMenuRef.current?.contains(event.target)) {
        setIsAccountMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    setIsAccountMenuOpen(false)
  }, [isCustomerAuthenticated, currentPathname])

  return (
    <header
      className={`topbar${topbarIsScrolled ? ' topbar--scrolled' : ''}${topbarMotion ? ` ${topbarMotion}` : ''}`}
    >
      <span className="topbar-background" aria-hidden="true" />
      <div className="topbar-inner">
        <a className="brand" href={homeHref} aria-label="Sweet Bakes home">
          <img src={logo} alt="Sweet Bakes" />
        </a>

        <nav className="nav" aria-label="Primary">
          <a href={homeHref}>
            <span className="nav-link-text">Home</span>
          </a>
          <div
            className={`nav-dropdown${isShopOpen ? ' nav-dropdown--open' : ''}`}
            ref={shopMenuRef}
            onMouseEnter={() => setIsShopOpen(true)}
            onMouseLeave={() => setIsShopOpen(false)}
          >
            <button
              type="button"
              className="nav-dropdown-toggle"
              aria-controls="shop-dropdown-menu"
              aria-expanded={isShopOpen}
              aria-haspopup="true"
              onClick={() => setIsShopOpen((current) => !current)}
            >
              <span className="nav-link-text">Shop</span>
            </button>
            <div className="nav-dropdown-menu" id="shop-dropdown-menu">
              <a href={cakesHref} onClick={(event) => handleShopNavigation(event, cakesHref)}>
                <span>Cakes</span>
              </a>
              <a href={cupcakesHref} onClick={(event) => handleShopNavigation(event, cupcakesHref)}>
                <span>Cupcakes</span>
              </a>
              <a
                href={packagesHref}
                onClick={(event) => handleShopNavigation(event, packagesHref)}
              >
                <span>Party Packages</span>
              </a>
              <a
                href="#sweet-treats"
                onClick={(event) => handleSectionScroll(event, 'sweet-treats')}
              >
                <span>Sweet Treats</span>
              </a>
            </div>
          </div>
          <a href={locationHref} onClick={(event) => handleSectionScroll(event, 'location')}>
            <span className="nav-link-text">Location</span>
          </a>
          <a href={contactHref} onClick={(event) => handleSectionScroll(event, 'contact')}>
            <span className="nav-link-text">Contact</span>
          </a>
        </nav>

        <div className="topbar-actions" aria-label="Quick actions">
          {hasTrackOrder ? (
            <div
              className={`topbar-account${isAccountMenuOpen ? ' topbar-account--open' : ''}`}
              ref={accountMenuRef}
              onMouseEnter={() => {
                if (isAccountMenuEnabled) setIsAccountMenuOpen(true)
              }}
              onMouseLeave={() => setIsAccountMenuOpen(false)}
            >
              <a
                className="topbar-login topbar-login-link"
                href={isAccountMenuEnabled ? profileHref : loginHref}
                aria-label={isAccountMenuEnabled ? 'Account menu' : 'Login'}
                aria-haspopup={isAccountMenuEnabled ? 'menu' : undefined}
                aria-expanded={isAccountMenuEnabled ? isAccountMenuOpen : undefined}
                onClick={handleLoginNavigation}
              >
                <span className="topbar-icon-stack" aria-hidden="true">
                  <img
                    className="topbar-icon topbar-login-icon topbar-icon--light"
                    src={loginIcon}
                    alt=""
                  />
                  <img
                    className="topbar-icon topbar-login-icon topbar-icon--dark"
                    src={loginIconBlack}
                    alt=""
                  />
                </span>
              </a>

              {isAccountMenuEnabled && isAccountMenuOpen ? (
                <div className="topbar-account-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => handleAccountMenuNavigation(profileHref)}>
                    <span className="topbar-account-menu-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </span>
                    <span>Profile</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => handleAccountMenuNavigation('/my-orders')}>
                    <span className="topbar-account-menu-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M7 3h10l2 4v14H5V7l2-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="M8 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span>My Orders</span>
                  </button>
                  <span className="topbar-account-menu-divider" />
                  <button type="button" role="menuitem" onClick={handleAccountSignOut}>
                    <span className="topbar-account-menu-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M15 12H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M12 4h7v16h-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <a
              className="topbar-login-text"
              href={loginHref}
              onClick={handleLoginNavigation}
            >
              <span className="topbar-login-pill-label">Login</span>
              <span className="topbar-login-pill-arrow" aria-hidden="true">
                <svg viewBox="0 0 18 18" focusable="false">
                  <path d="M6.5 11.5L11.5 6.5" />
                  <path d="M7.5 6.5H11.5V10.5" />
                </svg>
              </span>
            </a>
          )}
          <a
            className={`topbar-cart${isCartActive ? ' topbar-cart--active' : ''}`}
            href="/cart"
            aria-label="Cart"
            onClick={handleCartNavigation}
          >
            <span className="topbar-icon-stack" aria-hidden="true">
              <img
                className="topbar-icon topbar-cart-icon topbar-icon--light"
                src={cartIcon}
                alt=""
              />
              <img
                className="topbar-icon topbar-cart-icon topbar-icon--dark"
                src={cartIconBlack}
                alt=""
              />
            </span>
            {cartCount > 0 ? <span className="topbar-cart-badge">{cartCount}</span> : null}
          </a>
          {showTrackOrder ? (
            <button
              className="topbar-track-order"
              type="button"
              onClick={() => onTrackOrder?.(latestRequest)}
            >
              <span>Track Order</span>
              <svg
                className="track-order-border"
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="track-order-streak-gradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#9D62D9" stopOpacity="0.08" />
                    <stop offset="22%" stopColor="#BB86EA" stopOpacity="0.55" />
                    <stop offset="48%" stopColor="#D4ACF5" stopOpacity="0.95" />
                    <stop offset="66%" stopColor="#F0DEFF" stopOpacity="1" />
                    <stop offset="84%" stopColor="#BB86EA" stopOpacity="0.52" />
                    <stop offset="100%" stopColor="#9D62D9" stopOpacity="0" />
                  </linearGradient>
                  <filter id="track-order-soft-glow" x="-28%" y="-48%" width="156%" height="196%">
                    <feGaussianBlur stdDeviation="2.1" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <rect
                  className="track-order-border-trail"
                  x="2"
                  y="2"
                  width="96"
                  height="36"
                  rx="6"
                  pathLength="100"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <>
      <div
        className="footer-decoration"
        style={{ '--footer-decoration-bg': `url(${footerChecker})` }}
        aria-hidden="true"
      />
      <footer className="footer" id="contact">
        <div className="footer-body">
          <div className="footer-grid">
            <div className="footer-brand-column animate-up">
              <div className="footer-brand-lockup">
                <img src={footerMark} alt="Sweet Bakes logo" />
                <h2>Sweet Bakes</h2>
              </div>
              <p className="footer-description">
                Crafting delicious cakes and cupcakes for every celebration, made with
                quality ingredients and a touch of sweetness.
              </p>
              <p className="footer-copyright">&copy; 2026 Sweet Bakes. All Rights Reserved.</p>
            </div>
            <div className="footer-contact-column animate-up" style={{ '--delay': '90ms' }}>
              <h3>Hey, Bestie!</h3>
              <p>Follow us on Facebook for exclusive updates.</p>
              <div className="footer-contact-list">
                <a
                  className="footer-contact-row footer-facebook-link"
                  href="https://www.facebook.com/rhonatnarvaez0403"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M14 8.5H16V5.2C15.65 5.15 14.45 5 13.1 5C10.3 5 8.38 6.76 8.38 10V13H5.25V16.7H8.38V24H12.2V16.7H15.35L15.85 13H12.2V10.36C12.2 9.29 12.49 8.5 14 8.5Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Sweet Bakes Facebook page</span>
                </a>
                <a className="footer-contact-row" href="tel:+639278700399">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M22 16.92V20a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3 5.18 2 2 0 0 1 5 3h3.09a2 2 0 0 1 2 1.72l.45 3a2 2 0 0 1-.57 1.74l-1.32 1.32a16 16 0 0 0 4.57 4.57l1.32-1.32a2 2 0 0 1 1.74-.57l3 .45A2 2 0 0 1 22 16.92Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>0927 870 0399</span>
                </a>
                <a className="footer-contact-row" href="mailto:rhonanarvaez@gmail.com">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 6h16v12H4V6Zm16 1-8 6-8-6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>rhonanarvaez@gmail.com</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

function GalleryNav({ pages }) {
  const scrollRef = useRef(null)
  const [page, setPage] = useState(0)
  const maxPage = pages.length - 1
  const isPointerDown = useRef(false)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startScrollLeft = useRef(0)
  const dragMoved = useRef(false)
  const DRAG_THRESHOLD = 5

  // Sync page index from scroll position
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth)
      setPage(Math.min(Math.max(idx, 0), maxPage))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [maxPage])

  // Wheel / trackpad: NO custom wheel interception.
  //  - Horizontal two-finger gestures (deltaX dominant): the browser handles these
  //    natively because .gallery-grid is an `overflow-x: auto` scroller. Do NOT
  //    preventDefault — native deltaX scrolling is already working.
  //  - Vertical two-finger gestures (deltaY dominant): intentionally NOT handled
  //    here. The gallery cannot scroll vertically (`overflow-y: hidden`), so the
  //    browser naturally lets the page scroll vertically. Never preventDefault,
  //    never stopPropagation, and never convert deltaY into horizontal scrolling
  //    here — that would trap the page while the cursor is over the gallery.

  const goTo = (idx) => {
    scrollRef.current?.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' })
  }

  // Mouse / pen drag. We only commit to a drag once the pointer actually crosses
  // the threshold and only then take pointer capture. This way a plain click on a
  // card still reaches its link, while a genuine drag never opens it.
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') return
    isPointerDown.current = true
    isDragging.current = false
    dragMoved.current = false
    startX.current = e.clientX
    startScrollLeft.current = scrollRef.current.scrollLeft
  }
  const onPointerMove = (e) => {
    if (!isPointerDown.current) return
    const dx = e.clientX - startX.current
    if (!isDragging.current && Math.abs(dx) > DRAG_THRESHOLD) {
      isDragging.current = true
      dragMoved.current = true
      // `scroll-behavior: smooth` would animate every scrollLeft update and fight
      // the pointer — disable it for the duration of the drag.
      scrollRef.current.style.scrollBehavior = 'auto'
      scrollRef.current.setPointerCapture?.(e.pointerId)
    }
    if (isDragging.current) {
      scrollRef.current.scrollLeft = startScrollLeft.current - dx
    }
  }
  const onPointerUp = (e) => {
    if (isDragging.current) {
      if (e?.pointerId != null) {
        scrollRef.current?.releasePointerCapture?.(e.pointerId)
      }
      scrollRef.current.style.scrollBehavior = ''
    }
    isPointerDown.current = false
    isDragging.current = false
    // dragMoved intentionally kept so the click that follows a drag is suppressed
  }
  const onPointerCancel = () => {
    if (isDragging.current) {
      scrollRef.current.style.scrollBehavior = ''
    }
    isPointerDown.current = false
    isDragging.current = false
  }

  // Prevent click-through after a drag
  const onClickCapture = (e) => {
    if (dragMoved.current) e.stopPropagation()
  }

  return (
    <div className="gallery-nav-wrapper">
      <button
        className="gallery-arrow gallery-arrow--left"
        aria-label="Previous"
        disabled={page === 0}
        onClick={() => goTo(page - 1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className="gallery-grid"
        ref={scrollRef}
        aria-label="Sweet Bakes creation gallery"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        {pages.map((pageItems, pi) => (
          <div
            key={pi}
            className="gallery-page"
            aria-hidden={pi !== page}
          >
            {pageItems.map((item, idx) => (
              <article
                key={item.title}
                className={`gallery-item gallery-item--pos-${idx} gallery-item--visible`}
              >
                <img src={item.image} alt={item.title} draggable="false" />
                <div className="gallery-overlay">
                  <h3>{item.title}</h3>
                  {item.facebookUrl ? (
                    <a
                      href={item.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >View Details &rarr;</a>
                  ) : (
                    <strong>View Details &rarr;</strong>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>

      <button
        className="gallery-arrow gallery-arrow--right"
        aria-label="Next"
        disabled={page >= maxPage}
        onClick={() => goTo(page + 1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

const TREAT_CATEGORIES = [
  { id: 'regular_cake', label: 'Regular Cakes' },
  { id: 'cheesecake', label: 'Cheesecake' },
  { id: 'ube', label: 'Ube' },
  { id: 'graham_de_leche', label: 'Graham de Leche' },
  { id: 'leche_flan', label: 'Leche Flan' },
  { id: 'puto', label: 'Puto' },
]

const LOCAL_TREAT_IMAGE_FALLBACKS = {
  'chocolate-cake': chocolateCakeImage,
  'red-velvet-cake': redVelvetCakeImage,
  cheesecake: halfDozenCheesecakeImage,
  ube: ubeImage,
  'graham-de-leche': grahamImage,
  'leche-flan': lecheFlanImage,
  puto: putoImage,
}

const formatPeso = (value) => `₱${value.toLocaleString('en-PH')}`

const formatTreatPrice = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? formatPeso(numericValue) : '—'
}

const getTreatImage = (product) =>
  product.image_url || product.imageUrl || LOCAL_TREAT_IMAGE_FALLBACKS[product.slug] || null

const mapSupabaseTreatProduct = (product) => ({
  id: product.id,
  name: product.product || product.name,
  slug: product.slug,
  category: product.category,
  description: product.description || '',
  unitPrice:
    product.base_price === null || product.base_price === undefined || product.base_price === ''
      ? null
      : Number(product.base_price),
  price: formatTreatPrice(product.base_price ?? product.price),
  image: getTreatImage(product),
  image_url: product.image_url || product.imageUrl || '',
})

const buildTreatProductsByCategory = (products) =>
  products.reduce((groups, product) => {
    if (product.category === 'cheesecake') {
      return groups
    }

    const categoryProducts = groups[product.category] || []
    return {
      ...groups,
      [product.category]: [...categoryProducts, mapSupabaseTreatProduct(product)],
    }
  }, {})

const getVariantByLabel = (product, label) =>
  (product?.variants || []).find((variant) => variant.name === label && variant.active !== false)

const getProductImageByLabel = (product, label) =>
  (product?.productImages || []).find(
    (image) => image.label?.toLowerCase() === String(label || '').toLowerCase(),
  )?.image_url || ''

const emptyCheesecakeAssortment = () =>
  Object.fromEntries(CHEESECAKE_FLAVORS.map((flavor) => [flavor.id, 0]))

function CheesecakeTreatCard({ product }) {
  const [size, setSize] = useState(null)
  const [flavorType, setFlavorType] = useState(null)
  const [flavor, setFlavor] = useState(null)
  const [assorted, setAssorted] = useState(emptyCheesecakeAssortment)
  const [wholeQty, setWholeQty] = useState(1)
  const [added, setAdded] = useState(false)
  const addedTimerRef = useRef(null)

  useEffect(
    () => () => {
      if (addedTimerRef.current) {
        window.clearTimeout(addedTimerRef.current)
      }
    },
    [],
  )

  const sizeConfig = CHEESECAKE_SIZES.find((option) => option.id === size) ?? null
  const halfDozenVariant = getVariantByLabel(product, 'Half Dozen')
  const dozenVariant = getVariantByLabel(product, 'Dozen')
  const wholeVariant = getVariantByLabel(product, 'Large / Whole')
  const miniPrices = {
    halfDozen: Number(halfDozenVariant?.price ?? CHEESECAKE_MINI_PRICES.halfDozen),
    dozen: Number(dozenVariant?.price ?? CHEESECAKE_MINI_PRICES.dozen),
  }
  const wholePrice = Number(wholeVariant?.price ?? CHEESECAKE_WHOLE_PRICE)
  const isMini = size === 'halfDozen' || size === 'dozen'
  const isWhole = size === 'whole'
  const pieces = sizeConfig?.pieces ?? 0
  const sizeLabel = sizeConfig?.label ?? ''

  const assortedTotal = CHEESECAKE_FLAVORS.reduce(
    (total, option) => total + assorted[option.id],
    0,
  )
  const assortedComplete = isMini && flavorType === 'assorted' && assortedTotal === pieces

  let currentPrice = null
  if (sizeConfig) {
    if (isWhole) {
      currentPrice = wholePrice * wholeQty
    } else {
      currentPrice = miniPrices[size]
    }
  }

  const canAddToCart =
    Boolean(sizeConfig) &&
    (isMini
      ? flavorType === 'single'
        ? Boolean(flavor)
        : flavorType === 'assorted' && assortedComplete
      : Boolean(flavor))

  const LOCAL_WHOLE_CHEESECAKE_IMAGES = {
    Blueberry: wholeBlueberryImage,
    Mango: wholeMangoImage,
    Strawberry: wholeStrawberryImage,
    Oreo: wholeOreoImage,
  }
  const selectedFlavorImage = getProductImageByLabel(product, flavor)
  const mainCheesecakeImage = product?.image_url || product?.imageUrl || halfDozenCheesecakeImage
  const cheesecakeImage = selectedFlavorImage ||
    (isWhole ? LOCAL_WHOLE_CHEESECAKE_IMAGES[flavor] : null) ||
    mainCheesecakeImage
  const cheesecakeAlt = isWhole
    ? `${flavor ?? 'Blueberry'} whole cheesecake`
    : size === 'dozen'
      ? 'Dozen mini cheesecake box'
      : 'Half Dozen mini cheesecake box'

  const handleSizeChange = (nextSize) => {
    setSize(nextSize)
    setFlavorType(null)
    setFlavor(null)
    setAssorted(emptyCheesecakeAssortment())
    setWholeQty(1)
  }

  const handleFlavorTypeChange = (nextType) => {
    setFlavorType(nextType)
    setFlavor(null)
  }

  const maxForFlavor = (flavorId) => {
    if (!isMini) {
      return 0
    }
    return pieces - (assortedTotal - assorted[flavorId])
  }

  const handleAssortedChange = (flavorId, delta) => {
    setAssorted((current) => {
      const currentTotal = Object.values(current).reduce((total, value) => total + value, 0)
      const others = currentTotal - current[flavorId]
      const next = Math.min(Math.max(current[flavorId] + delta, 0), pieces - others)
      return { ...current, [flavorId]: next }
    })
  }

  const handleWholeQtyChange = (delta) => {
    setWholeQty((current) => Math.max(1, current + delta))
  }

  const buildCartKey = () => {
    if (isWhole) {
      return `${flavor} Cheesecake`
    }
    if (flavorType === 'single') {
      return `${flavor} Mini Cheesecake (${sizeLabel})`
    }
    const breakdown = CHEESECAKE_FLAVORS.filter((option) => assorted[option.id] > 0)
      .map((option) => `${option.id} ×${assorted[option.id]}`)
      .join(', ')
    return `Assorted Mini Cheesecake (${sizeLabel}) — ${breakdown}`
  }

  const handleAddToCart = () => {
    if (!canAddToCart) {
      return
    }
    if (isWhole) {
      addToCart(`${flavor} Cheesecake`, wholeQty, {
        productId: product?.id || null,
        variantId: wholeVariant?.id || null,
        variantName: wholeVariant?.name || 'Large / Whole',
        unitPrice: wholePrice,
        image_url: cheesecakeImage,
        imageUrl: cheesecakeImage,
        customizationData: { flavor, imageUrl: cheesecakeImage },
      })
    } else {
      const selectedVariant = size === 'halfDozen' ? halfDozenVariant : dozenVariant
      addToCart(buildCartKey(), 1, {
        productId: product?.id || null,
        variantId: selectedVariant?.id || null,
        variantName: selectedVariant?.name || sizeLabel,
        unitPrice: miniPrices[size],
        image_url: cheesecakeImage,
        imageUrl: cheesecakeImage,
        customizationData: {
          flavorType,
          flavor: flavorType === 'single' ? flavor : null,
          assorted: flavorType === 'assorted' ? assorted : null,
          imageUrl: cheesecakeImage,
        },
      })
    }
    setAdded(true)
    if (addedTimerRef.current) {
      window.clearTimeout(addedTimerRef.current)
    }
    addedTimerRef.current = window.setTimeout(() => {
      setAdded(false)
      addedTimerRef.current = null
    }, 1400)
  }

  return (
    <article className="treats-item treats-item--cheesecake">
      <div className="treats-item-copy">
        <h3>Cheesecake</h3>
        <div className="treats-price-row">
          <p className="treats-item-price">
            {currentPrice ? formatPeso(currentPrice) : 'Starting at ₱300'}
          </p>
        </div>

        <div className="treats-item-action treats-item-action--cheesecake">
          <p className="treats-item-desc">
            Mini cheesecake boxes or one whole cheesecake in Blueberry, Mango, Strawberry, and Oreo.
          </p>

          <div className="treats-cheesecake-config-wrap">
            <div className="treats-cheesecake-config">
              <div className="treats-cc-group">
                <span className="treats-cc-label">Size</span>
                <div className="treats-cc-chips treats-cc-chips--sizes">
                  {CHEESECAKE_SIZES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`treats-cc-chip treats-cc-chip--size${size === option.id ? ' treats-cc-chip--selected' : ''}`}
                      aria-pressed={size === option.id}
                      onClick={() => handleSizeChange(option.id)}
                    >
                      <span className="treats-cc-chip-title">{option.label}</span>
                      <span className="treats-cc-chip-detail">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isMini ? (
                <div className="treats-cc-group">
                  <span className="treats-cc-label">Flavor</span>
                  <div className="treats-cc-chips">
                    {CHEESECAKE_FLAVOR_TYPES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`treats-cc-chip${flavorType === option.id ? ' treats-cc-chip--selected' : ''}`}
                        aria-pressed={flavorType === option.id}
                        onClick={() => handleFlavorTypeChange(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {(isMini && flavorType === 'single') || isWhole ? (
                <div className="treats-cc-group">
                  <span className="treats-cc-label">Choose Flavor</span>
                  <div className="treats-cc-chips">
                    {CHEESECAKE_FLAVORS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`treats-cc-chip${flavor === option.id ? ' treats-cc-chip--selected' : ''}`}
                        aria-pressed={flavor === option.id}
                        onClick={() => setFlavor(option.id)}
                      >
                        {option.id}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {isMini && flavorType === 'assorted' ? (
                <div className="treats-cc-group">
                  <span className="treats-cc-label">Assorted Flavors</span>
                  <div className="treats-cc-assort">
                    {CHEESECAKE_FLAVORS.map((option) => (
                      <div className="treats-cc-assort-row" key={option.id}>
                        <span className="treats-cc-assort-name">{option.id}</span>
                        <div className="treats-qty" role="group" aria-label={`${option.id} pieces`}>
                          <button
                            className="treats-qty-btn"
                            type="button"
                            aria-label="Decrease"
                            disabled={assorted[option.id] === 0}
                            onClick={() => handleAssortedChange(option.id, -1)}
                          >
                            −
                          </button>
                          <span className="treats-qty-value">{assorted[option.id]}</span>
                          <button
                            className="treats-qty-btn"
                            type="button"
                            aria-label="Increase"
                            disabled={assorted[option.id] >= maxForFlavor(option.id)}
                            onClick={() => handleAssortedChange(option.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="treats-cc-total">
                    Total: {assortedTotal} / {pieces}
                  </p>
                  {!assortedComplete ? (
                    <p className="treats-cc-helper">
                      Select {pieces - assortedTotal} more piece
                      {pieces - assortedTotal === 1 ? '' : 's'} to complete your box.
                    </p>
                  ) : (
                    <p className="treats-cc-helper treats-cc-helper--complete">
                      Your box is complete.
                    </p>
                  )}
                </div>
              ) : null}

                            {isWhole ? (
                <div className="treats-cc-group">
                  <span className="treats-cc-label">Quantity</span>
                  <div className="treats-cc-qty-row">
                    <div className="treats-qty" role="group" aria-label="Amount">
                      <button
                        className="treats-qty-btn"
                        type="button"
                        aria-label="Decrease"
                        disabled={wholeQty === 1}
                        onClick={() => handleWholeQtyChange(-1)}
                      >
                        −
                      </button>
                      <span className="treats-qty-value">{wholeQty}</span>
                      <button
                        className="treats-qty-btn"
                        type="button"
                        aria-label="Increase"
                        onClick={() => handleWholeQtyChange(1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                className="treats-add-to-cart"
                type="button"
                disabled={!canAddToCart}
                onClick={handleAddToCart}
              >
                {added ? 'ADDED ✓' : 'ADD TO CART'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="treats-item-image">
        <img src={cheesecakeImage} alt={cheesecakeAlt} draggable="false" />
      </div>
    </article>
  )
}

function MoreTreatsSection() {
  const [activeCategory, setActiveCategory] = useState('regular_cake')
  const [treatCategories, setTreatCategories] = useState(TREAT_CATEGORIES)
  const [addedProduct, setAddedProduct] = useState(null)
  const [quantities, setQuantities] = useState({})
  const [productsByCategory, setProductsByCategory] = useState({})
  const [cheesecakeProduct, setCheesecakeProduct] = useState(null)
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const addedTimerRef = useRef(null)
  const products = productsByCategory[activeCategory] ?? []

  const updateQuantity = (productName, delta) => {
    setQuantities((prev) => {
      const next = Math.max(1, (prev[productName] ?? 1) + delta)
      return { ...prev, [productName]: next }
    })
  }

  const handleAddToCart = (product) => {
    addToCart(product.name, quantities[product.name] ?? 1, {
      productId: product.id,
      unitPrice: product.unitPrice,
      image_url: product.image_url || product.image || '',
      imageUrl: product.image || product.image_url || '',
    })
    setAddedProduct(product.name)
    if (addedTimerRef.current) {
      window.clearTimeout(addedTimerRef.current)
    }
    addedTimerRef.current = window.setTimeout(() => {
      setAddedProduct(null)
      addedTimerRef.current = null
    }, 1400)
  }

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setProductsLoading(true)
      setProductsError('')

      try {
        const [categories, products] = await Promise.all([
          getActiveSweetTreatsCategories(),
          getActiveSweetTreatsProducts(),
        ])
        if (!isMounted) return

        const nextCategories = categories.map((category) => ({
          id: category.value,
          label: category.label,
        }))

        setTreatCategories(nextCategories)
        setProductsByCategory(buildTreatProductsByCategory(products))
        setCheesecakeProduct(products.find((product) => product.category === 'cheesecake') || null)
        setActiveCategory((current) =>
          nextCategories.some((category) => category.id === current)
            ? current
            : nextCategories[0]?.id || 'regular_cake',
        )
      } catch (error) {
        console.error('[SWEET TREATS] load products:', error)
        if (!isMounted) return
        setProductsError('Sweet Treats are unavailable right now. Please try again later.')
      } finally {
        if (isMounted) {
          setProductsLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(
    () => () => {
      if (addedTimerRef.current) {
        window.clearTimeout(addedTimerRef.current)
      }
    },
    [],
  )

  return (
    <section
      className="section section--open treats-section"
      id="sweet-treats"
      aria-labelledby="treats-title"
    >
      <div className="section-heading treats-heading animate-up">
        <h2 id="treats-title">More Sweet Treats</h2>
      </div>

      <div className="treats-catalog">
        <div className="treats-tabs" role="tablist" aria-label="Sweet treat categories">
          {treatCategories.map((category) => {
            const isActive = activeCategory === category.id
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                id={`treats-tab-${category.id}`}
                aria-selected={isActive}
                aria-controls="treats-panel"
                className={`treats-tab${isActive ? ' treats-tab--active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </button>
            )
          })}
        </div>

        <div
          className="treats-panel"
          id="treats-panel"
          role="tabpanel"
          aria-labelledby={`treats-tab-${activeCategory}`}
          key={activeCategory}
        >
          {productsLoading ? (
            <div className="treats-list">
              <p className="treats-item-desc">Loading Sweet Treats...</p>
            </div>
          ) : productsError ? (
            <div className="treats-list">
              <p className="treats-item-desc">{productsError}</p>
            </div>
          ) : activeCategory === 'cheesecake' ? (
            <div className="treats-list treats-list--cheesecake">
              <CheesecakeTreatCard product={cheesecakeProduct} />
            </div>
          ) : (
            <div className="treats-list">
              {products.map((product) => (
                <article className="treats-item" key={product.name}>
                  <div className="treats-item-copy">
                    <h3>{product.name}</h3>
                    <div className="treats-price-row">
                      <p className="treats-item-price">{product.price}</p>
                      <div className="treats-qty" role="group" aria-label="Amount">
                        <button
                          type="button"
                          className="treats-qty-btn"
                          aria-label="Decrease"
                          onClick={() => updateQuantity(product.name, -1)}
                        >
                          −
                        </button>
                        <span className="treats-qty-value">{quantities[product.name] ?? 1}</span>
                        <button
                          type="button"
                          className="treats-qty-btn"
                          aria-label="Increase"
                          onClick={() => updateQuantity(product.name, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="treats-item-action">
                      <p className="treats-item-desc">{product.description}</p>
                      <button
                        type="button"
                        className="treats-add-to-cart"
                        onClick={() => handleAddToCart(product)}
                      >
                        {addedProduct === product.name ? 'ADDED ✓' : 'ADD TO CART'}
                      </button>
                    </div>
                  </div>
                  <div className="treats-item-image">
                    <img src={product.image} alt={product.name} draggable="false" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function LandingPage({
  latestRequest,
  onTrackOrder,
  onNavigate,
  onCustomerLogout,
  isCustomerAuthenticated = false,
}) {
  const handlePageNavigation = (event, href) => {
    event.preventDefault()

    if (isCustomerCustomizationRoute(href) && !isCustomerAuthenticated) {
      setAuthReturnTo(href)
      const loginTarget = `/login?redirect=${encodeURIComponent(href)}`

      if (onNavigate) {
        onNavigate(loginTarget)
        return
      }

      window.history.pushState({}, '', loginTarget)
      window.dispatchEvent(new PopStateEvent('popstate'))
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant',
      })
      return
    }

    if (onNavigate) {
      onNavigate(href)
      return
    }

    window.history.pushState({}, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }

  // One-shot "scroll to a section" navigation target passed via history.state
  // when arriving from another page (e.g. topbar Location/Contact). Glide there
  // after the page is painted, then clear it so a refresh doesn't re-trigger.
  useEffect(() => {
    const scrollTarget = window.history.state?.scrollTo
    if (!scrollTarget) {
      return undefined
    }

    const target = document.getElementById(scrollTarget)
    if (!target) {
      return undefined
    }

    const frame = window.requestAnimationFrame(() => {
      window.history.replaceState({}, '')
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  const offerings = [
    {
      title: 'Cakes',
      cta: 'Order Cakes',
      description:
        "Bring your dream cake to life by customizing every design detail. From elegant celebrations to fun themed occasions, we'll create a cake that reflects your unique style and vision.",
      image: cakesImage,
      href: homeCakesHref,
    },
    {
      title: 'Cupcakes',
      cta: 'Order Cupcakes',
      description:
        'Customize every cupcake to match your celebration. Whether you prefer elegant, playful, or themed designs, each box is carefully crafted to complement your special occasion.',
      image: cupcakesImage,
      href: homeCupcakesHref,
    },
    {
      title: 'Party Packages',
      cta: 'Order Package',
      description:
        'Create a complete dessert experience by customizing a party package that fits your celebration. Personalize your cake and cupcakes to achieve a cohesive look for your special event.',
      image: partyImage,
      href: homePackagesHref,
    },
  ]
useEffect(() => {
    const showcaseItems = document.querySelectorAll('.offer-showcase')

    if (!('IntersectionObserver' in window)) {
      showcaseItems.forEach((item) => item.classList.add('offer-showcase--visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('offer-showcase--visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.24 },
    )

    showcaseItems.forEach((item) => observer.observe(item))

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const galleryItems = document.querySelectorAll('.gallery-item')
    const galleryDivider = document.querySelector('.gallery-divider:not(.gallery-divider--bottom)')
    const gallerySection = document.querySelector('.gallery-section')

    if (!('IntersectionObserver' in window)) {
      galleryItems.forEach((item) => item.classList.add('gallery-item--visible'))
      galleryDivider?.classList.add('gallery-divider--visible')
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.classList.contains('gallery-section')) {
              galleryDivider?.classList.add('gallery-divider--visible')
            } else {
              entry.target.classList.add('gallery-item--visible')
            }
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.18 },
    )

    if (gallerySection) {
      observer.observe(gallerySection)
    }
    galleryItems.forEach((item) => observer.observe(item))

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div className="page-shell">
      <SiteTopbar
        latestRequest={latestRequest}
        onTrackOrder={onTrackOrder}
        onNavigate={onNavigate}
        onCustomerLogout={onCustomerLogout}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />

      <main>
        <section className="hero" id="home">
          <img className="hero-image" src={heroImage} alt="Sweet Bakes cake collection" />
          <div className="hero-overlay" />
          <div className="hero-frame">
            <div className="hero-copy animate-up" style={{ '--delay': '80ms' }}>
              <p className="eyebrow">CUSTOM CAKES AND CUPCAKES</p>
              <h1 className="hero-title">
                <span className="hero-title-line">Where Every Craving</span>
                <span className="hero-title-line hero-title-line--second">
                  <span>Finds</span>
                  <span className="hero-script-wrap">
                    <img
                      className="hero-script-line"
                      src={happinessLine}
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="hero-script">Happiness</span>
                  </span>
                </span>
              </h1>
              <p className="hero-text">
                Design your perfect cake or cupcake with your preferred flavor, theme, and message. Freshly made, carefully finished, and styled for the most memorable celebrations.
              </p>
              <div className="hero-actions">
                <a
                  className="button button-primary"
                  href={heroCustomizeHref}
                  onClick={(event) => handlePageNavigation(event, heroCustomizeHref)}
                >
                  <span>Customize Yours Now</span>
                  <svg
                    className="button-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12H19M13 6L19 12L13 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            </div>

          </div>
        </section>

        <section className="section section--open order-section" id="shop">
          <div className="section-heading order-section-heading animate-up">
            <h2>Start Your Order</h2>
            <p>
              Whether you're looking for a ready-made treat or a personalized creation,
              we've got something for every celebration.
            </p>
          </div>

          <div className="offer-showcases">
            {offerings.map((item, index) => (
              <article
                className={`offer-showcase${index % 2 === 1 ? ' offer-showcase--reverse' : ''}`}
                key={item.title}
              >
                <div className="offer-showcase-copy">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <a
                    className="offer-showcase-link"
                    href={item.href}
                    onClick={(event) => handlePageNavigation(event, item.href)}
                  >
                    <span>{item.cta}</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
                <div className="offer-showcase-media">
                  <div className="offer-showcase-composition">
                    <img
                      className="offer-showcase-texture"
                      src={textureBackground}
                      alt=""
                      aria-hidden="true"
                    />
                    <div className="offer-showcase-image-frame">
                      <img src={item.image} alt={item.title} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <MoreTreatsSection />

        <section className="section section--open gallery-section" aria-labelledby="gallery-title">
          <div className="gallery-divider" aria-hidden="true">
            <img src={dividerLine} alt="" />
          </div>
          <div className="section-heading gallery-heading animate-up">
            <h2 id="gallery-title">Our Creations</h2>
            <p>Every cake is handcrafted with love for every celebration.</p>
          </div>

          <GalleryNav pages={GALLERY_PAGES} />

          <div className="creations-bottom-divider" aria-hidden="true">
            <img className="creations-bottom-divider-image" src={dividerLine} alt="" />
          </div>
        </section>

        <section className="section section--open location-section" id="location">
          <div className="location-container">
            <div className="location-details">
              <h2>Location</h2>
              <p className="location-address">
                <svg
                  className="location-address-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 21s7-5.33 7-12a7 7 0 1 0-14 0c0 6.67 7 12 7 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  Diamond Village, Salawag,
                <br />
                Dasmariñas City
                </span>
              </p>
              <a
                className="location-directions"
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Get Directions</span>
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>

            <div className="location-map-wrapper" aria-label="Sweet Bakes location map">
              <img
                className="location-map"
                src={mapsImage}
                alt="Map showing Sweet Bakes near Diamond Village, Salawag"
              />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <Chatbot
        onNavigate={onNavigate}
        onTrackOrder={onTrackOrder}
        isCustomerAuthenticated={isCustomerAuthenticated}
      />
    </div>
  )
}

export default LandingPage

