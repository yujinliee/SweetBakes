import { useEffect, useRef, useState } from 'react'
import logo from '../assets/landingpage/sweetbakes_logo.svg'
import searchIcon from '../assets/landingpage/search.svg'
import cartIcon from '../assets/landingpage/cart.svg'
import cartIconBlack from '../assets/landingpage/cart_black.svg'
import loginIcon from '../assets/landingpage/login.svg'
import loginIconBlack from '../assets/landingpage/login_black.svg'
import heroImage from '../assets/landingpage/main_hero.svg'
import happinessLine from '../assets/landingpage/happiness_line.svg'
import dividerLine from '../assets/landingpage/divider.svg'
import cakesImage from '../assets/landingpage/cakes.svg'
import cupcakesImage from '../assets/landingpage/cupcakes.svg'
import partyImage from '../assets/landingpage/party_package.svg'
import textureBackground from '../assets/landingpage/texture_background.svg'
import masonryImage44 from '../assets/landingpage/masonry/image 44.png'
import masonryImage45 from '../assets/landingpage/masonry/image 45.png'
import masonryImage46 from '../assets/landingpage/masonry/image 46.png'
import masonryImage47 from '../assets/landingpage/masonry/image 47.png'
import masonryImage48 from '../assets/landingpage/masonry/image 48.png'
import masonryImage49 from '../assets/landingpage/masonry/image 49.png'
import masonryRectangle78 from '../assets/landingpage/masonry/Rectangle 78.png'
import masonryRectangle83 from '../assets/landingpage/masonry/Rectangle 83.png'
import mapsImage from '../assets/landingpage/maps.svg'
import footerMark from '../assets/landingpage/sweetbakes_footer.svg'
import footerBackground from '../assets/landingpage/footer_bg.png'
import './LandingPage.css'

const cakeStepOneHref = '/cakes?start=1'

export function SiteTopbar({
  scrollTargetRef,
  forceScrolled = false,
  homeHref = '#home',
  locationHref = '#location',
  contactHref = '#contact',
  latestRequest = '',
  onTrackOrder,
}) {
  const [isScrolled, setIsScrolled] = useState(forceScrolled)
  const [isShopOpen, setIsShopOpen] = useState(false)
  const shopMenuRef = useRef(null)

  useEffect(() => {
    if (forceScrolled) {
      return undefined
    }

    const getScrollThreshold = () => {
      const heroHeight = scrollTargetRef?.current?.offsetHeight ?? window.innerHeight

      return heroHeight * 0.88
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY >= getScrollThreshold())
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [forceScrolled, scrollTargetRef])

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
    <header className={`topbar${isScrolled ? ' topbar--scrolled' : ''}`}>
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
              <a href={cakeStepOneHref} onClick={() => setIsShopOpen(false)}>
                <span>Cakes</span>
              </a>
              <a href={cakeStepOneHref} onClick={() => setIsShopOpen(false)}>
                <span>Cupcakes</span>
              </a>
              <a href={contactHref} onClick={() => setIsShopOpen(false)}>
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
          <button type="button" aria-label="Search">
            <img
              src={searchIcon}
              alt=""
              aria-hidden="true"
              className={isScrolled ? 'topbar-icon topbar-icon--dark' : 'topbar-icon'}
            />
          </button>
          <button type="button" aria-label="Shopping Cart">
            <img
              src={isScrolled ? cartIconBlack : cartIcon}
              alt=""
              aria-hidden="true"
            />
          </button>
          <button type="button" aria-label="Login">
            <img
              src={isScrolled ? loginIconBlack : loginIcon}
              alt=""
              aria-hidden="true"
            />
          </button>
          {latestRequest ? (
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
                  pathLength="100"
                  x="3"
                  y="3"
                  width="94"
                  height="34"
                  rx="9"
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
            <div className="footer-contact-row">
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
            </div>
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

function LandingPage({ latestRequest, onTrackOrder }) {
  const heroRef = useRef(null)
  const offerings = [
    {
      title: 'Cakes',
      cta: 'Order Cakes',
      description:
        "Bring your dream cake to life by customizing every design detail. From elegant celebrations to fun themed occasions, we'll create a cake that reflects your unique style and vision.",
      image: cakesImage,
      href: cakeStepOneHref,
    },
    {
      title: 'Cupcakes',
      cta: 'Order Cupcakes',
      description:
        'Customize every cupcake to match your celebration. Whether you prefer elegant, playful, or themed designs, each box is carefully crafted to complement your special occasion.',
      image: cupcakesImage,
      href: cakeStepOneHref,
    },
    {
      title: 'Party Packages',
      cta: 'Order Package',
      description:
        'Create a complete dessert experience by customizing a party package that fits your celebration. Personalize your cake and cupcakes to achieve a cohesive look for your special event.',
      image: partyImage,
    },
  ]
  const galleryItems = [
    {
      title: 'Floral Celebration Cake',
      description: 'Soft florals and custom toppers for a romantic centerpiece.',
      label: 'Birthday',
      image: masonryImage46,
      shape: 'portrait',
    },
    {
      title: 'Signature Cupcake Box',
      description: 'A curated set of decorated cupcakes for sweet gifting.',
      label: 'Cupcakes',
      image: masonryImage45,
      shape: 'square',
    },
    {
      title: 'Party Dessert Table',
      description: 'A coordinated cake and cupcake spread for larger gatherings.',
      label: 'Party',
      image: masonryImage44,
      shape: 'landscape',
    },
    {
      title: 'Pastel Cake Details',
      description: 'Delicate color, polished finishes, and handmade accents.',
      label: 'Custom cake',
      image: masonryRectangle83,
      shape: 'square',
    },
    {
      title: 'Celebration Cupcakes',
      description: 'Playful frosting, themed toppers, and fresh-baked texture.',
      label: 'Celebration',
      image: masonryImage48,
      shape: 'portrait',
    },
    {
      title: 'Complete Sweet Package',
      description: 'Designed as one cohesive dessert moment for your event.',
      label: 'Package',
      image: masonryImage49,
      shape: 'landscape',
    },
    {
      title: 'Delicate Dessert Styling',
      description: 'A polished finish for intimate gatherings and special moments.',
      label: 'Occasion',
      image: masonryRectangle78,
      shape: 'portrait',
    },
    {
      title: 'Handcrafted Sweet Details',
      description: 'Thoughtful colors and textures made for memorable celebrations.',
      label: 'Details',
      image: masonryImage47,
      shape: 'square',
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
    const galleryDivider = document.querySelector('.gallery-divider')
    const gallerySection = document.querySelector('.gallery-section')
    const locationDivider = document.querySelector('.location-divider')
    const locationSection = document.querySelector('.location-section')

    if (!('IntersectionObserver' in window)) {
      galleryItems.forEach((item) => item.classList.add('gallery-item--visible'))
      galleryDivider?.classList.add('gallery-divider--visible')
      locationDivider?.classList.add('location-divider--visible')
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.classList.contains('gallery-section')) {
              galleryDivider?.classList.add('gallery-divider--visible')
            } else if (entry.target.classList.contains('location-section')) {
              locationDivider?.classList.add('location-divider--visible')
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
    if (locationSection) {
      observer.observe(locationSection)
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
        scrollTargetRef={heroRef}
        onTrackOrder={onTrackOrder}
      />

      <main>
        <section className="hero" id="home" ref={heroRef}>
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
                <a className="button button-primary" href={cakeStepOneHref}>
                  <span>Order Cakes &amp; Cupcakes</span>
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
                  <a className="offer-showcase-link" href={item.href ?? '#contact'}>
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

          <div className="gallery-grid" aria-label="Sweet Bakes creation gallery">
            <div className="gallery-track">
              {[0, 1].map((copyIndex) => (
                <div
                  className="gallery-loop"
                  key={`gallery-loop-${copyIndex}`}
                  aria-hidden={copyIndex === 1 ? 'true' : undefined}
                >
                  {galleryItems.map((item, index) => (
                    <article
                      className={`gallery-item gallery-item--${item.shape} gallery-item--tile-${index + 1} gallery-item--visible`}
                      key={`${copyIndex}-${item.title}`}
                      style={{ '--gallery-delay': `${index * 70}ms` }}
                    >
                      <img src={item.image} alt={copyIndex === 0 ? item.title : ''} />
                      <div className="gallery-overlay">
                        <p>{item.label}</p>
                        <h3>{item.title}</h3>
                        <strong>View Details &rarr;</strong>
                        <span>{item.description}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--open location-section" id="location">
          <div className="location-divider" aria-hidden="true">
            <img src={dividerLine} alt="" />
          </div>
          <div className="section-heading location-heading animate-up">
            <h2>Location</h2>
            <p>
              Stop by the shop to discuss flavors, themes, and the details of your
              next cake order in person.
            </p>
          </div>

          <div className="location-card animate-up" style={{ '--delay': '120ms' }}>
            <img src={mapsImage} alt="Sweet Bakes store location map" />
            <div className="location-copy">
              <h3>Diamond Village, Salawag, Dasmariñas City</h3>
              <p>Diamond Village Salawag Dasmariñas Cavite, Philippines, 4114</p>
              <div className="location-contact-list" aria-label="Location contact details">
                <a className="location-contact-row" href="tel:+639278700399">
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
                <a className="location-contact-row" href="mailto:rhonanarvaez@gmail.com">
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
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

export default LandingPage
