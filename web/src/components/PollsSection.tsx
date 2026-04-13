import { useMemo, useState, type ChangeEvent } from 'react'
import type { CommunityEvent, PollDraft, RemoteUser } from '../types'

type PollsSectionProps = {
  profile: RemoteUser
  pollDraft: PollDraft
  pollSubmitting: boolean
  polls: CommunityEvent[]
  onFieldChange: (field: keyof PollDraft, value: string) => void
  onSubmit: () => void | Promise<void>
  onVote: (poll: CommunityEvent, option: string) => void | Promise<void>
  onClosePoll: (poll: CommunityEvent) => void | Promise<void>
  formatDateTime: (value: number) => string
}

export function PollsSection({
  profile,
  pollDraft,
  pollSubmitting,
  polls,
  onFieldChange,
  onSubmit,
  onVote,
  onClosePoll,
  formatDateTime,
}: PollsSectionProps) {
  const [isCreateExpanded, setIsCreateExpanded] = useState(false)
  const [formError, setFormError] = useState('')

  const sortedPolls = useMemo(
    () => [...polls].sort((left, right) => Number(right.createdAtClient ?? 0) - Number(left.createdAtClient ?? 0)),
    [polls],
  )

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow accent">Раздел</p>
        <h2>Опросы</h2>
        <p>Здесь можно голосовать и создавать свои опросы для жителей прямо в веб-версии.</p>
      </div>

      <div className="poll-create-card">
        <div className="poll-create-card__header">
          <div>
            <h3>Создать опрос</h3>
            <p>Новый опрос появится в общей ленте сразу после публикации.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setIsCreateExpanded((current) => !current)}>
            {isCreateExpanded ? 'Свернуть' : 'Развернуть'}
          </button>
        </div>

        {isCreateExpanded && (
          <div className="poll-create">
            <input
              value={pollDraft.title}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onFieldChange('title', event.target.value)
                if (formError) setFormError('')
              }}
              placeholder="Заголовок опроса"
            />
            <textarea
              value={pollDraft.message}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onFieldChange('message', event.target.value)}
              placeholder="Описание опроса"
              rows={3}
            />
            <textarea
              value={pollDraft.options}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                onFieldChange('options', event.target.value)
                if (formError) setFormError('')
              }}
              placeholder={'Варианты ответов, каждый с новой строки\nДа\nНет'}
              rows={4}
            />
            {formError && <p className="error-note">{formError}</p>}
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                if (!pollDraft.title.trim()) {
                  setFormError('Введите заголовок опроса.')
                  return
                }
                const options = pollDraft.options
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean)
                if (options.length < 2) {
                  setFormError('Добавьте минимум два варианта ответа.')
                  return
                }
                setFormError('')
                void onSubmit()
              }}
              disabled={pollSubmitting}
            >
              {pollSubmitting ? 'Создаем...' : 'Создать опрос'}
            </button>
          </div>
        )}
      </div>

      <div className="stack">
        {sortedPolls.length === 0 ? (
          <div className="chat-empty-inline">Сейчас нет активных опросов.</div>
        ) : (
          sortedPolls.map((poll) => {
            const votedOption = poll.voterChoices[profile.id]
            const canClosePoll =
              !poll.isClosed && (poll.createdById === profile.id || profile.role === 'MODERATOR' || profile.role === 'ADMIN')

            return (
              <article key={poll.id} className="poll-card">
                <div className="poll-card__header">
                  <div className="event-meta">
                    <span className="event-badge">{poll.isClosed ? 'Опрос закрыт' : 'Опрос активен'}</span>
                    <span>{formatDateTime(poll.createdAtClient)}</span>
                  </div>
                  {canClosePoll && (
                    <button className="ghost-button" type="button" onClick={() => void onClosePoll(poll)}>
                      Закрыть опрос
                    </button>
                  )}
                </div>

                <h3>{poll.title}</h3>
                {poll.message.trim() && <p>{poll.message}</p>}
                {poll.createdByName && <p className="hero-copy compact">Создал: {poll.createdByName}</p>}

                <div className="poll-options">
                  {poll.pollOptions.map((option) => (
                    <button
                      key={option}
                      className={`poll-option ${votedOption === option ? 'is-selected' : ''}`}
                      disabled={Boolean(votedOption) || poll.isClosed}
                      onClick={() => void onVote(poll, option)}
                    >
                      <span>{option}</span>
                      <strong>{poll.pollVotes[option] ?? 0}</strong>
                    </button>
                  ))}
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
