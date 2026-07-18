const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const https = require('https');

function fetchCsv(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 400) return reject(new Error(`Upstream error ${res.statusCode}`));
            let data = '';
            res.on('data', chunk => data += chunk.toString());
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err));
    });
}

function fetchJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const requestOptions = { headers: Object.assign({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' }, headers) };
        https.get(url, requestOptions, (res) => {
            if (res.statusCode && res.statusCode >= 400) return reject(new Error(`Upstream error ${res.statusCode}`));
            let data = '';
            res.on('data', chunk => data += chunk.toString());
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', err => reject(err));
    });
}

function cleanWikiValue(value) {
    if (!value) return null;
    let text = String(value);
    text = text.replace(/<ref[^>]*>.*?<\/ref>/gi, '');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2');
    text = text.replace(/\{\{[^}]+\}\}/g, '');
    text = text.replace(/\s+/g, ' ').trim();
    return text || null;
}

function parseInfoboxField(text, keys) {
    if (!text) return null;
    const regex = new RegExp(`\\|\\s*(?:${keys.join('|')})\\s*=\\s*([\\s\\S]*?)(?=\\n\\|\\s*[A-Za-z0-9_]+\\s*=|$)`, 'i');
    const match = text.match(regex);
    return match ? cleanWikiValue(match[1]) : null;
}

async function fetchWikiInfobox(title) {
    try {
        const headers = { 'Accept': 'application/json' };
        const infoboxUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=revisions&rvslots=main&rvprop=content&format=json`;
        const pageResult = await fetchJson(infoboxUrl, headers);
        const pages = pageResult && pageResult.query && pageResult.query.pages;
        const page = pages ? Object.values(pages)[0] : null;
        const content = page && page.revisions && page.revisions[0] && page.revisions[0].slots && page.revisions[0].slots.main && page.revisions[0].slots.main['*'];
        if (!content) return null;
        return {
            founded: parseInfoboxField(content, ['founded', 'foundation', 'founded_date', 'formed']),
            fullTimeEmployees: parseInfoboxField(content, ['num_employees', 'employees', 'num_employees_year']),
            totalRevenue: parseInfoboxField(content, ['revenue', 'revenue_us', 'revenue_year', 'revenue_annual']),
            revenueGrowth: parseInfoboxField(content, ['revenue_growth', 'revenuegrowth'])
        };
    }
    catch (err) {
        console.error('Wiki infobox fetch error:', err && err.message);
        return null;
    }
}

async function fetchWikiSummary(query) {
    try {
        const headers = { 'Accept': 'application/json' };
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=1`;
        const searchResult = await fetchJson(searchUrl, headers);
        const page = (searchResult && searchResult.query && Array.isArray(searchResult.query.search) && searchResult.query.search[0]) || null;
        if (!page || !page.title) return null;
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`;
        const summary = await fetchJson(summaryUrl, headers);
        summary._wikiTitle = page.title;
        return summary;
    }
    catch (err) {
        console.error('Wikimedia fetch error:', err && err.message);
        return null;
    }
}

// Serve the index.html frontend file directly from the root directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: return historical pricing as parsed JSON to avoid CORS/proxy needs in the browser
app.get('/api/history/:symbol', async (req, res) => {
    const symbol = String(req.params.symbol || '').toUpperCase();
    try {
        if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

        const exchange = String(req.query.exchange || 'NSE').toUpperCase();
        const suffix = exchange === 'BSE' ? '.BO' : '.NS';
        const url = `https://query1.finance.yahoo.com/v7/finance/download/${symbol}${suffix}?range=3mo&interval=1d&events=history`;
        const csv = await fetchCsv(url);

        const lines = csv.split('\n').filter(l => l.trim());
        if (lines.length <= 1) return res.json({ symbol, data: [] });

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            // expected: Date,Open,High,Low,Close,Adj Close,Volume
            if (cols.length < 7) continue;
            const date = cols[0];
            const open = parseFloat(cols[1]);
            const high = parseFloat(cols[2]);
            const low = parseFloat(cols[3]);
            const close = parseFloat(cols[4]);
            const volume = parseInt(cols[6], 10);
            if (!isNaN(close)) data.push({ date, open, high, low, close, volume: isNaN(volume) ? 0 : volume });
        }

        return res.json({ symbol, data });
    }
    catch (err) {
        console.error('History fetch error:', err && err.message);
        // If upstream rate-limited, return a small synthetic dataset so UI can function during development
        if (err && String(err.message).includes('429')) {
            const today = new Date();
            const data = [];
            for (let i = 30; i >= 0; i--) {
                const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${day}`;
                // simple synthetic price and volume
                const close = 2000 + Math.round(Math.sin(i / 3) * 50 + Math.random() * 20);
                const open = close - Math.round(Math.random() * 10);
                const high = Math.max(open, close) + Math.round(Math.random() * 8);
                const low = Math.min(open, close) - Math.round(Math.random() * 8);
                const volume = 1000000 + Math.round(Math.random() * 500000);
                data.push({ date: dateStr, open, high, low, close, volume });
            }
            return res.json({ symbol, data });
        }

        return res.status(502).json({ error: 'Failed to fetch history' });
    }
});

// API: company profile (name, sector, industry, website, summary, marketCap)
app.get('/api/profile/:symbol', async (req, res) => {
    const symbol = String(req.params.symbol || '').toUpperCase();
    try {
        if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

        const exchange = String(req.query.exchange || 'NSE').toUpperCase();
        const suffix = exchange === 'BSE' ? '.BO' : '.NS';
        const wikiQueryParam = String(req.query.wikiQuery || '').trim();
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}${suffix}?modules=price,summaryProfile,assetProfile,financialData`;

        const json = await fetchJson(url);
        const result = (json && json.quoteSummary && Array.isArray(json.quoteSummary.result) && json.quoteSummary.result[0]) || null;
        if (!result) return res.status(502).json({ error: 'No profile data' });

        const profile = {};
        profile.longName = result.price && result.price.longName ? result.price.longName : (result.price && result.price.shortName ? result.price.shortName : symbol);
        profile.sector = (result.assetProfile && result.assetProfile.sector) || (result.summaryProfile && result.summaryProfile.sector) || '';
        profile.industry = (result.assetProfile && result.assetProfile.industry) || '';
        profile.website = (result.assetProfile && result.assetProfile.website) || '';
        profile.summary = (result.assetProfile && result.assetProfile.longBusinessSummary) || (result.summaryProfile && result.summaryProfile.longBusinessSummary) || '';
        profile.marketCap = (result.price && result.price.marketCap && result.price.marketCap.raw) ? result.price.marketCap.raw : null;
        profile.founded = (result.assetProfile && result.assetProfile.founded) || (result.summaryProfile && result.summaryProfile.founded) || null;
        profile.fullTimeEmployees = (result.assetProfile && result.assetProfile.fullTimeEmployees) || null;
        profile.totalRevenue = (result.financialData && result.financialData.totalRevenue && result.financialData.totalRevenue.fmt) || null;
        profile.revenueGrowth = (result.financialData && result.financialData.revenueGrowth && result.financialData.revenueGrowth.fmt) || null;
        profile.wikipedia = null;
        profile.summarySource = 'Yahoo Finance';

        const needsWikiFallback = !profile.summary || profile.summary.includes('Profile temporarily unavailable') || profile.summary === 'N/A' || profile.summary.trim().length < 40;
        const wikiQuery = wikiQueryParam || profile.longName || symbol;
        if (needsWikiFallback || wikiQueryParam) {
            const wiki = await fetchWikiSummary(wikiQuery);
            if (wiki && wiki.extract) {
                profile.summary = wiki.extract;
                profile.wikipedia = (wiki.content_urls && wiki.content_urls.desktop && wiki.content_urls.desktop.page) || wiki.content_urls?.desktop?.page || null;
                profile.summarySource = 'Wikipedia';
                if (!profile.longName && wiki.title) profile.longName = wiki.title;
                const infobox = await fetchWikiInfobox(wiki._wikiTitle || wiki.title);
                if (infobox) {
                    profile.founded = profile.founded || infobox.founded;
                    profile.fullTimeEmployees = profile.fullTimeEmployees || infobox.fullTimeEmployees;
                    profile.totalRevenue = profile.totalRevenue || infobox.totalRevenue;
                    profile.revenueGrowth = profile.revenueGrowth || infobox.revenueGrowth;
                }
            }
        }

        return res.json({ symbol, profile });
    }
    catch (err) {
        console.error('Profile fetch error:', err && err.message);
        const wikiQuery = String(req.query.wikiQuery || '').trim() || symbol;
        const wiki = await fetchWikiSummary(wikiQuery);
        const profile = {
            longName: symbol,
            sector: '',
            industry: '',
            website: '',
            summary: 'Profile temporarily unavailable due to upstream rate limits.',
            marketCap: null,
            founded: null,
            fullTimeEmployees: null,
            totalRevenue: null,
            revenueGrowth: null,
            summarySource: wiki && wiki.extract ? 'Wikipedia' : 'Yahoo Finance',
            wikipedia: wiki && wiki.content_urls && wiki.content_urls.desktop ? wiki.content_urls.desktop.page : null
        };

        if (wiki && wiki.extract) {
            profile.summary = wiki.extract;
            profile.summarySource = 'Wikipedia';
            if (wiki.title) profile.longName = wiki.title;
            const infobox = await fetchWikiInfobox(wiki._wikiTitle || wiki.title);
            if (infobox) {
                profile.founded = profile.founded || infobox.founded;
                profile.fullTimeEmployees = profile.fullTimeEmployees || infobox.fullTimeEmployees;
                profile.totalRevenue = profile.totalRevenue || infobox.totalRevenue;
                profile.revenueGrowth = profile.revenueGrowth || infobox.revenueGrowth;
            }
        }

        const shouldReturnFallback = wiki && wiki.extract;
        const shouldReturnOnYahooIssue = err && String(err.message).match(/429|401|403|404|Upstream error/i);
        if (shouldReturnFallback || shouldReturnOnYahooIssue) {
            return res.json({ symbol, profile });
        }

        return res.status(502).json({ error: 'Failed to fetch profile' });
    }
});

app.listen(PORT, () => {
    console.log(`[Server] Running smoothly at http://localhost:${PORT}`);
});
