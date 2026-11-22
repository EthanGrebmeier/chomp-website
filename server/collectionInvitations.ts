import express from 'express'

/** No API lookup or collection metadata is exposed to unauthenticated crawlers. */
export function createCollectionInvitationRoutes() {
  const router = express.Router()
  router.get('/join/:code', (req, res) => {
    const code = req.params.code.toUpperCase().replace(/[\s-]/g, '')
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' })
    if (!/^[2-9A-HJ-NP-Z]{12}$/.test(code)) {
      res.status(404).type('text').send('Invitation unavailable. Ask the owner for a current code.')
      return
    }
    // Flip only alongside the original-app cutover, never from an incoming URL.
    const production = process.env.CHOMP_COLLECTION_APP === 'production'
    const scheme = production ? 'chomp' : 'chomp-sync-lab'
    const formatted = code.match(/.{4}/g)!.join('-')
    res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Join a collection · Chomp</title>
<style>body{margin:0;background:#ebdcd6;color:#211e1b;font:18px system-ui,sans-serif}main{max-width:28rem;margin:12vh auto;padding:24px}h1{font-size:2rem}p{line-height:1.5}a{display:block;padding:16px 20px;border-radius:30px;background:#211e1b;color:white;text-align:center;text-decoration:none;margin:24px 0}input{box-sizing:border-box;width:100%;padding:16px;border:1px solid #84766c;border-radius:8px;background:white;font:24px ui-monospace,monospace;text-align:center}label{display:block;margin:24px 0 8px}small{display:block;line-height:1.5}</style>
</head><body><main><h1>Join a collection</h1>
<p>Open Chomp to review this invitation and choose whether to join.</p>
<a href="${scheme}://join/${code}">Open in Chomp</a>
<label for="code">Invitation code</label><input id="code" aria-label="Invitation code" readonly value="${formatted}">
<p>You can copy this code and enter it in Chomp under Join collection.</p>
${production ? '<a href="https://apps.apple.com/app/id6754225714">Get Chomp</a>' : '<small>This invitation requires Chomp Experimental. Ask the person who invited you for TestFlight access, then return to this link.</small>'}
</main></body></html>`)
  })
  return router
}
