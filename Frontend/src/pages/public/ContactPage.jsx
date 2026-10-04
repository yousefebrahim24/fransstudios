import { usePageTitle } from '../../hooks/usePageTitle.js'
import { InquiryForm } from '../../components/public/InquiryForm.jsx'
import { faq, studio } from '../../content/site.js'
import { t } from '../../i18n/index.js'

export default function ContactPage() {
  usePageTitle('Contact')
  return (
    <div className="pub-page">
      <header className="page-head">
        <p className="eyebrow">Contact</p>
        <h1 className="page-head__title">This is where the magic begins</h1>
        <p className="page-head__lead">Write to us, message us on WhatsApp, or send the form — we reply to every inquiry personally.</p>
      </header>

      <div className="contact">
        <aside className="contact__ways" aria-label="Ways to reach us">
          <div className="contact__way">
            <h2 className="eyebrow">Email</h2>
            <a href={`mailto:${studio.email}`}>{studio.email}</a>
          </div>
          <div className="contact__way">
            <h2 className="eyebrow">Phone &amp; WhatsApp</h2>
            <a href={studio.phoneHref}>{studio.phoneDisplay}</a>
            <a href={studio.whatsappHref} target="_blank" rel="noopener noreferrer">
              Message on WhatsApp
            </a>
          </div>
          <div className="contact__way">
            <h2 className="eyebrow">Instagram</h2>
            <a href={studio.instagramHref} target="_blank" rel="noopener noreferrer">
              {studio.instagramHandle}
            </a>
          </div>
        </aside>

        <section className="contact__form" aria-labelledby="form-title">
          <h2 id="form-title" className="section-head__title">
            {t('inquiry.title')}
          </h2>
          <InquiryForm />
        </section>
      </div>

      <section className="pub-section faq" aria-labelledby="faq-title">
        <h2 id="faq-title" className="section-head__title">
          Frequently asked questions
        </h2>
        {faq.map((item) => (
          <details key={item.q} className="faq__item">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>
    </div>
  )
}
