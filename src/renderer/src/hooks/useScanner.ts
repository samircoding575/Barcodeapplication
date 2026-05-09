import { useEffect, useRef } from 'react'

const SCANNER_MAX_CHAR_DELAY_MS = 50
const SCANNER_MIN_TOKEN_LENGTH = 8

/**
 * Detects USB QR scanner input (high-velocity keystrokes terminated by Enter)
 * and calls onScan with the accumulated token. Ignores input when focus is on
 * a form field — those handle scanner input directly via their onChange/onKeyDown.
 */
export function useScanner(onScan: (token: string) => void): void {
  const buffer = useRef('')
  const lastTime = useRef(0)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const now = Date.now()

      if (e.key === 'Enter') {
        const token = buffer.current
        buffer.current = ''
        lastTime.current = 0
        if (token.length >= SCANNER_MIN_TOKEN_LENGTH) {
          onScanRef.current(token)
          e.preventDefault()
        }
        return
      }

      // Reset buffer on human-speed pauses
      if (lastTime.current > 0 && now - lastTime.current > SCANNER_MAX_CHAR_DELAY_MS * 10) {
        buffer.current = ''
      }

      lastTime.current = now

      if (e.key.length === 1) {
        buffer.current += e.key
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
