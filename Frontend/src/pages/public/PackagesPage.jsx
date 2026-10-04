import { useApi } from '../../hooks/useApi.js'
import { usePageTitle } from '../../hooks/usePageTitle.js'
import { InquiryForm } from '../../components/public/InquiryForm.jsx'
import { t } from '../../i18n/index.js'

function formatPrice(p) {
  if (p.price == null) return p.priceNote
  const amount = new Intl.NumberFormat('en', { style: p.currency ? 'currency' : 'decimal', currency: p.currency ?? undefined, maximumFractionDigits: 0 }).format(p.price)
  return [p.priceNote, amount].filter(Boolean).join(' ')
}

/**
 * Inquiry-first. Package tiers appear above the form only once the studio publishes them
 * in the admin dashboard (none are invented here).
 */
export default function PackagesPage() {
  usePageTitle('Packages')
  const { data: packages } = useApi('/api/public/packages')

  return (
    <div className="pub-page">
      <header className="page-head">
        <p className="eyebrow">Packages</p>
        <h1 className="page-head__title">Where your journey begins</h1>
        <p className="page-head__lead">
          Every wedding is different. Tell us about yours — the date, the venue and how much of the day you’d like covered — and we’ll send our
          packages and availability.
        </p>
      </header>

      {packages?.length > 0 && (
        <section className="packages" aria-label="Packages">
          {packages.map((p) => (
            <article key={p.id} className="package">
              <h2 className="package__name">{p.name}</h2>
              {formatPrice(p) && <p className="package__price">{formatPrice(p)}</p>}
              {p.summary && <p className="package__summary">{p.summary}</p>}
              {p.features.length > 0 && (
                <ul className="package__features">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      )}

      <section className="inquiry-section" aria-labelledby="inquiry-title">
        <h2 id="inquiry-title" className="section-head__title">
          {t('inquiry.title')}
        </h2>
        <InquiryForm />
      </section>
    </div>
  )
}
