/**
 * Shared percentile computation used by all telemetry store implementations.
 */

import type { RequestMetric, PhaseTiming, TelemetrySummary } from "./types"

export function computePercentiles(values: number[]): PhaseTiming {
  if (values.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 }

  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)

  return {
    p50: sorted[Math.floor(sorted.length * 0.5)]!,
    p95: sorted[Math.floor(sorted.length * 0.95)]!,
    p99: sorted[Math.floor(sorted.length * 0.99)]!,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    avg: Math.round(sum / sorted.length),
  }
}

/**
 * Compute a TelemetrySummary from an array of RequestMetric.
 * Both MemoryTelemetryStore and SqliteTelemetryStore use this
 * to guarantee identical output.
 */
export function computeSummary(metrics: RequestMetric[], windowMs: number): TelemetrySummary {
  if (metrics.length === 0) {
    const emptyPhase: PhaseTiming = { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 }
    return {
      windowMs,
      totalRequests: 0,
      errorCount: 0,
      requestsPerMinute: 0,
      queueWait: emptyPhase,
      proxyOverhead: emptyPhase,
      ttfb: emptyPhase,
      upstreamDuration: emptyPhase,
      totalDuration: emptyPhase,
      byModel: {},
      byMode: {},
    }
  }

  const errorCount = metrics.filter(m => m.error !== null).length

  const oldest = metrics[metrics.length - 1]!.timestamp
  const newest = metrics[0]!.timestamp
  const spanMs = Math.max(newest - oldest, 1)
  const requestsPerMinute = (metrics.length / spanMs) * 60_000

  const queueWaits = metrics.map(m => m.queueWaitMs)
  const overheads = metrics.map(m => m.proxyOverheadMs)
  const ttfbs = metrics.filter(m => m.ttfbMs !== null).map(m => m.ttfbMs!)
  const upstreams = metrics.map(m => m.upstreamDurationMs)
  const totals = metrics.map(m => m.totalDurationMs)

  const byModel: Record<string, { count: number; totalMs: number }> = {}
  for (const m of metrics) {
    const modelKey = m.requestModel || m.model
    const entry = byModel[modelKey] ??= { count: 0, totalMs: 0 }
    entry.count++
    entry.totalMs += m.totalDurationMs
  }

  const byMode: Record<string, { count: number; totalMs: number }> = {}
  for (const m of metrics) {
    const entry = byMode[m.mode] ??= { count: 0, totalMs: 0 }
    entry.count++
    entry.totalMs += m.totalDurationMs
  }

  return {
    windowMs,
    totalRequests: metrics.length,
    errorCount,
    requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
    queueWait: computePercentiles(queueWaits),
    proxyOverhead: computePercentiles(overheads),
    ttfb: ttfbs.length > 0 ? computePercentiles(ttfbs) : { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 },
    upstreamDuration: computePercentiles(upstreams),
    totalDuration: computePercentiles(totals),
    byModel: Object.fromEntries(
      Object.entries(byModel).map(([k, v]) => [k, { count: v.count, avgTotalMs: Math.round(v.totalMs / v.count) }])
    ),
    byMode: Object.fromEntries(
      Object.entries(byMode).map(([k, v]) => [k, { count: v.count, avgTotalMs: Math.round(v.totalMs / v.count) }])
    ),
  }
}
