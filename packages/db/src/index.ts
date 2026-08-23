// Main export file for @halakabot/db package
export type { User, ChatStorage, ParticipationSummary, ParticipationTypeStats } from './types'

// Re-export Convex API
export { api } from '../convex/_generated/api'

// Export utility for creating Convex client (for server-side use)
export { ConvexHttpClient, ConvexClient } from 'convex/browser'

// Convex document and id types, for code that handles rows outside the backend
export type { Doc, Id } from '../convex/_generated/dataModel'
