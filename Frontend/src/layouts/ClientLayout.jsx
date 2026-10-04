import { Link, Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { RequireRole, useAuth } from '../context/AuthContext.jsx'
import { t } from '../i18n/index.js'
import '../styles/client.css'

function ClientShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function signOut() {
    await logout()
    navigate('/client/login', { replace: true })
  }

  return (
    <div className="cl-shell">
      <header className="cl-bar">
        <Link to="/client" className="cl-brand" aria-label="Your galleries">
          <span className="cl-brand__word">Frans</span>
          <span className="cl-brand__sub">Studios</span>
        </Link>
        <div className="cl-bar__user">
          <span className="cl-bar__name">{user?.displayName}</span>
          <button type="button" className="cl-bar__logout" onClick={signOut}>
            {t('client.logout')}
          </button>
        </div>
      </header>
      <main className="cl-main">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  )
}

export default function ClientLayout() {
  return (
    <RequireRole role="client" loginPath="/client/login">
      <ClientShell />
    </RequireRole>
  )
}
