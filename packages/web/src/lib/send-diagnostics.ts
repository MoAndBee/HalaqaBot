import { ConvexHttpClient } from 'convex/browser'
import type { ConvexReactClient } from 'convex/react'
import type { FunctionArgs } from 'convex/server'
import { api } from '@halakabot/db'
import { convexUrl } from './convex'

/**
 * Diagnostics for participant list sends that get stuck or fail, so each
 * incident can be pinned on the server or on the admin's connection.
 *
 * Reports go over plain HTTPS rather than the live connection, which is often
 * the very thing that broke. If even that fails, the report is kept on the
 * phone and delivered the next time the app opens.
 */

const PENDING_KEY = 'halaqabot.pendingSendReports'
const PROBE_TIMEOUT_MS = 5000
// Any reachable host outside our server; telegram.org already served this page's SDK
const INTERNET_PROBE_URL = 'https://telegram.org/js/telegram-web-app.js'

const httpClient = new ConvexHttpClient(convexUrl)

export interface SendContext {
  requestId: string
  userId?: number
  userName?: string
  chatId: number
  postId: number
  sessionNumber?: number
}

type ProblemReport = FunctionArgs<typeof api.mutations.reportSendProblem>
type OutcomeReport = FunctionArgs<typeof api.mutations.recordSendProblemOutcome>

type PendingItem =
  | { kind: 'problem'; args: ProblemReport }
  | { kind: 'outcome'; args: OutcomeReport }

export function newRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

/** Whether a request to `url` gets any response at all within the probe timeout. */
async function canReach(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    // no-cors: an opaque response still proves the host answered
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Snapshot the phone's connection state, probe our server and the wider
 * internet, and report it. Never throws.
 */
export async function reportSendProblem(
  convex: ConvexReactClient,
  context: SendContext,
  kind: 'stuck' | 'failed',
  waitedMs: number,
  error?: string,
): Promise<void> {
  try {
    // Take the live-connection state before probing, which takes a few seconds
    const state = convex.connectionState()
    const [serverReachable, internetReachable] = await Promise.all([
      canReach(`${convexUrl}/version`),
      canReach(INTERNET_PROBE_URL),
    ])

    const args: ProblemReport = {
      ...context,
      kind,
      waitedMs,
      error,
      wsConnected: state.isWebSocketConnected,
      connectionCount: state.connectionCount,
      connectionRetries: state.connectionRetries,
      navigatorOnline: navigator.onLine,
      serverReachable,
      internetReachable,
      pageVisible: document.visibilityState === 'visible',
      reportedLate: false,
    }
    await deliver({ kind: 'problem', args })
  } catch (e) {
    console.error('Failed to report send problem:', e)
  }
}

/** Record how a send that was already reported as stuck finally ended. Never throws. */
export async function reportSendOutcome(
  requestId: string,
  finalOutcome: 'completed_late' | 'failed',
  finalMs: number,
  finalError?: string,
): Promise<void> {
  try {
    await deliver({ kind: 'outcome', args: { requestId, finalOutcome, finalMs, finalError } })
  } catch (e) {
    console.error('Failed to report send outcome:', e)
  }
}

/** Deliver reports that couldn't be sent earlier. Call once when the app opens. */
export async function flushPendingSendReports(): Promise<void> {
  const pending = readPending()
  if (pending.length === 0) return
  writePending([])
  for (const item of pending) {
    // Mark late problem reports: not being able to report at all is evidence too
    const late: PendingItem =
      item.kind === 'problem' ? { kind: 'problem', args: { ...item.args, reportedLate: true } } : item
    await deliver(late)
  }
}

async function deliver(item: PendingItem): Promise<void> {
  try {
    if (item.kind === 'problem') {
      await httpClient.mutation(api.mutations.reportSendProblem, item.args)
    } else {
      await httpClient.mutation(api.mutations.recordSendProblemOutcome, item.args)
    }
  } catch (e) {
    console.warn('Send report not delivered, keeping it for later:', e)
    writePending([...readPending(), item])
  }
}

function readPending(): PendingItem[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingItem[]) : []
  } catch {
    return []
  }
}

function writePending(items: PendingItem[]): void {
  try {
    // Keep it bounded in case reports pile up on a phone that never reconnects
    localStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(-20)))
  } catch {
    // Storage unavailable; the report is lost, nothing else to do
  }
}
