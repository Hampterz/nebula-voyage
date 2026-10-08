/**
 * NEBULA VOYAGE · LIQUID SPATIAL CLIENT LOGIC
 * High-performance, reactive spatial client for Umbrel OS
 */

// Application State
let activeTripId = null;
let currentTrip = null;
let appSettings = null;
let allTrips = [];
let leafletMap = null;
let mapMarkers = [];
let activeDayFilter = 'all';
let activeModelMode = 'local'; // 'local' | 'cloud'

// Unassigned wishlist state (in-memory & persisted in trip notes or local storage)
let wishlistItems = [
  { id: 'w_1', title: 'Bar Rocking Chair', subtitle: 'World-class cocktail lounge • Gion', category: 'food', icon: 'local_bar' },
  { id: 'w_2', title: 'Men-ya Inoichi', subtitle: 'Michelin Bib Gourmand dashi ramen', category: 'food', icon: 'ramen_dining' },
  { id: 'w_3', title: 'Daitoku-ji Zen Garden', subtitle: 'Dry-landscape rock arrangements', category: 'sight', icon: 'park' }
];

// Document Ready Initialization
window.addEventListener('DOMContentLoaded', async () => {
  initLiquidGlassShader();
  initInteractiveGlassLighting();
  setupNavigation();
  setupModals();
  setupForms();
  setupAISection();
  setupPackingSection();
  setupSettingsSection();
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
    <span class="material-symbols-outlined text-[18px]" style="color: ${type === 'success' ? 'var(--emerald-accent)' : 'var(--rose-accent)'};">
      ${type === 'success' ? 'check_circle' : 'warning'}
    </span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px) scale(0.95)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// ----------------- NAVIGATION & TAB SWITCHING -----------------
function setupNavigation() {
  // Desktop & Mobile Tab Links
  const navButtons = document.querySelectorAll('.dock-nav-item, .mobile-dock-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(btn.dataset.tab);
    });
  });

  // Hub Quick Switchers
  const btnAiSwitch = document.getElementById('btn-ai-switch-to-itinerary');
  if (btnAiSwitch) {
    btnAiSwitch.addEventListener('click', () => switchTab('master-itinerary'));
  }

  // Header Share Trigger
  const btnHeaderShare = document.getElementById('btn-header-share');
  if (btnHeaderShare) {
    btnHeaderShare.addEventListener('click', openShareModal);
  }

  // Brand click -> Trips Hub
  const btnDockBrand = document.getElementById('btn-dock-brand');
  if (btnDockBrand) {
    btnDockBrand.addEventListener('click', () => switchTab('trips-hub'));
  }
}

function switchTab(tabId) {
  // Update Tab Views
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update Nav Dock Buttons
  document.querySelectorAll('.dock-nav-item, .mobile-dock-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    }
  });

  // Re-render / Invalidate Map if entering Itinerary
  if (tabId === 'master-itinerary' && leafletMap) {
    setTimeout(() => {
      leafletMap.invalidateSize();
      fitMapToMarkers();
    }, 200);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----------------- MODAL DIALOGS -----------------
function setupModals() {
  // Close triggers
  document.querySelectorAll('.btn-modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(modal => modal.classList.remove('active'));
    });
  });

  // Close when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // Hub Button Triggers
  const btnNewTrip = document.getElementById('btn-hub-new-trip');
  if (btnNewTrip) {
    btnNewTrip.addEventListener('click', () => {
      // Set default dates
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 18);
      document.getElementById('input-new-trip-start').value = start.toISOString().split('T')[0];
      document.getElementById('input-new-trip-end').value = end.toISOString().split('T')[0];
      openModal(document.getElementById('modal-new-trip'));
    });
  }

  // Import Plan Triggers (Hub, AI Planner, Itinerary)
  const importBtns = [
    document.getElementById('btn-hub-import-plan'),
    document.getElementById('btn-ai-import-plan'),
    document.getElementById('btn-itinerary-import-plan')
  ];
  importBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => openModal(document.getElementById('modal-import-plan')));
    }
  });

  // Fast Sample Itinerary Filler
  const btnSampleImport = document.getElementById('btn-load-sample-import');
  if (btnSampleImport) {
    btnSampleImport.addEventListener('click', () => {
      const textarea = document.getElementById('textarea-import-raw');
      if (textarea) {
        textarea.value = `Day 1: Arrive Osaka KIX 09:15 AM. Haruka Express train to Kyoto Station. Check in at Hotel Kanra Kyoto. Lunch at Men-ya Inoichi (Michelin Bib Gourmand ramen). Afternoon stroll through Nishiki Market. Evening cocktail at Bar Rocking Chair in Gion.
Day 2: Early morning hike through Fushimi Inari Taisha 1,000 torii gates (07:30 AM). Midday green tea tasting at Tsuen Tea in Uji. Afternoon Zen rock garden meditation at Daitoku-ji. Kaiseki dinner in Pontocho Alley.
Day 3: Sunrise bamboo walk in Arashiyama (08:00 AM). Tenryu-ji garden, Togetsukyo Bridge, and Monkey Park. Shinkansen bullet train departure to Tokyo.`;
        showToast('Sample Kyoto plan populated!');
      }
    });
  }

  const btnAddStop = document.getElementById('btn-itinerary-add-stop');
  if (btnAddStop) {
    btnAddStop.addEventListener('click', () => openAddStopModal());
  }

  const btnSync = document.getElementById('btn-hub-sync');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.style.transform = 'rotate(180deg)';
      btnSync.style.transition = 'transform 0.4s ease';
      await loadTrips();
      setTimeout(() => {
        btnSync.style.transform = 'none';
        btnSync.style.transition = 'none';
        showToast('Synchronized with Umbrel vault');
      }, 400);
    });
  }
}

function openModal(modalEl) {
  if (modalEl) modalEl.classList.add('active');
}

function closeModal(modalEl) {
  if (modalEl) modalEl.classList.remove('active');
}

// ----------------- DATA LOADING -----------------
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      appSettings = await res.json();
      populateSettingsForm(appSettings);
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function loadTrips() {
  try {
    const res = await fetch('/api/trips');
    if (!res.ok) throw new Error('Failed to load trips');
    allTrips = await res.json();

    const countLabel = document.getElementById('hub-trips-count');
    if (countLabel) {
      countLabel.textContent = `${allTrips.length} active expedition${allTrips.length === 1 ? '' : 's'}`;
    }

    if (allTrips.length > 0) {
      if (!activeTripId || !allTrips.find(t => t.id === activeTripId)) {
        activeTripId = allTrips[0].id;
      }
      renderTripsHub(allTrips);
      await loadActiveTrip(activeTripId);
    } else {
      renderEmptyHub();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to load trips from node', 'error');
  }
}

async function loadActiveTrip(tripId) {
  try {
    const res = await fetch(`/api/trips/${tripId}`);
    if (!res.ok) throw new Error('Trip not found');
    currentTrip = await res.json();
    activeTripId = tripId;

    // Update Header and Global Labels
    const headerTripLabel = document.getElementById('header-trip-name');
    if (headerTripLabel) headerTripLabel.textContent = currentTrip.title || currentTrip.destination;

    const aiTripLabel = document.getElementById('ai-active-trip-label');
    if (aiTripLabel) aiTripLabel.textContent = currentTrip.destination || currentTrip.title;

    // Render Master Itinerary
    renderMasterItinerary(currentTrip);
    // Render AI Planner Sidebars
    renderAIDayPreview(currentTrip);
    renderWishlist();

    // Fetch Destination Weather
    fetchDestinationWeather(currentTrip.destination);
  } catch (err) {
    console.error(err);
  }
}

// ----------------- RENDER VIEW 1: TRIPS HUB -----------------
function renderTripsHub(trips) {
  const featured = trips.find(t => t.id === activeTripId) || trips[0];
  const container = document.getElementById('featured-trip-container');

  if (featured && container) {
    const totalStops = (featured.items || []).length;
    const spent = (featured.items || []).reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
    const budget = Number(featured.targetBudget) || 3500;
    const budgetPct = Math.min(Math.round((spent / budget) * 100), 100);
    const durationDays = calculateDurationDays(featured.startDate, featured.endDate);

    container.innerHTML = `
      <section class="liquid-glass featured-trip-hero">
        <!-- Ambient Backing Glow & Refraction -->
        <div style="position: absolute; -top: 100px; -right: 100px; width: 300px; height: 300px; border-radius: 9999px; background: rgba(125,211,252,0.08); filter: blur(80px); pointer-events: none;"></div>

        <div class="featured-trip-content">
          <div>
            <div class="featured-header-badge">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="dock-status-dot"></span>
                <span style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--water-accent); font-weight: 600;">Active Expedition</span>
                <span style="opacity: 0.3;">•</span>
                <span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(featured.destination)}</span>
              </div>
              <span class="route-code-chip">VAULT #${featured.id.slice(-6).toUpperCase()}</span>
            </div>

            <div style="margin-top: 16px;">
              <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 600;">
                ${escapeHtml(featured.travelStyle || 'Sovereign Journey')}
              </span>
              <h2 class="featured-trip-title">${escapeHtml(featured.title)}</h2>
              <p class="featured-trip-desc">${escapeHtml(featured.notes || 'Autonomous travel itinerary managed through sovereign Umbrel node.')}</p>
            </div>
          </div>

          <!-- Spatial Metrics Matrix -->
          <div class="spatial-metrics-grid">
            <div class="metric-liquid-tile">
              <span class="metric-label">Timeline</span>
              <span class="metric-value">${formatDateDisplay(featured.startDate)} – ${formatDateDisplay(featured.endDate)}</span>
              <span class="metric-sub">${durationDays} Days Active</span>
            </div>

            <div class="metric-liquid-tile">
              <span class="metric-label">Spatial Waypoints</span>
              <span class="metric-value">${totalStops} Coordinates</span>
              <span class="metric-sub">Zero-Knowledge Offline</span>
            </div>

            <div class="metric-liquid-tile">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="metric-label" style="margin: 0;">Budget Usage</span>
                <span style="font-size: 11px; color: var(--water-accent);">${budgetPct}%</span>
              </div>
              <span class="metric-value">$${spent.toLocaleString()} / $${budget.toLocaleString()}</span>
              <div class="metric-progress-track">
                <div class="metric-progress-fill" style="width: ${budgetPct}%;"></div>
              </div>
            </div>
          </div>

          <!-- Interactive Plate Controls -->
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding-top: 8px;">
            <button id="btn-hub-open-itinerary" class="btn-liquid-primary" type="button">
              <span>Open Master Itinerary</span>
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
            <button id="btn-hub-open-ai" class="btn-liquid-subtle" type="button">
              <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span>AI Spatial Planner</span>
            </button>
            <button id="btn-hub-download-archive" class="btn-icon-disc" title="Download Zero-Knowledge JSON Archive" type="button">
              <span class="material-symbols-outlined text-[18px]">download</span>
            </button>
          </div>
        </div>

        <!-- Right: Optical Spatial Window / Image Preview -->
        <div class="featured-trip-visual" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuBn0eNohwehV7DVOlG9bN-sCfh8OrL5kiDtusyKBDl0UBaUNpm6-hDPkChNQ3x8k5vB-E2Co65YFKFNWtByO00tsd2PSFvM831GyKhZRyk1-kYmtCifybl-guD748UvQ9WbZqD7Ynd-GFc9FP1X_ugo_8gghQShCXU3CgD7QPySbykD2RnczlGK0scpnu4Hbg0TeOSOkJQJ__Fhar31BAyrURDHE4ADd1NhcT0xwa9l');">
          <div class="visual-floating-badge">
            <span class="material-symbols-outlined text-[16px]" style="color: var(--water-accent);">verified</span>
            <span>Spatial Coordinates Verified • Kyoto</span>
          </div>
        </div>
      </section>
    `;

    // Bind Hero Action Buttons
    document.getElementById('btn-hub-open-itinerary').addEventListener('click', () => switchTab('master-itinerary'));
    document.getElementById('btn-hub-open-ai').addEventListener('click', () => switchTab('ai-planner'));
    document.getElementById('btn-hub-download-archive').addEventListener('click', () => downloadTripJSON(featured));
  }

  // Render Grid of All Trips
  const grid = document.getElementById('trips-grid');
  if (grid) {
    grid.innerHTML = trips.map(t => {
      const isSelected = t.id === activeTripId;
      const stopsCount = (t.items || []).length;
      return `
        <article class="liquid-glass trip-card-item ${isSelected ? 'active-selection' : ''}" data-id="${t.id}">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; border-radius: 9999px; background: rgba(255,255,255,0.08); color: var(--water-accent); border: 1px solid rgba(255,255,255,0.12);">
                ${isSelected ? 'Active Selection' : 'Encrypted Vault'}
              </span>
              <button class="btn-icon-disc btn-delete-trip" data-id="${t.id}" style="width: 28px; height: 28px; opacity: 0.7;" title="Delete Trip" type="button">
                <span class="material-symbols-outlined text-[15px]">delete</span>
              </button>
            </div>

            <h3 style="font-size: 19px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">${escapeHtml(t.title)}</h3>
            <p style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined text-[15px]">location_on</span>
              <span>${escapeHtml(t.destination)}</span>
            </p>
          </div>

          <div style="padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
            <span style="color: var(--text-secondary);">${formatDateDisplay(t.startDate)}</span>
            <span style="color: var(--water-accent); font-weight: 500;">${stopsCount} Stops</span>
          </div>
        </article>
      `;
    }).join('');

    // Attach card click handlers
    grid.querySelectorAll('.trip-card-item').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-trip')) return;
        const id = card.dataset.id;
        loadActiveTrip(id);
        renderTripsHub(allTrips);
        showToast('Switched active expedition');
      });
    });

    // Attach delete handlers
    grid.querySelectorAll('.btn-delete-trip').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Permanently delete this expedition from node vault?')) {
          await deleteTrip(id);
        }
      });
    });
  }
}

function renderEmptyHub() {
  const container = document.getElementById('featured-trip-container');
  if (container) {
    container.innerHTML = `
      <div class="liquid-glass" style="padding: 48px; text-align: center;">
        <span class="material-symbols-outlined text-[48px]" style="color: var(--water-accent); margin-bottom: 16px;">explore_off</span>
        <h2 style="font-size: 24px; font-weight: 500; color: #ffffff; margin-bottom: 8px;">No Expeditions Found in Vault</h2>
        <p style="font-size: 14px; color: var(--text-muted); max-width: 480px; margin: 0 auto 24px;">
          Create your first spatial expedition or import an existing travel plan to begin planning with sovereign local AI.
        </p>
        <button id="btn-empty-create" class="btn-liquid-primary" type="button">
          <span class="material-symbols-outlined text-[18px]">add</span>
          <span>Create New Expedition</span>
        </button>
      </div>
    `;
    document.getElementById('btn-empty-create').addEventListener('click', () => {
      openModal(document.getElementById('modal-new-trip'));
    });
  }
}

// ----------------- RENDER VIEW 3: MASTER ITINERARY -----------------
function renderMasterItinerary(trip) {
  if (!trip) return;

  // Header Metadata
  const destEl = document.getElementById('itinerary-trip-dest');
  if (destEl) destEl.textContent = trip.destination;

  const vaultEl = document.getElementById('itinerary-vault-id');
  if (vaultEl) vaultEl.textContent = `VAULT #${trip.id.slice(-6).toUpperCase()}`;

  const titleEl = document.getElementById('itinerary-trip-title');
  if (titleEl) titleEl.textContent = trip.title;

  const datesEl = document.getElementById('itinerary-trip-dates');
  if (datesEl) datesEl.textContent = `${formatDateDisplay(trip.startDate)} – ${formatDateDisplay(trip.endDate)}`;

  const travEl = document.getElementById('itinerary-trip-travelers');
  if (travEl) travEl.textContent = trip.travelers || '2 Adults';

  const stopsEl = document.getElementById('itinerary-total-stops-badge');
  if (stopsEl) stopsEl.textContent = `${(trip.items || []).length} Curated Stops`;

  // Day Selector Pills
  renderDaySelector(trip);

  // Filter and Render Timeline Items
  renderTimelineItems(trip);

  // Render Map Markers
  updateMapMarkers(trip);

  // Render Packing Items
  renderPackingItems(trip);

  // Render Budget Metrics
  renderBudgetMetrics(trip);
}

function renderDaySelector(trip) {
  const container = document.getElementById('itinerary-day-selector');
  if (!container) return;

  const daysSet = new Set((trip.items || []).map(i => Number(i.day) || 1));
  const maxDay = Math.max(...Array.from(daysSet), 1);

  let html = `
    <button class="day-tab-btn ${activeDayFilter === 'all' ? 'active' : ''}" data-day="all" type="button">
      All Days (${(trip.items || []).length})
    </button>
  `;

  for (let d = 1; d <= maxDay; d++) {
    const count = (trip.items || []).filter(i => Number(i.day) === d).length;
    html += `
      <button class="day-tab-btn ${String(activeDayFilter) === String(d) ? 'active' : ''}" data-day="${d}" type="button">
        Day ${d} (${count})
      </button>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.day-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeDayFilter = btn.dataset.day;
      renderDaySelector(trip);
      renderTimelineItems(trip);
      updateMapMarkers(trip);
    });
  });
}

function renderTimelineItems(trip) {
  const container = document.getElementById('timeline-items-container');
  if (!container) return;

  let items = trip.items || [];
  if (activeDayFilter !== 'all') {
    items = items.filter(i => String(i.day) === String(activeDayFilter));
  }

  // Sort by Day then Approx Time
  items.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return (a.time || '').localeCompare(b.time || '');
  });

  if (items.length === 0) {
    container.innerHTML = `
      <div class="liquid-glass" style="padding: 32px; text-align: center;">
        <span class="material-symbols-outlined text-[32px]" style="color: var(--water-accent); margin-bottom: 8px;">calendar_today</span>
        <h3 style="font-size: 16px; color: #ffffff; margin-bottom: 4px;">No stops recorded for this day</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Add your first stop or let AI generate an itinerary for this day.</p>
        <button id="btn-timeline-empty-add" class="btn-liquid-primary" style="padding: 8px 16px;" type="button">
          + Add Stop to Day ${activeDayFilter === 'all' ? 1 : activeDayFilter}
        </button>
      </div>
    `;
    document.getElementById('btn-timeline-empty-add').addEventListener('click', () => openAddStopModal());
    return;
  }

  container.innerHTML = items.map((item, index) => {
    const stepNumber = String(index + 1).padStart(2, '0');
    const categoryIcon = getCategoryIcon(item.category);
    const mapQuery = encodeURIComponent(item.location || item.title);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

    return `
      <article class="liquid-glass itinerary-item-card" data-item-id="${item.id}">
        <!-- Node Pin -->
        <div class="timeline-step-node">${stepNumber}</div>

        <div class="item-card-header">
          <div class="item-time-badge">
            <span class="material-symbols-outlined text-[16px]">${categoryIcon}</span>
            <span>Day ${item.day} • ${item.time || 'Flexible'} (${escapeHtml(item.timeBlock || 'Day')})</span>
          </div>
          <div class="item-actions-cluster">
            <span style="font-size: 11px; text-transform: uppercase; padding: 2px 8px; border-radius: 9999px; background: rgba(255,255,255,0.08); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.12);">
              ${escapeHtml(item.category || 'Sight')}
            </span>
            <button class="btn-icon-disc btn-edit-stop" data-id="${item.id}" style="width: 28px; height: 28px;" title="Edit Stop" type="button">
              <span class="material-symbols-outlined text-[14px]">edit</span>
            </button>
            <button class="btn-icon-disc btn-delete-stop" data-id="${item.id}" style="width: 28px; height: 28px; opacity: 0.7;" title="Delete Stop" type="button">
              <span class="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </div>
        </div>

        <h3 class="item-title">${escapeHtml(item.title)}</h3>

        ${item.notes ? `<p class="item-notes">${escapeHtml(item.notes)}</p>` : ''}

        <div class="item-meta-footer">
          <div style="display: flex; align-items: center; gap: 6px; color: var(--text-muted);">
            <span class="material-symbols-outlined text-[15px]">location_on</span>
            <span style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(item.location || 'Location upon arrival')}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            ${item.cost ? `<span style="color: var(--water-accent); font-weight: 600;">$${Number(item.cost).toLocaleString()}</span>` : ''}
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: none; display: flex; align-items: center; gap: 4px; font-weight: 500;">
              <span>Directions</span>
              <span class="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Attach Item Actions
  container.querySelectorAll('.btn-edit-stop').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = (trip.items || []).find(i => i.id === id);
      if (item) openEditStopModal(item);
    });
  });

  container.querySelectorAll('.btn-delete-stop').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (confirm('Delete this stop from itinerary?')) {
        await deleteStopItem(id);
      }
    });
  });
}

// ----------------- RENDER VIEW 2: AI PLANNER STREAM -----------------
function setupAISection() {
  // Model Toggle Pills
  const btnLocal = document.getElementById('btn-model-local');
  const btnCloud = document.getElementById('btn-model-cloud');

  if (btnLocal && btnCloud) {
    btnLocal.addEventListener('click', () => {
      activeModelMode = 'local';
      btnLocal.classList.add('active');
      btnCloud.classList.remove('active');
      showToast('Switched to Local Ollama Neural Engine');
    });

    btnCloud.addEventListener('click', () => {
      activeModelMode = 'cloud';
      btnCloud.classList.add('active');
      btnLocal.classList.remove('active');
      showToast('Switched to Cloud Gemini + Live Web Search');
    });
  }

  // Prompt Submit
  const btnQuery = document.getElementById('btn-ai-query');
  const omnibarInput = document.getElementById('ai-omnibar-input');

  if (btnQuery && omnibarInput) {
    btnQuery.addEventListener('click', () => handleAISubmit());
    omnibarInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAISubmit();
    });
  }

  // Quick Inspiration Chips
  document.querySelectorAll('.ai-chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      if (omnibarInput) {
        omnibarInput.value = chip.dataset.prompt;
        handleAISubmit();
      }
    });
  });

  const btnSeed = document.getElementById('btn-quick-inspire-seed');
  if (btnSeed) {
    btnSeed.addEventListener('click', () => {
      if (omnibarInput) {
        omnibarInput.value = "Top cultural sights, hidden zen gardens, and evening dining in Kyoto";
        handleAISubmit();
      }
    });
  }
}

async function handleAISubmit() {
  const input = document.getElementById('ai-omnibar-input');
  if (!input || !input.value.trim() || !currentTrip) return;

  const query = input.value.trim();
  const btnQuery = document.getElementById('btn-ai-query');
  const container = document.getElementById('ai-rec-container');

  if (btnQuery) {
    btnQuery.disabled = true;
    btnQuery.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span><span>Thinking...</span>`;
  }

  // Show loading skeleton
  container.innerHTML = `
    <div class="liquid-glass" style="padding: 28px; text-align: center;">
      <div class="dock-status-dot" style="margin: 0 auto 12px; width: 12px; height: 12px;"></div>
      <h3 style="font-size: 16px; color: #ffffff;">Consulting ${activeModelMode === 'local' ? 'Local Ollama' : 'Gemini 3.8 Flash & Live Web'}...</h3>
      <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Analyzing destination coordinates and crowd patterns for ${escapeHtml(currentTrip.destination)}.</p>
    </div>
  `;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: currentTrip.id,
        prompt: query,
        provider: activeModelMode === 'local' ? 'ollama' : 'gemini'
      })
    });

    if (!res.ok) throw new Error('AI Generation failed');
    const data = await res.json();
    renderAIRecommendations(data.recommendations || data.plan || data);
  } catch (err) {
    console.error(err);
    showToast('Failed to generate suggestions', 'error');
    container.innerHTML = `
      <div class="liquid-glass" style="padding: 24px; text-align: center; color: var(--rose-accent);">
        <p>Could not connect to ${activeModelMode === 'local' ? 'Ollama' : 'Gemini'}. Verify settings in System Settings tab.</p>
      </div>
    `;
  } finally {
    if (btnQuery) {
      btnQuery.disabled = false;
      btnQuery.innerHTML = `<span>Inspire Me</span><span class="material-symbols-outlined text-[16px]">arrow_forward</span>`;
    }
  }
}

function renderAIRecommendations(recs) {
  const container = document.getElementById('ai-rec-container');
  if (!container) return;

  // Normalize array if returned as single object or markdown
  let list = Array.isArray(recs) ? recs : (recs.items || [recs]);

  // Fallback rich sample if structure differs
  if (!list[0] || !list[0].title) {
    list = [
      {
        title: 'Gion Hatanaka Ryokan & Tea Courtyard',
        location: 'Higashiyama Core • Yasakajinja Minamimon-mae',
        rating: '4.95',
        price: 310,
        day: 2,
        category: 'lodging',
        chips: ['Centuries-old Moss Yard', 'Vegetarian Shojin Kaiseki', 'Hinoki Cedar Bath', '4 min to Pagoda'],
        description: 'Traditional Sukiya-style sanctuary bordering Maruyama Park. Exceptional contemplative quiet and Hinoki bath aroma in autumn mist.',
        imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC7eMmOFS_KfgKTQLAv_7tXhqAZLeRlkpn5TPaVjR2JzfWJOCQ8QmZs5u6G35ajPl5c3gTXC00hqUnZGV8SOVl_Kc2ydagjRNzEDygpqgWr_EctN-3ARd3R1_JZJLZPbkkhKhsotvdr9Zpe1kItezEELByKP-xyLf3U1KPkx3nJA4TxuyQFvpqwqCZXFFnYSKmhiAthY0hxidPpQ07i4hR44qIDMqZFh_LJE7BNvoL4'
      }
    ];
  }

  container.innerHTML = list.map((item, idx) => {
    const chipsHtml = (item.chips || ['Scenic Waypoint', 'Local Specialty']).map(c => `
      <span class="liquid-capsule" style="padding: 4px 10px; font-size: 11px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px;">
        <span>•</span> ${escapeHtml(c)}
      </span>
    `).join('');

    return `
      <div class="liquid-glass ai-rec-card" style="margin-bottom: 20px;">
        ${item.imgUrl ? `
          <div class="ai-rec-media" style="background-image: url('${item.imgUrl}');">
            <div style="position: absolute; top: 12px; left: 12px; z-index: 2; padding: 4px 12px; border-radius: 9999px; background: rgba(6,9,14,0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); font-size: 11px; font-weight: 600; color: #ffffff;">
              AI Recommended Stop
            </div>
            ${item.price ? `
              <div style="position: absolute; bottom: 12px; right: 12px; z-index: 2; padding: 4px 12px; border-radius: 9999px; background: rgba(6,9,14,0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); font-size: 13px; font-weight: 700; color: #ffffff;">
                $${item.price} <span style="font-size: 11px; font-weight: 400; color: var(--text-muted);">est.</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="ai-rec-body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div>
              <h3 style="font-size: 20px; font-weight: 600; color: #ffffff;">${escapeHtml(item.title)}</h3>
              <p style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(item.location || 'Kyoto Region')}</p>
            </div>
            ${item.rating ? `
              <span class="dock-status-pill" style="font-size: 12px; font-weight: 600; color: #ffffff;">
                ★ ${item.rating}
              </span>
            ` : ''}
          </div>

          <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5;">${escapeHtml(item.description || item.notes || '')}</p>

          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${chipsHtml}
          </div>

          <!-- 1-Click Commit Action -->
          <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);">
            <button class="btn-liquid-primary btn-commit-ai-item" data-idx="${idx}" type="button">
              <span class="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Commit to Itinerary (Day ${item.day || 1})</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach Commit Button Click
  container.querySelectorAll('.btn-commit-ai-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.idx);
      const chosen = list[idx];
      if (chosen) {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span><span>Committing...</span>`;
        await commitAIToItinerary(chosen);
        btn.innerHTML = `<span>✓ Added to Day ${chosen.day || 1}</span>`;
        showToast(`Added "${chosen.title}" to Day ${chosen.day || 1}!`);
      }
    });
  });
}

async function commitAIToItinerary(item) {
  if (!currentTrip) return;
  const newItem = {
    day: Number(item.day) || 1,
    timeBlock: item.timeBlock || 'morning',
    time: item.time || '10:00',
    category: item.category || 'sight',
    title: item.title,
    location: item.location || currentTrip.destination,
    cost: Number(item.price) || 0,
    notes: item.description || ''
  };

  try {
    const res = await fetch(`/api/trips/${currentTrip.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    });
    if (res.ok) {
      await loadActiveTrip(currentTrip.id);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderAIDayPreview(trip) {
  const container = document.getElementById('ai-day-preview-list');
  if (!container || !trip) return;

  const items = (trip.items || []).slice(0, 4);
  if (items.length === 0) {
    container.innerHTML = `<p style="font-size: 13px; color: var(--text-muted);">No stops planned yet.</p>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="liquid-capsule" style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--water-accent);">${item.time || '10:00'}</span>
        <div>
          <div style="font-size: 13.5px; font-weight: 600; color: #ffffff;">${escapeHtml(item.title)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(item.location || '')}</div>
        </div>
      </div>
      <span class="material-symbols-outlined text-[16px]" style="color: var(--emerald-accent);">check_circle</span>
    </div>
  `).join('');
}

function renderWishlist() {
  const container = document.getElementById('ai-wishlist-container');
  const countLabel = document.getElementById('ai-wishlist-count');
  if (!container) return;

  if (countLabel) countLabel.textContent = `${wishlistItems.length} Spots`;

  container.innerHTML = wishlistItems.map((spot, idx) => `
    <div class="liquid-capsule" style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="material-symbols-outlined text-[18px]" style="color: var(--water-accent);">${spot.icon || 'place'}</span>
        <div>
          <div style="font-size: 13.5px; font-weight: 600; color: #ffffff;">${escapeHtml(spot.title)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(spot.subtitle)}</div>
        </div>
      </div>
      <button class="btn-liquid-subtle btn-assign-wishlist" data-idx="${idx}" style="padding: 4px 10px; font-size: 11.5px;" type="button">
        Assign
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-assign-wishlist').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.idx);
      const spot = wishlistItems[idx];
      if (spot && currentTrip) {
        await commitAIToItinerary({
          title: spot.title,
          location: spot.subtitle,
          category: spot.category,
          day: 1
        });
        wishlistItems.splice(idx, 1);
        renderWishlist();
        showToast(`Assigned ${spot.title} to Day 1!`);
      }
    });
  });
}

// ----------------- INTERACTIVE LEAFLET MAP -----------------
function initMap() {
  const mapEl = document.getElementById('map-container');
  if (!mapEl) return;

  leafletMap = L.map('map-container', {
    zoomControl: false,
    attributionControl: false
  }).setView([35.0116, 135.7681], 12); // Default to Kyoto coordinates

  // 100% Free OpenStreetMap Layer (Zero API Key Required)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(leafletMap);

  L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);
}

function updateMapMarkers(trip) {
  if (!leafletMap || !trip) return;

  // Clear existing markers
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];

  let items = trip.items || [];
  if (activeDayFilter !== 'all') {
    items = items.filter(i => String(i.day) === String(activeDayFilter));
  }

  // Base coordinate (Kyoto or fallback)
  const baseLat = 35.0116;
  const baseLng = 135.7681;

  items.forEach((item, index) => {
    // Generate deterministic coordinate offset around city center for beautiful spatial dispersion
    const hash = simpleStringHash(item.location || item.title || String(index));
    const offsetLat = ((hash % 100) - 50) * 0.0007;
    const offsetLng = (((hash >> 4) % 100) - 50) * 0.0007;
    const lat = baseLat + offsetLat;
    const lng = baseLng + offsetLng;

    const stepNum = String(index + 1).padStart(2, '0');

    const customIcon = L.divIcon({
      className: 'custom-spatial-marker-wrapper',
      html: `<div class="custom-spatial-marker">${stepNum}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(leafletMap);
    marker.bindPopup(`
      <div style="color: #0d0e10; font-family: 'Inter', sans-serif; font-size: 13px;">
        <strong>#${stepNum} ${escapeHtml(item.title)}</strong><br>
        <span style="color: #636466;">${escapeHtml(item.time || '')} • ${escapeHtml(item.location || '')}</span>
      </div>
    `);

    mapMarkers.push(marker);
  });

  fitMapToMarkers();
}

function fitMapToMarkers() {
  if (!leafletMap || mapMarkers.length === 0) return;
  const group = L.featureGroup(mapMarkers);
  leafletMap.fitBounds(group.getBounds().pad(0.2));
}

// ----------------- PACKING CHECKLIST -----------------
function setupPackingSection() {
  const form = document.getElementById('form-add-pack-item');
  const input = document.getElementById('input-pack-item-name');

  if (form && input) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name || !currentTrip) return;

      try {
        const res = await fetch(`/api/trips/${currentTrip.id}/packing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: name, packed: false, category: 'General' })
        });
        if (res.ok) {
          input.value = '';
          await loadActiveTrip(currentTrip.id);
          showToast('Added to packing list');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
}

function renderPackingItems(trip) {
  const container = document.getElementById('packing-items-list');
  const ratioLabel = document.getElementById('packing-progress-ratio');
  if (!container || !trip) return;

  const items = trip.packingList || [];
  const packedCount = items.filter(i => i.packed).length;

  if (ratioLabel) {
    ratioLabel.textContent = `${packedCount} / ${items.length} Packed`;
  }

  if (items.length === 0) {
    container.innerHTML = `<p style="font-size: 12.5px; color: var(--text-muted); padding: 8px 0;">No items yet. Type an item above to add.</p>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="pack-item-row">
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
        <input class="pack-checkbox pack-toggle" data-id="${item.id}" type="checkbox" ${item.packed ? 'checked' : ''}>
        <span style="font-size: 13.5px; color: ${item.packed ? 'var(--text-muted)' : '#ffffff'}; text-decoration: ${item.packed ? 'line-through' : 'none'};">
          ${escapeHtml(item.item)}
        </span>
      </label>
      <button class="btn-icon-disc btn-delete-pack" data-id="${item.id}" style="width: 24px; height: 24px; opacity: 0.6;" type="button">
        <span class="material-symbols-outlined text-[13px]">close</span>
      </button>
    </div>
  `).join('');

  // Checkbox Toggle
  container.querySelectorAll('.pack-toggle').forEach(chk => {
    chk.addEventListener('change', async () => {
      const id = chk.dataset.id;
      const packed = chk.checked;
      await fetch(`/api/trips/${trip.id}/packing/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packed })
      });
      await loadActiveTrip(trip.id);
    });
  });

  // Delete Item
  container.querySelectorAll('.btn-delete-pack').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await fetch(`/api/trips/${trip.id}/packing/${id}`, { method: 'DELETE' });
      await loadActiveTrip(trip.id);
    });
  });
}

// ----------------- BUDGET METRICS -----------------
function renderBudgetMetrics(trip) {
  if (!trip) return;

  const total = Number(trip.targetBudget) || 3500;
  const spent = (trip.items || []).reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
  const remaining = Math.max(total - spent, 0);
  const pct = Math.min(Math.round((spent / total) * 100), 100);

  const totalEl = document.getElementById('budget-total-display');
  const spentEl = document.getElementById('budget-spent-display');
  const remEl = document.getElementById('budget-remaining-display');
  const barEl = document.getElementById('budget-progress-bar');
  const currEl = document.getElementById('budget-currency-label');

  if (totalEl) totalEl.textContent = `$${total.toLocaleString()}`;
  if (spentEl) spentEl.textContent = `$${spent.toLocaleString()}`;
  if (remEl) remEl.textContent = `$${remaining.toLocaleString()}`;
  if (barEl) barEl.style.width = `${pct}%`;
  if (currEl) currEl.textContent = trip.currency || 'USD';
}

// ----------------- SYSTEM SETTINGS -----------------
function setupSettingsSection() {
  const sliderCtx = document.getElementById('slider-context-window');
  const displayCtx = document.getElementById('display-context-window');
  if (sliderCtx && displayCtx) {
    sliderCtx.addEventListener('input', () => {
      displayCtx.textContent = `${Number(sliderCtx.value).toLocaleString()} tokens`;
    });
  }

  const sliderTemp = document.getElementById('slider-temperature');
  const displayTemp = document.getElementById('display-temperature');
  if (sliderTemp && displayTemp) {
    sliderTemp.addEventListener('input', () => {
      displayTemp.textContent = `${sliderTemp.value} (${sliderTemp.value < 0.4 ? 'Analytical' : 'Creative'})`;
    });
  }

  const btnSave = document.getElementById('btn-save-settings');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const payload = {
        ollamaUrl: document.getElementById('input-ollama-url').value,
        ollamaModel: document.getElementById('select-ollama-model').value,
        geminiApiKey: document.getElementById('input-gemini-key').value,
        geminiModel: document.getElementById('select-gemini-model').value,
        enableWebSearch: document.getElementById('toggle-web-search').checked
      };

      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          appSettings = await res.json();
          showToast('Sovereign settings updated successfully!');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to save settings', 'error');
      }
    });
  }

  // Database Export & Import
  const btnExport = document.getElementById('btn-export-vault');
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/trips');
        const data = await res.json();
        downloadJSON(data, 'voyage-sovereign-vault.json');
        showToast('Vault backup downloaded');
      } catch (err) {
        showToast('Export failed', 'error');
      }
    });
  }
}

function populateSettingsForm(settings) {
  if (!settings) return;
  if (settings.ollamaUrl) document.getElementById('input-ollama-url').value = settings.ollamaUrl;
  if (settings.ollamaModel) document.getElementById('select-ollama-model').value = settings.ollamaModel;
  if (settings.geminiApiKey) document.getElementById('input-gemini-key').value = settings.geminiApiKey;
  if (settings.geminiModel) document.getElementById('select-gemini-model').value = settings.geminiModel;
  if (typeof settings.enableWebSearch === 'boolean') {
    document.getElementById('toggle-web-search').checked = settings.enableWebSearch;
  }
}

// ----------------- FORMS & CRUD OPERATIONS -----------------
function setupForms() {
  // New Expedition Form
  const formNew = document.getElementById('form-new-trip');
  if (formNew) {
    formNew.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('input-new-trip-title').value.trim(),
        destination: document.getElementById('input-new-trip-dest').value.trim(),
        startDate: document.getElementById('input-new-trip-start').value,
        endDate: document.getElementById('input-new-trip-end').value,
        travelers: document.getElementById('input-new-trip-travelers').value.trim(),
        targetBudget: Number(document.getElementById('input-new-trip-budget').value) || 3500,
        notes: document.getElementById('input-new-trip-notes').value.trim()
      };

      try {
        const res = await fetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          closeModal(document.getElementById('modal-new-trip'));
          formNew.reset();
          activeTripId = created.id;
          await loadTrips();
          showToast(`Expedition "${created.title}" initialized!`);
          switchTab('master-itinerary');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to create trip', 'error');
      }
    });
  }

  // Add / Edit Stop Item Form
  const formStop = document.getElementById('form-stop-item');
  if (formStop) {
    formStop.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentTrip) return;

      const itemId = document.getElementById('input-stop-id').value;
      const payload = {
        title: document.getElementById('input-stop-title').value.trim(),
        day: Number(document.getElementById('input-stop-day').value) || 1,
        timeBlock: document.getElementById('select-stop-timeblock').value,
        time: document.getElementById('input-stop-time').value,
        category: document.getElementById('select-stop-category').value,
        location: document.getElementById('input-stop-location').value.trim(),
        cost: Number(document.getElementById('input-stop-cost').value) || 0,
        websiteUrl: document.getElementById('input-stop-url').value.trim(),
        notes: document.getElementById('input-stop-notes').value.trim()
      };

      try {
        let res;
        if (itemId) {
          res = await fetch(`/api/trips/${currentTrip.id}/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          res = await fetch(`/api/trips/${currentTrip.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        if (res.ok) {
          closeModal(document.getElementById('modal-stop-item'));
          formStop.reset();
          await loadActiveTrip(currentTrip.id);
          showToast(itemId ? 'Stop updated' : 'Stop committed to itinerary');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to save stop', 'error');
      }
    });
  }

  // Import Raw Plan Form
  const formImport = document.getElementById('form-import-plan');
  if (formImport) {
    formImport.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawText = document.getElementById('textarea-import-raw').value.trim();
      const btnSubmit = document.getElementById('btn-submit-import');
      if (!rawText) return;

      const modeRadio = document.querySelector('input[name="import-target-mode"]:checked');
      const importMode = modeRadio ? modeRadio.value : (currentTrip ? 'current' : 'new');

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span><span>Converting Plan...</span>`;

      try {
        const payload = {
          rawPlan: rawText,
          importMode,
          targetTripId: (importMode === 'current' && currentTrip) ? currentTrip.id : null,
          tripId: (importMode === 'current' && currentTrip) ? currentTrip.id : null
        };

        const res = await fetch('/api/import-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          closeModal(document.getElementById('modal-import-plan'));
          formImport.reset();

          await loadTrips();
          const targetId = (data.trip && data.trip.id) ? data.trip.id : (currentTrip ? currentTrip.id : null);
          if (targetId) {
            await loadActiveTrip(targetId);
          }
          showToast('Itinerary converted to Nebula Voyage successfully!');
          switchTab('master-itinerary');
          if (leafletMap) {
            setTimeout(() => {
              leafletMap.invalidateSize();
              fitMapToMarkers();
            }, 300);
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Conversion failed');
        }
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Plan conversion failed.', 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<span class="material-symbols-outlined text-[18px]">auto_awesome</span><span>Convert to Nebula Plan</span>`;
      }
    });
  }
}

function openAddStopModal() {
  const form = document.getElementById('form-stop-item');
  if (form) form.reset();
  document.getElementById('input-stop-id').value = '';
  document.getElementById('modal-stop-title').textContent = 'Add Stop to Itinerary';
  document.getElementById('input-stop-day').value = activeDayFilter === 'all' ? 1 : activeDayFilter;
  openModal(document.getElementById('modal-stop-item'));
}

function openEditStopModal(item) {
  document.getElementById('input-stop-id').value = item.id;
  document.getElementById('modal-stop-title').textContent = 'Edit Itinerary Stop';
  document.getElementById('input-stop-title').value = item.title || '';
  document.getElementById('input-stop-day').value = item.day || 1;
  document.getElementById('select-stop-timeblock').value = item.timeBlock || 'morning';
  document.getElementById('input-stop-time').value = item.time || '';
  document.getElementById('select-stop-category').value = item.category || 'sight';
  document.getElementById('input-stop-location').value = item.location || '';
  document.getElementById('input-stop-cost').value = item.cost || 0;
  document.getElementById('input-stop-url').value = item.websiteUrl || '';
  document.getElementById('input-stop-notes').value = item.notes || '';
  openModal(document.getElementById('modal-stop-item'));
}

async function deleteStopItem(itemId) {
  if (!currentTrip) return;
  try {
    const res = await fetch(`/api/trips/${currentTrip.id}/items/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadActiveTrip(currentTrip.id);
      showToast('Stop removed');
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteTrip(tripId) {
  try {
    const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
    if (res.ok) {
      activeTripId = null;
      await loadTrips();
      showToast('Expedition deleted from node');
    }
  } catch (err) {
    console.error(err);
  }
}

// ----------------- SHARE MODAL -----------------
function openShareModal() {
  if (!currentTrip) return;
  const linkInput = document.getElementById('input-share-link');
  const token = currentTrip.shareToken || currentTrip.id;
  const shareUrl = `${window.location.origin}/share.html?token=${token}`;

  if (linkInput) linkInput.value = shareUrl;

  const btnCopy = document.getElementById('btn-copy-share-link');
  if (btnCopy) {
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(shareUrl);
      showToast('Share link copied to clipboard!');
    };
  }

  const btnDownload = document.getElementById('btn-download-trip-json');
  if (btnDownload) {
    btnDownload.onclick = () => downloadTripJSON(currentTrip);
  }

  openModal(document.getElementById('modal-share'));
}

// ----------------- WEATHER -----------------
async function fetchDestinationWeather(destination) {
  if (!destination) return;
  try {
    const res = await fetch(`/api/weather?q=${encodeURIComponent(destination)}`);
    if (res.ok) {
      const data = await res.json();
      const badge = document.getElementById('itinerary-weather-badge');
      if (badge && data.temperature) {
        badge.innerHTML = `
          <span class="material-symbols-outlined text-[18px]" style="color: var(--amber-accent);">wb_sunny</span>
          <span>${data.temperature}°C · ${escapeHtml(data.condition || 'Clear')}</span>
        `;
      }
    }
  } catch (err) {
    // Non-critical, keep fallback weather text
  }
}

// ----------------- UTILITIES -----------------
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
    }
  } catch {}
  return dateStr;
}

function calculateDurationDays(start, end) {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  } catch {
    return 1;
  }
}

function getCategoryIcon(cat) {
  switch ((cat || '').toLowerCase()) {
    case 'flight': return 'flight';
    case 'lodging': return 'hotel';
    case 'food': return 'restaurant';
    case 'sight': return 'nature_people';
    case 'shopping': return 'shopping_bag';
    default: return 'place';
  }
}

function simpleStringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function downloadTripJSON(trip) {
  downloadJSON(trip, `trip-${trip.id}.json`);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------- REAL LIQUID GLASS WEBGL SHADER ENGINE -----------------
function initLiquidGlassShader() {
  const canvas = document.getElementById('liquid-glass-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn('WebGL not supported, falling back to CSS glass.');
    return;
  }

  const setCanvasSize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  setCanvasSize();

  const vsSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragShaderEl = document.getElementById('fragShader');
  if (!fragShaderEl) return;
  const fsSource = fragShaderEl.textContent;

  const createShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Shader compile log:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = createShader(gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Shader program link log:', gl.getShaderInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );

  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, 'iResolution'),
    time: gl.getUniformLocation(program, 'iTime'),
    mouse: gl.getUniformLocation(program, 'iMouse'),
    texture: gl.getUniformLocation(program, 'iChannel0'),
    texResolution: gl.getUniformLocation(program, 'uTextureResolution'),
    numLenses: gl.getUniformLocation(program, 'uNumLenses'),
    lenses: gl.getUniformLocation(program, 'uLenses'),
    lensParams: gl.getUniformLocation(program, 'uLensParams')
  };

  let mouse = [-2000, -2000];
  let targetMouse = [-2000, -2000];

  window.addEventListener('mousemove', (e) => {
    targetMouse = [e.clientX, canvas.height - e.clientY];
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 0) {
      targetMouse = [e.touches[0].clientX, canvas.height - e.touches[0].clientY];
    }
  }, { passive: true });

  const texture = gl.createTexture();
  const img = document.getElementById('liquidGlassTexture') || new Image();

  const setupTexture = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  if (img.complete && img.naturalWidth !== 0) {
    setupTexture();
  } else {
    img.onload = setupTexture;
    if (!img.src) img.src = '/liquid_ocean_bg.jpg';
  }

  const maxLenses = 8;
  const flatLenses = new Float32Array(maxLenses * 4);
  const flatParams = new Float32Array(maxLenses * 4);

  const startTime = performance.now();
  const render = () => {
    // Smooth fluid lerp for mouse cursor lighting
    mouse[0] += (targetMouse[0] - mouse[0]) * 0.12;
    mouse[1] += (targetMouse[1] - mouse[1]) * 0.12;

    const currentTime = (performance.now() - startTime) / 1000;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform3f(uniforms.resolution, canvas.width, canvas.height, 1.0);
    gl.uniform1f(uniforms.time, currentTime);
    gl.uniform4f(uniforms.mouse, mouse[0], mouse[1], 0, 0);
    gl.uniform2f(uniforms.texResolution, img.naturalWidth || 1920, img.naturalHeight || 1080);

    // Dynamically evaluate visible UI elements for real liquid glass refraction
    let lensCount = 0;
    flatLenses.fill(0);
    flatParams.fill(0);

    const addLens = (el, defaultRadius = 24) => {
      if (!el || lensCount >= maxLenses) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // Viewport culling
      if (rect.bottom < -60 || rect.top > window.innerHeight + 60) return;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

      const cx = rect.left + rect.width * 0.5;
      const cy = canvas.height - (rect.top + rect.height * 0.5);
      const hw = rect.width * 0.5;
      const hh = rect.height * 0.5;

      let r = defaultRadius;
      if (el.classList.contains('dock-inner') || (style.borderRadius && style.borderRadius.includes('9999px'))) {
        r = Math.min(hw, hh);
      } else if (style.borderRadius) {
        const parsed = parseFloat(style.borderRadius);
        if (!isNaN(parsed) && parsed > 0) r = Math.min(parsed, Math.min(hw, hh));
      }

      const idx = lensCount * 4;
      flatLenses[idx] = cx;
      flatLenses[idx + 1] = cy;
      flatLenses[idx + 2] = hw;
      flatLenses[idx + 3] = hh;

      flatParams[idx] = r;
      flatParams[idx + 1] = 1.0;
      flatParams[idx + 2] = 1.0;
      flatParams[idx + 3] = 0.0;
      lensCount++;
    };

    // 1. Highest priority: Active modal sheet if open
    const activeModal = document.querySelector('.modal-backdrop.active .modal-sheet');
    if (activeModal) {
      addLens(activeModal, 28);
    }

    // 2. Persistent Top Navigation Dock
    const dock = document.querySelector('.dock-inner');
    if (dock) {
      addLens(dock, 30);
    }

    // 3. Prominent active tab components
    const activeTab = document.querySelector('.tab-view.active');
    if (activeTab) {
      const selectors = [
        '#featured-trip-container .trip-hero-glass-card',
        '.import-conversion-banner',
        '.ai-planner-deck',
        '.itinerary-meta-deck',
        '.day-selector-dock',
        '#itinerary-col-map',
        '.itinerary-schedule-chamber',
        '.settings-deck',
        '.trip-vault-card'
      ];
      for (let s = 0; s < selectors.length && lensCount < maxLenses; s++) {
        const els = activeTab.querySelectorAll(selectors[s]);
        for (let j = 0; j < els.length && lensCount < maxLenses; j++) {
          addLens(els[j], 22);
        }
      }
    }

    gl.uniform1i(uniforms.numLenses, lensCount);
    gl.uniform4fv(uniforms.lenses, flatLenses);
    gl.uniform4fv(uniforms.lensParams, flatParams);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.texture, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  };

  window.addEventListener('resize', setCanvasSize);
  render();
}

// ----------------- INTERACTIVE SPECULAR LIGHTING TRACKER -----------------
function initInteractiveGlassLighting() {
  window.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.liquid-glass, .btn-liquid-primary, .btn-liquid-subtle');
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (
        e.clientX >= rect.left - 80 &&
        e.clientX <= rect.right + 80 &&
        e.clientY >= rect.top - 80 &&
        e.clientY <= rect.bottom + 80
      ) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      }
    });
  }, { passive: true });
}
