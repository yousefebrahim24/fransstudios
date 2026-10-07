import { useState } from 'react'
import { api, upload } from '../../services/api.js'
import { useApi } from '../../hooks/useApi.js'
import { Checkbox, Field } from '../../components/ui/Field.jsx'
import { ErrorState, Spinner } from '../../components/ui/Spinner.jsx'
import { ErrorBanner, PageHeader, StatusBadge } from '../../components/admin/AdminUi.jsx'
import { formatBytes } from '../../utils/format.js'

function FilmEditor({ film, onChanged }) {
  const [form, setForm] = useState({ title: film.title, description: film.description ?? '', isPublished: film.isPublished, sortOrder: film.sortOrder })
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save(e) {
    e.preventDefault()
    setError(null)
    try {
      await api(`/api/admin/films/${film.id}`, { method: 'PUT', body: { ...form, sortOrder: Number(form.sortOrder) || 0 } })
      onChanged()
    } catch (err) {
      setError(err)
    }
  }

  async function send(kind, file) {
    if (!file) return
    setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      await upload(`/api/admin/films/${film.id}/${kind}`, form, (p) => setProgress({ kind, p }))
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setProgress(null)
    }
  }

  return (
    <form className="adm-card adm-form" onSubmit={save}>
      <header className="adm-card__head">
        <h2>{film.title}</h2>
        {film.isPublished ? <StatusBadge tone="ok">Published</StatusBadge> : <StatusBadge>Hidden</StatusBadge>}
      </header>
      <ErrorBanner error={error} />
      <div className="adm-film">
        <div className="adm-film__media">
          {film.videoUrl ? (
            <video controls preload="none" poster={film.poster ? `${film.poster.src}/${film.poster.widths[0]}.jpg` : undefined} src={film.videoUrl} />
          ) : (
            <div className="adm-film__empty">No video yet</div>
          )}
        </div>
        <div className="adm-form">
          <Field label="Title" required value={form.title} onChange={set('title')} />
          <Field label="Description" as="textarea" rows={3} value={form.description} onChange={set('description')} />
          <Field label="Sort order" type="number" value={form.sortOrder} onChange={set('sortOrder')} />
          <Checkbox label="Published" checked={form.isPublished} onChange={set('isPublished')} />
        </div>
      </div>
      <div className="adm-form__row">
        <label className="adm-dropzone adm-dropzone--small">
          <input type="file" accept="image/*" onChange={(e) => send('poster', e.target.files[0])} disabled={Boolean(progress)} />
          <span>{progress?.kind === 'poster' ? `Uploading ${Math.round(progress.p * 100)}%` : film.poster ? 'Replace poster image' : 'Upload poster image'}</span>
        </label>
        <label className="adm-dropzone adm-dropzone--small">
          <input type="file" accept="video/mp4,video/webm" onChange={(e) => send('video', e.target.files[0])} disabled={Boolean(progress)} />
          <span>
            {progress?.kind === 'video'
              ? `Uploading ${Math.round(progress.p * 100)}%`
              : film.videoUrl
                ? `Replace video (${formatBytes(film.videoBytes)})`
                : 'Upload web video (MP4)'}
          </span>
        </label>
      </div>
      <div className="adm-form__actions">
        <button type="submit" className="adm-btn adm-btn--primary">
          Save
        </button>
        <button
          type="button"
          className="adm-btn adm-btn--danger-quiet"
          onClick={() => window.confirm(`Delete “${film.title}” from the website?`) && api(`/api/admin/films/${film.id}`, { method: 'DELETE' }).then(onChanged)}
        >
          Delete
        </button>
      </div>
    </form>
  )
}

export default function FilmsAdminPage() {
  const { data, error, loading, reload } = useApi('/api/admin/films')

  async function create() {
    await api('/api/admin/films', { method: 'POST', body: { title: 'New film', description: null, isPublished: false, sortOrder: (data?.length ?? 0) * 10 } })
    reload()
  }

  return (
    <>
      <PageHeader
        title="Films"
        subtitle="The first 4 published films appear on the home page. A poster alone is enough to publish (shown as “Film coming soon”); add the web video later (1080p H.264 MP4 with “fast start”, ideally under ~300 MB). Masters belong in the client’s Drive folder, not here."
        actions={
          <button type="button" className="adm-btn adm-btn--primary" onClick={create}>
            + New film
          </button>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.length === 0 && <p className="adm-muted">No films yet.</p>}
      <div className="adm-stack">{data?.map((f) => <FilmEditor key={`${f.id}-${f.videoUrl}-${f.poster?.src}`} film={f} onChanged={reload} />)}</div>
    </>
  )
}
