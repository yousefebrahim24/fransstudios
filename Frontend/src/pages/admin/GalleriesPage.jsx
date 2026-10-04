import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../services/api.js'
import { useApi } from '../../hooks/useApi.js'
import { Dialog } from '../../components/ui/Dialog.jsx'
import { Field } from '../../components/ui/Field.jsx'
import { ErrorState, Spinner } from '../../components/ui/Spinner.jsx'
import { ErrorBanner, PageHeader, StatusBadge } from '../../components/admin/AdminUi.jsx'

export const slugify = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

export default function GalleriesPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useApi('/api/admin/galleries')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', slug: '' })
  const [saveError, setSaveError] = useState(null)

  async function create(e) {
    e.preventDefault()
    setSaveError(null)
    try {
      const g = await api('/api/admin/galleries', {
        method: 'POST',
        body: { ...form, category: 'wedding', isPublished: false, isFeatured: false, sortOrder: (data?.length ?? 0) * 10 },
      })
      navigate(`/admin/portfolio/${g.id}`)
    } catch (err) {
      setSaveError(err)
    }
  }

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle="Public wedding stories on the website. Images are uploaded here (optimised automatically) — not from Google Drive."
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => setCreating(true)}>
            + New story
          </button>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="adm-muted">No stories yet.</p>}
      {data && data.length > 0 && (
        <ul className="adm-gallery-grid" role="list">
          {data.map((g) => (
            <li key={g.id}>
              <Link to={`/admin/portfolio/${g.id}`} className="adm-gallery-card">
                <div className="adm-gallery-card__img">{g.cover ? <img src={`${g.cover.src}/${g.cover.widths[0]}.webp`} alt="" loading="lazy" /> : <span>No images</span>}</div>
                <div className="adm-gallery-card__meta">
                  <strong>{g.title}</strong>
                  <span className="adm-muted adm-small">
                    /portfolio/{g.slug} · {g.imageCount} images
                  </span>
                  <span>
                    {g.isPublished ? <StatusBadge tone="ok">Published</StatusBadge> : <StatusBadge>Hidden</StatusBadge>} {g.isFeatured && <StatusBadge tone="warn">Featured</StatusBadge>}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New portfolio story"
        footer={
          <button type="submit" form="new-gallery" className="adm-btn adm-btn--primary">
            Create
          </button>
        }
      >
        <form id="new-gallery" className="adm-form" onSubmit={create}>
          <ErrorBanner error={saveError} />
          <Field label="Title" placeholder="Sara & Amr" required value={form.title} onChange={(e) => setForm({ title: e.target.value, slug: slugify(e.target.value) })} />
          <Field label="URL" hint={`fransstudios.com/portfolio/${form.slug || '…'}`} required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} error={saveError?.fieldErrors?.slug} />
        </form>
      </Dialog>
    </>
  )
}
