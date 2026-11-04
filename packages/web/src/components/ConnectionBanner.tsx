import { useEffect, useState } from 'react'
import { useConvexConnectionState } from 'convex/react'

// Brief reconnects are normal; only flag a drop that lasts this long
const SHOW_AFTER_MS = 4000

/**
 * Tells the admin when the live connection to the server is down. While it is,
 * nothing they do reaches the server and the list stops updating, which
 * otherwise just looks like the app hanging.
 */
export function ConnectionBanner() {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState()
  const isDisconnected = hasEverConnected && !isWebSocketConnected
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isDisconnected) {
      setShow(false)
      return
    }
    const timer = setTimeout(() => setShow(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [isDisconnected])

  if (!show) return null

  return (
    <div
      role="status"
      className="bg-destructive text-white text-sm text-center px-4 py-2"
    >
      انقطع الاتصال بالخادم، جاري إعادة الاتصال... تحققي من الإنترنت
    </div>
  )
}
