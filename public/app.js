// Voyage Client Application Logic

let activeTripId = null;
let currentTrip = null;
let appSettings = null;
let leafletMap = null;
let mapMarkers = [];
let activeDayFilter = 'all';

// DOM Elements
const selectTrip = document.getElementById('select-active-trip');
const btnNewTrip = document.getElementById('btn-new-trip');
const tabPlanning = document.getElementById('tab-planning');
const tabViewing = document.getElementById('tab-viewing');
const sectionPlanning = document.getElementById('section-planning');
const sectionViewing = document.getElementById('section-viewing');
const btnShare = document.getElementById('btn-share-trip');
const btnSettings = document.getElementById('btn-open-settings');

// Hero elements
const heroTitle = document.getElementById('hero-title');
const heroDest = document.getElementById('hero-dest');
const heroDates = document.getElementById('hero-dates');
const heroTravelers = document.getElementById('hero-travelers');
const heroStyle = document.getElementById('hero-style');
const heroNotes = document.getElementById('hero-notes');
const weatherStatus = document.getElementById('weather-status');

// Modals
const modalNewTrip = document.getElementById('modal-new-trip');
const modalSettings = document.getElementById('modal-settings');
const modalShare = document.getElementById('modal-share');
const modalEditItem = document.getElementById('modal-edit-item');

// Initialize on Load
window.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupModals();
  setupForms();
  setupAISection();
  setupToolsTabs();
  initMap();

  await loadSettings();
  await loadTrips();
});

// ----------------- NAVIGATION & TABS -----------------
function setupNavigation() {
  tabPlanning.addEventListener('click', () => switchTab('planning'));
  tabViewing.addEventListener('click', () => switchTab('viewing'));

  selectTrip.addEventListener('change', (e) => {
    if (e.target.value) {
      loadTripDetails(e.target.value);
    }
  });

  btnNewTrip.addEventListener('click', () => openModal(modalNewTrip));
  document.getElementById('btn-open-import').addEventListener('click', openImportModal);
  btnShare.addEventListener('click', () => openShareModal());
  btnSettings.addEventListener('click', () => openSettingsModal());
}

function switchTab(mode) {
  if (mode === 'planning') {
    tabPlanning.classList.add('active');
    tabViewing.classList.remove('active');
    sectionPlanning.classList.add('active');
    sectionViewing.classList.remove('active');
  } else {
    tabViewing.classList.add('active');
    tabPlanning.classList.remove('active');
    sectionViewing.classList.add('active');
    sectionPlanning.classList.remove('active');
    // Refresh leaflet map view once container is visible
    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize();
      renderMapMarkers();
    }, 200);
  }
}

// ----------------- DATA LOADING -----------------
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    appSettings = await res.json();
    updateAIBadges();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function updateAIBadges() {
  const badgeModel = document.getElementById('badge-ai-model');
  const labelProvider = document.getElementById('ai-active-provider-label');
  if (appSettings.aiProvider === 'gemini') {
    badgeModel.textContent = appSettings.geminiModel || 'Gemini 3.8 Flash';
    labelProvider.textContent = 'Using Google Gemini & Live Web Search';
  } else {
    badgeModel.textContent = appSettings.ollamaModel || 'Local Ollama';
    labelProvider.textContent = 'Using Local Ollama (Umbrel Home Server)';
  }
}

async function loadTrips() {
  try {
    const res = await fetch('/api/trips');
    const trips = await res.json();

    selectTrip.innerHTML = '';
    if (trips.length === 0) {
      selectTrip.innerHTML = '<option value="">No trips found</option>';
      return;
    }

    trips.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.title || t.destination} (${t.startDate ? t.startDate.slice(5) : 'Upcoming'})`;
      selectTrip.appendChild(opt);
    });

    // Default to first trip
    if (!activeTripId || !trips.some(t => t.id === activeTripId)) {
      activeTripId = trips[0].id;
    }
    selectTrip.value = activeTripId;
    await loadTripDetails(activeTripId);
  } catch (err) {
    console.error('Error loading trips:', err);
  }
}

async function loadTripDetails(id) {
  try {
    activeTripId = id;
    const res = await fetch(`/api/trips/${id}`);
    if (!res.ok) throw new Error('Trip not found');
    currentTrip = await res.json();

    renderHero();
    renderDayFilters();
    renderViewingTimeline();
    renderPackingList();
    renderBudget();
    renderStats();
    loadWeather();
  } catch (err) {
    console.error('Error loading trip details:', err);
  }
}

// ----------------- HERO & WEATHER -----------------
function renderHero() {
  if (!currentTrip) return;
  heroTitle.textContent = currentTrip.title || currentTrip.destination;
  heroDest.textContent = `📍 ${currentTrip.destination}`;
  heroDates.textContent = `📅 ${currentTrip.startDate || 'TBD'} to ${currentTrip.endDate || 'TBD'}`;
  heroTravelers.textContent = `👥 ${currentTrip.travelers || '1'}`;
  heroStyle.textContent = `🏷️ ${currentTrip.travelStyle || 'Explore'}`;
  heroNotes.textContent = currentTrip.notes || 'No notes added yet. Use the planning section to build your itinerary.';
}

async function loadWeather() {
  if (!currentTrip || !currentTrip.destination) return;
  weatherStatus.innerHTML = '<span>🌤️ Loading weather...</span>';

  try {
    const res = await fetch(`/api/weather?destination=${encodeURIComponent(currentTrip.destination)}`);
    if (!res.ok) {
      weatherStatus.innerHTML = '<span style="font-size:12px; color:var(--text-dim);">Weather info unavailable</span>';
      return;
    }
    const data = await res.json();
    const tempC = Math.round(data.current?.temperature || 20);
    const tempF = Math.round((tempC * 9/5) + 32);

    weatherStatus.innerHTML = `
      <div class="weather-temp">${tempC}°C <span style="font-size:18px; color:var(--text-muted);">/ ${tempF}°F</span></div>
      <div class="weather-condition">📍 ${data.location}</div>
      <div class="weather-forecast-strip">
        <span class="forecast-day">Wind: ${data.current?.windspeed || 0} km/h</span>
      </div>
    `;
  } catch (err) {
    weatherStatus.innerHTML = '<span style="font-size:12px; color:var(--text-dim);">Forecast offline</span>';
  }
}

// ----------------- ITINERARY TIMELINE & VIEWING -----------------
function renderDayFilters() {
  const bar = document.getElementById('day-filter-bar');
  bar.innerHTML = '<button class="day-filter-btn active" data-day="all">All Days</button>';

  if (!currentTrip || !currentTrip.items) return;
  const days = [...new Set(currentTrip.items.map(i => Number(i.day) || 1))].sort((a,b) => a - b);

  days.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'day-filter-btn';
    btn.dataset.day = d;
    btn.textContent = `Day ${d}`;
    bar.appendChild(btn);
  });

  bar.querySelectorAll('.day-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      bar.querySelectorAll('.day-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDayFilter = btn.dataset.day;
      renderViewingTimeline();
      renderMapMarkers();
    });
  });
}

function renderViewingTimeline() {
  const container = document.getElementById('viewing-timeline-container');
  container.innerHTML = '';

  if (!currentTrip || !currentTrip.items || currentTrip.items.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:48px 24px;">
        <span style="font-size:36px; display:block; margin-bottom:12px;">🗺️</span>
        <h3>Your itinerary is waiting to be written</h3>
        <p style="color:var(--text-muted); font-size:14px; margin-top:6px;">Switch to the Planning tab to generate ideas with AI or add flights, hotels, and sights manually.</p>
      </div>
    `;
    return;
  }

  // Filter items
  let filteredItems = currentTrip.items;
  if (activeDayFilter !== 'all') {
    filteredItems = currentTrip.items.filter(i => String(i.day) === String(activeDayFilter));
  }

  // Group by day
  const daysMap = {};
  filteredItems.forEach(item => {
    const d = item.day || 1;
    if (!daysMap[d]) daysMap[d] = [];
    daysMap[d].push(item);
  });

  const sortedDays = Object.keys(daysMap).sort((a,b) => Number(a) - Number(b));

  sortedDays.forEach(day => {
    const dayGroup = document.createElement('div');
    dayGroup.className = 'day-timeline-group';

    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-heading';
    dayHeader.innerHTML = `
      <span>Day ${day}</span>
      <span style="font-size:13px; font-weight:600; color:var(--text-dim);">${daysMap[day].length} scheduled items</span>
    `;
    dayGroup.appendChild(dayHeader);

    // Sort items within day by time
    daysMap[day].sort((a,b) => (a.time || '10:00').localeCompare(b.time || '10:00')).forEach(item => {
      const card = document.createElement('div');
      card.className = 'timeline-card';

      const catBadge = getCategoryBadge(item.category);
      const gmapsUrl = item.mapUrl || (item.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}` : '');

      card.innerHTML = `
        <div class="timeline-header">
          <div class="timeline-title-row">
            ${catBadge}
            <span class="timeline-title">${escapeHtml(item.title)}</span>
          </div>
          <span class="timeline-time-badge">${item.time || 'Flexible'} (${item.timeBlock || 'Day'})</span>
        </div>
        ${item.location ? `<div class="timeline-loc">📍 ${escapeHtml(item.location)}</div>` : ''}
        ${item.notes ? `<div class="timeline-notes">${escapeHtml(item.notes)}</div>` : ''}
        <div class="timeline-actions-row">
          <div>
            ${gmapsUrl ? `<a href="${gmapsUrl}" target="_blank" rel="noopener" class="btn-gmaps">📍 Open in Google Maps ↗</a>` : ''}
            ${item.websiteUrl ? `<a href="${item.websiteUrl}" target="_blank" rel="noopener" class="btn-subtle" style="margin-left:6px;">Visit Site ↗</a>` : ''}
          </div>
          <div class="timeline-quick-actions">
            <button class="btn-inline-edit" data-edit-id="${item.id}">✏️ Edit</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-inline-edit').addEventListener('click', () => {
        openEditItemModal(item);
      });

      dayGroup.appendChild(card);
    });

    container.appendChild(dayGroup);
  });
}

function getCategoryBadge(cat) {
  const map = {
    flight: '<span class="ai-rec-badge cat-flight">✈️ Flight</span>',
    hotel: '<span class="ai-rec-badge cat-hotel">🏨 Hotel</span>',
    food: '<span class="ai-rec-badge cat-food">🍽️ Dining</span>',
    activity: '<span class="ai-rec-badge cat-activity">🎯 Activity</span>',
    note: '<span class="ai-rec-badge cat-note">📝 Info</span>'
  };
  return map[cat] || '<span class="ai-rec-badge cat-activity">🎯 Place</span>';
}

// ----------------- LEAFLET MAP INTEGRATION -----------------
function initMap() {
  const mapContainer = document.getElementById('trip-map');
  if (!mapContainer) return;

  // Initialize center at world or Tokyo default
  leafletMap = L.map('trip-map').setView([35.0116, 135.7681], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(leafletMap);
}

async function renderMapMarkers() {
  if (!leafletMap || !currentTrip) return;

  // Clear existing markers
  mapMarkers.forEach(m => leafletMap.removeLayer(m));
  mapMarkers = [];

  let itemsToMap = currentTrip.items || [];
  if (activeDayFilter !== 'all') {
    itemsToMap = itemsToMap.filter(i => String(i.day) === String(activeDayFilter));
  }

  // Geocode items with location
  const bounds = [];

  for (const item of itemsToMap) {
    if (!item.location) continue;
    try {
      // Free geocoding lookup through Open-Meteo or Nominatim
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(item.location.split(',')[0])}&count=1`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const { latitude, longitude } = data.results[0];
        const marker = L.marker([latitude, longitude]).addTo(leafletMap);
        marker.bindPopup(`
          <strong>${escapeHtml(item.title)}</strong><br>
          📍 ${escapeHtml(item.location)}<br>
          <a href="${item.mapUrl || '#'}" target="_blank" style="color:#2563eb; font-weight:600; text-decoration:none;">Open in Google Maps ↗</a>
        `);
        mapMarkers.push(marker);
        bounds.push([latitude, longitude]);
      }
    } catch (e) {
      // Skip failed geocodes silently
    }
  }

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [40, 40] });
  } else if (currentTrip.destination) {
    // Center destination
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(currentTrip.destination)}&count=1`);
      const data = await res.json();
      if (data.results?.[0]) {
        leafletMap.setView([data.results[0].latitude, data.results[0].longitude], 12);
      }
    } catch (e) {}
  }
}

// ----------------- PACKING LIST & BUDGET -----------------
function setupToolsTabs() {
  const tabPack = document.getElementById('tab-packing-btn');
  const tabBudget = document.getElementById('tab-budget-btn');
  const panelPack = document.getElementById('panel-packing');
  const panelBudget = document.getElementById('panel-budget');

  tabPack.addEventListener('click', () => {
    tabPack.classList.add('active');
    tabBudget.classList.remove('active');
    panelPack.classList.add('active');
    panelBudget.classList.remove('active');
  });

  tabBudget.addEventListener('click', () => {
    tabBudget.classList.add('active');
    tabPack.classList.remove('active');
    panelBudget.classList.add('active');
    panelPack.classList.remove('active');
  });

  // Add packing item
  document.getElementById('btn-add-pack').addEventListener('click', async () => {
    const input = document.getElementById('pack-input-text');
    const cat = document.getElementById('pack-input-category').value;
    const text = input.value.trim();
    if (!text || !activeTripId) return;

    await fetch(`/api/trips/${activeTripId}/packing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, category: cat })
    });
    input.value = '';
    await loadTripDetails(activeTripId);
  });

  // AI Auto-pack suggestions
  document.getElementById('btn-auto-pack').addEventListener('click', async () => {
    if (!activeTripId) return;
    const btn = document.getElementById('btn-auto-pack');
    btn.textContent = 'Generating packing advice...';
    try {
      const res = await fetch(`/api/trips/${activeTripId}/generate-packing`, { method: 'POST' });
      await loadTripDetails(activeTripId);
    } catch (err) {
      alert('Failed to generate packing list: ' + err.message);
    } finally {
      btn.textContent = '⚡ AI Packing Suggestions';
    }
  });

  // Add expense
  document.getElementById('btn-add-expense').addEventListener('click', async () => {
    const titleInput = document.getElementById('exp-input-title');
    const catInput = document.getElementById('exp-input-category');
    const amtInput = document.getElementById('exp-input-amount');

    const title = titleInput.value.trim();
    const category = catInput.value;
    const amount = Number(amtInput.value);

    if (!title || !amount || !activeTripId) return;

    await fetch(`/api/trips/${activeTripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, amount, currency: currentTrip.currency || 'USD' })
    });

    titleInput.value = '';
    amtInput.value = '';
    await loadTripDetails(activeTripId);
  });
}

function renderPackingList() {
  const list = document.getElementById('packing-list-items');
  const label = document.getElementById('packing-progress-label');
  const bar = document.getElementById('packing-progress-bar');
  list.innerHTML = '';

  const items = currentTrip.packingList || [];
  const packedCount = items.filter(i => i.checked).length;
  const percent = items.length > 0 ? Math.round((packedCount / items.length) * 100) : 0;

  label.textContent = `${packedCount} of ${items.length} packed (${percent}%)`;
  bar.style.width = `${percent}%`;

  if (items.length === 0) {
    list.innerHTML = '<li style="color:var(--text-muted); font-size:13px; text-align:center; padding:12px;">No packing items added yet. Click "AI Packing Suggestions" to auto-populate.</li>';
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = `pack-item ${item.checked ? 'checked' : ''}`;
    li.innerHTML = `
      <div class="pack-left">
        <input type="checkbox" ${item.checked ? 'checked' : ''} data-id="${item.id}">
        <span class="pack-text">${escapeHtml(item.text)}</span>
        <span class="pack-badge">${escapeHtml(item.category || 'General')}</span>
      </div>
      <button class="btn-remove-item" data-id="${item.id}" title="Delete">✕</button>
    `;

    li.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
      await fetch(`/api/trips/${activeTripId}/packing/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: e.target.checked })
      });
      await loadTripDetails(activeTripId);
    });

    li.querySelector('.btn-remove-item').addEventListener('click', async () => {
      await fetch(`/api/trips/${activeTripId}/packing/${item.id}`, { method: 'DELETE' });
      await loadTripDetails(activeTripId);
    });

    list.appendChild(li);
  });
}

function renderBudget() {
  const targetVal = document.getElementById('budget-target-val');
  const spentVal = document.getElementById('budget-spent-val');
  const remainVal = document.getElementById('budget-remain-val');
  const list = document.getElementById('expense-list-items');
  list.innerHTML = '';

  const target = currentTrip.targetBudget || 0;
  const curr = currentTrip.currency || 'USD';
  const expenses = currentTrip.expenses || [];
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = target - totalSpent;

  targetVal.textContent = `${curr} ${target.toLocaleString()}`;
  spentVal.textContent = `${curr} ${totalSpent.toLocaleString()}`;
  remainVal.textContent = `${curr} ${remaining.toLocaleString()}`;
  remainVal.style.color = remaining >= 0 ? '#10b981' : '#f43f5e';

  expenses.forEach(exp => {
    const li = document.createElement('li');
    li.className = 'expense-item';
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(exp.title)}</strong>
        <span style="color:var(--text-dim); margin-left:8px;">(${escapeHtml(exp.category)})</span>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-weight:700;">${curr} ${Number(exp.amount).toLocaleString()}</span>
        <button class="btn-remove-item" data-id="${exp.id}">✕</button>
      </div>
    `;

    li.querySelector('.btn-remove-item').addEventListener('click', async () => {
      await fetch(`/api/trips/${activeTripId}/expenses/${exp.id}`, { method: 'DELETE' });
      await loadTripDetails(activeTripId);
    });

    list.appendChild(li);
  });
}

function renderStats() {
  if (!currentTrip) return;
  const stops = currentTrip.items?.length || 0;
  const food = currentTrip.items?.filter(i => i.category === 'food').length || 0;
  const days = [...new Set((currentTrip.items || []).map(i => i.day))].length || 1;
  const target = currentTrip.targetBudget || 1;
  const totalSpent = (currentTrip.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const budgetPercent = Math.min(100, Math.round((totalSpent / target) * 100));

  document.getElementById('stat-total-stops').textContent = stops;
  document.getElementById('stat-total-food').textContent = food;
  document.getElementById('stat-total-days').textContent = days;
  document.getElementById('stat-budget-progress').textContent = `${budgetPercent}%`;
}

// ----------------- AI PLANNER RECOMMENDATIONS -----------------
function setupAISection() {
  const btnGen = document.getElementById('btn-generate-ai');
  const inputPrompt = document.getElementById('ai-custom-prompt');
  const resultsContainer = document.getElementById('ai-results-container');

  document.querySelectorAll('.prompt-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      inputPrompt.value = pill.dataset.prompt;
      triggerAIGeneration();
    });
  });

  btnGen.addEventListener('click', triggerAIGeneration);
  inputPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') triggerAIGeneration();
  });
}

async function triggerAIGeneration() {
  if (!activeTripId) return;
  const inputPrompt = document.getElementById('ai-custom-prompt');
  const btnText = document.getElementById('ai-btn-text');
  const resultsContainer = document.getElementById('ai-results-container');

  const prompt = inputPrompt.value.trim() || 'Suggest top must-see highlights and great restaurants';
  btnText.textContent = 'Searching & Thinking...';
  resultsContainer.innerHTML = `
    <div class="ai-placeholder">
      <div style="font-size:28px; animation: spin 1s linear infinite;">🌀</div>
      <p style="margin-top:12px;">Browsing web info & tailoring recommendations with ${appSettings?.aiProvider === 'gemini' ? 'Gemini 3.8 Flash' : 'Ollama'}...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/trips/${activeTripId}/generate-ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI generation failed');

    renderAIResults(data.recommendations || []);
  } catch (err) {
    resultsContainer.innerHTML = `
      <div class="ai-placeholder" style="color:#fb7185;">
        <p>⚠️ Error: ${escapeHtml(err.message)}</p>
        <p style="font-size:12px; margin-top:6px; color:var(--text-muted);">Check your API Key or Ollama host in Settings (⚙️).</p>
      </div>
    `;
  } finally {
    btnText.textContent = 'Inspire Me';
  }
}

function renderAIResults(recommendations) {
  const container = document.getElementById('ai-results-container');
  container.innerHTML = '';

  if (recommendations.length === 0) {
    container.innerHTML = '<div class="ai-placeholder">No recommendations found. Try another prompt.</div>';
    return;
  }

  recommendations.forEach(rec => {
    const card = document.createElement('div');
    card.className = 'ai-rec-card';

    const catBadge = getCategoryBadge(rec.category);

    card.innerHTML = `
      <div class="ai-rec-top">
        <span class="ai-rec-title">${escapeHtml(rec.title)}</span>
        ${catBadge}
      </div>
      <p class="ai-rec-desc">${escapeHtml(rec.description)}</p>
      <div class="ai-rec-meta">
        <span>📍 ${escapeHtml(rec.location || currentTrip.destination)}</span>
        <span>⏱️ ${rec.suggestedTime || 'Flexible'} (${rec.timeBlock || 'Morning'})</span>
      </div>
      <div class="ai-rec-actions">
        <select class="select-category select-day-picker" style="max-width:110px; padding:4px 8px; font-size:12px;">
          <option value="1">Day 1</option>
          <option value="2">Day 2</option>
          <option value="3">Day 3</option>
          <option value="4">Day 4</option>
          <option value="5">Day 5</option>
        </select>
        <button class="btn-primary btn-add-rec" style="padding:4px 14px; font-size:12px;">+ Add to Itinerary</button>
      </div>
    `;

    card.querySelector('.btn-add-rec').addEventListener('click', async () => {
      const selectedDay = card.querySelector('.select-day-picker').value;
      await fetch(`/api/trips/${activeTripId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: Number(selectedDay),
          timeBlock: rec.timeBlock || 'morning',
          time: rec.suggestedTime || '10:00',
          category: rec.category || 'activity',
          title: rec.title,
          location: rec.location || currentTrip.destination,
          cost: rec.cost || 0,
          websiteUrl: rec.websiteUrl || '',
          notes: rec.description
        })
      });
      card.style.opacity = '0.5';
      card.querySelector('.btn-add-rec').textContent = '✓ Added';
      card.querySelector('.btn-add-rec').disabled = true;
      await loadTripDetails(activeTripId);
    });

    container.appendChild(card);
  });
}

// ----------------- FORMS & MODALS -----------------
function setupForms() {
  // Manual Add Item Form
  document.getElementById('form-add-item').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTripId) return;

    const payload = {
      title: document.getElementById('item-title').value.trim(),
      category: document.getElementById('item-category').value,
      day: Number(document.getElementById('item-day').value) || 1,
      timeBlock: document.getElementById('item-timeblock').value,
      time: document.getElementById('item-time').value,
      cost: Number(document.getElementById('item-cost').value) || 0,
      location: document.getElementById('item-location').value.trim(),
      websiteUrl: document.getElementById('item-website').value.trim(),
      notes: document.getElementById('item-notes').value.trim()
    };

    await fetch(`/api/trips/${activeTripId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    e.target.reset();
    document.getElementById('item-day').value = '1';
    await loadTripDetails(activeTripId);
  });

  // Create Trip Form
  document.getElementById('form-create-trip').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      destination: document.getElementById('trip-destination').value.trim(),
      title: document.getElementById('trip-name').value.trim(),
      startDate: document.getElementById('trip-start').value,
      endDate: document.getElementById('trip-end').value,
      travelers: document.getElementById('trip-travelers').value.trim(),
      travelStyle: document.getElementById('trip-style').value.trim(),
      targetBudget: Number(document.getElementById('trip-budget').value) || 0,
      currency: document.getElementById('trip-currency').value,
      notes: document.getElementById('trip-notes-input').value.trim()
    };

    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const newTrip = await res.json();
    closeModal(modalNewTrip);
    e.target.reset();
    activeTripId = newTrip.id;
    await loadTrips();
  });

  // Edit Item Form
  document.getElementById('form-edit-item').addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemId = document.getElementById('edit-item-id').value;
    const payload = {
      title: document.getElementById('edit-item-title').value.trim(),
      category: document.getElementById('edit-item-category').value,
      day: Number(document.getElementById('edit-item-day').value) || 1,
      timeBlock: document.getElementById('edit-item-timeblock').value,
      time: document.getElementById('edit-item-time').value,
      location: document.getElementById('edit-item-location').value.trim(),
      websiteUrl: document.getElementById('edit-item-website').value.trim(),
      notes: document.getElementById('edit-item-notes').value.trim()
    };

    await fetch(`/api/trips/${activeTripId}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    closeModal(modalEditItem);
    await loadTripDetails(activeTripId);
  });

  // Delete Item button
  document.getElementById('btn-delete-item').addEventListener('click', async () => {
    const itemId = document.getElementById('edit-item-id').value;
    if (confirm('Delete this item from your itinerary?')) {
      await fetch(`/api/trips/${activeTripId}/items/${itemId}`, { method: 'DELETE' });
      closeModal(modalEditItem);
      await loadTripDetails(activeTripId);
    }
  });

  // Settings Save
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const provider = document.querySelector('input[name="settings-provider"]:checked')?.value || 'gemini';
    const key = document.getElementById('settings-gemini-key').value.trim();
    const gModel = document.getElementById('settings-gemini-model').value.trim();
    const oUrl = document.getElementById('settings-ollama-url').value.trim();
    const oModel = document.getElementById('settings-ollama-model').value.trim();
    const webSearch = document.getElementById('settings-web-search').checked;

    const updates = {
      aiProvider: provider,
      geminiModel: gModel,
      ollamaUrl: oUrl,
      ollamaModel: oModel,
      enableWebSearch: webSearch
    };
    if (key) updates.geminiApiKey = key;

    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    await loadSettings();
    closeModal(modalSettings);
  });

  // Test AI Connection button
  document.getElementById('btn-test-ai-conn').addEventListener('click', async () => {
    const resultBox = document.getElementById('test-connection-result');
    resultBox.style.display = 'block';
    resultBox.style.color = '#38bdf8';
    resultBox.style.background = 'rgba(56, 189, 248, 0.1)';
    resultBox.textContent = 'Testing connection...';

    const provider = document.querySelector('input[name="settings-provider"]:checked')?.value || 'gemini';
    const key = document.getElementById('settings-gemini-key').value.trim();
    const gModel = document.getElementById('settings-gemini-model').value.trim();
    const oUrl = document.getElementById('settings-ollama-url').value.trim();
    const oModel = document.getElementById('settings-ollama-model').value.trim();

    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiProvider: provider,
          geminiApiKey: key || appSettings.geminiApiKey,
          geminiModel: gModel,
          ollamaUrl: oUrl,
          ollamaModel: oModel
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      resultBox.style.color = '#34d399';
      resultBox.style.background = 'rgba(16, 185, 129, 0.15)';
      resultBox.textContent = `✓ Success: ${data.message}`;
    } catch (err) {
      resultBox.style.color = '#fb7185';
      resultBox.style.background = 'rgba(244, 63, 94, 0.15)';
      resultBox.textContent = `✕ Failed: ${err.message}`;
    }
  });

  // Provider radio switcher toggles fields
  document.querySelectorAll('input[name="settings-provider"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('settings-gemini-fields').style.display = e.target.value === 'gemini' ? 'flex' : 'none';
      document.getElementById('settings-ollama-fields').style.display = e.target.value === 'ollama' ? 'flex' : 'none';
    });
  });

  // Import Existing Plan Form
  const formImport = document.getElementById('form-import-plan');
  if (formImport) {
    formImport.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawPlan = document.getElementById('import-plan-text').value.trim();
      const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'new';
      const statusBox = document.getElementById('import-status-box');
      const submitBtn = document.getElementById('btn-submit-import');

      if (!rawPlan) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Parsing with AI...';
      statusBox.style.display = 'block';
      statusBox.style.color = '#38bdf8';
      statusBox.style.background = 'rgba(56, 189, 248, 0.1)';
      statusBox.textContent = `Analyzing and structuring your travel plan with ${appSettings?.aiProvider === 'gemini' ? (appSettings.geminiModel || 'Gemini') : 'Ollama'}...`;

      try {
        const res = await fetch('/api/trips/import-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawPlan,
            importMode: mode,
            targetTripId: activeTripId
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed');

        statusBox.style.color = '#34d399';
        statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBox.textContent = '✓ Trip plan successfully parsed and converted into your itinerary!';

        setTimeout(async () => {
          closeModal(document.getElementById('modal-import-plan'));
          formImport.reset();
          submitBtn.disabled = false;
          submitBtn.textContent = '✨ Convert & Import';
          if (data.trip?.id) {
            activeTripId = data.trip.id;
          }
          await loadTrips();
          if (activeTripId) await loadTripDetails(activeTripId);
        }, 900);
      } catch (err) {
        statusBox.style.color = '#fb7185';
        statusBox.style.background = 'rgba(244, 63, 94, 0.15)';
        statusBox.textContent = `✕ Error: ${err.message}`;
        submitBtn.disabled = false;
        submitBtn.textContent = '✨ Convert & Import';
      }
    });
  }
}

function openImportModal() {
  const modal = document.getElementById('modal-import-plan');
  const tripNameSpan = document.getElementById('import-current-trip-name');
  const providerPill = document.getElementById('import-provider-pill');
  const statusBox = document.getElementById('import-status-box');

  if (currentTrip) {
    tripNameSpan.textContent = `Append into "${currentTrip.title || currentTrip.destination}"`;
  } else {
    tripNameSpan.textContent = 'No active trip (will create new)';
  }

  if (appSettings) {
    providerPill.textContent = appSettings.aiProvider === 'gemini' 
      ? (appSettings.geminiModel || 'Gemini 3.8 Flash') 
      : (appSettings.ollamaModel || 'Local Ollama');
  }

  if (statusBox) statusBox.style.display = 'none';
  openModal(modal);
}

function openEditItemModal(item) {
  document.getElementById('edit-item-id').value = item.id;
  document.getElementById('edit-item-title').value = item.title;
  document.getElementById('edit-item-category').value = item.category || 'activity';
  document.getElementById('edit-item-day').value = item.day || 1;
  document.getElementById('edit-item-timeblock').value = item.timeBlock || 'morning';
  document.getElementById('edit-item-time').value = item.time || '10:00';
  document.getElementById('edit-item-location').value = item.location || '';
  document.getElementById('edit-item-website').value = item.websiteUrl || '';
  document.getElementById('edit-item-notes').value = item.notes || '';

  openModal(modalEditItem);
}

function openShareModal() {
  if (!currentTrip) return;
  const linkInput = document.getElementById('share-link-input');
  const shareUrl = `${window.location.origin}/share/${currentTrip.shareToken}`;
  linkInput.value = shareUrl;

  document.getElementById('btn-export-html').href = `/api/trips/${currentTrip.id}/export/html`;
  document.getElementById('btn-export-ics').href = `/api/trips/${currentTrip.id}/export/ics`;

  document.getElementById('btn-copy-share-link').onclick = () => {
    navigator.clipboard.writeText(shareUrl);
    document.getElementById('btn-copy-share-link').textContent = 'Copied!';
    setTimeout(() => {
      document.getElementById('btn-copy-share-link').textContent = 'Copy';
    }, 2000);
  };

  openModal(modalShare);
}

function openSettingsModal() {
  if (appSettings) {
    if (appSettings.aiProvider === 'ollama') {
      document.getElementById('provider-ollama').checked = true;
      document.getElementById('settings-gemini-fields').style.display = 'none';
      document.getElementById('settings-ollama-fields').style.display = 'flex';
    } else {
      document.getElementById('provider-gemini').checked = true;
      document.getElementById('settings-gemini-fields').style.display = 'flex';
      document.getElementById('settings-ollama-fields').style.display = 'none';
    }
    document.getElementById('settings-gemini-model').value = appSettings.geminiModel || 'gemini-3.8-flash';
    document.getElementById('settings-ollama-url').value = appSettings.ollamaUrl || 'http://umbrel.local:11434';
    document.getElementById('settings-ollama-model').value = appSettings.ollamaModel || 'llama3:latest';
    document.getElementById('settings-web-search').checked = Boolean(appSettings.enableWebSearch);
  }
  document.getElementById('test-connection-result').style.display = 'none';
  openModal(modalSettings);
}

function setupModals() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById(btn.dataset.close);
      if (modal) closeModal(modal);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });
}

function openModal(m) { if (m) m.classList.add('active'); }
function closeModal(m) { if (m) m.classList.remove('active'); }

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
