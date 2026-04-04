export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__copy">
          <span>{year} Rethavo Systems. Все права защищены.</span>
        </div>
        <div className="site-footer__links">
          <a href="https://rethavo.ru" target="_blank" rel="noreferrer">
            rethavo.ru
          </a>
          <a href="mailto:info@rethavo.ru">info@rethavo.ru</a>
        </div>
      </div>
    </footer>
  )
}
