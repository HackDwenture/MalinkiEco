import { useEffect, useMemo, useState } from 'react'
import type { NotificationSettings, RemoteUser } from '../types'

type AccountSettingsPanelProps = {
  profile: RemoteUser
  open: boolean
  savingProfileRequest: boolean
  savingNotificationSettings: boolean
  webPushTitle: string
  webPushDescription: string
  webPushActionLabel: string | null
  webPushBusy: boolean
  onClose: () => void
  onLogout: () => void | Promise<void>
  onWebPushAction: () => void | Promise<void>
  onSubmitProfileChangeRequest: (payload: { fullName: string; phone: string }) => void | Promise<void>
  onUpdateNotificationSettings: (settings: NotificationSettings) => void | Promise<void>
}

const BASE_TOGGLES: Array<{ key: keyof NotificationSettings; label: string }> = [
  { key: 'events', label: 'События и объявления' },
  { key: 'chat', label: 'Чат' },
  { key: 'mentions', label: 'Упоминания' },
  { key: 'polls', label: 'Опросы' },
  { key: 'payments', label: 'Оплаты и сборы' },
  { key: 'system', label: 'Системные уведомления' },
]

const STAFF_TOGGLES: Array<{ key: keyof NotificationSettings; label: string }> = [
  { key: 'requests', label: 'Заявки от пользователей' },
]

export function AccountSettingsPanel({
  profile,
  open,
  savingProfileRequest,
  savingNotificationSettings,
  webPushTitle,
  webPushDescription,
  webPushActionLabel,
  webPushBusy,
  onClose,
  onLogout,
  onWebPushAction,
  onSubmitProfileChangeRequest,
  onUpdateNotificationSettings,
}: AccountSettingsPanelProps) {
  const [fullName, setFullName] = useState(profile.fullName)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [settings, setSettings] = useState<NotificationSettings>(profile.notificationSettings)

  const isStaff = profile.role === 'ADMIN' || profile.role === 'MODERATOR'
  const toggles = useMemo(
    () => (isStaff ? [...BASE_TOGGLES, ...STAFF_TOGGLES] : BASE_TOGGLES),
    [isStaff],
  )

  useEffect(() => {
    if (!open) return
    setFullName(profile.fullName)
    setPhone(profile.phone ?? '')
    setSettings(profile.notificationSettings)
  }, [open, profile.fullName, profile.phone, profile.notificationSettings])

  if (!open) return null

  const updateToggle = (key: keyof NotificationSettings, checked: boolean) => {
    const nextSettings = { ...settings, [key]: checked }
    setSettings(nextSettings)
    void onUpdateNotificationSettings(nextSettings)
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-panel__header">
          <h3>Настройки</h3>
          <button className="ghost-button" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <section className="settings-panel__section">
          <h4>Изменение данных</h4>
          <p>Имя и телефон обновятся после одобрения модератором или администратором.</p>
          <label>
            <span>Имя</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label>
            <span>Телефон</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button
            className="primary-button"
            type="button"
            disabled={savingProfileRequest}
            onClick={() => void onSubmitProfileChangeRequest({ fullName, phone })}
          >
            {savingProfileRequest ? 'Отправляем...' : 'Отправить запрос на изменение'}
          </button>
        </section>

        <section className="settings-panel__section">
          <h4>Push для веб-версии</h4>
          <div className="settings-push-card">
            <div className="settings-push-card__copy">
              <strong>{webPushTitle}</strong>
              <p>{webPushDescription}</p>
            </div>
            {webPushActionLabel ? (
              <button className="ghost-button" type="button" disabled={webPushBusy} onClick={() => void onWebPushAction()}>
                {webPushActionLabel}
              </button>
            ) : null}
          </div>
        </section>

        <section className="settings-panel__section">
          <h4>Уведомления</h4>
          <div className="settings-toggles">
            {toggles.map((toggle) => (
              <label key={toggle.key} className="poll-anonymous-toggle" htmlFor={`settings-toggle-${toggle.key}`}>
                <input
                  id={`settings-toggle-${toggle.key}`}
                  type="checkbox"
                  checked={settings[toggle.key]}
                  disabled={savingNotificationSettings}
                  onChange={(event) => updateToggle(toggle.key, event.target.checked)}
                />
                <span className="poll-anonymous-toggle__track" aria-hidden="true">
                  <span className="poll-anonymous-toggle__thumb" />
                </span>
                <span className="poll-anonymous-toggle__label">{toggle.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-panel__section">
          <button className="danger-button" type="button" onClick={() => void onLogout()}>
            Выйти
          </button>
        </section>
      </div>
    </div>
  )
}
