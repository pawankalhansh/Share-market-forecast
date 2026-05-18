const YAHOO_SPARK_URL = 'https://query1.finance.yahoo.com/v7/finance/spark';
const YAHOO_SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';
const GEMINI_MODEL = 'gemini-2.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'MarketOracle/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed: ${response.status}`);
  }

  return response.json();
}

function sanitizeSymbols(value) {
  return value
    .split(',')
    .map(symbol => symbol.trim())
    .filter(Boolean)
    .filter(symbol => /^[A-Z0-9.^=-]+$/i.test(symbol))
    .slice(0, 25);
}

async function getQuotes(symbols) {
  const url = new URL(YAHOO_SPARK_URL);
  url.searchParams.set('symbols', symbols.join(','));
  url.searchParams.set('range', '1d');
  url.searchParams.set('interval', '1m');
  const data = await fetchJSON(url.toString());
  return data.spark?.result || [];
}

async function searchYahoo(query, count = 5) {
  const url = new URL(YAHOO_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('quotesCount', String(count));
  url.searchParams.set('newsCount', '0');
  return fetchJSON(url.toString());
}

async function getMarketContext(query) {
  const search = await searchYahoo(query, 1);
  const quote = search.quotes?.[0];
  if (!quote?.symbol) return 'No live quote found for this query.';

  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(quote.symbol)}`);
  chartUrl.searchParams.set('range', '1d');
  chartUrl.searchParams.set('interval', '1d');
  const chart = await fetchJSON(chartUrl.toString());
  const meta = chart.chart?.result?.[0]?.meta;
  if (!meta) return `Symbol found: ${quote.symbol}. Live quote metadata unavailable.`;

  return [
    `Symbol: ${quote.symbol}`,
    `Name: ${quote.shortname || quote.longname || quote.symbol}`,
    `Exchange: ${meta.exchangeName || quote.exchange || 'Unknown'}`,
    `Currency: ${meta.currency || 'Unknown'}`,
    `Live Price: ${meta.regularMarketPrice ?? 'Unavailable'}`,
    `Previous Close: ${meta.chartPreviousClose ?? meta.previousClose ?? 'Unavailable'}`
  ].join('\n');
}

function toGeminiContents(messages) {
  return messages
    .filter(item => item && typeof item.content === 'string' && item.content.trim())
    .slice(-12)
    .map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content.slice(0, 4000) }]
    }));
}

async function handleChat(request, env) {
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({
      error: 'GEMINI_API_KEY is not configured on the backend.'
    }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find(item => item.role === 'user')?.content || '';
  const marketContext = lastUser ? await getMarketContext(lastUser).catch(() => 'Live quote lookup failed.') : '';

  const systemText = [
    'You are Market Oracle AI, a careful Indian stock market assistant.',
    'Reply in clear Hinglish.',
    'Do not present educational forecasts as guaranteed returns.',
    'Use the market context when it is relevant, and say when data is unavailable.',
    'Always end with a short educational disclaimer.'
  ].join(' ');

  const contents = toGeminiContents(messages);
  if (marketContext) {
    contents.push({
      role: 'user',
      parts: [{ text: `Live market context for the latest user query:\n${marketContext}` }]
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: {
          maxOutputTokens: 1200,
          temperature: 0.55
        }
      })
    }
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    return jsonResponse({
      error: data.error?.message || `Gemini request failed: ${response.status}`
    }, 502);
  }

  return jsonResponse({
    reply: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, answer generate nahi ho paya.',
    marketContext
  });
}

async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');

  if (path === '/api/health') {
    return jsonResponse({
      ok: true,
      service: 'market-oracle-api',
      time: new Date().toISOString()
    });
  }

  if (path === '/api/quotes') {
    const symbols = sanitizeSymbols(url.searchParams.get('symbols') || '');
    if (!symbols.length) return jsonResponse({ error: 'symbols query parameter is required.' }, 400);
    return jsonResponse({
      result: await getQuotes(symbols),
      source: 'yahoo-spark'
    });
  }

  if (path === '/api/search') {
    const query = (url.searchParams.get('q') || '').trim();
    if (!query) return jsonResponse({ error: 'q query parameter is required.' }, 400);
    return jsonResponse(await searchYahoo(query, 8));
  }

  if (path === '/api/chat' && request.method === 'POST') {
    return handleChat(request, env);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return jsonResponse({ error: error.message || 'Unexpected backend error.' }, 500);
    }
  }
};
