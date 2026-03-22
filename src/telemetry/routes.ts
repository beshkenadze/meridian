/**
 * Telemetry API routes.
 *
 * GET /telemetry            — HTML dashboard
 * GET /telemetry/requests   — Recent request metrics (JSON)
 * GET /telemetry/summary    — Aggregate statistics (JSON)
 */

import { Hono } from "hono"
import { telemetryStore } from "./store"
import { dashboardHtml } from "./dashboard"

export function createTelemetryRoutes() {
  const routes = new Hono()

  // Dashboard
  routes.get("/", (c) => {
    return c.html(dashboardHtml)
  })

  // Recent requests
  routes.get("/requests", (c) => {
    const limit = Number.parseInt(c.req.query("limit") || "50", 10)
    const since = c.req.query("since") ? Number.parseInt(c.req.query("since")!, 10) : undefined
    const model = c.req.query("model") || undefined

    const requests = telemetryStore.getRecent({
      limit: Math.min(limit, 500),
      since,
      model,
    })

    return c.json(requests)
  })

  // Aggregate summary
  routes.get("/summary", (c) => {
    const windowMs = Number.parseInt(c.req.query("window") || "3600000", 10) // default 1 hour

    const summary = telemetryStore.summarize(windowMs)
    return c.json(summary)
  })

  return routes
}
