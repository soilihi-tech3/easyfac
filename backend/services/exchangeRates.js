const axios = require('axios');

let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours cache

async function getRates() {
  const now = Date.now();
  if (cachedRates && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedRates;
  }

  try {
    console.log('Fetching fresh exchange rates from Open ExchangeRate API...');
    const response = await axios.get('https://open.er-api.com/v6/latest/USD');
    if (response.data && response.data.result === 'success') {
      const rates = response.data.rates;
      
      // Ensure FCFA is populated based on West African (XOF) or Central African (XAF) rates
      if (rates.XOF) {
        rates.FCFA = rates.XOF;
      } else if (rates.XAF) {
        rates.FCFA = rates.XAF;
      } else {
        rates.FCFA = 562.09; // stable fallback value for CFA Franc
      }

      cachedRates = {
        base: 'USD',
        rates: rates,
        time_last_update_utc: response.data.time_last_update_utc
      };
      lastFetchTime = now;
      console.log('Exchange rates cache updated successfully.');
      return cachedRates;
    } else {
      throw new Error('API response result was not success');
    }
  } catch (error) {
    console.error('Error fetching exchange rates from API:', error.message);
    if (cachedRates) {
      console.log('Returning stale cached exchange rates as fallback.');
      return cachedRates;
    }
    
    // Completely offline fallback rates
    return {
      base: 'USD',
      rates: {
        USD: 1,
        EUR: 0.91,
        KMF: 450,
        FCFA: 600,
        XOF: 600,
        XAF: 600
      },
      time_last_update_utc: new Date().toUTCString(),
      fallback: true
    };
  }
}

module.exports = {
  getRates
};
