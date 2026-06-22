import { useEffect, useState } from 'react'
import { isTutorialAdvanceKey, tutorialSteps } from '../lib/tutorial'

interface GuidedTutorialProps {
  stepIndex: number
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onFinish: () => void
}

interface TargetRect {
  left: number
  top: number
  width: number
  height: number
}

const readTargetRect = (selector: string): TargetRect | null => {
  const target = document.querySelector(selector)
  if (!(target instanceof HTMLElement)) {
    return null
  }
  const rect = target.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export default function GuidedTutorial({
  stepIndex,
  onBack,
  onNext,
  onSkip,
  onFinish,
}: GuidedTutorialProps) {
  const step = tutorialSteps[stepIndex]
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      setTargetRect(readTargetRect(step.target))
    }
    frame = window.requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step.target])

  const isLastStep = stepIndex === tutorialSteps.length - 1
  const panelOnLeft =
    targetRect !== null && targetRect.left > window.innerWidth * 0.55

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTutorialAdvanceKey(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      if (isLastStep) {
        onFinish()
      } else {
        onNext()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [isLastStep, onFinish, onNext])

  return (
    <div className="tutorial-layer" role="dialog" aria-modal="false" aria-label="MasterScript tutorial">
      <div className="tutorial-dimmer" />
      {targetRect && (
        <div
          className="tutorial-spotlight"
          style={{
            left: Math.max(8, targetRect.left - 6),
            top: Math.max(8, targetRect.top - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}
      <section
        className={`tutorial-card${panelOnLeft ? ' tutorial-card-left' : ''}`}
      >
        <p className="tutorial-progress">
          Step {stepIndex + 1} of {tutorialSteps.length}
        </p>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="tutorial-actions">
          <button type="button" className="ghost-btn" onClick={onSkip}>
            Skip
          </button>
          <div>
            <button
              type="button"
              className="ghost-btn"
              onClick={onBack}
              disabled={stepIndex === 0}
            >
              Back
            </button>
            <button
              type="button"
              className="share-btn"
              onClick={isLastStep ? onFinish : onNext}
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
