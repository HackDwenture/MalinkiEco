import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import './ResidentChat.css'

export type ResidentChatProfile = {
  id: string
  fullName: string
  plotName: string
  plots: string[]
  lastChatReadAt: number
}

export type ResidentChatUser = {
  id: string
  fullName: string
  plotName: string
  plots: string[]
}

export type ResidentChatMessage = {
  id: string
  senderId: string
  senderName: string
  senderPlotName: string
  text: string
  replyToMessageId: string
  replyToSenderName: string
  replyToSenderPlotName: string
  replyToText: string
  mentionedUserIds: string[]
  isPinned: boolean
  pinnedAtClient: number
  createdAtClient: number
  updatedAtClient: number
}

type ResidentChatProps = {
  profile: ResidentChatProfile
  users: ResidentChatUser[]
  messages: ResidentChatMessage[]
  readerCutoff: number
  onSend: (text: string, replyTo: ResidentChatMessage | null, mentionedUserIds: string[]) => Promise<void>
  onSaveEdit: (messageId: string, text: string) => Promise<void>
  onDelete: (message: ResidentChatMessage) => Promise<void>
  onTogglePin: (message: ResidentChatMessage) => Promise<void>
  onMarkRead: (latestSeen: number) => Promise<void>
}

type ChatMenuState = {
  message: ResidentChatMessage
  x: number
  y: number
}

const MENU_WIDTH = 196
const MENU_HEIGHT = 184
const MENU_GAP = 10
const EVERYONE_LABEL = '@все'

export function ResidentChat({
  profile,
  users,
  messages,
  readerCutoff,
  onSend,
  onSaveEdit,
  onDelete,
  onTogglePin,
  onMarkRead,
}: ResidentChatProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ResidentChatMessage | null>(null)
  const [editingId, setEditingId] = useState('')
  const [editingText, setEditingText] = useState('')
  const [menu, setMenu] = useState<ChatMenuState | null>(null)
  const [pinnedCursor, setPinnedCursor] = useState(0)
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false)
  const [selectedMentionedUsers, setSelectedMentionedUsers] = useState<ResidentChatUser[]>([])
  const [everyoneMentionActive, setEveryoneMentionActive] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previousLastMessageIdRef = useRef('')

  const mentionCandidates = useMemo(
    () =>
      users
        .filter((user) => user.id !== profile.id)
        .sort((left, right) => left.fullName.localeCompare(right.fullName, 'ru')),
    [profile.id, users],
  )

  const latestForeignTimestamp = useMemo(
    () => messages.filter((message) => message.senderId !== profile.id).at(-1)?.createdAtClient ?? 0,
    [messages, profile.id],
  )

  const markLatestAsRead = () => {
    if (latestForeignTimestamp > 0) {
      void onMarkRead(latestForeignTimestamp)
    }
  }

  useEffect(() => {
    markLatestAsRead()
  }, [latestForeignTimestamp])

  useEffect(() => {
    const handleFocus = () => markLatestAsRead()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        markLatestAsRead()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [latestForeignTimestamp])

  useEffect(() => {
    const list = listRef.current
    const lastMessageId = messages.at(-1)?.id ?? ''
    if (!list || !lastMessageId) return

    const isSameLastMessage = previousLastMessageIdRef.current === lastMessageId
    const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight
    const shouldStickToBottom = distanceToBottom < 72

    if (!isSameLastMessage || shouldStickToBottom) {
      requestAnimationFrame(() => {
        list.scrollTo({ top: list.scrollHeight, behavior: isSameLastMessage ? 'smooth' : 'auto' })
        markLatestAsRead()
      })
    }

    previousLastMessageIdRef.current = lastMessageId
  }, [messages, latestForeignTimestamp])

  useEffect(() => {
    if (!menu) return

    const closeMenu = () => setMenu(null)
    const closeByEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null)
      }
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('contextmenu', closeMenu)
    window.addEventListener('keydown', closeByEscape)

    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('contextmenu', closeMenu)
      window.removeEventListener('keydown', closeByEscape)
    }
  }, [menu])

  useEffect(() => {
    if (!input.trim()) {
      setSelectedMentionedUsers([])
      setEveryoneMentionActive(false)
      setMentionPickerOpen(false)
      return
    }

    setEveryoneMentionActive(input.includes(EVERYONE_LABEL))
    setMentionPickerOpen(input.endsWith('@'))
  }, [input])

  const pinnedMessages = useMemo(
    () => [...messages].filter((item) => item.isPinned).sort((a, b) => b.pinnedAtClient - a.pinnedAtClient),
    [messages],
  )

  const activePinnedMessage =
    pinnedMessages.length > 0 ? pinnedMessages[pinnedCursor % pinnedMessages.length] : null

  const openMenuAt = (message: ResidentChatMessage, rect: DOMRect, alignRight: boolean) => {
    const preferredX = alignRight ? rect.right - MENU_WIDTH : rect.left
    const preferredY = rect.bottom + MENU_GAP
    const nextX = Math.max(12, Math.min(preferredX, window.innerWidth - MENU_WIDTH - 12))
    const nextY = Math.max(12, Math.min(preferredY, window.innerHeight - MENU_HEIGHT - 12))
    setMenu({ message, x: nextX, y: nextY })
  }

  const openContextMenu = (event: React.MouseEvent<HTMLElement>, message: ResidentChatMessage) => {
    event.preventDefault()
    event.stopPropagation()
    openMenuAt(message, event.currentTarget.getBoundingClientRect(), message.senderId === profile.id)
  }

  const openTouchMenu = (element: HTMLElement, message: ResidentChatMessage) => {
    openMenuAt(message, element.getBoundingClientRect(), message.senderId === profile.id)
  }

  const formatUserPlots = (user: ResidentChatUser) => {
    const normalizedPlots = user.plots
      .map((plot) => plot.trim())
      .filter(Boolean)
      .map((plot) => plot.replace(/^Участок\s*/i, '').trim())

    if (normalizedPlots.length > 0) {
      return `Участок ${normalizedPlots.join(', ')}`
    }

    const singlePlot = user.plotName.trim().replace(/^Участок\s*/i, '').trim()
    if (!singlePlot) return ''
    return `Участок ${singlePlot}`
  }

  const insertMentionToken = (token: string, selectedUser?: ResidentChatUser) => {
    const atIndex = input.lastIndexOf('@')
    const updatedText = atIndex >= 0 ? `${input.slice(0, atIndex)}${token} ` : `${input}${token} `

    if (selectedUser) {
      setSelectedMentionedUsers((current) =>
        current.some((item) => item.id === selectedUser.id) ? current : [...current, selectedUser],
      )
    }
    if (token === EVERYONE_LABEL) {
      setEveryoneMentionActive(true)
    }

    setMentionPickerOpen(false)
    setInput(updatedText)

    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(updatedText.length, updatedText.length)
    })
  }

  const resolveMentionedUserIds = (text: string) => {
    const mentionedIds = new Set<string>()

    selectedMentionedUsers.forEach((user) => {
      if (text.includes(`@${user.fullName}`)) {
        mentionedIds.add(user.id)
      }
    })

    if (text.includes(EVERYONE_LABEL)) {
      mentionCandidates.forEach((user) => mentionedIds.add(user.id))
    }

    return Array.from(mentionedIds)
  }

  const handleSend = async () => {
    const normalized = input.trim()
    if (!normalized || sending) return

    const mentionedUserIds = resolveMentionedUserIds(normalized)

    setSending(true)
    try {
      await onSend(normalized, replyingTo, mentionedUserIds)
      setInput('')
      setReplyingTo(null)
      setSelectedMentionedUsers([])
      setEveryoneMentionActive(false)
      setMentionPickerOpen(false)
    } finally {
      setSending(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const normalized = editingText.trim()
    if (!normalized) return
    await onSaveEdit(editingId, normalized)
    setEditingId('')
    setEditingText('')
  }

  const startEdit = (message: ResidentChatMessage) => {
    setEditingId(message.id)
    setEditingText(message.text)
    setMenu(null)
  }

  const startReply = (message: ResidentChatMessage) => {
    setReplyingTo(message)
    setMenu(null)
  }

  const cancelEdit = () => {
    setEditingId('')
    setEditingText('')
  }

  const scrollToMessage = (messageId: string) => {
    document.getElementById(`chat-message-${messageId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  const readStatusLabel = (message: ResidentChatMessage) => {
    if (message.senderId !== profile.id) return ''
    return message.createdAtClient <= readerCutoff ? '✓✓' : '✓'
  }

  return (
    <section className="panel resident-chat" onClick={() => setMenu(null)}>
      <div className="panel-heading">
        <p className="eyebrow accent">Раздел</p>
        <h2>Чат поселка</h2>
        <p>Общий чат собственников с ответами, редактированием сообщений, закреплением и упоминаниями.</p>
      </div>

      {activePinnedMessage && (
        <button
          className="resident-chat__pinned"
          onClick={(event) => {
            event.stopPropagation()
            scrollToMessage(activePinnedMessage.id)
            if (pinnedMessages.length > 1) {
              setPinnedCursor((current) => (current + 1) % pinnedMessages.length)
            }
          }}
        >
          <span className="resident-chat__pinned-count">
            Закрепленное сообщение {Math.min(pinnedCursor + 1, pinnedMessages.length)} из {pinnedMessages.length}
          </span>
          <strong className="resident-chat__pinned-title">
            {activePinnedMessage.senderName}
            {activePinnedMessage.senderPlotName ? ` · ${activePinnedMessage.senderPlotName}` : ''}
          </strong>
          <span className="resident-chat__pinned-body">{activePinnedMessage.text}</span>
        </button>
      )}

      <div
        ref={listRef}
        className="resident-chat__list"
        onScroll={(event) => {
          const list = event.currentTarget
          const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight
          if (distanceToBottom < 72) {
            markLatestAsRead()
          }
        }}
      >
        {messages.length === 0 ? (
          <div className="resident-chat__empty">Сообщений пока нет</div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === profile.id
            const isEditing = editingId === message.id
            const mentionedMe = message.mentionedUserIds.includes(profile.id)

            return (
              <article
                id={`chat-message-${message.id}`}
                key={message.id}
                className={`resident-chat__bubble ${isMine ? 'is-mine' : 'is-other'} ${message.isPinned ? 'is-pinned' : ''} ${mentionedMe ? 'is-mentioned' : ''}`}
                onContextMenu={(event) => openContextMenu(event, message)}
                onTouchStart={(event) => {
                  const element = event.currentTarget as HTMLElement
                  const timer = window.setTimeout(() => openTouchMenu(element, message), 420)
                  element.dataset.longPressTimer = String(timer)
                }}
                onTouchEnd={(event) => {
                  const element = event.currentTarget as HTMLElement
                  const timer = Number(element.dataset.longPressTimer ?? '0')
                  if (timer) window.clearTimeout(timer)
                  element.dataset.longPressTimer = ''
                }}
                onTouchMove={(event) => {
                  const element = event.currentTarget as HTMLElement
                  const timer = Number(element.dataset.longPressTimer ?? '0')
                  if (timer) window.clearTimeout(timer)
                  element.dataset.longPressTimer = ''
                }}
              >
                <div className="resident-chat__meta">
                  <span className="resident-chat__author">
                    {message.senderName}
                    {message.senderPlotName ? ` · ${message.senderPlotName}` : ''}
                  </span>
                  <span className="resident-chat__time">{formatTime(message.createdAtClient)}</span>
                </div>

                {isEditing ? (
                  <div className="resident-chat__edit">
                    <textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={3} />
                    <div className="resident-chat__edit-actions">
                      <button className="primary-button" onClick={() => void handleSaveEdit()}>
                        Сохранить
                      </button>
                      <button className="ghost-button" onClick={cancelEdit}>
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {message.replyToMessageId && (
                      <button
                        className="resident-chat__reply-preview"
                        onClick={(event) => {
                          event.stopPropagation()
                          scrollToMessage(message.replyToMessageId)
                        }}
                      >
                        <strong>
                          {message.replyToSenderName}
                          {message.replyToSenderPlotName ? ` · ${message.replyToSenderPlotName}` : ''}
                        </strong>
                        <span>{message.replyToText || 'Сообщение удалено'}</span>
                      </button>
                    )}

                    <p className="resident-chat__text">{message.text}</p>

                    <div className="resident-chat__footer">
                      <span className="resident-chat__flags">
                        {mentionedMe && <span className="resident-chat__flag is-mention">вас отметили</span>}
                        {message.updatedAtClient > 0 && <span className="resident-chat__flag">изменено</span>}
                        {message.isPinned && <span className="resident-chat__flag">закреплено сверху</span>}
                      </span>
                      {isMine && <span className="resident-chat__ticks">{readStatusLabel(message)}</span>}
                    </div>
                  </>
                )}
              </article>
            )
          })
        )}
      </div>

      <div className="resident-chat__compose">
        {replyingTo && (
          <div className="resident-chat__replying">
            <div className="resident-chat__replying-text">
              <strong>
                {replyingTo.senderName}
                {replyingTo.senderPlotName ? ` · ${replyingTo.senderPlotName}` : ''}
              </strong>
              <span>{replyingTo.text}</span>
            </div>
            <button className="ghost-button" onClick={() => setReplyingTo(null)}>
              Отменить
            </button>
          </div>
        )}

        <div className="resident-chat__compose-box" onClick={(event) => event.stopPropagation()}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Введите сообщение для общего чата..."
            rows={3}
          />

          {mentionPickerOpen && (
            <div className="resident-chat__mention-picker">
              {mentionCandidates.length === 0 ? (
                <div className="resident-chat__mention-empty">Пока некого отмечать</div>
              ) : (
                <>
                  <button
                    className={`resident-chat__mention-option ${everyoneMentionActive ? 'is-selected' : ''}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertMentionToken(EVERYONE_LABEL)}
                  >
                    <strong>{EVERYONE_LABEL}</strong>
                    <span>Уведомить всех собственников</span>
                  </button>

                  {mentionCandidates.map((user) => {
                    const plots = formatUserPlots(user)
                    const selected = selectedMentionedUsers.some((item) => item.id === user.id)

                    return (
                      <button
                        key={user.id}
                        className={`resident-chat__mention-option ${selected ? 'is-selected' : ''}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertMentionToken(`@${user.fullName}`, user)}
                      >
                        <strong>@{user.fullName}</strong>
                        <span>{plots || 'Без участка'}</span>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>

        <div className="resident-chat__compose-actions">
          <span className="resident-chat__hint">Напишите `@`, чтобы выбрать `@все` или конкретного собственника.</span>
          <button className="primary-button" onClick={() => void handleSend()} disabled={sending}>
            {sending ? 'Отправляем...' : 'Отправить'}
          </button>
        </div>
      </div>

      {menu &&
        createPortal(
          <div
            className="resident-chat__menu"
            style={{ left: menu.x, top: menu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="resident-chat__menu-item" onClick={() => startReply(menu.message)}>
              Ответить
            </button>
            <button
              className="resident-chat__menu-item"
              onClick={() => startEdit(menu.message)}
              disabled={menu.message.senderId !== profile.id}
            >
              Редактировать
            </button>
            <button
              className="resident-chat__menu-item"
              onClick={async () => {
                await onTogglePin(menu.message)
                setMenu(null)
              }}
            >
              {menu.message.isPinned ? 'Открепить' : 'Закрепить'}
            </button>
            <button
              className="resident-chat__menu-item is-danger"
              onClick={async () => {
                await onDelete(menu.message)
                setMenu(null)
              }}
              disabled={menu.message.senderId !== profile.id}
            >
              Удалить
            </button>
          </div>,
          document.body,
        )}
    </section>
  )
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}
