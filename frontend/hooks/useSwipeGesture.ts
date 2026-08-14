'use client'

import { useEffect, useRef, useCallback } from 'react'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

interface UseSwipeGestureOptions {
  threshold?: number
  maxVerticalDrift?: number
  edgeWidth?: number
  onSwipe?: (direction: SwipeDirection) => void
  enabled?: boolean
  target?: HTMLElement | null
}

/**
 * Lightweight touch swipe detector for mobile navigation.
 * Works on iOS Safari and Android Chrome without extra libraries.
 */
export function useSwipeGesture({
  threshold = 60,
  maxVerticalDrift = 80,
  edgeWidth = 24,
  onSwipe,
  enabled = true,
  target = null,
}: UseSwipeGestureOptions = {}) {
  const startX = useRef(0)
  const startY = useRef(0)
  const tracking = useRef(false)
  const fromEdge = useRef(false)
  const onSwipeRef = useRef(onSwipe)
  onSwipeRef.current = onSwipe

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return
      const t = e.touches[0]
      startX.current = t.clientX
      startY.current = t.clientY
      fromEdge.current = t.clientX <= edgeWidth
      tracking.current = true
    },
    [enabled, edgeWidth]
  )

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!tracking.current || !enabled) return
      tracking.current = false

      const t = e.changedTouches[0]
      const dx = t.clientX - startX.current
      const dy = t.clientY - startY.current

      if (Math.abs(dy) > maxVerticalDrift) return
      if (Math.abs(dx) < threshold) return

      if (dx > 0) {
        // Swipe right: only when started near left edge (open-drawer)
        if (fromEdge.current) {
          onSwipeRef.current?.('right')
        }
      } else {
        // Swipe left: always fire (close-drawer)
        onSwipeRef.current?.('left')
      }
    },
    [enabled, threshold, maxVerticalDrift]
  )

  const onTouchCancel = useCallback(() => {
    tracking.current = false
  }, [])

  useEffect(() => {
    if (!enabled) return
    const el: EventTarget = target ?? document
    el.addEventListener('touchstart', onTouchStart as EventListener, { passive: true })
    el.addEventListener('touchend', onTouchEnd as EventListener, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel as EventListener, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart as EventListener)
      el.removeEventListener('touchend', onTouchEnd as EventListener)
      el.removeEventListener('touchcancel', onTouchCancel as EventListener)
    }
  }, [enabled, target, onTouchStart, onTouchEnd, onTouchCancel])
}