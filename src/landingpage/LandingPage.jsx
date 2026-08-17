import { useEffect, useRef, useState } from 'react'
import logo from '../assets/landingpage/sweetbakes_logo.svg'
import loginIcon from '../assets/landingpage/login.svg'
import loginIconBlack from '../assets/landingpage/login_black.svg'
import heroImage from '../assets/landingpage/main_hero.svg'
import happinessLine from '../assets/landingpage/happiness_line.svg'
import dividerLine from '../assets/landingpage/divider.svg'
import cakesImage from '../assets/landingpage/cakes.svg'
import cupcakesImage from '../assets/landingpage/cupcakes.svg'
import partyImage from '../assets/landingpage/party_package.svg'
import textureBackground from '../assets/landingpage/texture_background.svg'
import mapsImage from '../assets/landingpage/maps.png'
import footerMark from '../assets/landingpage/sweetbakes_footer.svg'
import footerBackground from '../assets/landingpage/footer_bg.png'
import Chatbot from '../components/Chatbot/Chatbot.jsx'
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

const cakeStepOneHref = '/customize'
const heroCustomizeHref = '/customize'
const homeCakesHref = '/customize?category=cakes'
const homeCupcakesHref = '/customize?category=cupcakes'
const homePackagesHref = '/customize?category=packages'
const cakesHref = '/cakes'
const cupcakesHref = '/cupcakes'
const packagesHref = '/customize?type=packages'
const loginHref = '/login'
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
}) {
  const [isScrolled, setIsScrolled] = useState(getIsTopbarScrolled)
  const [topbarMotion, setTopbarMotion] = useState('')
  const [isShopOpen, setIsShopOpen] = useState(false)
  const shopMenuRef = useRef(null)
  const isScrolledRef = useRef(forceScrolled || getIsTopbarScrolled())
  const topbarMotionTimeoutRef = useRef(null)
  const topbarIsScrolled = forceScrolled || isScrolled
  const hasTrackOrder = Boolean(onTrackOrder)

  const handleLoginNavigation = (event) => {
    event.preventDefault()

    if (onNavigate) {
      onNavigate(loginHref)
      return
    }

    window.history.pushState({}, '', loginHref)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
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
    }

    document.addEventListener('pointerdown', handleClickOutside)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [])

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
              <a href={cakesHref} onClick={() => setIsShopOpen(false)}>
                <span>Cakes</span>
              </a>
              <a href={cupcakesHref} onClick={() => setIsShopOpen(false)}>
                <span>Cupcakes</span>
              </a>
              <a
                href={packagesHref}
                onClick={(event) => {
                  event.preventDefault()
                  setIsShopOpen(false)
                  if (onNavigate) {
                    onNavigate(packagesHref)
                    return
                  }

                  window.history.pushState({}, '', packagesHref)
                  window.dispatchEvent(new PopStateEvent('popstate'))
                  window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: 'instant',
                  })
                }}
              >
                <span>Party Packages</span>
              </a>
            </div>
          </div>
          <a href={locationHref}>
            <span className="nav-link-text">Location</span>
          </a>
          <a href={contactHref}>
            <span className="nav-link-text">Contact</span>
          </a>
        </nav>

        <div className="topbar-actions" aria-label="Quick actions">
          {hasTrackOrder ? (
            <a
              className="topbar-login topbar-login-link"
              href={loginHref}
              aria-label="Login"
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
          {hasTrackOrder ? (
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
    <footer
      className="footer"
      id="contact"
      style={{ '--footer-bg': `url(${footerBackground})` }}
    >
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
    </footer>
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

  // Wheel / trackpad:
  //  - Horizontal gestures: rely on native deltaX scrolling (do NOT preventDefault).
  //  - Vertical gestures over the gallery: convert to horizontal while more pages
  //    remain in that direction; at the ends, let normal vertical page scroll resume.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e) => {
      const horizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      if (horizontalIntent) {
        // Native laptop-trackpad horizontal swipe — the browser scrolls el itself.
        return
      }
      const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
      const canLeft = el.scrollLeft > 1
      if ((e.deltaY > 0 && canRight) || (e.deltaY < 0 && canLeft)) {
        e.preventDefault()
        // Mouse wheels often report in lines; trackpads report in pixels.
        const pixelsPerLine = 16
        const delta =
          e.deltaMode === 1
            ? e.deltaY * pixelsPerLine
            : e.deltaY
        el.scrollLeft += delta
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

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

function LandingPage({ latestRequest, onTrackOrder, onNavigate, isCustomerAuthenticated = false }) {
  const handlePageNavigation = (event, href) => {
    event.preventDefault()

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

        <section className="section section--open gallery-section" aria-labelledby="gallery-title">
          <div className="gallery-divider" aria-hidden="true">
            <img src={dividerLine} alt="" />
          </div>
          <div className="section-heading gallery-heading animate-up">
            <h2 id="gallery-title">Our Creations</h2>
            <p>Every cake is handcrafted with love for every celebration.</p>
          </div>

          <GalleryNav pages={GALLERY_PAGES} />
        </section>

        <div className="creations-bottom-divider" aria-hidden="true">
          <img className="creations-bottom-divider-image" src={dividerLine} alt="" />
        </div>

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

