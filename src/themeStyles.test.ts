import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync('src/index.css', 'utf8')

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const expectRuleToContain = (selector: string, declarations: string[]) => {
  const pattern = new RegExp(`${escapeRegExp(selector)}\\s*{(?<body>[^}]*)}`, 'm')
  const match = stylesheet.match(pattern)

  expect(match, `${selector} rule is missing`).not.toBeNull()

  const body = match?.groups?.body ?? ''
  for (const declaration of declarations) {
    expect(body, `${selector} should include ${declaration}`).toContain(declaration)
  }
}

describe('light theme stylesheet', () => {
  it('renders the editor page as white paper with black screenplay text', () => {
    expectRuleToContain(":root[data-theme='light'] .script-page", [
      'background: #ffffff;',
      'color: #111111;',
    ])
    expectRuleToContain(":root[data-theme='light'] .script-input", [
      'color: #111111;',
      'caret-color: #111111;',
    ])
    expectRuleToContain(":root[data-theme='light'] .script-input.scene-heading", [
      'color: #111111;',
    ])
    expectRuleToContain(":root[data-theme='light'] .script-input.action", [
      'color: #111111;',
    ])
    expectRuleToContain(":root[data-theme='light'] .script-input.dialogue", [
      'color: #111111;',
    ])
  })

  it('uses light surfaces for the surrounding workspace chrome', () => {
    expectRuleToContain(":root[data-theme='light'] .app-header", [
      'background: rgba(255, 255, 255, 0.88);',
      'color: #111111;',
    ])
    expectRuleToContain(":root[data-theme='light'] .left-rail", [
      'background: #ffffff;',
    ])
    expectRuleToContain(":root[data-theme='light'] .right-outline", [
      'background: #ffffff;',
    ])
    expectRuleToContain(":root[data-theme='light'] .statusbar", [
      'background: rgba(255, 255, 255, 0.94);',
      'color: #3f3f3f;',
    ])
  })

  it('keeps controls readable against light panels', () => {
    expectRuleToContain(":root[data-theme='light'] input", [
      'background: #ffffff;',
      'color: #111111;',
    ])
    expectRuleToContain(":root[data-theme='light'] .floating-toolbar", [
      'background: rgba(255, 255, 255, 0.96);',
    ])
    expectRuleToContain(":root[data-theme='light'] .format-btn.active", [
      'color: #111111;',
      'background: rgba(0, 0, 0, 0.08);',
    ])
  })

  it('keeps light-theme placeholders and writer-panel guidance readable', () => {
    expectRuleToContain(":root[data-theme='light'] .script-input::placeholder", [
      'color: #111111;',
    ])
    expectRuleToContain(":root[data-theme='light'] .current-element-card", [
      'background: rgba(0, 0, 0, 0.03);',
    ])
    expectRuleToContain(":root[data-theme='light'] .keyboard-hint-list div", [
      'color: #3f3f3f;',
    ])
    expectRuleToContain(":root[data-theme='light'] .shortcut-grid span", [
      'color: #3f3f3f;',
    ])
  })
})
