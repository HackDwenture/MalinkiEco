import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db, firebaseSetup } from '../lib/firebase'
import type { RemoteUser, Role } from '../types'

type UseResidentProfileOptions = {
  authUser: User | null
  onMissingProfile: (userId: string) => void | Promise<void>
}

export function useResidentProfile({ authUser, onMissingProfile }: UseResidentProfileOptions) {
  const [profile, setProfile] = useState<RemoteUser | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (!firebaseSetup.ready || !db || !authUser) {
      setProfile(null)
      return
    }

    setProfileLoading(true)
    return onSnapshot(doc(db, 'users', authUser.uid), (snapshot) => {
      if (!snapshot.exists()) {
        setProfile(null)
        setProfileLoading(false)
        void onMissingProfile(authUser.uid)
        return
      }

      const data = snapshot.data()
      setProfile({
        id: snapshot.id,
        email: String(data.email ?? ''),
        fullName: String(data.fullName ?? ''),
        plotName: String(data.plotName ?? ''),
        plots: Array.isArray(data.plots) ? data.plots.map(String).filter(Boolean) : [],
        role: String(data.role ?? 'USER') as Role,
        balance: Number(data.balance ?? 0),
        lastChatReadAt: Number(data.lastChatReadAt ?? 0),
      })
      setProfileLoading(false)
    })
  }, [authUser, onMissingProfile])

  return { profile, profileLoading, setProfile }
}
