import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../services/api.js'
import { usePageTitle } from '../../hooks/usePageTitle.js'
import { largestSrc, ResponsiveImage } from '../../components/media/ResponsiveImage.jsx'
import { Lightbox } from '../../components/media/Lightbox.jsx'
import { ErrorState, Spinner } from '../../components/ui/Spinner.jsx'
import { t } from '../../i18n/index.js'

const PAGE_SIZE = 60

/** 3 columns on desktop, 2 on tablets, 1 on phones (kept in sync with the window size). */
function useColumnCount() {
  const get = () => (window.matchMedia('(min-width: 900px)').matches ? 3 : window.matchMedia('(min-width: 560px)').matches ? 2 : 1)
  const [count, setCount] = useState(get)
  useEffect(() => {
    const onResize = () => setCount(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return count
}

/**
 * Portfolio wall (like fransstudios.com/portofolio): full-width, 3 columns of photos with 16px gaps,
 * scrolled continuously. Shows every photo of every published album (Admin → Portfolio), in album
 * order, loading more as the visitor nears the bottom. Clicking a photo opens it full screen.
 */
export default function PortfolioPage() {
  usePageTitle('Portfolio')
  const [state, setState] = useState({ items: [], total: null, page: 0, loading: false, error: null })
  const [viewer, setViewer] = useState(-1)
  const busy = useRef(false)
  const sentinel = useRef(null)

  const loadMore = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const page = state.page + 1
      const data = await api('/api/public/portfolio', { query: { page, pageSize: PAGE_SIZE } })
      setState((s) => ({ items: [...s.items, ...data.items], total: data.total, page, loading: false, error: null }))
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }))
    } finally {
      busy.current = false
    }
  }, [state.page])

  const hasMore = state.total === null || state.items.length < state.total

  // First page on mount, then more whenever the sentinel scrolls into view.
  useEffect(() => {
    if (state.page === 0 && !state.loading && !state.error) loadMore()
  }, [state.page, state.loading, state.error, loadMore])

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || state.page === 0 || state.error) return
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '1500px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, state.page, state.error, loadMore])

  const slides = state.items.map((p) => ({ src: largestSrc(p.image), width: p.image.width, height: p.image.height, alt: p.image.alt }))

  // Deal photos across the columns in turn so the wall reads left → right, row by row,
  // while each photo keeps its own proportions.
  const columnCount = useColumnCount()
  const columns = Array.from({ length: columnCount }, () => [])
  state.items.forEach((p, i) => columns[i % columnCount].push({ ...p, index: i }))

  return (
    <div className="portfolio-wall">
      <h1 className="visually-hidden">Portfolio</h1>

      {state.total === 0 && <p className="empty-note portfolio-wall__empty">{t('portfolio.empty')}</p>}

      <div className="portfolio-wall__grid" style={{ '--cols': columnCount }}>
        {columns.map((col, c) => (
          <ul key={c} className="portfolio-wall__col" role="list">
            {col.map((p) => (
              <li key={p.image.id} className="portfolio-wall__item">
                <button type="button" className="portfolio-wall__btn" onClick={() => setViewer(p.index)} aria-label={`${p.image.alt} — open full screen`}>
                  <ResponsiveImage image={p.image} sizes="(min-width: 900px) 33vw, (min-width: 560px) 50vw, 100vw" priority={p.index < 3} />
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {state.error && <ErrorState error={state.error} onRetry={loadMore} />}
      {state.loading && <Spinner />}
      <div ref={sentinel} aria-hidden="true" />

      <Lightbox open={viewer >= 0} slides={slides} index={Math.max(viewer, 0)} onClose={() => setViewer(-1)} onIndexChange={setViewer} />
    </div>
  )
}
