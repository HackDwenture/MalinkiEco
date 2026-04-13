import { SiteFooter } from './SiteFooter'

export function MaintenanceScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="shell">
      <section className="hero-card auth-card">
        <div className="brand-title-row">
          <p className="eyebrow accent">MalinkiEco</p>
          <span className="brand-badge">WEB</span>
        </div>
        <h1>{title}</h1>
        <p className="hero-copy">{message}</p>
      </section>
      <SiteFooter />
    </div>
  )
}
