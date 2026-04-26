/**
 * Prelude — JSON formatter
 */

import type { AuditResult } from "../utils/types.js"

export function formatJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2)
}
