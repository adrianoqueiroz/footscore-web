import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseMatchDateTime(match: { date?: string, time?: string }): Date | null {
  if (!match || !match.date) {
    return null
  }

  // If date already contains time information (e.g., ISO string)
  if (match.date.includes('T')) {
    const d = new Date(match.date)
    return isNaN(d.getTime()) ? null : d
  }

  // If time is provided separately
  if (match.time) {
    const d = new Date(`${match.date}T${match.time}`)
    return isNaN(d.getTime()) ? null : d
  }

  // Fallback for just a date (will result in midnight UTC)
  const d = new Date(match.date)
  return isNaN(d.getTime()) ? null : d
}




