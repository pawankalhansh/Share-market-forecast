# Market Oracle Backend

This folder contains the Cloudflare Worker API for Market Oracle.

## Endpoints

- `GET /api/health` - backend health check
- `GET /api/quotes?symbols=^NSEI,^BSESN` - Yahoo Spark quote proxy
- `GET /api/search?q=reliance` - Yahoo symbol search proxy
- `POST /api/chat` - Gemini-powered Hinglish market assistant

## Deploy

1. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```

2. Login:
   ```bash
   wrangler login
   ```

3. Add your Gemini API key as a secret:
   ```bash
   wrangler secret put GEMINI_API_KEY
   ```

4. Deploy from this folder:
   ```bash
   wrangler deploy
   ```

5. Copy the Worker URL, for example:
   ```text
   https://market-oracle-api.your-account.workers.dev
   ```

6. On the website, open DevTools Console once and save the backend URL:
   ```js
   localStorage.setItem('mo-api-base', 'https://market-oracle-api.your-account.workers.dev')
   ```

After this, reload the page. Forecast/search will use the backend API, and chat will work if `GEMINI_API_KEY` is configured.

## Important

Never put API keys in `index.html`, GitHub Pages, or any browser JavaScript. Keep secrets only in Worker environment secrets.
