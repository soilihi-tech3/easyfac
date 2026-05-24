const http = require('http');

http.get('http://localhost:3001/api/factures', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.error("API ERROR:", parsed.error);
      } else {
        console.log("API Success! Found", parsed.length, "factures.");
        console.log("Most recent:", parsed[0].numero, parsed[0].id);
      }
    } catch (e) {
      console.error("Parse error:", e);
      console.log("Raw response:", data.substring(0, 500));
    }
  });
}).on('error', err => {
  console.error("Request failed:", err.message);
});
