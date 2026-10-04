import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../services/api.js'
import { Field, Checkbox } from '../../components/ui/Field.jsx'
import { CredentialsDialog, ErrorBanner, PageHeader } from '../../components/admin/AdminUi.jsx'

/** Suggests "sara.ahmed" from "Sara Ahmed". */
function suggestUsername(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 64)
}

export default function ClientNewPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', username: '', email: '', phone: '', notes: '', password: '' })
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [customPassword, setCustomPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)

  const set = (name) => (e) => {
    const value = e.target.value
    setForm((f) => ({
      ...f,
      [name]: value,
      ...(name === 'fullName' && !usernameTouched ? { username: suggestUsername(value) } : {}),
    }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await api('/api/admin/clients', {
        method: 'POST',
        body: { ...form, password: customPassword ? form.password : null, email: form.email || null },
      })
      setCreated(result)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const fe = (name) => error?.fieldErrors?.[name]

  return (
    <>
      <PageHeader title="New client" subtitle="Creates the client and their gallery login." back={<Link to="/admin/clients" className="adm-back">← Clients</Link>} />
      <form className="adm-card adm-form" onSubmit={submit}>
        <ErrorBanner error={error} />
        <Field label="Full name" placeholder="Sara & Ahmed" required value={form.fullName} onChange={set('fullName')} error={fe('fullName')} />
        <Field
          label="Username"
          hint="Used to sign in. Letters, numbers, dots, dashes."
          required
          autoCapitalize="none"
          spellCheck={false}
          value={form.username}
          onChange={(e) => {
            setUsernameTouched(true)
            set('username')(e)
          }}
          error={fe('username')}
        />
        <div className="adm-form__row">
          <Field label="Email (optional)" type="email" value={form.email} onChange={set('email')} error={fe('email')} />
          <Field label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} error={fe('phone')} />
        </div>
        <Field label="Private notes (optional)" as="textarea" rows={3} value={form.notes} onChange={set('notes')} />
        <Checkbox label="Set the password myself" hint="Otherwise a strong password is generated for you." checked={customPassword} onChange={(e) => setCustomPassword(e.target.checked)} />
        {customPassword && <Field label="Password" type="text" autoComplete="new-password" minLength={10} value={form.password} onChange={set('password')} error={fe('password')} hint="At least 10 characters." />}
        <div className="adm-form__actions">
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create client'}
          </button>
        </div>
      </form>

      <CredentialsDialog
        credentials={created}
        onClose={() => navigate(`/admin/albums/new?clientId=${created.clientId}`)}
        title="Client created — login details"
      />
    </>
  )
}
