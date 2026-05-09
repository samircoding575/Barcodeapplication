import type { WindowAPI } from '@shared/types'

declare global {
  interface Window {
    api: WindowAPI
  }
}

export {}
