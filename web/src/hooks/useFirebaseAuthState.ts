import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth, firebaseSetup } from '../lib/firebase'

export function useFirebaseAuthState() {
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!firebaseSetup.ready || !auth) {
      setAuthLoading(false)
      return
    }

    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user)
      setAuthLoading(false)
    })
  }, [])

  return { authUser, authLoading }
}
