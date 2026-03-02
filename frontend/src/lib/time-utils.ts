/**
 * Time formatting utility functions
 * Unified handling of timestamp and ISO format time display
 */

/**
 * Format time to local time string
 * @param timestamp Timestamp (seconds or milliseconds) or ISO string
 * @param format Output format: 'time' | 'date' | 'datetime'
 * @returns Formatted time string
 */
export function formatTime(
  timestamp: string | number | null | undefined,
  format: 'time' | 'date' | 'datetime' = 'time'
): string {
  if (!timestamp) {
    return ''
  }

  try {
    let date: Date

    if (typeof timestamp === 'number') {
      // Automatically judge whether it is second-level or millisecond-level timestamp
      // 10000000000 is approximately the year 2286, so less than this value is considered second-level
      date = new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1))
    } else {
      date = new Date(timestamp)
    }

    if (isNaN(date.getTime())) {
      return String(timestamp)
    }

    switch (format) {
      case 'time':
        return date.toLocaleTimeString()
      case 'date':
        return date.toLocaleDateString()
      case 'datetime':
        return date.toLocaleString()
      default:
        return date.toLocaleTimeString()
    }
  } catch {
    return String(timestamp)
  }
}

/**
 * Calculate time duration
 * @param start Start time (timestamp or ISO string)
 * @param end End time (timestamp or ISO string)
 * @returns Time duration (milliseconds)
 */
export function getTimeDuration(
  start: string | number | null | undefined,
  end: string | number | null | undefined
): number {
  if (!start || !end) {
    return 0
  }

  try {
    let startDate: Date
    let endDate: Date

    if (typeof start === 'number') {
      startDate = new Date(start * (start < 10000000000 ? 1000 : 1))
    } else {
      startDate = new Date(start)
    }

    if (typeof end === 'number') {
      endDate = new Date(end * (end < 10000000000 ? 1000 : 1))
    } else {
      endDate = new Date(end)
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return 0
    }

    return endDate.getTime() - startDate.getTime()
  } catch {
    return 0
  }
}

/**
 * Format time duration
 * @param duration Time duration (milliseconds)
 * @returns Formatted time string (e.g., 1h 30m 25s)
 */
export function formatDuration(duration: number): string {
  if (duration <= 0) {
    return '0s'
  }

  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const parts: string[] = []

  if (days > 0) {
    parts.push(`${days}d`)
  }
  if (hours % 24 > 0) {
    parts.push(`${hours % 24}h`)
  }
  if (minutes % 60 > 0) {
    parts.push(`${minutes % 60}m`)
  }
  if (seconds % 60 > 0) {
    parts.push(`${seconds % 60}s`)
  }

  return parts.join(' ') || '0s'
}

/**
 * Get current timestamp (seconds)
 * @returns Current timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Check if time is expired
 * @param timestamp Timestamp (seconds)
 * @param seconds Expiration time (seconds)
 * @returns Whether it is expired
 */
export function isExpired(timestamp: number, seconds: number): boolean {
  return getCurrentTimestamp() - timestamp > seconds
}
