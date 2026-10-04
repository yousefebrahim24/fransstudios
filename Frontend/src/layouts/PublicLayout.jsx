import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { t } from '../i18n/index.js'
import { studio } from '../content/site.js'
import '../styles/public.css'

const links = [
  { to: '/portfolio', label: t('nav.portfolio') },
  { to: '/films', label: t('nav.films') },
  { to: '/about', label: t('nav.about') },
  { to: '/packages', label: t('nav.packages') },
  { to: '/contact', label: t('nav.contact') },
]

export default function PublicLayout() {
  const location = useLocation()
  const overHero = location.pathname === '/'
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const solid = !overHero || scrolled || menuOpen

  return (
    <>
      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>
      <header className={`pub-header ${solid ? 'pub-header--solid' : 'pub-header--over'}`}>
        <div className="pub-header__inner">
          <Link to="/" className="pub-logo" aria-label="Frans Studios — home">
            <span className="pub-logo__word">Frans</span>
            <span className="pub-logo__sub">Studios</span>
          </Link>

          <nav className="pub-nav" aria-label="Main">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className="pub-nav__link">
                {l.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="pub-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="visually-hidden">{menuOpen ? t('nav.close') : t('nav.menu')}</span>
            <span className="pub-menu-btn__bar" aria-hidden="true" />
            <span className="pub-menu-btn__bar" aria-hidden="true" />
          </button>
        </div>

        <nav id="mobile-menu" className="pub-mobile-nav" data-open={menuOpen} aria-label="Main" hidden={!menuOpen}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="pub-mobile-nav__link">
              {l.label}
            </NavLink>
          ))}
          <Link to="/client" className="pub-mobile-nav__client">
            {t('nav.clientLogin')}
          </Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className={overHero ? 'pub-main pub-main--hero' : 'pub-main'}>
        <Outlet />
      </main>

      <footer className="pub-footer">
        <div className="pub-footer__inner">
          <div className="pub-footer__brand">
            <p className="pub-logo pub-logo--footer">
              <span className="pub-logo__word">Frans</span>
              <span className="pub-logo__sub">Studios</span>
            </p>
            <p className="pub-footer__line">{studio.footerLine}</p>
          </div>
          <div className="pub-footer__col">
            <h2 className="eyebrow">{t('nav.contact')}</h2>
            <a href={`mailto:${studio.email}`}>{studio.email}</a>
            <a href={studio.phoneHref}>{studio.phoneDisplay}</a>
            <a href={studio.whatsappHref} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </div>
          <div className="pub-footer__col">
            <h2 className="eyebrow">Follow</h2>
            <a href={studio.instagramHref} target="_blank" rel="noopener noreferrer">
              Instagram {studio.instagramHandle}
            </a>
          </div>
          <div className="pub-footer__col">
            <h2 className="eyebrow">Clients</h2>
            <Link to="/client">{t('nav.clientLogin')}</Link>
          </div>
        </div>
        <p className="pub-footer__legal">© {new Date().getFullYear()} Frans Studios</p>
      </footer>
      <ScrollRestoration />
    </>
  )
}
