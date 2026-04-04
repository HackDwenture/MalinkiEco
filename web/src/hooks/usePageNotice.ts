import { useCallback, useState } from 'react'

export function usePageNotice() {
  const [pageNotice, setPageNotice] = useState('')

  const showNotice = useCallback((message: string) => {
    setPageNotice(message)
  }, [])

  const clearNotice = useCallback(() => {
    setPageNotice('')
  }, [])

  return {
    pageNotice,
    showNotice,
    clearNotice,
  }
}
