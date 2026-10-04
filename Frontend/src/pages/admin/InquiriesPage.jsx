import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../../services/api.js'
import { useApi } from '../../hooks/useApi.js'
import { ErrorState, Spinner } from '../../components/ui/Spinner.jsx'
import { PageHeader, Pagination, StatusBadge } from '../../components/admin/AdminUi.jsx'
import { formatDate, formatDateTime } from '../../utils/format.js'

const statuses = ['new', 'contacted', 'booked', 'closed']
const tone = { new: 'warn', contacted: 'neutral', booked: 'ok', closed: 'neutral' }

export default function InquiriesPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? 1)
  const { data, error, loading, reload, setData } = useApi('/api/admin/inquiries', { status, page, pageSize: 25 })
  const [open, setOpen] = useState(null)

  async function setStatus(inquiry, next) {
    setData((d) => ({ ...d, items: d.items.map((i) => (i.id === inquiry.id ? { ...i, status: next } : i)) }))
    await api(`/api/admin/inquiries/${inquiry.id}`, { method: 'PUT', body: { status: next } })
  }

  return (
    <>
      <PageHeader title="Inquiries" subtitle="Messages from the Contact and Packages forms." />
      <div className="adm-filters">
        <select className="adm-input" aria-label="Status" value={status} onChange={(e) => setParams({ status: e.target.value })}>
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {loading && !data && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <ul className="adm-inquiries" role="list">
            {data.items.length === 0 && <li className="adm-muted">No inquiries.</li>}
            {data.items.map((i) => (
              <li key={i.id} className="adm-card adm-inquiry">
                <button type="button" className="adm-inquiry__head" aria-expanded={open === i.id} onClick={() => setOpen(open === i.id ? null : i.id)}>
                  <strong>{i.name}</strong>
                  <span className="adm-muted adm-small">
                    {[i.eventType, i.eventDate && formatDate(i.eventDate), i.venue].filter(Boolean).join(' · ') || '—'}
                  </span>
                  <span className="adm-muted adm-small">{formatDateTime(i.createdAt)}</span>
                  <StatusBadge tone={tone[i.status]}>{i.status}</StatusBadge>
                </button>
                {open === i.id && (
                  <div className="adm-inquiry__body">
                    <dl className="adm-credentials">
                      <dt>Mobile</dt>
                      <dd>
                        <a href={`tel:${i.mobile}`}>{i.mobile}</a> ·{' '}
                        <a href={`https://wa.me/${i.mobile.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer">
                          WhatsApp
                        </a>
                      </dd>
                      {i.email && (
                        <>
                          <dt>Email</dt>
                          <dd>
                            <a href={`mailto:${i.email}`}>{i.email}</a>
                          </dd>
                        </>
                      )}
                      <dt>Coverage</dt>
                      <dd>{i.coverage ?? '—'}</dd>
                      <dt>Heard via</dt>
                      <dd>{i.source ?? '—'}</dd>
                    </dl>
                    {i.message && <p className="adm-message">{i.message}</p>}
                    <div className="adm-form__actions">
                      {statuses.map((s) => (
                        <button key={s} type="button" className={s === i.status ? 'adm-btn adm-btn--small adm-btn--primary' : 'adm-btn adm-btn--small'} onClick={() => setStatus(i, s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParams({ status, page: String(p) })} />
        </>
      )}
    </>
  )
}
