import { useState } from 'react'
import { Field } from '../ui/Field.jsx'
import { api, ApiError } from '../../services/api.js'
import { t } from '../../i18n/index.js'
import { inquiryOptions } from '../../content/site.js'

const empty = { name: '', eventType: '', eventDate: '', venue: '', mobile: '', coverage: '', source: '', message: '', website: '' }

// Fields the studio needs to reply, per variant (as required on the live forms; plus a name).
const requiredBy = {
  packages: ['name', 'mobile', 'coverage'],
  contact: ['name', 'venue', 'mobile'],
}

/**
 * The inquiry form. Both variants post to the same endpoint and land in Admin → Inquiries.
 * - "packages" (live fransstudios.com/packages-2): Full Name · Event Type · Event Date · City / Venue location ·
 *   Mobile · Estimated Coverage Time · How did you hear about us? · Message.
 * - "contact" (live fransstudios.com/contact-us): Name · Wedding / Session date · City / Venue location · Mobile · Message.
 */
export function InquiryForm({ variant = 'packages' }) {
  const isContact = variant === 'contact'
  const required = requiredBy[variant]
  const [values, setValues] = useState(empty)
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [error, setError] = useState(null)

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }))
  const fieldError = (name) => error?.fieldErrors?.[name]

  async function submit(e) {
    e.preventDefault()
    const missing = required.filter((k) => !values[k].trim())
    if (missing.length) {
      setError(new ApiError(400, { title: t('common.error'), errors: Object.fromEntries(missing.map((k) => [k, [t('inquiry.required')]])) }))
      e.currentTarget.querySelector(`[name="${missing[0]}"]`)?.focus()
      return
    }
    setStatus('sending')
    setError(null)
    try {
      await api('/api/public/inquiries', {
        method: 'POST',
        body: { ...values, eventDate: values.eventDate || null, email: null },
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
      <div className="inquiry-sent" role="status">
        <p className="inquiry-sent__title">Thank you!</p>
        <p>{t('inquiry.thanks')}</p>
      </div>
    )
  }

  const hasFieldErrors = error && Object.keys(error.fieldErrors).length > 0

  return (
    <form className="inquiry" onSubmit={submit} noValidate>
      {error && !hasFieldErrors && (
        <p className="form-error" role="alert">
          {error.message}
        </p>
      )}
      <Field
        label={t(isContact ? 'inquiry.nameShort' : 'inquiry.name')}
        name="name"
        autoComplete="name"
        required
        value={values.name}
        onChange={set('name')}
        error={fieldError('name')}
      />
      {!isContact && (
        <Field label={t('inquiry.eventType')} name="eventType" value={values.eventType} onChange={set('eventType')} error={fieldError('eventType')} />
      )}
      <Field
        label={t(isContact ? 'inquiry.sessionDate' : 'inquiry.eventDate')}
        name="eventDate"
        type="date"
        value={values.eventDate}
        onChange={set('eventDate')}
        error={fieldError('eventDate')}
      />
      <Field label={t('inquiry.venue')} name="venue" required={isContact} value={values.venue} onChange={set('venue')} error={fieldError('venue')} />
      <Field
        label={t('inquiry.mobile')}
        name="mobile"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder={t('inquiry.mobilePlaceholder')}
        required
        value={values.mobile}
        onChange={set('mobile')}
        error={fieldError('mobile')}
      />
      {!isContact && (
        <>
          <Field label={t('inquiry.coverage')} as="select" name="coverage" required value={values.coverage} onChange={set('coverage')} error={fieldError('coverage')}>
            <option value="" disabled>
              {t('inquiry.select')}
            </option>
            {inquiryOptions.coverage.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Field>
          <Field label={t('inquiry.source')} as="select" name="source" value={values.source} onChange={set('source')}>
            <option value="">{t('inquiry.select')}</option>
            {inquiryOptions.sources.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Field>
        </>
      )}
      <Field label={t('inquiry.message')} as="textarea" name="message" rows={4} value={values.message} onChange={set('message')} error={fieldError('message')} />

      {/* Honeypot: invisible to people, irresistible to bots. */}
      <div className="visually-hidden" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" name="website" value={values.website} onChange={set('website')} />
        </label>
      </div>

      <button type="submit" className="inquiry__submit" disabled={status === 'sending'}>
        {status === 'sending' ? t('inquiry.sending') : t('inquiry.submit')}
      </button>
    </form>
  )
}
