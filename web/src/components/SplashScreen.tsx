export function SplashScreen({ message }: { message: string }) {
  return (
    <div className="shell">
      <section className="hero-card auth-card">
        <div className="brand-title-row">
          <p className="eyebrow accent">MalinkiEco</p>
          <span className="brand-badge">WEB</span>
        </div>
        <h1>{message}</h1>
      </section>
    </div>
  )
}
