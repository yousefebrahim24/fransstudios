import { Link, Navigate } from 'react-router'
import { useApi } from '../../hooks/useApi.js'
import { usePageTitle } from '../../hooks/usePageTitle.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { ErrorState, Spinner } from '../../components/ui/Spinner.jsx'
import { formatBytes, formatDate } from '../../utils/format.js'
import { t } from '../../i18n/index.js'

export default function ClientDashboardPage() {
  usePageTitle('Your galleries')
  const { user } = useAuth()
  const { data: albums, error, loading, reload } = useApi('/api/client/albums')

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={reload} />
  // Most couples have a single gallery — take them straight to it.
  if (albums?.length === 1) return <Navigate to={`/client/albums/${albums[0].id}`} replace />

  return (
    <div className="cl-dashboard">
      <header className="cl-dashboard__head">
        <p className="eyebrow">{t('client.dashboard.greeting', { name: user?.displayName ?? '' })}</p>
        <h1 className="cl-dashboard__title">Your galleries</h1>
      </header>

      {albums?.length === 0 ? (
        <p className="cl-empty">{t('client.dashboard.empty')}</p>
      ) : (
        <ul className="cl-albums" role="list">
          {albums.map((a) => (
            <li key={a.id}>
              <Link to={`/client/albums/${a.id}`} className="cl-album-card">
                <div className="cl-album-card__media">
                  {a.coverFileId ? (
                    <img src={`/api/client/files/${a.coverFileId}/thumbnail?size=medium`} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <div className="cl-album-card__placeholder" />
                  )}
                </div>
                <div className="cl-album-card__meta">
                  <h2 className="cl-album-card__title">{a.title}</h2>
                  <p className="cl-album-card__sub">
                    {[
                      a.eventDate && formatDate(a.eventDate),
                      a.photoCount > 0 && t('client.album.photos', { count: a.photoCount }),
                      a.videoCount > 0 && t('client.album.videos', { count: a.videoCount }),
                      formatBytes(a.totalBytes),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <span className="text-link">{t('client.album.open')}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
