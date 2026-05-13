import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations, type Locale, type TranslationKey } from './translations'

interface LocaleState {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey) => string
}

export const useLocale = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      setLocale: (locale) => {
        set({ locale })
        // Apply RTL direction to the document root immediately
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
        document.documentElement.lang = locale
      },
      t: (key) => translations[get().locale][key] ?? translations.en[key] ?? key,
    }),
    { name: 'scangrade-locale' }
  )
)

/** Call once on app boot to sync the persisted locale to the DOM. */
export function syncLocaleToDom(): void {
  const stored = localStorage.getItem('scangrade-locale')
  if (stored) {
    try {
      const { state } = JSON.parse(stored) as { state: { locale: Locale } }
      if (state?.locale === 'ar') {
        document.documentElement.dir = 'rtl'
        document.documentElement.lang = 'ar'
      }
    } catch {
      // ignore malformed storage
    }
  }
}
