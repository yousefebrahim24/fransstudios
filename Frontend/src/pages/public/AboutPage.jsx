import { Link } from 'react-router'
import { usePageTitle } from '../../hooks/usePageTitle.js'
import { founder, team, testimonials } from '../../content/site.js'

export default function AboutPage() {
  usePageTitle('About Us')
  return (
    <div className="pub-page">
      <header className="page-head">
        <p className="eyebrow">About us</p>
        <h1 className="page-head__title">Your visual storytellers</h1>
        <p className="page-head__lead">
          We’re a team of wedding photographers and cinematographers driven by a love for storytelling and a passion for capturing emotion.
        </p>
      </header>

      <section className="about-founder" aria-labelledby="founder-title">
        <p className="eyebrow">Founder &amp; lead photographer</p>
        <h2 id="founder-title" className="about-founder__name">
          {founder.name}
        </h2>
        <p className="about-founder__lead">{founder.lead}</p>
        <div className="prose">
          {founder.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      <section className="pub-section about-team" aria-labelledby="team-title">
        <p className="eyebrow">Meet our family</p>
        <h2 id="team-title" className="section-head__title">
          The team behind every story
        </h2>
        <ul className="team-list" role="list">
          {team.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </section>

      {testimonials.length > 0 && (
        <section className="pub-section" aria-labelledby="words-title">
          <p className="eyebrow">Kind words</p>
          <h2 id="words-title" className="section-head__title">
            From our couples
          </h2>
          <div className="testimonials">
            {testimonials.map((q) => (
              <figure key={q.couple} className="testimonial">
                <blockquote>“{q.quote}”</blockquote>
                <figcaption>{q.couple}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="pub-section home-cta">
        <h2>Let’s create something timeless</h2>
        <Link to="/contact" className="btn">
          Contact us
        </Link>
      </section>
    </div>
  )
}
