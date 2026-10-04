import { Link } from 'react-router'
import { useApi } from '../../hooks/useApi.js'
import { usePageTitle } from '../../hooks/usePageTitle.js'
import { ResponsiveImage } from '../../components/media/ResponsiveImage.jsx'
import { StoryCard } from './PortfolioPage.jsx'
import { founder, stats, studio } from '../../content/site.js'
import { t } from '../../i18n/index.js'

export default function HomePage() {
  usePageTitle('Frans Studios — Wedding Photography & Cinematography')
  const { data: galleries } = useApi('/api/public/galleries')
  const { data: films } = useApi('/api/public/films')

  const featured = galleries?.filter((g) => g.isFeatured) ?? []
  const stories = (featured.length ? featured : galleries ?? []).slice(0, 6)
  const hero = (featured[0] ?? galleries?.[0])?.cover
  const film = films?.[0]

  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__media">{hero && <ResponsiveImage image={hero} priority sizes="100vw" alt="" />}</div>
        <div className="home-hero__content">
          <p className="eyebrow eyebrow--light">Wedding photography &amp; cinematography</p>
          <h1 id="home-title" className="home-hero__title">
            {studio.tagline}
          </h1>
          <p className="home-hero__lead">{studio.intro}</p>
          <div className="home-hero__actions">
            <Link to="/contact" className="btn btn--light">
              {t('home.cta')}
            </Link>
            <Link to="/portfolio" className="text-link text-link--light">
              {t('home.portfolioCta')}
            </Link>
          </div>
        </div>
      </section>

      <section className="pub-section home-intro" aria-labelledby="intro-title">
        <div className="home-intro__text">
          <p className="eyebrow">Hi, I’m {founder.name}</p>
          <h2 id="intro-title" className="home-intro__lead">
            {founder.lead}
          </h2>
          <p>{founder.paragraphs[0]}</p>
          <p className="home-intro__sign">
            {founder.name} — <span>{founder.role}</span>
          </p>
          <Link to="/about" className="text-link">
            Our story
          </Link>
        </div>
        <dl className="home-stats">
          {stats.map((s) => (
            <div key={s.label} className="home-stats__item">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {stories.length > 0 && (
        <section className="pub-section" aria-labelledby="stories-title">
          <header className="section-head">
            <p className="eyebrow">Portfolio</p>
            <h2 id="stories-title" className="section-head__title">
              Every detail, every emotion, perfectly preserved
            </h2>
            <p className="section-head__lead">
              We focus on what matters most — your unforgettable moments — blending heartfelt storytelling with creative visuals.
            </p>
          </header>
          <div className="story-grid">
            {stories.map((g, i) => (
              <StoryCard key={g.slug} gallery={g} large={i === 0} />
            ))}
          </div>
          <p className="section-foot">
            <Link to="/portfolio" className="text-link">
              {t('home.portfolioCta')}
            </Link>
          </p>
        </section>
      )}

      {film && (
        <section className="home-film" aria-labelledby="film-title">
          <div className="home-film__media">{film.poster && <ResponsiveImage image={film.poster} sizes="100vw" alt="" />}</div>
          <div className="home-film__content">
            <p className="eyebrow eyebrow--light">Cinematography</p>
            <h2 id="film-title">Bring your love story to the screen</h2>
            <p>Every glance, every laugh and every embrace — woven into a film you’ll return to for a lifetime.</p>
            <Link to="/films" className="btn btn--light">
              {t('home.filmsCta')}
            </Link>
          </div>
        </section>
      )}

      <section className="pub-section home-cta" aria-labelledby="cta-title">
        <h2 id="cta-title">Tell us about your day</h2>
        <p>Share your date and venue, and we’ll send our packages and availability.</p>
        <div className="home-cta__actions">
          <Link to="/packages" className="btn">
            Request our packages
          </Link>
          <a href={studio.whatsappHref} className="btn btn--ghost" target="_blank" rel="noopener noreferrer">
            WhatsApp us
          </a>
        </div>
      </section>
    </>
  )
}
