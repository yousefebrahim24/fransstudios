import { Link, useSearchParams } from 'react-router'
import { useApi } from '../../hooks/useApi.js'
import { usePageTitle } from '../../hooks/usePageTitle.js'
import { ResponsiveImage } from '../../components/media/ResponsiveImage.jsx'
import { ErrorState, Spinner } from '../../components/ui/Spinner.jsx'
import { formatDate } from '../../utils/format.js'
import { t } from '../../i18n/index.js'

const categories = ['wedding', 'engagement', 'destination', 'other']

export function StoryCard({ gallery, large = false }) {
  return (
    <Link to={`/portfolio/${gallery.slug}`} className={large ? 'story-card story-card--large' : 'story-card'}>
      <div className="story-card__media">
        {gallery.cover ? (
          <ResponsiveImage image={gallery.cover} sizes={large ? '(min-width: 900px) 66vw, 100vw' : '(min-width: 900px) 33vw, (min-width: 600px) 50vw, 100vw'} />
        ) : (
          <div className="story-card__placeholder" />
        )}
      </div>
      <div className="story-card__meta">
        <h3 className="story-card__title">{gallery.title}</h3>
        <p className="story-card__sub">
          {[gallery.location, gallery.eventDate && formatDate(gallery.eventDate, { month: 'long', year: 'numeric' })].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  )
}

export default function PortfolioPage() {
  usePageTitle('Portfolio')
  const [params, setParams] = useSearchParams()
  const category = params.get('category')
  const { data, error, loading, reload } = useApi('/api/public/galleries', category ? { category } : undefined)

  return (
    <div className="pub-page">
      <header className="page-head">
        <p className="eyebrow">Portfolio</p>
        <h1 className="page-head__title">Love stories</h1>
        <p className="page-head__lead">Real moments, honestly felt — photographed with film tones and a love for black &amp; white.</p>
      </header>

      <nav className="filter-chips" aria-label="Filter stories">
        <button type="button" className="chip" aria-pressed={!category} onClick={() => setParams({})}>
          {t('portfolio.all')}
        </button>
        {categories.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setParams({ category: c })}>
            {t(`portfolio.category.${c}`)}
          </button>
        ))}
      </nav>

      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="empty-note">{t('portfolio.empty')}</p>}
      {data && data.length > 0 && (
        <div className="story-grid story-grid--even">
          {data.map((g) => (
            <StoryCard key={g.slug} gallery={g} />
          ))}
        </div>
      )}
    </div>
  )
}
