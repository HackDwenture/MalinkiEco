import type { AuditLogEntry } from '../types'

type LogsSectionProps = {
  logs: AuditLogEntry[]
  formatDateTime: (value: number) => string
}

export function LogsSection({ logs, formatDateTime }: LogsSectionProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow accent">Раздел</p>
        <h2>Логи</h2>
        <p>Служебные действия модераторов и администраторов.</p>
      </div>

      <div className="stack">
        {logs.length === 0 ? (
          <div className="chat-empty-inline">Пока нет записей в логах.</div>
        ) : (
          logs.map((log) => (
            <article key={log.id} className="event-card">
              <div className="event-meta">
                <span className="event-badge">{log.title}</span>
                <span>{formatDateTime(log.createdAtClient)}</span>
              </div>
              <h3>{log.actorName}</h3>
              <p>{log.message}</p>
              {(log.targetUserName || log.targetPlotName) && (
                <p className="hero-copy compact">
                  {log.targetUserName}
                  {log.targetUserName && log.targetPlotName ? ' · ' : ''}
                  {log.targetPlotName}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
