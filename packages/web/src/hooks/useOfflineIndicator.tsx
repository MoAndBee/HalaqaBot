import { useEffect } from 'react'
import toast from 'react-hot-toast'

export function useOfflineIndicator() {
  useEffect(() => {
    const handleOnline = () => {
      toast.success('online', {
        id: 'network-status',
        duration: 2000,
      })
    }

    const handleOffline = () => {
      toast.error('offline', {
        id: 'network-status',
        duration: Infinity,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
}
