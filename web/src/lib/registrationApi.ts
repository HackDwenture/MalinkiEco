import type { AuthFormState } from '../types'

const DEFAULT_BACKEND_URL = 'https://malinkieco-production.up.railway.app'

function backendUrl(path: string) {
  const base = (import.meta.env.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/$/, '')
  return `${base}${path}`
}

async function parseResponse(response: Response) {
  let payload: any = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(String(payload?.error || 'Не удалось выполнить запрос'))
  }

  return payload
}

export async function requestRegistrationEmailCode(email: string) {
  const response = await fetch(backendUrl('/api/email-verification/request'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  return parseResponse(response)
}

export async function verifyRegistrationEmailCode(email: string, code: string) {
  const response = await fetch(backendUrl('/api/email-verification/verify'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
  })

  return parseResponse(response) as Promise<{ ok: true; registerToken: string }>
}

export async function submitVerifiedRegistration(form: AuthFormState, registerToken: string) {
  const response = await fetch(backendUrl('/api/email-verification/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: form.login.trim(),
      login: form.login.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      phone: form.phone,
      plots: form.plots,
      registerToken,
    }),
  })

  return parseResponse(response)
}
