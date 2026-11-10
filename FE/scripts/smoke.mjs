// HTTP smoke test for the built frontend: starts `vite preview` on a free port
// and checks that the page and its assets are actually served.
// Run after `npm run build` (see the `test` script in package.json).

import assert from 'node:assert/strict'
import { preview } from 'vite'

const server = await preview({
  // Override `preview.port: 80` / `strictPort: true` from vite.config.ts:
  // the test must not depend on privileges for a low port or on a free 80.
  preview: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
  logLevel: 'silent',
})

const close = () =>
  new Promise((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()))
  })

try {
  const baseUrl = server.resolvedUrls?.local?.[0]
  assert.ok(baseUrl, 'vite preview did not report a local URL')

  const page = await fetch(baseUrl)
  assert.equal(page.status, 200, `GET / вернул ${page.status}`)
  assert.match(
    page.headers.get('content-type') ?? '',
    /text\/html/,
    'GET / должен отдавать HTML',
  )

  const html = await page.text()
  assert.match(html, /<div id="root"><\/div>/, 'в HTML нет корневого узла #root')
  assert.match(
    html,
    /<title>Календарь звонков<\/title>/,
    'в HTML нет ожидаемого <title>',
  )

  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
    (match) => match[1],
  )
  assert.ok(
    assets.some((asset) => asset.endsWith('.js')),
    'в HTML нет ссылки на JS-бандл',
  )
  assert.ok(
    assets.some((asset) => asset.endsWith('.css')),
    'в HTML нет ссылки на CSS-бандл',
  )

  for (const asset of assets) {
    const response = await fetch(new URL(asset, baseUrl))
    assert.equal(response.status, 200, `GET ${asset} вернул ${response.status}`)
    assert.match(
      response.headers.get('content-type') ?? '',
      /javascript|text\/css/,
      `GET ${asset} вернул не бандл, а ${
        response.headers.get('content-type') ?? 'ответ без content-type'
      } (похоже на SPA-фолбэк на index.html)`,
    )
    await response.arrayBuffer()
  }

  console.log(`smoke ok: ${baseUrl} отдаёт страницу и ${assets.length} ассет(ов)`)
} finally {
  await close()
}
