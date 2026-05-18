# Market Oracle — Sensex & Nifty AI Forecaster

This repository contains the Market Oracle dashboard for Sensex and Nifty forecasting.

## Files
- `index.html` — full static Market Oracle page
- `styles.css` — unused stylesheet (the page uses inline styles)
- `backend/` — Cloudflare Worker API for market quotes, search, and Gemini chat
- `README.md` — this project description

## Usage
Open `index.html` in a browser to view the page.

For local preview from the project folder:

```bash
py -m http.server 4173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4173/index.html
```

## Deployment
This repo is configured for GitHub Pages from the `main` branch root.

The published site should be:
- `https://pawankalhansh.github.io/Share-market-forcast/`

Current Worker backend:
- `https://market-oracle-api.pawankalhansh.workers.dev`

## Backend API

The browser app can run without the backend for basic forecast simulation, but the production direction is:

1. Deploy `backend/` as a Cloudflare Worker.
2. Add `GEMINI_API_KEY` as a Worker secret.
3. The current Worker URL is already the default in `index.html`. To override it in the browser:
   ```js
   localStorage.setItem('mo-api-base', 'https://market-oracle-api.your-account.workers.dev')
   ```
4. Reload the page.

After this, forecast/search will use the backend quote API and the chatbot will use Gemini safely through the backend.

## Notes
- The page is a static HTML dashboard based on your original Market Oracle design.
- The `RUN MARKET ANALYSIS` button can use live backend quotes, legacy quote proxy fallback, or local simulation fallback.
- Never put API keys in frontend code or GitHub Pages.
