import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatHijriDate(date: Date): string {
  const hijri = new Intl.DateTimeFormat('ar-EG-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  return `${hijri}هـ`
}

export function tgConfirm(message: string): Promise<boolean> {
  const tg = (window as any).Telegram?.WebApp
  if (tg?.showConfirm) {
    return new Promise((resolve) => tg.showConfirm(message, resolve))
  }
  return Promise.resolve(window.confirm(message))
}
