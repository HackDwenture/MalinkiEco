export function SetupScreen() {
  return (
    <div className="shell">
      <section className="hero-card auth-card">
        <p className="eyebrow accent">Нужна настройка Firebase Web App</p>
        <h1>Веб-версия почти готова</h1>
        <p className="hero-copy">
          Осталось один раз зарегистрировать веб-приложение в Firebase и заполнить конфиг в
          <code> web/.env.local</code>.
        </p>
      </section>
    </div>
  )
}
