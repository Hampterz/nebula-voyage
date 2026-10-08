/**
 * VOYAGE TRIP PLANNER · CLIENT APPLICATION LOGIC
 * Complete modern, thumb-friendly and feature-packed frontend.
 */

// Application State
let activeTripId = null;
let currentTrip = null;
let appSettings = null;
let leafletMap = null;
let mapMarkers = [];
let activeDayFilter = 'all';
let activePackFilter = 'all';
let isMapVisibleOnMobile = false;

// DOM Elements Initialization
window.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupModals();
  setupForms();
  setupAISection();
  setupPackingSection();
  setupBudgetSection();
  initMap();

  await loadSettings();
  await loadTrips();
});

// ----------------- TOAST NOTIFICATIONS -----------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// ----------------- NAVIGATION & TABS -----------------
function setupNavigation() {
  // Desktop Nav Tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Mobile Bottom Nav Buttons
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Trip Switcher Trigger & Outside Click Handling
  const btnTrigger = document.getElementById('btn-trip-selector-trigger');
  const dropdownMenu = document.getElementById('trip-dropdown-menu');

  btnTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = btnTrigger.getAttribute('aria-expanded') === 'true';
    btnTrigger.setAttribute('aria-expanded', !isExpanded);
    dropdownMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && e.target !== btnTrigger) {
      dropdownMenu.classList.remove('active');
      btnTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  // Quick Action Buttons
  document.getElementById('btn-quick-new-trip').addEventListener('click', () => {
    dropdownMenu.classList.remove('active');
    openModal(document.getElementById('modal-new-trip'));
  });

  document.getElementById('btn-header-share').addEventListener('click', openShareModal);
  document.getElementById('btn-header-settings').addEventListener('click', openSettingsModal);
  document.getElementById('btn-hero-import-plan').addEventListener('click', openImportModal);

  // Edit Active Trip Details Button
  document.getElementById('btn-edit-trip-details').addEventListener('click', openEditTripModal);

  // Mobile Map Toggle
  const btnToggleMap = document.getElementById('btn-toggle-map');
  const mapColumn = document.getElementById('map-column');
  const mapToggleText = document.getElementById('map-toggle-text');

  btnToggleMap.addEventListener('click', () => {
    isMapVisibleOnMobile = !isMapVisibleOnMobile;
    if (isMapVisibleOnMobile) {
      mapColumn.style.display = 'block';
      mapToggleText.textContent = 'Hide Map';
      setTimeout(() => {
        if (leafletMap) leafletMap.invalidateSize();
        renderMapMarkers();
      }, 150);
    } else {
      mapColumn.style.display = 'none';
      mapToggleText.textContent = 'Show Map';
    }
  });

  // Floating Action Button (Mobile) & Desktop Toolbar Add
  document.getElementById('mobile-fab-add').addEventListener('click', () => openAddItemModal());
  document.getElementById('btn-open-add-item').addEventListener('click', () => openAddItemModal());
}

function switchTab(tabId) {
  // Update desktop tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const isActive = tab.dataset.tab === tabId;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });

  // Update mobile bottom nav
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(`view-${tabId}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Refresh map view if switching to itinerary
  if (tabId === 'itinerary' && leafletMap) {
    setTimeout(() => {
      leafletMap.invalidateSize();
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
  if (!appSettings) return;

  if (appSettings.aiProvider === 'gemini') {
    badgeModel.textContent = appSettings.geminiModel || 'Gemini 3.8 Flash';
    labelProvider.textContent = 'Grounded with Google Gemini & Live Web Discovery';
  } else {
    badgeModel.textContent = appSettings.ollamaModel || 'Local Ollama';
    labelProvider.textContent = 'Running locally on your private Umbrel server';
  }
}

async function loadTrips() {
  try {
    const res = await fetch('/api/trips');
    const trips = await res.json();

    const dropdownList = document.getElementById('trip-dropdown-list');
    dropdownList.innerHTML = '';

    if (trips.length === 0) {
      document.getElementById('header-trip-name').textContent = 'No Trips Found';
      return;
    }

    trips.forEach(t => {
      const item = document.createElement('div');
      item.className = `trip-dropdown-item ${t.id === activeTripId ? 'active' : ''}`;
      item.dataset.tripId = t.id;
      item.innerHTML = `
        <div class="item-main-text">
          <strong>${escapeHtml(t.title || t.destination)}</strong>
          <div class="item-sub-dates">${escapeHtml(t.destination)} • ${t.startDate ? t.startDate.slice(5) : 'Upcoming'}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        document.getElementById('trip-dropdown-menu').classList.remove('active');
        document.getElementById('btn-trip-selector-trigger').setAttribute('aria-expanded', 'false');
        loadTripDetails(t.id);
      });
      dropdownList.appendChild(item);
    });

    // Default to first trip if none set
    if (!activeTripId || !trips.some(t => t.id === activeTripId)) {
      activeTripId = trips[0].id;
    }

    await loadTripDetails(activeTripId);
  } catch (err) {
    console.error('Error loading trips:', err);
    showToast('Failed to load trips from server', 'error');
  }
}

async function loadTripDetails(id) {
  try {
    activeTripId = id;
    const res = await fetch(`/api/trips/${id}`);
    if (!res.ok) throw new Error('Trip not found');
    currentTrip = await res.json();

    // Update Header Selector Text
    document.getElementById('header-trip-name').textContent = currentTrip.title || currentTrip.destination;

    // Update Dropdown Items Active State
    document.querySelectorAll('.trip-dropdown-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tripId === id);
    });

    renderHero();
    renderDayFilters();
    renderViewingTimeline();
    renderPackingList();
    renderBudget();
    loadWeather();
  } catch (err) {
    console.error('Error loading trip details:', err);
    showToast('Failed to load trip details', 'error');
  }
}

// ----------------- HERO & WEATHER -----------------
function renderHero() {
  if (!currentTrip) return;
  document.getElementById('hero-title').textContent = currentTrip.title || currentTrip.destination;
  document.getElementById('hero-dest').textContent = `📍 ${currentTrip.destination}`;
  document.getElementById('hero-dates').textContent = `📅 ${currentTrip.startDate || 'Upcoming'} to ${currentTrip.endDate || 'Upcoming'}`;
  document.getElementById('hero-travelers').textContent = `👥 ${currentTrip.travelers || '1 Traveler'}`;
  document.getElementById('hero-style').textContent = `✨ ${currentTrip.travelStyle || 'Exploration'}`;
  document.getElementById('hero-notes').textContent = currentTrip.notes || 'No trip notes added yet. Use "Edit Details" above to set trip reminders, packing goals, and key flight info.';
}

async function loadWeather() {
  if (!currentTrip || !currentTrip.destination) return;
  const weatherBox = document.getElementById('weather-status');
  weatherBox.innerHTML = '<span style="font-size:12px; color:var(--text-dim);">🌤️ Loading weather...</span>';

  try {
    const res = await fetch(`/api/weather?destination=${encodeURIComponent(currentTrip.destination)}`);
    if (!res.ok) {
      weatherBox.innerHTML = '<span style="font-size:12px; color:var(--text-dim);">Weather offline</span>';
      return;
    }
    const data = await res.json();
    const tempC = Math.round(data.current?.temperature || 20);
    const tempF = Math.round((tempC * 9/5) + 32);

    weatherBox.innerHTML = `
      <div class="weather-temp-row">
        <span class="weather-celsius">${tempC}°C</span>
        <span class="weather-fahrenheit">/ ${tempF}°F</span>
      </div>
      <div class="weather-condition-text">📍 ${escapeHtml(data.location)}</div>
    `;
  } catch (err) {
    weatherBox.innerHTML = '<span style="font-size:12px; color:var(--text-dim);">Forecast unavailable</span>';
  }
}

// ----------------- ITINERARY TIMELINE -----------------
function renderDayFilters() {
  const bar = document.getElementById('day-filter-bar');
  bar.innerHTML = '<button class="day-chip active" data-day="all">All Days</button>';

  if (!currentTrip || !currentTrip.items) return;
  const days = [...new Set(currentTrip.items.map(i => Number(i.day) || 1))].sort((a,b) => a - b);

  days.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'day-chip';
    btn.dataset.day = d;
    btn.textContent = `Day ${d}`;
    bar.appendChild(btn);
  });

  bar.querySelectorAll('.day-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.day-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDayFilter = btn.dataset.day;
      renderViewingTimeline();
      renderMapMarkers();
    });
  });
}

function renderViewingTimeline() {
  const container = document.getElementById('timeline-cards-container');
  container.innerHTML = '';

  if (!currentTrip || !currentTrip.items || currentTrip.items.length === 0) {
    container.innerHTML = `
      <div class="empty-itinerary-card">
        <div class="empty-itinerary-icon">🗺️</div>
        <h3 style="font-family:'Outfit'; font-size:20px; color:#fff; margin-bottom:6px;">Your itinerary is empty</h3>
        <p style="color:var(--text-muted); font-size:13.5px; max-width:440px; margin:0 auto 18px;">
          Plan your adventure by adding your first stop, or let the AI Co-Pilot curate highlights for you.
        </p>
        <button class="btn-primary-gradient" id="btn-empty-add-stop">
          + Add First Stop
        </button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-empty-add-stop');
    if (btnEmpty) btnEmpty.addEventListener('click', openAddItemModal);
    return;
  }

  // Filter items by day
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

  const sortedDays = Object.keys(daysMap).sort((a, b) => Number(a) - Number(b));

  sortedDays.forEach(day => {
    const dayGroup = document.createElement('div');
    dayGroup.className = 'day-timeline-group';

    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-heading-bar';
    dayHeader.innerHTML = `
      <span class="day-heading-title">Day ${day}</span>
      <span class="day-heading-count">${daysMap[day].length} scheduled stop${daysMap[day].length === 1 ? '' : 's'}</span>
    `;
    dayGroup.appendChild(dayHeader);

    // Sort items by time
    daysMap[day].sort((a, b) => (a.time || '10:00').localeCompare(b.time || '10:00')).forEach(item => {
      const card = document.createElement('div');
      card.className = 'stop-card';

      const catBadge = getCategoryBadge(item.category);
      const gmapsUrl = item.mapUrl || (item.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}` : '');

      card.innerHTML = `
        <div class="stop-card-top">
          <div class="stop-title-wrap">
            ${catBadge}
            <span class="stop-title">${escapeHtml(item.title)}</span>
          </div>
          <span class="stop-time-badge">${item.time || 'Flexible'} • ${(item.timeBlock || 'Day').toUpperCase()}</span>
        </div>
        ${item.location ? `<div class="stop-loc">📍 <span>${escapeHtml(item.location)}</span></div>` : ''}
        ${item.notes ? `<div class="stop-notes">${escapeHtml(item.notes)}</div>` : ''}
        <div class="stop-card-actions">
          <div class="stop-links-group">
            ${gmapsUrl ? `<a href="${gmapsUrl}" target="_blank" rel="noopener" class="btn-gmaps-link">📍 Directions ↗</a>` : ''}
            ${item.websiteUrl ? `<a href="${item.websiteUrl}" target="_blank" rel="noopener" class="btn-gmaps-link" style="color:#a78bfa; background:rgba(167,139,250,0.1);">Website ↗</a>` : ''}
          </div>
          <button class="btn-card-edit" data-edit-id="${item.id}">✏️ Edit</button>
        </div>
      `;

      card.querySelector('.btn-card-edit').addEventListener('click', () => {
        openEditItemModal(item);
      });

      dayGroup.appendChild(card);
    });

    container.appendChild(dayGroup);
  });
}

function getCategoryBadge(cat) {
  const map = {
    flight: '<span class="badge-cat cat-flight">✈️ Flight</span>',
    hotel: '<span class="badge-cat cat-hotel">🏨 Hotel</span>',
    food: '<span class="badge-cat cat-food">🍽️ Food</span>',
    activity: '<span class="badge-cat cat-activity">🎯 Activity</span>',
    note: '<span class="badge-cat cat-note">📝 Note</span>'
  };
  return map[cat] || '<span class="badge-cat cat-activity">🎯 Activity</span>';
}

// ----------------- LEAFLET MAP INTEGRATION -----------------
function initMap() {
  const mapContainer = document.getElementById('trip-map');
  if (!mapContainer) return;

  leafletMap = L.map('trip-map', {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([35.0116, 135.7681], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
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

  const bounds = [];

  for (const item of itemsToMap) {
    if (!item.location) continue;
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(item.location.split(',')[0])}&count=1`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const { latitude, longitude } = data.results[0];
        const marker = L.marker([latitude, longitude]).addTo(leafletMap);
        marker.bindPopup(`
          <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:160px;">
            <strong style="color:#0f172a; font-size:14px;">${escapeHtml(item.title)}</strong><br>
            <span style="color:#64748b; font-size:12px;">📍 ${escapeHtml(item.location)}</span><br>
            <a href="${item.mapUrl || '#'}" target="_blank" style="color:#4f46e5; font-weight:700; font-size:12px; display:inline-block; margin-top:4px;">Directions in Google Maps ↗</a>
          </div>
        `);
        mapMarkers.push(marker);
        bounds.push([latitude, longitude]);
      }
    } catch (e) {
      // skip
    }
  }

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [30, 30] });
  } else if (currentTrip.destination) {
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(currentTrip.destination)}&count=1`);
      const data = await res.json();
      if (data.results?.[0]) {
        leafletMap.setView([data.results[0].latitude, data.results[0].longitude], 12);
      }
    } catch (e) {}
  }
}

// ----------------- AI CO-PILOT -----------------
function setupAISection() {
  const btnGen = document.getElementById('btn-generate-ai');
  const inputPrompt = document.getElementById('ai-custom-prompt');

  document.querySelectorAll('.ai-shortcut-chip').forEach(pill => {
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
  if (!activeTripId) {
    showToast('Please select or create a trip first', 'error');
    return;
  }

  const inputPrompt = document.getElementById('ai-custom-prompt');
  const btnText = document.getElementById('ai-btn-text');
  const resultsContainer = document.getElementById('ai-results-container');

  const prompt = inputPrompt.value.trim() || 'Suggest top must-see highlights, restaurants, and hidden spots';
  btnText.textContent = 'Searching & Thinking...';
  
  resultsContainer.innerHTML = `
    <div class="ai-empty-state">
      <div style="font-size:32px; animation: spin 1s linear infinite;">🌀</div>
      <h3 style="color:#fff; margin-top:12px;">Discovering destinations...</h3>
      <p style="color:var(--text-muted); font-size:13px; margin-top:4px;">
        Querying ${appSettings?.aiProvider === 'gemini' ? 'Gemini 3.8 Flash with DuckDuckGo grounding' : 'Ollama'}...
      </p>
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
    showToast('Generated fresh travel ideas!');
  } catch (err) {
    resultsContainer.innerHTML = `
      <div class="ai-empty-state" style="border-color:rgba(244,63,94,0.4);">
        <div style="font-size:32px;">⚠️</div>
        <h3 style="color:#fb7185; margin-top:8px;">Generation Error</h3>
        <p style="color:var(--text-muted); font-size:13px; max-width:400px; margin:4px auto;">
          ${escapeHtml(err.message)}
        </p>
        <button class="btn-secondary-glow" style="margin-top:12px;" onclick="openSettingsModal()">
          Check AI Settings
        </button>
      </div>
    `;
    showToast('AI generation error', 'error');
  } finally {
    btnText.textContent = 'Generate Ideas';
  }
}

function renderAIResults(recommendations) {
  const container = document.getElementById('ai-results-container');
  container.innerHTML = '';

  if (recommendations.length === 0) {
    container.innerHTML = '<div class="ai-empty-state">No recommendations returned. Try a different query.</div>';
    return;
  }

  recommendations.forEach(rec => {
    const card = document.createElement('div');
    card.className = 'ai-rec-card';

    const catBadge = getCategoryBadge(rec.category);

    card.innerHTML = `
      <div class="ai-rec-header">
        <span class="ai-rec-title">${escapeHtml(rec.title)}</span>
        ${catBadge}
      </div>
      <p class="ai-rec-desc">${escapeHtml(rec.description)}</p>
      <div class="ai-rec-meta">
        <span>📍 ${escapeHtml(rec.location || currentTrip.destination)}</span>
        <span>⏱️ ${rec.suggestedTime || '10:00'} (${(rec.timeBlock || 'Morning').toUpperCase()})</span>
        ${rec.cost ? `<span>💰 ~${currentTrip.currency || '$'}${rec.cost}</span>` : ''}
      </div>
      <div class="ai-rec-actions-row">
        <select class="ai-day-select select-rec-day">
          <option value="1">Day 1</option>
          <option value="2">Day 2</option>
          <option value="3">Day 3</option>
          <option value="4">Day 4</option>
          <option value="5">Day 5</option>
        </select>
        <button class="btn-primary-gradient btn-add-rec" style="padding:6px 14px; font-size:12.5px;">
          + Add to Itinerary
        </button>
      </div>
    `;

    card.querySelector('.btn-add-rec').addEventListener('click', async () => {
      const selectedDay = card.querySelector('.select-rec-day').value;
      const addBtn = card.querySelector('.btn-add-rec');
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';

      try {
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

        addBtn.textContent = '✓ Added';
        addBtn.style.background = '#10b981';
        card.style.opacity = '0.6';
        showToast(`Added "${rec.title}" to Day ${selectedDay}!`);
        await loadTripDetails(activeTripId);
      } catch (e) {
        addBtn.disabled = false;
        addBtn.textContent = '+ Add to Itinerary';
        showToast('Failed to add stop', 'error');
      }
    });

    container.appendChild(card);
  });
}

// ----------------- PACKING CHECKLIST -----------------
function setupPackingSection() {
  // Category Filter Pills
  document.querySelectorAll('.pack-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pack-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePackFilter = btn.dataset.packFilter;
      renderPackingList();
    });
  });

  // Quick Add Form
  document.getElementById('form-quick-pack').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTripId) return;

    const input = document.getElementById('pack-input-text');
    const cat = document.getElementById('pack-input-category').value;
    const text = input.value.trim();
    if (!text) return;

    await fetch(`/api/trips/${activeTripId}/packing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, category: cat })
    });

    input.value = '';
    showToast(`Added "${text}" to packing`);
    await loadTripDetails(activeTripId);
  });

  // AI Auto-pack suggestions
  document.getElementById('btn-auto-pack').addEventListener('click', async () => {
    if (!activeTripId) return;
    const btn = document.getElementById('btn-auto-pack');
    btn.textContent = 'Thinking...';
    btn.disabled = true;

    try {
      const res = await fetch(`/api/trips/${activeTripId}/generate-packing`, { method: 'POST' });
      if (!res.ok) throw new Error('Packing generation failed');
      showToast('AI smart packing items generated!');
      await loadTripDetails(activeTripId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" class="btn-svg" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>AI Smart Pack</span>
      `;
      btn.disabled = false;
    }
  });
}

function renderPackingList() {
  const list = document.getElementById('packing-list-items');
  const label = document.getElementById('packing-progress-label');
  const bar = document.getElementById('packing-progress-bar');
  const badgeCounter = document.getElementById('badge-pack-progress');
  list.innerHTML = '';

  const allItems = currentTrip?.packingList || [];
  const packedCount = allItems.filter(i => i.checked).length;
  const percent = allItems.length > 0 ? Math.round((packedCount / allItems.length) * 100) : 0;

  label.textContent = `${packedCount} of ${allItems.length} items packed (${percent}%)`;
  bar.style.width = `${percent}%`;
  if (badgeCounter) badgeCounter.textContent = `${packedCount}/${allItems.length}`;

  let displayItems = allItems;
  if (activePackFilter !== 'all') {
    displayItems = allItems.filter(i => (i.category || 'General').toLowerCase() === activePackFilter.toLowerCase());
  }

  if (displayItems.length === 0) {
    list.innerHTML = '<li style="grid-column:1/-1; color:var(--text-muted); font-size:13px; text-align:center; padding:30px;">No items in this category. Click "AI Smart Pack" or add one above!</li>';
    return;
  }

  displayItems.forEach(item => {
    const li = document.createElement('li');
    li.className = `checklist-item ${item.checked ? 'checked' : ''}`;
    li.innerHTML = `
      <div class="checklist-item-left">
        <div class="check-box-custom" data-id="${item.id}">
          <svg class="check-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span class="item-text-title">${escapeHtml(item.text)}</span>
        <span class="item-cat-badge">${escapeHtml(item.category || 'General')}</span>
      </div>
      <button class="btn-remove-circle" data-id="${item.id}" title="Remove item">✕</button>
    `;

    // Toggle Check
    li.querySelector('.check-box-custom').addEventListener('click', async () => {
      await fetch(`/api/trips/${activeTripId}/packing/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: !item.checked })
      });
      await loadTripDetails(activeTripId);
    });

    // Delete Item
    li.querySelector('.btn-remove-circle').addEventListener('click', async () => {
      await fetch(`/api/trips/${activeTripId}/packing/${item.id}`, { method: 'DELETE' });
      await loadTripDetails(activeTripId);
    });

    list.appendChild(li);
  });
}

// ----------------- BUDGET & EXPENSES -----------------
function setupBudgetSection() {
  document.getElementById('form-quick-expense').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTripId) return;

    const title = document.getElementById('exp-input-title').value.trim();
    const category = document.getElementById('exp-input-category').value;
    const amount = Number(document.getElementById('exp-input-amount').value);

    if (!title || !amount) return;

    await fetch(`/api/trips/${activeTripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        amount,
        currency: currentTrip?.currency || 'USD'
      })
    });

    e.target.reset();
    showToast(`Logged ${currentTrip?.currency || '$'}${amount} for ${title}`);
    await loadTripDetails(activeTripId);
  });
}

function renderBudget() {
  const targetVal = document.getElementById('budget-target-val');
  const spentVal = document.getElementById('budget-spent-val');
  const remainVal = document.getElementById('budget-remain-val');
  const spentPct = document.getElementById('budget-spent-pct');
  const remainStatus = document.getElementById('budget-remain-status');
  const targetCurrency = document.getElementById('budget-target-currency');
  const list = document.getElementById('expense-list-items');
  list.innerHTML = '';

  const target = currentTrip?.targetBudget || 0;
  const curr = currentTrip?.currency || 'USD';
  const expenses = currentTrip?.expenses || [];
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = target - totalSpent;
  const pct = target > 0 ? Math.round((totalSpent / target) * 100) : 0;

  targetVal.textContent = `${curr} ${target.toLocaleString()}`;
  spentVal.textContent = `${curr} ${totalSpent.toLocaleString()}`;
  remainVal.textContent = `${curr} ${remaining.toLocaleString()}`;
  targetCurrency.textContent = `Set in trip parameters (${curr})`;
  spentPct.textContent = `${pct}% of target allocated`;

  if (remaining < 0) {
    remainVal.className = 'stat-value text-rose';
    remainStatus.textContent = 'Over Budget';
    remainStatus.style.color = '#f43f5e';
  } else {
    remainVal.className = 'stat-value text-emerald';
    remainStatus.textContent = 'Within Budget';
    remainStatus.style.color = '#34d399';
  }

  if (expenses.length === 0) {
    list.innerHTML = '<li style="color:var(--text-muted); font-size:13px; text-align:center; padding:24px;">No expenses logged yet.</li>';
    return;
  }

  expenses.forEach(exp => {
    const li = document.createElement('li');
    li.className = 'expense-item-row';
    li.innerHTML = `
      <div class="exp-desc-group">
        <span class="item-cat-badge">${escapeHtml(exp.category || 'General')}</span>
        <strong>${escapeHtml(exp.title)}</strong>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span class="exp-amount-text">${curr} ${Number(exp.amount).toLocaleString()}</span>
        <button class="btn-remove-circle" data-id="${exp.id}" title="Remove expense">✕</button>
      </div>
    `;

    li.querySelector('.btn-remove-circle').addEventListener('click', async () => {
      await fetch(`/api/trips/${activeTripId}/expenses/${exp.id}`, { method: 'DELETE' });
      showToast('Expense removed');
      await loadTripDetails(activeTripId);
    });

    list.appendChild(li);
  });
}

// ----------------- FORMS & MODAL ACTIONS -----------------
function setupForms() {
  // Itinerary Item Form (Add / Edit)
  document.getElementById('form-item-submit').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTripId) return;

    const itemId = document.getElementById('item-form-id').value;
    const payload = {
      title: document.getElementById('item-title').value.trim(),
      category: document.getElementById('item-category').value,
      day: Number(document.getElementById('item-day').value) || 1,
      timeBlock: document.getElementById('item-timeblock').value,
      time: document.getElementById('item-time').value,
      location: document.getElementById('item-location').value.trim(),
      websiteUrl: document.getElementById('item-website').value.trim(),
      cost: Number(document.getElementById('item-cost').value) || 0,
      notes: document.getElementById('item-notes').value.trim()
    };

    if (itemId) {
      // Edit existing
      await fetch(`/api/trips/${activeTripId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Stop updated!');
    } else {
      // Create new
      await fetch(`/api/trips/${activeTripId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Added stop to itinerary!');
    }

    closeModal(document.getElementById('modal-item'));
    await loadTripDetails(activeTripId);
  });

  // Delete Item from Edit Modal
  document.getElementById('btn-delete-item').addEventListener('click', async () => {
    const itemId = document.getElementById('item-form-id').value;
    if (confirm('Delete this stop from your itinerary?')) {
      await fetch(`/api/trips/${activeTripId}/items/${itemId}`, { method: 'DELETE' });
      closeModal(document.getElementById('modal-item'));
      showToast('Stop removed');
      await loadTripDetails(activeTripId);
    }
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
    closeModal(document.getElementById('modal-new-trip'));
    e.target.reset();
    showToast(`Created trip to ${newTrip.destination}!`);
    activeTripId = newTrip.id;
    await loadTrips();
  });

  // Edit Trip Details Form
  document.getElementById('form-edit-trip').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTripId) return;

    const payload = {
      destination: document.getElementById('edit-trip-destination').value.trim(),
      title: document.getElementById('edit-trip-title').value.trim(),
      startDate: document.getElementById('edit-trip-start').value,
      endDate: document.getElementById('edit-trip-end').value,
      travelers: document.getElementById('edit-trip-travelers').value.trim(),
      travelStyle: document.getElementById('edit-trip-style').value.trim(),
      targetBudget: Number(document.getElementById('edit-trip-budget').value) || 0,
      currency: document.getElementById('edit-trip-currency').value,
      notes: document.getElementById('edit-trip-notes').value.trim()
    };

    await fetch(`/api/trips/${activeTripId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    closeModal(document.getElementById('modal-edit-trip'));
    showToast('Trip parameters updated!');
    await loadTrips();
  });

  // Delete Active Trip
  document.getElementById('btn-delete-active-trip').addEventListener('click', async () => {
    if (!activeTripId) return;
    if (confirm(`Are you sure you want to completely delete "${currentTrip?.title || currentTrip?.destination}"?`)) {
      await fetch(`/api/trips/${activeTripId}`, { method: 'DELETE' });
      closeModal(document.getElementById('modal-edit-trip'));
      showToast('Trip deleted');
      activeTripId = null;
      await loadTrips();
    }
  });

  // Import Existing Plan Form
  document.getElementById('form-import-plan').addEventListener('submit', async (e) => {
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
    statusBox.style.background = 'rgba(56, 189, 248, 0.12)';
    statusBox.textContent = `Structuring your travel plan with ${appSettings?.aiProvider === 'gemini' ? (appSettings.geminiModel || 'Gemini 3.8 Flash') : 'Ollama'}...`;

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
      statusBox.textContent = '✓ Plan successfully converted into your itinerary!';

      setTimeout(async () => {
        closeModal(document.getElementById('modal-import-plan'));
        document.getElementById('form-import-plan').reset();
        submitBtn.disabled = false;
        submitBtn.textContent = '✨ Convert & Import';
        if (data.trip?.id) activeTripId = data.trip.id;
        showToast('Plan imported successfully!');
        await loadTrips();
      }, 700);
    } catch (err) {
      statusBox.style.color = '#fb7185';
      statusBox.style.background = 'rgba(244, 63, 94, 0.15)';
      statusBox.textContent = `✕ Error: ${err.message}`;
      submitBtn.disabled = false;
      submitBtn.textContent = '✨ Convert & Import';
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
    closeModal(document.getElementById('modal-settings'));
    showToast('AI settings saved!');
  });

  // Settings Test Connection
  document.getElementById('btn-test-ai-conn').addEventListener('click', async () => {
    const resultBox = document.getElementById('test-connection-result');
    resultBox.style.display = 'block';
    resultBox.style.color = '#38bdf8';
    resultBox.style.background = 'rgba(56, 189, 248, 0.1)';
    resultBox.textContent = 'Pinging AI connection...';

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
          geminiApiKey: key || appSettings?.geminiApiKey,
          geminiModel: gModel,
          ollamaUrl: oUrl,
          ollamaModel: oModel
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      resultBox.style.color = '#34d399';
      resultBox.style.background = 'rgba(16, 185, 129, 0.15)';
      resultBox.textContent = `✓ Connected successfully: ${data.message}`;
    } catch (err) {
      resultBox.style.color = '#fb7185';
      resultBox.style.background = 'rgba(244, 63, 94, 0.15)';
      resultBox.textContent = `✕ Failed: ${err.message}`;
    }
  });

  // Provider Radio Toggle
  document.querySelectorAll('input[name="settings-provider"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('settings-gemini-fields').style.display = e.target.value === 'gemini' ? 'flex' : 'none';
      document.getElementById('settings-ollama-fields').style.display = e.target.value === 'ollama' ? 'flex' : 'none';
    });
  });
}

// ----------------- MODAL OPENERS -----------------
function openAddItemModal() {
  document.getElementById('modal-item-heading').textContent = 'Add Itinerary Stop';
  document.getElementById('item-form-id').value = '';
  document.getElementById('form-item-submit').reset();
  document.getElementById('btn-delete-item').style.display = 'none';
  document.getElementById('btn-submit-item-text').textContent = 'Add to Itinerary';

  // Default day to currently selected day filter if not 'all'
  if (activeDayFilter !== 'all') {
    document.getElementById('item-day').value = activeDayFilter;
  } else {
    document.getElementById('item-day').value = '1';
  }

  openModal(document.getElementById('modal-item'));
}

function openEditItemModal(item) {
  document.getElementById('modal-item-heading').textContent = 'Edit Itinerary Stop';
  document.getElementById('item-form-id').value = item.id;
  document.getElementById('item-title').value = item.title;
  document.getElementById('item-category').value = item.category || 'activity';
  document.getElementById('item-day').value = item.day || 1;
  document.getElementById('item-timeblock').value = item.timeBlock || 'morning';
  document.getElementById('item-time').value = item.time || '10:00';
  document.getElementById('item-location').value = item.location || '';
  document.getElementById('item-website').value = item.websiteUrl || '';
  document.getElementById('item-cost').value = item.cost || '';
  document.getElementById('item-notes').value = item.notes || '';
  document.getElementById('btn-delete-item').style.display = 'block';
  document.getElementById('btn-submit-item-text').textContent = 'Save Changes';

  openModal(document.getElementById('modal-item'));
}

function openEditTripModal() {
  if (!currentTrip) return;
  document.getElementById('edit-trip-destination').value = currentTrip.destination || '';
  document.getElementById('edit-trip-title').value = currentTrip.title || '';
  document.getElementById('edit-trip-start').value = currentTrip.startDate || '';
  document.getElementById('edit-trip-end').value = currentTrip.endDate || '';
  document.getElementById('edit-trip-travelers').value = currentTrip.travelers || '2 Adults';
  document.getElementById('edit-trip-style').value = currentTrip.travelStyle || 'Exploration';
  document.getElementById('edit-trip-budget').value = currentTrip.targetBudget || 0;
  document.getElementById('edit-trip-currency').value = currentTrip.currency || 'USD';
  document.getElementById('edit-trip-notes').value = currentTrip.notes || '';

  openModal(document.getElementById('modal-edit-trip'));
}

function openImportModal() {
  const modal = document.getElementById('modal-import-plan');
  const tripNameSpan = document.getElementById('import-current-trip-name');
  if (currentTrip) {
    tripNameSpan.textContent = `Append into "${currentTrip.title || currentTrip.destination}"`;
  }
  document.getElementById('import-status-box').style.display = 'none';
  openModal(modal);
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
    showToast('Guest link copied to clipboard!');
  };

  openModal(document.getElementById('modal-share'));
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
  openModal(document.getElementById('modal-settings'));
}

function setupModals() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById(btn.dataset.close);
      if (modal) closeModal(modal);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });
}

function openModal(modal) {
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modal) {
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
