/* ============================================================
   Nimbus Weather App — JavaScript (app.js)
   ============================================================ */

// ── API endpoints ──────────────────────────────────────────────
const API_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEO_API  = 'https://geocoding-api.open-meteo.com/v1/search';

// ── State ──────────────────────────────────────────────────────
let currentUnit     = 'C';
let weatherData     = null;
let currentLocation = null;

// ── WMO weather code maps ──────────────────────────────────────
const WMO_ICONS = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️', 45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌧️', 56:'🌧️', 57:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️', 66:'🌨️', 67:'🌨️',
  71:'❄️', 73:'❄️', 75:'❄️', 77:'🌨️',
  80:'🌦️', 81:'🌦️', 82:'⛈️',
  85:'🌨️', 86:'🌨️', 95:'⛈️', 96:'⛈️', 99:'⛈️'
};

const WMO_DESC = {
  0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
  45:'Foggy', 48:'Depositing rime fog',
  51:'Light drizzle', 53:'Moderate drizzle', 55:'Dense drizzle',
  56:'Light freezing drizzle', 57:'Heavy freezing drizzle',
  61:'Slight rain', 63:'Moderate rain', 65:'Heavy rain',
  66:'Light freezing rain', 67:'Heavy freezing rain',
  71:'Slight snow', 73:'Moderate snow', 75:'Heavy snow', 77:'Snow grains',
  80:'Slight showers', 81:'Moderate showers', 82:'Violent showers',
  85:'Slight snow showers', 86:'Heavy snow showers',
  95:'Thunderstorm', 96:'Thunderstorm w/ hail', 99:'Heavy thunderstorm'
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Temperature helpers ────────────────────────────────────────
function toF(c)     { return Math.round(c * 9 / 5 + 32); }
function showTemp(c) { return currentUnit === 'C' ? Math.round(c) : toF(c); }
function unitSym()  { return '°' + currentUnit; }

// ── Wind direction ─────────────────────────────────────────────
function getWindDir(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// ── Error display ──────────────────────────────────────────────
function showError(msg) {
  const eb = document.getElementById('error-box');
  eb.style.display = 'flex';
  document.getElementById('error-text').textContent = msg;
  setTimeout(() => { eb.style.display = 'none'; }, 5000);
}

// ── Geocoding ──────────────────────────────────────────────────
async function geocode(city) {
  const r = await fetch(`${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const d = await r.json();
  if (!d.results || !d.results.length) throw new Error('City not found. Try another name.');
  return d.results[0];
}

// ── Weather fetch ──────────────────────────────────────────────
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    hourly:    'temperature_2m,weathercode,relative_humidity_2m,windspeed_10m,precipitation_probability',
    daily:     'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,uv_index_max,sunrise,sunset',
    current_weather: true,
    timezone:  'auto',
    forecast_days: 7
  });
  const r = await fetch(`${API_BASE}?${params}`);
  return r.json();
}



// ── Build hourly HTML ──────────────────────────────────────────
function buildHourlyHTML(hourly, currentHourIdx) {
  let html = '';
  for (let i = 0; i < 12; i++) {
    const idx   = currentHourIdx + i;
    if (idx >= hourly.temperature_2m.length) break;
    const hTime = i === 0 ? 'Now' : (idx % 24).toString().padStart(2, '0') + ':00';
    const hIcon = WMO_ICONS[hourly.weathercode[idx]] || '🌤️';
    html += `
      <div class="hour-card${i === 0 ? ' now' : ''}">
        <div class="hour-time">${hTime}</div>
        <div class="hour-icon">${hIcon}</div>
        <div class="hour-temp">${showTemp(hourly.temperature_2m[idx])}${unitSym()}</div>
      </div>`;
  }
  return html;
}

// ── Build 7-day forecast HTML ──────────────────────────────────
function buildForecastHTML(daily) {
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d       = new Date(daily.time[i]);
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAYS[d.getDay()];
    const fi      = WMO_ICONS[daily.weathercode[i]] || '🌤️';
    const fd      = WMO_DESC[daily.weathercode[i]] || '';
    const hi      = showTemp(daily.temperature_2m_max[i]);
    const lo      = showTemp(daily.temperature_2m_min[i]);
    const rain    = daily.precipitation_probability_max[i];
    const range   = Math.max(1, hi - lo);
    const pct     = Math.min(100, Math.round((range / (currentUnit === 'C' ? 20 : 36)) * 100));
    html += `
      <div class="forecast-row">
        <div class="forecast-day">${dayName}</div>
        <div class="forecast-icon">${fi}</div>
        <div class="forecast-desc">${fd}</div>
        ${rain > 20 ? `<div class="forecast-rain">💧 ${rain}%</div>` : ''}
        <div class="range-bar-wrap"><div class="range-bar-fill" style="width:${pct}%"></div></div>
        <div class="forecast-temps">
          <span class="temp-high">${hi}°</span>
          <span class="temp-low">${lo}°</span>
        </div>
      </div>`;
  }
  return html;
}

// ── Main render ────────────────────────────────────────────────
function renderWeather(data, locInfo) {
  weatherData     = data;
  currentLocation = locInfo;

  const c      = data.current_weather;
  const daily  = data.daily;
  const hourly = data.hourly;
  const now    = new Date();

  // Timestamp
  document.getElementById('last-updated').textContent =
    'Updated ' + now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0');

  const currentHourIdx = now.getHours();
  const humidity       = hourly.relative_humidity_2m[currentHourIdx] ?? '--';
  const windspeed      = Math.round(c.windspeed);
  const winddir        = getWindDir(c.winddirection);
  const uv             = Math.round(daily.uv_index_max[0]);
  const sunrise        = daily.sunrise[0]?.split('T')[1] ?? '--';
  const sunset         = daily.sunset[0]?.split('T')[1] ?? '--';
  const precipChance   = daily.precipitation_probability_max[0];
  const feelsLike      = Math.round(c.temperature - (0.4 * (c.temperature - 10) * (1 - humidity / 100)));
  const icon           = WMO_ICONS[c.weathercode] || '🌡️';
  const desc           = WMO_DESC[c.weathercode]  || 'Unknown';

  const uvColor = uv <= 2 ? '#22c55e' : uv <= 5 ? '#eab308' : uv <= 7 ? '#f97316' : '#ef4444';
  const uvLabel = uv <= 2 ? 'Low'     : uv <= 5 ? 'Moderate' : uv <= 7 ? 'High'   : 'Very High';
  const uvPct   = Math.min(100, Math.round((uv / 11) * 100));

  document.getElementById('content').innerHTML = `
    <!-- Current conditions -->
    <div class="main-card fade-in">
      <div class="weather-hero">
        <div>
          <div class="location-name">📍 ${locInfo.name}${locInfo.country_code ? ', ' + locInfo.country_code : ''}</div>
          <div style="display:flex;align-items:flex-end;gap:8px;">
            <div class="temp-main">${showTemp(c.temperature)}</div>
            <div class="temp-unit-toggle">
              <button class="unit-btn${currentUnit === 'C' ? ' active' : ''}" onclick="switchUnit('C')">°C</button>
              <button class="unit-btn${currentUnit === 'F' ? ' active' : ''}" onclick="switchUnit('F')">°F</button>
            </div>
          </div>
          <div class="condition-text">${desc}</div>
          <div class="feels-like">
            Feels like ${showTemp(feelsLike)}${unitSym()} ·
            ${now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </div>
        </div>
        <div class="weather-icon-large">${icon}</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">💧</div>
          <div class="stat-label">Humidity</div>
          <div class="stat-value">${humidity}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💨</div>
          <div class="stat-label">Wind</div>
          <div class="stat-value">${windspeed} <span style="font-size:13px;font-weight:400">km/h ${winddir}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🌧️</div>
          <div class="stat-label">Rain chance</div>
          <div class="stat-value">${precipChance}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">☀️</div>
          <div class="stat-label">UV Index</div>
          <div class="stat-value" style="color:${uvColor}">${uv} <span style="font-size:12px;font-weight:400">${uvLabel}</span></div>
          <div class="uv-bar-wrap"><div class="uv-bar" style="width:${uvPct}%"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🌅</div>
          <div class="stat-label">Sunrise</div>
          <div class="stat-value" style="font-size:17px">${sunrise}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🌇</div>
          <div class="stat-label">Sunset</div>
          <div class="stat-value" style="font-size:17px">${sunset}</div>
        </div>
      </div>
    </div>

    <!-- Hourly forecast -->
    <div class="main-card fade-in" style="padding:24px 20px 20px">
      <div class="section-title">Hourly Forecast</div>
      <div class="hourly-scroll">${buildHourlyHTML(hourly, currentHourIdx)}</div>
    </div>

    <!-- 7-day forecast -->
    <div class="main-card fade-in" style="padding:24px 20px 20px">
      <div class="section-title">7-Day Forecast</div>
      <div class="forecast-list">${buildForecastHTML(daily)}</div>
    </div>

    <!-- Location info -->
    <div class="map-card fade-in">
      <div class="map-placeholder">
        <div class="map-grid"></div>
        <div class="map-pin">📍</div>
      </div>
      <div class="map-info">
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--sky-dark)">${locInfo.name}</div>
          <div class="map-coords">Lat: ${locInfo.latitude?.toFixed(4)} · Lon: ${locInfo.longitude?.toFixed(4)}</div>
        </div>
        <div style="font-size:12px;color:var(--text3)">Timezone: ${locInfo.timezone || data.timezone || 'Auto'}</div>
      </div>
    </div>`;


}

// ── Unit switcher (called from inline onclick) ─────────────────
function switchUnit(u) {
  currentUnit = u;
  if (weatherData && currentLocation) renderWeather(weatherData, currentLocation);
}

// ── Search flow ────────────────────────────────────────────────
async function search(city) {
  document.getElementById('error-box').style.display = 'none';
  document.getElementById('content').innerHTML = `
    <div class="main-card">
      <div class="empty-state">
        <div class="ai-loading" style="justify-content:center">
          <div class="ai-dot"></div>
          <div class="ai-dot"></div>
          <div class="ai-dot"></div>
          <span style="margin-left:4px">Fetching weather…</span>
        </div>
      </div>
    </div>`;

  try {
    const loc  = await geocode(city);
    const data = await fetchWeather(loc.latitude, loc.longitude);
    renderWeather(data, loc);
  } catch (e) {
    showError(e.message || 'Failed to fetch weather.');
    document.getElementById('content').innerHTML = `
      <div class="main-card">
        <div class="empty-state">
          <div class="empty-icon">🌧️</div>
          <div class="empty-title">Oops!</div>
          <div class="empty-sub">${e.message}</div>
        </div>
      </div>`;
  }
}

// ── Geolocation flow ───────────────────────────────────────────
async function useLocation() {
  if (!navigator.geolocation) { showError('Geolocation not supported.'); return; }

  document.getElementById('content').innerHTML = `
    <div class="main-card">
      <div class="empty-state">
        <div class="ai-loading" style="justify-content:center">
          <div class="ai-dot"></div>
          <div class="ai-dot"></div>
          <div class="ai-dot"></div>
          <span style="margin-left:4px">Getting your location…</span>
        </div>
      </div>
    </div>`;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const d = await r.json();
        const loc = {
          name:         d.address.city || d.address.town || d.address.village || d.address.county || 'Your Location',
          country_code: d.address.country_code?.toUpperCase(),
          latitude,
          longitude,
          timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        const weather = await fetchWeather(latitude, longitude);
        renderWeather(weather, loc);
      } catch (e) {
        showError('Could not get weather for your location.');
      }
    },
    () => showError('Location access denied.')
  );
}

// ── Event listeners ────────────────────────────────────────────
document.getElementById('search-btn').addEventListener('click', () => {
  const v = document.getElementById('city-input').value.trim();
  if (v) search(v);
});

document.getElementById('city-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const v = e.target.value.trim();
    if (v) search(v);
  }
});

document.getElementById('loc-btn').addEventListener('click', useLocation);

// ── Default load ───────────────────────────────────────────────
search('Bengaluru');
