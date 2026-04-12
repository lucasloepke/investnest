const https = require('https')
require('dotenv').config()

//alpha vantage api gives json
function avGet(params) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({ ...params, apikey: process.env.ALPHA_VANTAGE_API_KEY }).toString()

    https.get(`https://www.alphavantage.co/query?${qs}`, res => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        const json = JSON.parse(raw)
        //free tier of alpha vantage is limited
        if (json['Note'] || json['Information']) {
          reject(new Error('hit alpha vantage rate limit (25 requests/day on free tier)'))
        } else {
          resolve(json)
        }
      })
    }).on('error', reject)
  })
}

async function getQuote(symbol) {
  const data = await avGet({ function: 'GLOBAL_QUOTE', symbol })
  const q = data['Global Quote']

  if (!q || !q['05. price']) throw new Error(`couldn't find data for ${symbol}`)

  return {
    symbol: q['01. symbol'],
    price: parseFloat(q['05. price']),
    change: parseFloat(q['09. change']),
    changePercent: q['10. change percent'],
    latestTradingDay: q['07. latest trading day']
  }
}

//delay makes sure we dont hit limit for alpha vantage
async function getBatchQuotes(symbols) {
  const results = {}
  for (const sym of symbols) {
    try {
      results[sym] = await getQuote(sym)
    } catch(err) {
      results[sym] = { symbol: sym, error: err.message }
    }
    await new Promise(r => setTimeout(r, 250))
  }
  return results
}

async function searchSymbol(keywords) {
  const data = await avGet({ function: 'SYMBOL_SEARCH', keywords })
  return (data['bestMatches'] || []).map(m => ({
    symbol: m['1. symbol'],
    name: m['2. name'],
    type: m['3. type']
  }))
}

module.exports = { getQuote, getBatchQuotes, searchSymbol }
