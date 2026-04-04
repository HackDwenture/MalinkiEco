import type { FormEvent } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { INITIAL_AUTH_FORM } from '../constants'
import { auth, db, firebaseSetup } from '../lib/firebase'
import {
  requestRegistrationEmailCode,
  submitVerifiedRegistration,
  verifyRegistrationEmailCode,
} from '../lib/registrationApi'
import type { AuthFormState, AuthMode } from '../types'
import { humanizeError, isValidRussianPhoneInput, normalizeAuthEmail, parsePlots } from '../utils'

const PENDING_REGISTRATION_MESSAGE =
  'Заявка уже передана модераторам. Дождитесь одобрения и попробуйте войти снова.'
const SUBMITTED_REGISTRATION_MESSAGE =
  'Заявка передана модераторам. Дождитесь одобрения, после этого вы сможете войти.'
const REJECTED_REGISTRATION_FALLBACK =
  'Заявка на регистрацию была отклонена. Обратитесь к модератору или администратору.'
const REGISTRATION_REQUIRED_MESSAGE =
  'Для входа сначала нужно отправить заявку на регистрацию.'

export function useResidentAuth() {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState<AuthFormState>(INITIAL_AUTH_FORM)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [verificationSending, setVerificationSending] = useState(false)
  const [verificationChecking, setVerificationChecking] = useState(false)
  const [verificationSentTo, setVerificationSentTo] = useState('')
  const [verificationApprovedFor, setVerificationApprovedFor] = useState('')
  const [registerToken, setRegisterToken] = useState('')

  const clearAuthMessages = useCallback(() => {
    setAuthError('')
    setAuthSuccess('')
  }, [])

  const resetVerificationState = useCallback(() => {
    setVerificationSentTo('')
    setVerificationApprovedFor('')
    setRegisterToken('')
  }, [])

  const updateAuthField = useCallback((field: keyof AuthFormState, value: string) => {
    setAuthForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'login' && value.trim() !== verificationSentTo) {
        setVerificationSentTo('')
        setVerificationApprovedFor('')
        setRegisterToken('')
      }
      return next
    })
  }, [verificationSentTo])

  const switchAuthMode = useCallback((mode: AuthMode) => {
    setAuthMode(mode)
    clearAuthMessages()
    if (mode === 'register') {
      resetVerificationState()
    }
  }, [clearAuthMessages, resetVerificationState])

  const registrationEmail = useMemo(() => authForm.login.trim().toLowerCase(), [authForm.login])
  const isRegistrationEmailVerified = registrationEmail !== '' && verificationApprovedFor === registrationEmail && !!registerToken

  const handleMissingProfileAccess = useCallback(async (userId: string) => {
    if (!db || !auth) return

    const requestSnapshot = await getDoc(doc(db, 'registration_requests', userId))
    const requestData = requestSnapshot.exists() ? requestSnapshot.data() : null
    const requestStatus = String(requestData?.status ?? '')
    const reviewReason = String(requestData?.reviewReason ?? '').trim()

    setAuthMode('login')
    if (requestStatus === 'PENDING') {
      setAuthSuccess(PENDING_REGISTRATION_MESSAGE)
      setAuthError('')
    } else if (requestStatus === 'REJECTED') {
      setAuthSuccess('')
      setAuthError(reviewReason ? `Заявка отклонена. Причина: ${reviewReason}` : REJECTED_REGISTRATION_FALLBACK)
    } else {
      setAuthSuccess('')
      setAuthError(REGISTRATION_REQUIRED_MESSAGE)
    }

    await signOut(auth)
  }, [])

  const validateRegistrationForm = useCallback(() => {
    if (!authForm.login.trim()) {
      return 'Укажите электронную почту.'
    }
    if (!authForm.login.includes('@')) {
      return 'Для регистрации в веб-версии укажите действующую электронную почту.'
    }
    if (!authForm.fullName.trim()) {
      return 'Введите отображаемое имя.'
    }
    if (authForm.password.trim().length < 6) {
      return 'Пароль должен быть не короче 6 символов.'
    }
    if (!authForm.phone.trim()) {
      return 'Введите номер телефона.'
    }
    if (!isValidRussianPhoneInput(authForm.phone)) {
      return 'Номер телефона должен содержать 10 цифр после 8.'
    }
    if (parsePlots(authForm.plots).length === 0) {
      return 'Укажите хотя бы один участок.'
    }
    if (!verificationSentTo || verificationSentTo !== registrationEmail) {
      return 'Сначала запросите код подтверждения на почту.'
    }
    if (!authForm.verificationCode.trim()) {
      return 'Введите код подтверждения из письма.'
    }
    if (!isRegistrationEmailVerified) {
      return 'Сначала подтвердите код из письма.'
    }
    return ''
  }, [authForm, isRegistrationEmailVerified, registrationEmail, verificationSentTo])

  const requestEmailCode = useCallback(async () => {
    clearAuthMessages()
    const validationError = validateRegistrationFormBase(authForm)
    if (validationError) {
      setAuthError(validationError)
      return
    }

    setVerificationSending(true)
    try {
      await requestRegistrationEmailCode(authForm.login.trim())
      setVerificationSentTo(registrationEmail)
      setVerificationApprovedFor('')
      setRegisterToken('')
      setAuthSuccess('Код подтверждения отправлен на указанную электронную почту.')
    } catch (error) {
      setAuthError(humanizeError(error))
    } finally {
      setVerificationSending(false)
    }
  }, [authForm, clearAuthMessages, registrationEmail])

  const verifyEmailCode = useCallback(async () => {
    clearAuthMessages()

    if (!verificationSentTo || verificationSentTo !== registrationEmail) {
      setAuthError('Сначала запросите код подтверждения.')
      return
    }
    if (!/^\d{6}$/.test(authForm.verificationCode.trim())) {
      setAuthError('Код подтверждения должен содержать 6 цифр.')
      return
    }

    setVerificationChecking(true)
    try {
      const result = await verifyRegistrationEmailCode(authForm.login.trim(), authForm.verificationCode.trim())
      setVerificationApprovedFor(registrationEmail)
      setRegisterToken(result.registerToken)
      setAuthSuccess('Электронная почта подтверждена. Теперь можно отправить заявку.')
    } catch (error) {
      setAuthError(humanizeError(error))
    } finally {
      setVerificationChecking(false)
    }
  }, [authForm.login, authForm.verificationCode, clearAuthMessages, registrationEmail, verificationSentTo])

  const handleAuthSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!firebaseSetup.ready || !auth || !db || authSubmitting) return

    clearAuthMessages()

    if (!authForm.login.trim()) {
      setAuthError(authMode === 'register' ? 'Укажите электронную почту.' : 'Введите логин или почту.')
      return
    }
    if (!authForm.password.trim()) {
      setAuthError('Введите пароль.')
      return
    }

    if (authMode === 'register') {
      const validationError = validateRegistrationForm()
      if (validationError) {
        setAuthError(validationError)
        return
      }
    }

    setAuthSubmitting(true)

    try {
      if (authMode === 'login') {
        const credential = await signInWithEmailAndPassword(
          auth,
          normalizeAuthEmail(authForm.login.trim()),
          authForm.password,
        )
        const profileSnapshot = await getDoc(doc(db, 'users', credential.user.uid))
        if (!profileSnapshot.exists()) {
          await handleMissingProfileAccess(credential.user.uid)
          return
        }
        setAuthForm((current) => ({ ...current, password: '' }))
      } else {
        await submitVerifiedRegistration(authForm, registerToken)
        setAuthMode('login')
        setAuthForm({
          ...INITIAL_AUTH_FORM,
          login: authForm.login.trim(),
        })
        resetVerificationState()
        setAuthSuccess(SUBMITTED_REGISTRATION_MESSAGE)
      }
    } catch (error) {
      setAuthError(humanizeError(error))
    } finally {
      setAuthSubmitting(false)
    }
  }, [
    authForm,
    authMode,
    authSubmitting,
    clearAuthMessages,
    db,
    handleMissingProfileAccess,
    registerToken,
    resetVerificationState,
    validateRegistrationForm,
  ])

  return {
    authMode,
    authForm,
    authError,
    authSuccess,
    authSubmitting,
    verificationSending,
    verificationChecking,
    verificationSentTo,
    isRegistrationEmailVerified,
    updateAuthField,
    switchAuthMode,
    handleAuthSubmit,
    handleMissingProfileAccess,
    requestEmailCode,
    verifyEmailCode,
  }
}

function validateRegistrationFormBase(form: AuthFormState) {
  if (!form.login.trim()) {
    return 'Укажите электронную почту.'
  }
  if (!form.login.includes('@')) {
    return 'Для регистрации в веб-версии укажите действующую электронную почту.'
  }
  if (!form.fullName.trim()) {
    return 'Введите отображаемое имя.'
  }
  if (form.password.trim().length < 6) {
    return 'Пароль должен быть не короче 6 символов.'
  }
  if (!form.phone.trim()) {
    return 'Введите номер телефона.'
  }
  if (!isValidRussianPhoneInput(form.phone)) {
    return 'Номер телефона должен содержать 10 цифр после 8.'
  }
  if (parsePlots(form.plots).length === 0) {
    return 'Укажите хотя бы один участок.'
  }
  return ''
}
