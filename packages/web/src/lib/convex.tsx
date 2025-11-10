'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'

// Create the Convex client
const convexUrl = import.meta.env.VITE_CONVEX_URL || 'http://localhost:3210'
const convex = new ConvexReactClient(convexUrl)

interface ConvexClientProviderProps {
  children: ReactNode
}

/**
 * Provider component that wraps the app with Convex client
 * This enables the use of useQuery and useMutation hooks throughout the app
 */
export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
