import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { ScriptBlock } from '../types/screenplay'

interface DismissAutofillOptions {
  activeBlockId: string | null
  blocks: readonly ScriptBlock[]
  itemRefs: RefObject<Record<string, HTMLElement | null>>
  onDismiss(text: string): void
  suggestionCount: number
}

export const useDismissAutofillOnOutsidePointerDown = ({
  activeBlockId,
  blocks,
  itemRefs,
  onDismiss,
  suggestionCount,
}: DismissAutofillOptions) => {
  useEffect(() => {
    if (!activeBlockId || suggestionCount === 0) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (itemRefs.current[activeBlockId]?.contains(target)) return

      const activeBlock = blocks.find((block) => block.id === activeBlockId)
      onDismiss(activeBlock?.text ?? '')
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [activeBlockId, blocks, itemRefs, onDismiss, suggestionCount])
}
