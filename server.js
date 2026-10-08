import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Persistent Storage Path
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.join(DATA_DIR, 'voyage.json');

// Initialize Database structure
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading DB file, initializing fresh:', err);
  }
  const initial = {
    settings: {
      aiProvider: 'gemini', // 'gemini' | 'ollama'
      geminiApiKey: '',
      geminiModel: 'gemini-3.8-flash',
      ollamaUrl: 'http://umbrel.local:11434',
      ollamaModel: 'llama3:latest',
      enableWebSearch: true
    },
    trips: []
  };
  saveDb(initial);
  return initial;
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving DB file:', err);
  }
}

let db = loadDb();

// Seed sample trip if database has zero trips
if (db.trips.length === 0) {
  const sampleTripId = 'trip_' + crypto.randomUUID().slice(0, 8);
  const sampleShareToken = crypto.randomBytes(16).toString('hex');
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 10);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 15);

  const formatDate = (d) => d.toISOString().split('T')[0];

  db.trips.push({
    id: sampleTripId,
    title: 'Kyoto Cultural & Culinary Journey',
    destination: 'Kyoto, Japan',
    startDate: formatDate(nextMonth),
    endDate: formatDate(nextMonthEnd),
    travelers: '2 Adults',
    travelStyle: 'Culture, Food & Relaxation',
    targetBudget: 3500,
    currency: 'USD',
    notes: 'JR Rail Pass activated. Pocket WiFi reserved at KIX airport.',
    shareToken: sampleShareToken,
    createdAt: new Date().toISOString(),
    items: [
      {
        id: 'item_1',
        day: 1,
        timeBlock: 'morning',
        time: '09:30',
        category: 'flight',
        title: 'Arrive at Kansai International Airport (KIX)',
        location: 'Kansai International Airport, Osaka',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kansai+International+Airport',
        websiteUrl: 'https://www.kansai-airport.or.jp/en/',
        cost: 950,
        notes: 'Take Haruka Express direct to Kyoto Station.'
      },
      {
        id: 'item_2',
        day: 1,
        timeBlock: 'afternoon',
        time: '14:00',
        category: 'hotel',
        title: 'Check-in: Hotel Kanra Kyoto',
        location: '190 Kitamachi, Shimogyo Ward, Kyoto',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=Hotel+Kanra+Kyoto',
        websiteUrl: 'https://www.hotelkanra.jp/en/',
        cost: 1100,
        notes: 'Traditional machiya style luxury rooms with wooden cypress tub.'
      },
      {
        id: 'item_3',
        day: 1,
        timeBlock: 'evening',
        time: '18:30',
        category: 'food',
        title: 'Dinner at Pontocho Alley Kaiseki',
        location: 'Pontocho Alley, Nakagyo Ward, Kyoto',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=Pontocho+Alley+Kyoto',
        websiteUrl: '',
        cost: 140,
        notes: 'Riverside dining overlooking Kamogawa River.'
      },
      {
        id: 'item_4',
        day: 2,
        timeBlock: 'morning',
        time: '07:30',
        category: 'activity',
        title: 'Fushimi Inari Taisha Thousand Torii Gates',
        location: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=Fushimi+Inari+Taisha',
        websiteUrl: 'http://inari.jp/en/',
        cost: 0,
        notes: 'Arrive before 8am to experience peaceful mountain paths.'
      },
      {
        id: 'item_5',
        day: 2,
        timeBlock: 'afternoon',
        time: '13:00',
        category: 'food',
        title: 'Nishiki Market Street Food Tour',
        location: 'Nishikikoji-dori, Nakagyo Ward, Kyoto',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=Nishiki+Market+Kyoto',
        websiteUrl: '',
        cost: 45,
        notes: 'Try tako tamago (baby octopus), matcha warabi mochi, and fresh dashi omelettes.'
      }
    ],
    packingList: [
      { id: 'pack_1', category: 'Documents', text: 'Passport & International Drivers Permit', checked: true },
      { id: 'pack_2', category: 'Documents', text: 'JR Rail Pass Exchange Voucher', checked: true },
      { id: 'pack_3', category: 'Electronics', text: 'Japan Type A Power Adapter & Power Bank', checked: false },
      { id: 'pack_4', category: 'Clothing', text: 'Slip-on comfortable walking shoes for temples', checked: false },
      { id: 'pack_5', category: 'Toiletries', text: 'Sunscreen and travel medicine kit', checked: true }
    ],
    expenses: [
      { id: 'exp_1', title: 'Roundtrip Flights', category: 'Flights', amount: 1900, currency: 'USD', paidBy: 'Self' },
      { id: 'exp_2', title: 'Hotel Kanra Deposit', category: 'Hotels', amount: 550, currency: 'USD', paidBy: 'Self' }
    ]
  });
  saveDb(db);
}

// ----------------- DUCKDUCKGO WEB SEARCH HELPER -----------------
async function searchWeb(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) return '';
    const html = await response.text();
    // Extract snippets from DDG HTML
    const snippets = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && snippets.length < 5) {
      const cleanSnippet = match[1].replace(/<[^>]+>/g, '').trim();
      if (cleanSnippet) snippets.push(cleanSnippet);
    }
    return snippets.join('\n\n');
  } catch (err) {
    console.warn('Web search lookup failed:', err.message);
    return '';
  }
}

// ----------------- AI RECOMMENDATION ENGINE -----------------
async function callAiService({ prompt, systemPrompt, settings }) {
  const provider = settings.aiProvider || 'gemini';

  // 1. Google Gemini
  if (provider === 'gemini') {
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is required. Please set it in Settings.');
    }
    const model = settings.geminiModel || 'gemini-3.8-flash';
    
    // Attempt requested model, fallback if version name differs
    const modelsToTry = [model, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError = null;

    for (const m of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: (systemPrompt ? systemPrompt + '\n\n' : '') + prompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048
            }
          })
        });

        if (res.ok) {
          const json = await res.json();
          const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) return candidate;
        } else {
          const errText = await res.text();
          lastError = new Error(`Gemini (${m}) failed [${res.status}]: ${errText}`);
          if (res.status === 404) continue; // Try next fallback model
          throw lastError;
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Failed to generate with Gemini');
  }

  // 2. Local Ollama
  if (provider === 'ollama') {
    const ollamaUrl = (settings.ollamaUrl || 'http://umbrel.local:11434').replace(/\/$/, '');
    const model = settings.ollamaModel || 'llama3:latest';

    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        stream: false
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama request failed [${res.status}]: ${errText}`);
    }

    const json = await res.json();
    return json.message?.content || json.response || '';
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

// ----------------- API ROUTES: SETTINGS -----------------
app.get('/api/settings', (req, res) => {
  const safeSettings = { ...db.settings };
  if (safeSettings.geminiApiKey) {
    // Mask key for safety
    safeSettings.hasGeminiKey = true;
    safeSettings.geminiApiKeyMasked = safeSettings.geminiApiKey.slice(0, 4) + '••••••••' + safeSettings.geminiApiKey.slice(-4);
  } else {
    safeSettings.hasGeminiKey = false;
  }
  res.json(safeSettings);
});

app.post('/api/settings', (req, res) => {
  const updates = req.body;
  db.settings = { ...db.settings, ...updates };
  saveDb(db);
  res.json({ success: true, settings: db.settings });
});

// Test AI Provider Connection
app.post('/api/settings/test', async (req, res) => {
  try {
    const testSettings = { ...db.settings, ...req.body };
    const response = await callAiService({
      prompt: 'Respond with exactly: "AI connection successful."',
      systemPrompt: 'You are a connection test responder.',
      settings: testSettings
    });
    res.json({ success: true, message: response.trim() });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ----------------- API ROUTES: TRIPS -----------------
app.get('/api/trips', (req, res) => {
  const summary = db.trips.map(t => ({
    id: t.id,
    title: t.title,
    destination: t.destination,
    startDate: t.startDate,
    endDate: t.endDate,
    travelers: t.travelers,
    travelStyle: t.travelStyle,
    targetBudget: t.targetBudget,
    currency: t.currency,
    itemsCount: t.items?.length || 0,
    packingCount: t.packingList?.length || 0,
    packingDone: t.packingList?.filter(p => p.checked).length || 0,
    shareToken: t.shareToken,
    createdAt: t.createdAt
  }));
  res.json(summary);
});

app.post('/api/trips', (req, res) => {
  const { title, destination, startDate, endDate, travelers, travelStyle, targetBudget, currency, notes } = req.body;
  if (!destination) {
    return res.status(400).json({ error: 'Destination is required' });
  }

  const newTrip = {
    id: 'trip_' + crypto.randomUUID().slice(0, 8),
    title: title || `Trip to ${destination}`,
    destination,
    startDate: startDate || '',
    endDate: endDate || '',
    travelers: travelers || '1 Traveler',
    travelStyle: travelStyle || 'General',
    targetBudget: Number(targetBudget) || 0,
    currency: currency || 'USD',
    notes: notes || '',
    shareToken: crypto.randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString(),
    items: [],
    packingList: [],
    expenses: []
  };

  db.trips.unshift(newTrip);
  saveDb(db);
  res.status(201).json(newTrip);
});

app.get('/api/trips/:id', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json(trip);
});

app.put('/api/trips/:id', (req, res) => {
  const index = db.trips.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Trip not found' });

  db.trips[index] = { ...db.trips[index], ...req.body, id: db.trips[index].id };
  saveDb(db);
  res.json(db.trips[index]);
});

app.delete('/api/trips/:id', (req, res) => {
  const index = db.trips.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Trip not found' });

  const deleted = db.trips.splice(index, 1);
  saveDb(db);
  res.json({ success: true, deleted: deleted[0].id });
});

// ----------------- API ROUTES: ITINERARY ITEMS -----------------
app.post('/api/trips/:id/items', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const { day, timeBlock, time, category, title, location, mapUrl, websiteUrl, cost, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const cleanLocation = location || '';
  const generatedMapUrl = mapUrl || (cleanLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanLocation)}` : '');

  const newItem = {
    id: 'item_' + crypto.randomUUID().slice(0, 8),
    day: Number(day) || 1,
    timeBlock: timeBlock || 'morning',
    time: time || '10:00',
    category: category || 'activity',
    title,
    location: cleanLocation,
    mapUrl: generatedMapUrl,
    websiteUrl: websiteUrl || '',
    cost: Number(cost) || 0,
    notes: notes || ''
  };

  trip.items = trip.items || [];
  trip.items.push(newItem);
  saveDb(db);
  res.status(201).json(newItem);
});

app.put('/api/trips/:id/items/:itemId', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const itemIndex = trip.items.findIndex(i => i.id === req.params.itemId);
  if (itemIndex === -1) return res.status(404).json({ error: 'Item not found' });

  const updatedItem = { ...trip.items[itemIndex], ...req.body, id: trip.items[itemIndex].id };
  if (updatedItem.location && !updatedItem.mapUrl) {
    updatedItem.mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(updatedItem.location)}`;
  }

  trip.items[itemIndex] = updatedItem;
  saveDb(db);
  res.json(updatedItem);
});

app.delete('/api/trips/:id/items/:itemId', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  trip.items = trip.items.filter(i => i.id !== req.params.itemId);
  saveDb(db);
  res.json({ success: true });
});

// ----------------- API ROUTES: PACKING LIST -----------------
app.post('/api/trips/:id/packing', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const { text, category } = req.body;
  if (!text) return res.status(400).json({ error: 'Item text required' });

  const newPackItem = {
    id: 'pack_' + crypto.randomUUID().slice(0, 8),
    category: category || 'General',
    text,
    checked: false
  };

  trip.packingList = trip.packingList || [];
  trip.packingList.push(newPackItem);
  saveDb(db);
  res.status(201).json(newPackItem);
});

app.put('/api/trips/:id/packing/:packId', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const item = trip.packingList.find(p => p.id === req.params.packId);
  if (!item) return res.status(404).json({ error: 'Packing item not found' });

  if (req.body.checked !== undefined) item.checked = Boolean(req.body.checked);
  if (req.body.text !== undefined) item.text = req.body.text;
  if (req.body.category !== undefined) item.category = req.body.category;

  saveDb(db);
  res.json(item);
});

app.delete('/api/trips/:id/packing/:packId', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  trip.packingList = trip.packingList.filter(p => p.id !== req.params.packId);
  saveDb(db);
  res.json({ success: true });
});

// ----------------- API ROUTES: EXPENSES -----------------
app.post('/api/trips/:id/expenses', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const { title, category, amount, currency, paidBy } = req.body;
  const newExp = {
    id: 'exp_' + crypto.randomUUID().slice(0, 8),
    title: title || 'Expense',
    category: category || 'General',
    amount: Number(amount) || 0,
    currency: currency || trip.currency || 'USD',
    paidBy: paidBy || 'Self'
  };

  trip.expenses = trip.expenses || [];
  trip.expenses.push(newExp);
  saveDb(db);
  res.status(201).json(newExp);
});

app.delete('/api/trips/:id/expenses/:expId', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  trip.expenses = trip.expenses.filter(e => e.id !== req.params.expId);
  saveDb(db);
  res.json({ success: true });
});

// ----------------- AI GENERATION: IDEAS & ITINERARY -----------------
app.post('/api/trips/:id/generate-ideas', async (req, res) => {
  try {
    const trip = db.trips.find(t => t.id === req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { prompt: userPrompt, category } = req.body;

    let webContext = '';
    if (db.settings.enableWebSearch) {
      const searchQuery = `${trip.destination} top ${category || 'attractions and restaurants'} travel guide ${trip.travelStyle}`;
      webContext = await searchWeb(searchQuery);
    }

    const systemPrompt = `You are Voyage, an elite modern travel planner AI.
Return ONLY valid JSON matching this exact structure with NO markdown fences, no conversational text:
{
  "recommendations": [
    {
      "category": "activity" | "food" | "hotel" | "flight" | "transit",
      "title": "Short catchy name",
      "timeBlock": "morning" | "afternoon" | "evening" | "night",
      "suggestedTime": "HH:MM",
      "location": "Address or landmark with city",
      "cost": number (estimated cost in destination currency),
      "description": "2-3 sentences explaining why it's great and practical tips",
      "websiteUrl": "official or booking URL if known, else empty"
    }
  ]
}`;

    const prompt = `Plan recommendations for a trip to "${trip.destination}".
Trip Details:
- Dates: ${trip.startDate || 'Upcoming'} to ${trip.endDate || 'Upcoming'}
- Travelers: ${trip.travelers || '2 travelers'}
- Style & Vibe: ${trip.travelStyle || 'Explore'}
- Target Budget: ${trip.currency} ${trip.targetBudget || 'Flexible'}
${category ? `- Specific category focus: ${category}` : ''}
${userPrompt ? `- User special request: ${userPrompt}` : ''}
${webContext ? `\nRecent Web Search Information:\n${webContext}` : ''}

Provide 5 to 7 diverse, high-quality, practical recommendations (mix of activities, dining, must-see sights, and hidden gems).`;

    const aiOutput = await callAiService({
      prompt,
      systemPrompt,
      settings: db.settings
    });

    // Clean JSON response
    let jsonStr = aiOutput.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);
    res.json(parsed);
  } catch (err) {
    console.error('Error generating AI ideas:', err);
    res.status(500).json({ error: err.message || 'Failed to generate recommendations' });
  }
});

// ----------------- AI GENERATION: SMART PACKING -----------------
app.post('/api/trips/:id/generate-packing', async (req, res) => {
  try {
    const trip = db.trips.find(t => t.id === req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const systemPrompt = `You are a smart travel packing advisor.
Return ONLY valid JSON matching this exact schema without markdown fences:
{
  "items": [
    { "category": "Clothing" | "Documents" | "Electronics" | "Toiletries" | "Health" | "Gear", "text": "Item name with brief note" }
  ]
}`;

    const prompt = `Generate a customized packing list for a trip to "${trip.destination}".
Trip Duration: ${trip.startDate} to ${trip.endDate}
Style: ${trip.travelStyle}
Travelers: ${trip.travelers}
Provide 12-18 essential and destination-specific packing items.`;

    const aiOutput = await callAiService({
      prompt,
      systemPrompt,
      settings: db.settings
    });

    let jsonStr = aiOutput.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);
    
    // Add items to trip packing list
    const addedItems = [];
    if (Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        const newItem = {
          id: 'pack_' + crypto.randomUUID().slice(0, 8),
          category: item.category || 'General',
          text: item.text,
          checked: false
        };
        trip.packingList.push(newItem);
        addedItems.push(newItem);
      }
      saveDb(db);
    }

    res.json({ success: true, added: addedItems });
  } catch (err) {
    console.error('Error generating packing list:', err);
    res.status(500).json({ error: err.message || 'Failed to generate packing list' });
  }
});

function parseRawPlanHeuristically(rawPlan) {
  const lines = rawPlan.split('\n').map(l => l.trim()).filter(Boolean);
  let destination = 'Kyoto, Japan';
  let title = 'Imported Expedition';
  let currentDay = 1;
  const items = [];
  const packingList = [];
  const expenses = [];

  for (const line of lines) {
    if (/(?:trip to|travel to|visiting|destination:?)\s*([A-Za-z\s,]+)/i.test(line)) {
      const match = line.match(/(?:trip to|travel to|visiting|destination:?)\s*([A-Za-z\s,]+)/i);
      if (match && match[1]) {
        destination = match[1].trim();
        title = `Trip to ${destination}`;
        break;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Day headers (e.g. Day 1, Day 02, Day 3: Arashiyama)
    const dayMatch = line.match(/^(?:day|dia)\s*(\d+)[:\s-]*(.*)$/i) || line.match(/^(?:day\s*[a-z]+|\d+(?:st|nd|rd|th)\s*day)[:\s-]*(.*)$/i);
    if (dayMatch) {
      if (dayMatch[1]) {
        currentDay = parseInt(dayMatch[1], 10);
      } else {
        currentDay++;
      }
      const restOfLine = (dayMatch[2] || '').trim();
      if (!restOfLine) {
        continue;
      }
      line = restOfLine;
    }

    // Split sentences / activities if multiple listed in one line
    const segments = line.split(/(?<=[.!?])\s+|;\s+/).map(s => s.trim()).filter(s => s.length > 3);
    const subLines = segments.length > 1 ? segments : [line];

    for (const subLine of subLines) {
      let time = '10:00';
      let timeBlock = 'morning';
      const timeMatch = subLine.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeMatch) {
        time = timeMatch[1].trim();
      }

      let category = 'activity';
      const lower = subLine.toLowerCase();
      if (lower.includes('flight') || lower.includes('terminal') || lower.includes('airport') || lower.includes('landing') || lower.includes('kix') || lower.includes('nrt') || lower.includes('hnd')) {
        category = 'flight';
        timeBlock = 'morning';
      } else if (lower.includes('hotel') || lower.includes('check in') || lower.includes('check-in') || lower.includes('ryokan') || lower.includes('airbnb') || lower.includes('resort')) {
        category = 'hotel';
        timeBlock = 'afternoon';
      } else if (lower.includes('lunch') || lower.includes('dinner') || lower.includes('breakfast') || lower.includes('cafe') || lower.includes('restaurant') || lower.includes('ramen') || lower.includes('bar ') || lower.includes('food') || lower.includes('sushi') || lower.includes('dining')) {
        category = 'food';
        if (lower.includes('dinner') || lower.includes('bar')) timeBlock = 'evening';
        else if (lower.includes('lunch')) timeBlock = 'afternoon';
        else timeBlock = 'morning';
      } else if (lower.includes('train') || lower.includes('bus') || lower.includes('shinkansen') || lower.includes('metro') || lower.includes('transit') || lower.includes('taxi')) {
        category = 'transit';
      }

      let itemTitle = subLine
        .replace(/^[-*•\d.)\]\s]+/, '')
        .replace(/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–:]?\s*/i, '')
        .trim();

      if (itemTitle.length > 2 && !itemTitle.toLowerCase().startsWith('day ')) {
        items.push({
          day: currentDay,
          timeBlock,
          time,
          category,
          title: itemTitle.slice(0, 80),
          location: itemTitle.split(' - ')[0].replace(/^(?:visit|explore|see|go to)\s+/i, '').trim() || destination,
          cost: 0,
          notes: subLine
        });
      }
    }
  }

  if (items.length === 0) {
    items.push({
      day: 1,
      timeBlock: 'morning',
      time: '10:00',
      category: 'activity',
      title: 'Arrival & First Impressions',
      location: destination,
      cost: 0,
      notes: rawPlan.slice(0, 200)
    });
  }

  return {
    destination,
    title,
    startDate: '',
    endDate: '',
    travelers: '2 Travelers',
    travelStyle: 'Exploration',
    targetBudget: 2500,
    currency: 'USD',
    notes: 'Converted from raw travel plan',
    items,
    packingList,
    expenses
  };
}

// ----------------- AI / HEURISTIC IMPORT: PARSE & IMPORT EXISTING PLAN -----------------
app.post(['/api/import-plan', '/api/trips/import-plan'], async (req, res) => {
  try {
    const { rawPlan } = req.body;
    const targetTripId = req.body.targetTripId || req.body.tripId;
    const importMode = req.body.importMode || (targetTripId ? 'current' : 'new');

    if (!rawPlan || !rawPlan.trim()) {
      return res.status(400).json({ error: 'Please paste your existing plan text' });
    }

    let parsed = null;

    // Check if an AI provider has an API key configured (Gemini or OpenAI or Ollama)
    const hasAiKey = Boolean(
      db.settings.geminiApiKey || 
      process.env.GEMINI_API_KEY || 
      db.settings.aiProvider === 'ollama'
    );

    if (hasAiKey) {
      try {
        const systemPrompt = `You are Voyage Itinerary Parser AI.
Your job is to read unstructured or formatted trip plans, emails, notes, bullet points, or bookings, and extract a complete, organized travel itinerary.
Return ONLY valid JSON matching this exact schema with NO markdown fences, no conversational text:
{
  "destination": "City, Country or Region",
  "title": "Descriptive catchy Trip Title",
  "startDate": "YYYY-MM-DD" or "",
  "endDate": "YYYY-MM-DD" or "",
  "travelers": "e.g. 2 Adults or Solo Traveler",
  "travelStyle": "e.g. Cultural & Foodie, Backpacking, Luxury, Family",
  "targetBudget": number,
  "currency": "USD" | "EUR" | "GBP" | "JPY",
  "notes": "Key notes or general tips",
  "items": [
    {
      "day": number (1, 2, 3...),
      "timeBlock": "morning" | "afternoon" | "evening" | "night",
      "time": "HH:MM",
      "category": "flight" | "hotel" | "food" | "activity" | "transit",
      "title": "Concise name of place or activity",
      "location": "Address or landmark name",
      "cost": number,
      "websiteUrl": "",
      "notes": "Booking confirmation, instructions or details"
    }
  ],
  "packingList": [
    { "category": "Clothing" | "Documents" | "Electronics", "text": "Item text" }
  ],
  "expenses": [
    { "title": "Expense description", "category": "Flights" | "Hotels" | "Food", "amount": number }
  ]
}`;

        const prompt = `Parse and convert the following existing travel plan text into the structured JSON schema:

=== RAW PLAN TEXT ===
${rawPlan}
=== END RAW PLAN TEXT ===

Extract all days, scheduled events, flights, hotels, food spots, and notes accurately. Organize sequential Days starting at Day 1.`;

        const aiOutput = await callAiService({
          prompt,
          systemPrompt,
          settings: db.settings
        });

        let jsonStr = aiOutput.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        jsonStr = jsonStr.trim();

        parsed = JSON.parse(jsonStr);
      } catch (aiErr) {
        console.warn('AI Parsing failed, falling back to sovereign heuristic parser:', aiErr.message);
        parsed = parseRawPlanHeuristically(rawPlan);
      }
    } else {
      // 100% Free / Sovereign local parsing (no API key required)
      parsed = parseRawPlanHeuristically(rawPlan);
    }

    if (importMode === 'current' && targetTripId) {
      const trip = db.trips.find(t => t.id === targetTripId);
      if (!trip) return res.status(404).json({ error: 'Target trip not found' });

      // Append items
      trip.items = trip.items || [];
      if (Array.isArray(parsed.items)) {
        parsed.items.forEach(item => {
          trip.items.push({
            id: 'item_' + crypto.randomUUID().slice(0, 8),
            day: Number(item.day) || 1,
            timeBlock: item.timeBlock || 'morning',
            time: item.time || '10:00',
            category: item.category || 'activity',
            title: item.title,
            location: item.location || '',
            mapUrl: item.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}` : '',
            websiteUrl: item.websiteUrl || '',
            cost: Number(item.cost) || 0,
            notes: item.notes || ''
          });
        });
      }

      // Append packing
      trip.packingList = trip.packingList || [];
      if (Array.isArray(parsed.packingList)) {
        parsed.packingList.forEach(p => {
          trip.packingList.push({
            id: 'pack_' + crypto.randomUUID().slice(0, 8),
            category: p.category || 'General',
            text: p.text,
            checked: false
          });
        });
      }

      // Append expenses
      trip.expenses = trip.expenses || [];
      if (Array.isArray(parsed.expenses)) {
        parsed.expenses.forEach(e => {
          trip.expenses.push({
            id: 'exp_' + crypto.randomUUID().slice(0, 8),
            title: e.title,
            category: e.category || 'General',
            amount: Number(e.amount) || 0,
            currency: trip.currency || 'USD',
            paidBy: 'Self'
          });
        });
      }

      saveDb(db);
      return res.json({ success: true, trip });
    } else {
      // Create new trip
      const newTrip = {
        id: 'trip_' + crypto.randomUUID().slice(0, 8),
        title: parsed.title || `Trip to ${parsed.destination || 'Destination'}`,
        destination: parsed.destination || 'Destination',
        startDate: parsed.startDate || '',
        endDate: parsed.endDate || '',
        travelers: parsed.travelers || '2 Travelers',
        travelStyle: parsed.travelStyle || 'Exploration',
        targetBudget: Number(parsed.targetBudget) || 0,
        currency: parsed.currency || 'USD',
        notes: parsed.notes || '',
        shareToken: crypto.randomBytes(16).toString('hex'),
        createdAt: new Date().toISOString(),
        items: (parsed.items || []).map(item => ({
          id: 'item_' + crypto.randomUUID().slice(0, 8),
          day: Number(item.day) || 1,
          timeBlock: item.timeBlock || 'morning',
          time: item.time || '10:00',
          category: item.category || 'activity',
          title: item.title,
          location: item.location || '',
          mapUrl: item.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}` : '',
          websiteUrl: item.websiteUrl || '',
          cost: Number(item.cost) || 0,
          notes: item.notes || ''
        })),
        packingList: (parsed.packingList || []).map(p => ({
          id: 'pack_' + crypto.randomUUID().slice(0, 8),
          category: p.category || 'General',
          text: p.text,
          checked: false
        })),
        expenses: (parsed.expenses || []).map(e => ({
          id: 'exp_' + crypto.randomUUID().slice(0, 8),
          title: e.title,
          category: e.category || 'General',
          amount: Number(e.amount) || 0,
          currency: parsed.currency || 'USD',
          paidBy: 'Self'
        }))
      };

      db.trips.unshift(newTrip);
      saveDb(db);
      return res.status(201).json({ success: true, trip: newTrip });
    }
  } catch (err) {
    console.error('Error importing plan:', err);
    res.status(500).json({ error: err.message || 'Failed to import plan' });
  }
});

// ----------------- WEATHER FORECAST (OPEN-METEO) -----------------
app.get('/api/weather', async (req, res) => {
  try {
    const { destination } = req.query;
    if (!destination) return res.status(400).json({ error: 'Destination required' });

    // Geocoding
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ error: 'Location coordinates not found' });
    }

    const { latitude, longitude, name, country } = geoData.results[0];
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current_weather=true&timezone=auto`;
    const forecastRes = await fetch(forecastUrl);
    const forecastData = await forecastRes.json();

    res.json({
      location: `${name}, ${country || ''}`,
      current: forecastData.current_weather,
      daily: forecastData.daily
    });
  } catch (err) {
    res.status(500).json({ error: 'Weather lookup failed: ' + err.message });
  }
});

// ----------------- SHARING: READ-ONLY GUEST VIEW -----------------
app.get('/api/share/:token', (req, res) => {
  const trip = db.trips.find(t => t.shareToken === req.params.token);
  if (!trip) return res.status(404).json({ error: 'Shared trip not found or expired' });
  // Return clean public trip
  res.json({
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travelers: trip.travelers,
    travelStyle: trip.travelStyle,
    currency: trip.currency,
    notes: trip.notes,
    items: trip.items || [],
    packingList: (trip.packingList || []).map(p => ({ text: p.text, category: p.category, checked: p.checked })),
    expenses: trip.expenses || []
  });
});

// Dedicated Public Share HTML Page
app.get('/share/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

// ----------------- EXPORT: ICALENDAR (.ICS) -----------------
app.get('/api/trips/:id/export/ics', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).send('Trip not found');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Voyage Travel Planner//EN',
    `X-WR-CALNAME:${trip.title}`,
    'CALSCALE:GREGORIAN'
  ];

  const baseDate = trip.startDate ? new Date(trip.startDate) : new Date();

  (trip.items || []).forEach(item => {
    const itemDate = new Date(baseDate);
    itemDate.setDate(itemDate.getDate() + (item.day - 1));
    const [hh, mm] = (item.time || '10:00').split(':').map(Number);
    itemDate.setHours(hh || 10, mm || 0, 0, 0);

    const endDate = new Date(itemDate);
    endDate.setHours(endDate.getHours() + 2); // Default 2 hr block

    const formatIcsTime = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@voyage.app`,
      `DTSTAMP:${formatIcsTime(new Date())}`,
      `DTSTART:${formatIcsTime(itemDate)}`,
      `DTEND:${formatIcsTime(endDate)}`,
      `SUMMARY:${item.title}`,
      `DESCRIPTION:${(item.notes || '') + (item.websiteUrl ? ' \\nWebsite: ' + item.websiteUrl : '')}`,
      `LOCATION:${item.location || trip.destination}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${trip.destination.replace(/[^a-zA-Z0-9]/g, '_')}_itinerary.ics"`);
  res.send(lines.join('\r\n'));
});

// ----------------- EXPORT: STANDALONE OFFLINE HTML -----------------
app.get('/api/trips/:id/export/html', (req, res) => {
  const trip = db.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).send('Trip not found');

  const itemsByDay = {};
  (trip.items || []).forEach(item => {
    if (!itemsByDay[item.day]) itemsByDay[item.day] = [];
    itemsByDay[item.day].push(item);
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${trip.title} - Offline Travel Guide</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151c2e;
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .hero {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 32px;
    }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .meta { color: var(--text-muted); font-size: 14px; margin-bottom: 12px; }
    .tag { display: inline-block; background: rgba(99, 102, 241, 0.2); color: #818cf8; padding: 4px 10px; border-radius: 20px; font-size: 12px; margin-right: 6px; }
    .day-section { margin-bottom: 32px; }
    .day-title { font-size: 20px; font-weight: 700; color: #a5b4fc; border-bottom: 2px solid rgba(255,255,255,0.06); padding-bottom: 8px; margin-bottom: 16px; }
    .item-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .item-header { display: flex; justify-content: space-between; align-items: baseline; }
    .item-title { font-weight: 700; font-size: 16px; }
    .item-time { font-size: 13px; font-weight: 600; color: #818cf8; }
    .item-loc { font-size: 13px; color: var(--text-muted); }
    .item-notes { font-size: 13px; color: #cbd5e1; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px; margin-top: 4px; }
    .btn-maps {
      display: inline-block;
      align-self: flex-start;
      margin-top: 6px;
      background: #4f46e5;
      color: white;
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    }
    .print-tip { text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>${trip.title}</h1>
      <div class="meta">📍 ${trip.destination} | 📅 ${trip.startDate || ''} to ${trip.endDate || ''} | 👥 ${trip.travelers}</div>
      <div>
        <span class="tag">${trip.travelStyle}</span>
        <span class="tag">Budget: ${trip.currency} ${trip.targetBudget}</span>
      </div>
      ${trip.notes ? `<p style="margin-top:14px; font-size:14px; color:#cbd5e1;">${trip.notes}</p>` : ''}
    </div>

    ${Object.keys(itemsByDay).sort((a,b) => Number(a)-Number(b)).map(day => `
      <div class="day-section">
        <div class="day-title">Day ${day}</div>
        ${itemsByDay[day].map(item => `
          <div class="item-card">
            <div class="item-header">
              <span class="item-title">${item.title}</span>
              <span class="item-time">${item.time || ''} (${item.timeBlock})</span>
            </div>
            ${item.location ? `<div class="item-loc">📍 ${item.location}</div>` : ''}
            ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
            ${item.mapUrl ? `<a class="btn-maps" href="${item.mapUrl}" target="_blank">Open Directions in Google Maps ↗</a>` : ''}
          </div>
        `).join('')}
      </div>
    `).join('')}

    <div class="print-tip">Generated by Voyage Travel Planner · Offline Ready</div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${trip.destination.replace(/[^a-zA-Z0-9]/g, '_')}_offline_guide.html"`);
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Voyage server running on port ${PORT}`);
});
