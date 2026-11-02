import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const original = readFileSync(new URL('../../src/web/app/globals.css', import.meta.url), 'utf8')
const mobile = readFileSync(new URL('../src/kolshek-tokens.css', import.meta.url), 'utf8')

function tokens(source: string, selector: ':root' | '.dark'): Record<string, string> {
  const block = source.match(new RegExp(`^${selector.replace('.', '\\.')} \\{\\n([\\s\\S]*?)^\\}`, 'm'))
  assert.ok(block, `Missing ${selector} theme block`)
  return Object.fromEntries([...block[1]!.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]))
}

for (const selector of [':root', '.dark'] as const) {
  test(`mobile ${selector} colors and radius match the original KolShek source`, () => {
    assert.deepEqual(tokens(mobile, selector), tokens(original, selector))
  })
}
