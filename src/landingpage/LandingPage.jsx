import { useEffect, useRef, useState } from 'react'
import logo from '../assets/landingpage/sweetbakes_logo.svg'
import searchIcon from '../assets/landingpage/search.svg'
import cartIcon from '../assets/landingpage/cart.svg'
import cartIconBlack from '../assets/landingpage/cart_black.svg'
import loginIcon from '../assets/landingpage/login.svg'
import loginIconBlack from '../assets/landingpage/login_black.svg'
import heroImage from '../assets/landingpage/main_hero.svg'
import happinessLine from '../assets/landingpage/happiness_line.svg'
import mapsImage from '../assets/landingpage/maps.svg'
import footerMark from '../assets/landingpage/sweetbakes_footer.svg'
import './LandingPage.css'

function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isShopOpen, setIsShopOpen] = useState(false)
  const heroRef = useRef(null)
  const shopMenuRef = useRef(null)

  useEffect(() => {
    const getScrollThreshold = () => {
      const heroHeight = heroRef.current?.offsetHeight ?? window.innerHeight

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
  }, [])

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
    <div className="page-shell">
      <header className={`topbar${isScrolled ? ' topbar--scrolled' : ''}`}>
        <div className="topbar-inner">
          <a className="brand" href="#home" aria-label="Sweet Bakes home">
            <img src={logo} alt="Sweet Bakes" />
          </a>

          <nav className="nav" aria-label="Primary">
            <a href="#home">Home</a>
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
                Shop
              </button>
              <div className="nav-dropdown-menu" id="shop-dropdown-menu">
                <a href="#contact" onClick={() => setIsShopOpen(false)}>
                  <span>Cakes</span>
                </a>
                <a href="#contact" onClick={() => setIsShopOpen(false)}>
                  <span>Cupcakes</span>
                </a>
                <a href="#contact" onClick={() => setIsShopOpen(false)}>
                  <span>Party Packages</span>
                </a>
              </div>
            </div>
            <a href="#location">Location</a>
            <a href="#contact">Contact</a>
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
          </div>
        </div>
      </header>

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
                Design your perfect cake or cupcake with your preferred flavor, theme,
                and message. Freshly made, carefully finished, and styled for the most
                memorable celebrations.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#contact">
                  <span>Order Your Cake</span>
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

        <section className="section quote-section" aria-labelledby="testimonial-title">
          <div className="section-heading animate-up">
            <p className="eyebrow">Customer love</p>
            <h2 id="testimonial-title">What our customers say</h2>
          </div>
          <blockquote className="animate-up" style={{ '--delay': '100ms' }}>
            Bright pink cake decorated with 3D fondant sun, moon, and cloud toppers
            for christenings or birthdays.
          </blockquote>
          <p className="quote-author animate-up" style={{ '--delay': '180ms' }}>
            Michael Jackson
          </p>
        </section>

        <section className="section section--open location-section" id="location">
          <div className="section-heading animate-up">
            <p className="eyebrow">Visit us</p>
            <h2>Pickups, inquiries, and custom orders</h2>
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
              <a href="tel:+639278700399">0927 870 0399</a>
              <a href="mailto:rhonanarvaez@gmail.com">rhonanarvaez@gmail.com</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer" id="contact">
        <img className="footer-mark" src={footerMark} alt="Sweet Bakes" />
        <div className="footer-grid">
          <div className="animate-up">
            <h2>Sweet Bakes</h2>
            <p>
              Crafting delicious cakes and cupcakes for every celebration, made with
              quality ingredients and a touch of sweetness.
            </p>
          </div>
          <div className="animate-up" style={{ '--delay': '90ms' }}>
            <h3>Hey, Bestie!</h3>
            <p>Follow us on Facebook for exclusive updates.</p>
            <p>0927 870 0399</p>
            <p>rhonanarvaez@gmail.com</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
