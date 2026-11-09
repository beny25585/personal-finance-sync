import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const original = readFileSync(new URL('../../src/web/app/globals.css', import.meta.url), 'utf8')
const mobile = readFileSync(new URL('../src/kolshek-tokens.css', import.meta.url), 'utf8')

function tokens(source: string, selector: ':root' | '.dark'): Record<string, string> {
  const block = source.replace(/\r\n/g, '\n').match(new RegExp(`^${selector.replace('.', '\\.')} \\{\\n([\\s\\S]*?)^\\}`, 'm'))
  assert.ok(block, `Missing ${selector} theme block`)
  return Object.fromEntries([...block[1]!.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]))
}

test('theme token extraction accepts LF and CRLF without changing values', () => {
  const expected = { '--primary': '#4f46e5', '--radius': '0.625rem' }
  for (const selector of [':root', '.dark'] as const) {
    const lf = `${selector} {\n  --primary: #4f46e5;\n  --radius: 0.625rem;\n}\n`
    const crlf = lf.replace(/\n/g, '\r\n')
    assert.deepEqual(tokens(lf, selector), expected)
    assert.deepEqual(tokens(crlf, selector), expected)
  }
})

test('theme token extraction still distinguishes changed values', () => {
  const source = ':root {\r\n  --primary: #4f46e5;\r\n}\r\n'
  const changed = source.replace('#4f46e5', '#6366f1')
  assert.notDeepEqual(tokens(source, ':root'), tokens(changed, ':root'))
})

for (const selector of [':root', '.dark'] as const) {
  test(`mobile ${selector} colors and radius match the original KolShek source`, () => {
    assert.deepEqual(tokens(mobile, selector), tokens(original, selector))
  })
}
