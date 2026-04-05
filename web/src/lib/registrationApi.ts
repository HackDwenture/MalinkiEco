import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { AuthFormState } from '../types'
import { isValidRussianPhoneInput, normalizeAuthEmail, normalizeRussianPhone, parsePlots } from '../utils'
import { auth, db, firebaseSetup } from './firebase'

function ensureFirebaseReady() {
  if (!firebaseSetup.ready || !auth || !db) {
    throw new Error('Firebase еще не готов. Обновите страницу и попробуйте снова.')
  }

  return { auth, db }
}

function extractFirebaseErrorCode(error: unknown) {
  const value = error as { code?: string; message?: string }
  return String(value?.code ?? value?.message ?? '')
}

async function readRegistrationState(userId: string) {
  const { db } = ensureFirebaseReady()
  const [profileSnapshot, requestSnapshot] = await Promise.all([
    getDoc(doc(db, 'users', userId)),
    getDoc(doc(db, 'registration_requests', userId)),
  ])

  return {
    hasProfile: profileSnapshot.exists(),
    requestStatus: String(requestSnapshot.data()?.status ?? ''),
  }
}

async function ensureRegistrationUser(email: string, password: string) {
  const { auth } = ensureFirebaseReady()
  const normalizedEmail = normalizeAuthEmail(email)

  try {
    return await signInWithEmailAndPassword(auth, normalizedEmail, password)
  } catch (signInError) {
    const signInCode = extractFirebaseErrorCode(signInError)
    const canCreateNewUser =
      signInCode.includes('auth/invalid-credential') ||
      signInCode.includes('auth/invalid-login-credentials') ||
      signInCode.includes('auth/user-not-found')

    if (!canCreateNewUser) {
      throw signInError
    }

    try {
      return await createUserWithEmailAndPassword(auth, normalizedEmail, password)
    } catch (createError) {
      const createCode = extractFirebaseErrorCode(createError)
      if (createCode.includes('auth/email-already-in-use')) {
        throw new Error('Для этой почты уже создан аккаунт. Введите правильный пароль или используйте вход.')
      }
      throw createError
    }
  }
}

export async function requestRegistrationEmailCode(email: string, password: string) {
  const { auth } = ensureFirebaseReady()
  if (password.trim().length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов.')
  }

  const credential = await ensureRegistrationUser(email, password)

  try {
    const state = await readRegistrationState(credential.user.uid)
    if (state.hasProfile) {
      throw new Error('Аккаунт уже одобрен. Используйте вход.')
    }
    if (state.requestStatus === 'PENDING') {
      throw new Error('Заявка уже передана модераторам. Дождитесь одобрения.')
    }

    await sendEmailVerification(credential.user)
  } finally {
    await signOut(auth)
  }

  return { ok: true as const }
}

export async function verifyRegistrationEmailCode(email: string, password: string) {
  const { auth } = ensureFirebaseReady()
  const credential = await signInWithEmailAndPassword(auth, normalizeAuthEmail(email), password)

  try {
    const state = await readRegistrationState(credential.user.uid)
    if (state.hasProfile) {
      throw new Error('Аккаунт уже одобрен. Используйте вход.')
    }

    await reload(credential.user)
    if (!credential.user.emailVerified) {
      throw new Error('Подтвердите адрес по ссылке из письма, затем нажмите проверить снова.')
    }

    return { ok: true as const, registerToken: credential.user.uid }
  } finally {
    await signOut(auth)
  }
}

export async function submitVerifiedRegistration(form: AuthFormState, registerToken: string) {
  const { auth, db } = ensureFirebaseReady()
  const email = normalizeAuthEmail(form.login.trim())
  const fullName = form.fullName.trim()
  const phone = normalizeRussianPhone(form.phone)
  const plots = parsePlots(form.plots)

  if (!fullName) {
    throw new Error('Введите отображаемое имя.')
  }
  if (!isValidRussianPhoneInput(form.phone)) {
    throw new Error('Номер телефона должен содержать 10 цифр после 8.')
  }
  if (plots.length === 0) {
    throw new Error('Укажите хотя бы один участок.')
  }

  const credential = await signInWithEmailAndPassword(auth, email, form.password)

  try {
    await reload(credential.user)
    if (!credential.user.emailVerified) {
      throw new Error('Сначала подтвердите электронную почту по ссылке из письма.')
    }
    if (registerToken && registerToken !== credential.user.uid) {
      throw new Error('Подтвердите электронную почту заново и попробуйте еще раз.')
    }

    const state = await readRegistrationState(credential.user.uid)
    if (state.hasProfile) {
      throw new Error('Аккаунт уже одобрен. Используйте вход.')
    }
    if (state.requestStatus === 'PENDING') {
      throw new Error('Заявка уже передана модераторам. Дождитесь одобрения.')
    }

    await setDoc(doc(db, 'registration_requests', credential.user.uid), {
      login: form.login.trim(),
      authEmail: email,
      fullName,
      phone,
      plots,
      status: 'PENDING',
      reviewedById: '',
      reviewedByName: '',
      reviewReason: '',
      createdAt: serverTimestamp(),
      createdAtClient: Date.now(),
    })
  } finally {
    await signOut(auth)
  }

  return { ok: true as const }
}
