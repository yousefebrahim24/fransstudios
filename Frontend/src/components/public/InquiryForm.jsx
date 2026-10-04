import { useState } from 'react'
import { Field } from '../ui/Field.jsx'
import { api, ApiError } from '../../services/api.js'
import { t } from '../../i18n/index.js'
import { inquiryOptions } from '../../content/site.js'

const empty = { name: '', mobile: '', email: '', eventType: '', eventDate: '', venue: '', coverage: '', source: '', message: '', website: '' }

/** The single inquiry form used on Packages and Contact (replaces the two different WordPress forms). */
export function InquiryForm({ compact = false }) {
  const [values, setValues] = useState(empty)
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [error, setError] = useState(null)

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }))
  const fieldError = (name) => error?.fieldErrors?.[name]

  async function submit(e) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      await api('/api/public/inquiries', {
        method: 'POST',
        body: { ...values, eventDate: values.eventDate || null, email: values.email || null },
      })
      setStatus('sent')
      setValues(empty)
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, { title: t('common.error') }))
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <div className="form-success" role="status">
        <p>{t('inquiry.thanks')}</p>
      </div>
    )
  }

  return (
    <form className={compact ? 'inquiry inquiry--compact' : 'inquiry'} onSubmit={submit} noValidate>
      {error && !Object.keys(error.fieldErrors).length && (
        <p className="form-error" role="alert">
          {error.message}
        </p>
      )}
      <div className="inquiry__grid">
        <Field label={t('inquiry.name')} name="name" autoComplete="name" required value={values.name} onChange={set('name')} error={fieldError('name')} />
        <Field label={t('inquiry.mobile')} name="mobile" type="tel" autoComplete="tel" inputMode="tel" required value={values.mobile} onChange={set('mobile')} error={fieldError('mobile')} />
        <Field label={t('inquiry.email')} name="email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={fieldError('email')} />
        <Field label={t('inquiry.eventType')} as="select" name="eventType" value={values.eventType} onChange={set('eventType')}>
          <option value="">—</option>
          {inquiryOptions.eventTypes.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Field>
        <Field label={t('inquiry.eventDate')} name="eventDate" type="date" value={values.eventDate} onChange={set('eventDate')} error={fieldError('eventDate')} />
        <Field label={t('inquiry.venue')} name="venue" value={values.venue} onChange={set('venue')} />
        <Field label={t('inquiry.coverage')} as="select" name="coverage" value={values.coverage} onChange={set('coverage')}>
          <option value="">—</option>
          <option value="Half day">{t('inquiry.coverage.half')}</option>
          <option value="Full day">{t('inquiry.coverage.full')}</option>
          <option value="Not sure yet">{t('inquiry.coverage.unsure')}</option>
        </Field>
        <Field label={t('inquiry.source')} as="select" name="source" value={values.source} onChange={set('source')}>
          <option value="">—</option>
          {inquiryOptions.sources.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Field>
      </div>
      <Field label={t('inquiry.message')} as="textarea" name="message" rows={5} value={values.message} onChange={set('message')} error={fieldError('message')} />

      {/* Honeypot: invisible to people, irresistible to bots. */}
      <div className="visually-hidden" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" name="website" value={values.website} onChange={set('website')} />
        </label>
      </div>

      <button type="submit" className="btn" disabled={status === 'sending'}>
        {status === 'sending' ? t('inquiry.sending') : t('inquiry.submit')}
      </button>
    </form>
  )
}
