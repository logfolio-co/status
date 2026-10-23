# status.logfolio.co page

Our own status page, in Logfolio's look (Tailwind, shadcn style). Upptime
(the workflows in this repo) still runs the checks every 5 minutes and saves
them to `history/`; this page reads that data in the browser, so nothing is
built per check and it works when logfolio.co is down.

Upptime builds its own page, then copies `assets/` over it, so
`assets/index.html` replaces Upptime's. A push to `assets/` republishes.

- Page: `assets/index.html`, `assets/app.js`
- Styles: edit `page/src/input.css` (no comments in CSS), then
  `cd page && npm install && npm run build` writes `assets/style.css`.
