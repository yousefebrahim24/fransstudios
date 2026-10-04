import { useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import { usePageTitle } from '../../hooks/usePageTitle.js'
import { largestSrc, ResponsiveImage } from '../../components/media/ResponsiveImage.jsx'
import { ErrorState, Spinner } from '../../components/ui/Spinner.jsx'
import { t } from '../../i18n/index.js'

/** Poster first; the video element (and its download) only loads when the visitor presses play. */
function Film({ film }) {
  const [playing, setPlaying] = useState(false)
  const ratio = film.poster ? `${film.poster.width} / ${film.poster.height}` : '16 / 9'
  return (
    <article className="film">
      <div className="film__frame" style={{ aspectRatio: ratio }}>
        {playing ? (
          <video className="film__video" controls autoPlay playsInline preload="auto" poster={film.poster ? largestSrc(film.poster, 'jpg') : undefined}>
            <source src={film.videoUrl} type={film.videoMimeType ?? 'video/mp4'} />
          </video>
        ) : (
          <button type="button" className="film__poster" onClick={() => setPlaying(true)} aria-label={`Play film: ${film.title}`}>
            {film.poster && <ResponsiveImage image={film.poster} sizes="(min-width: 1200px) 1100px, 100vw" alt="" />}
            <span className="film__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <div className="film__meta">
        <h2 className="film__title">{film.title}</h2>
        {film.description && <p className="film__desc">{film.description}</p>}
      </div>
    </article>
  )
}

export default function FilmsPage() {
  usePageTitle('Wedding Films')
  const { data, error, loading, reload } = useApi('/api/public/films')
  return (
    <div className="pub-page">
      <header className="page-head">
        <p className="eyebrow">Cinematography</p>
        <h1 className="page-head__title">Wedding films</h1>
        <p className="page-head__lead">Through the lens of cinematic artistry we craft films that narrate your love story.</p>
      </header>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.length === 0 && <p className="empty-note">{t('films.empty')}</p>}
      <div className="film-list">{data?.map((f) => <Film key={f.id} film={f} />)}</div>
    </div>
  )
}
