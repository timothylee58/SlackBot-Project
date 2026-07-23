// ── Defaults ─────────────────────────────────────────────────────────────────
const defaultLat  = 1.3521;
const defaultLng  = 103.8198;
const defaultZoom = 10;

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const lat    = parseFloat(params.get('lat'));
    const lng    = parseFloat(params.get('lng'));
    const zoom   = parseInt(params.get('zoom'));
    return {
        lat:  (!isNaN(lat)  && lat  >= -90  && lat  <= 90)  ? lat  : defaultLat,
        lng:  (!isNaN(lng)  && lng  >= -180 && lng  <= 180) ? lng  : defaultLng,
        zoom: (!isNaN(zoom) && zoom > 0)                     ? zoom : defaultZoom,
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── State ─────────────────────────────────────────────────────────────────────
var map;
var markers        = [];
var openInfoWindow = null;
var currentLocation = null;  // tracks active region to discard stale fetches
var cloudOverlay, precipOverlay;
var cloudVisible   = false;
var precipVisible  = false;
var trafficLayer;
var trafficVisible = false;

// ── RainViewer overlays (no API key required) ─────────────────────────────────
function loadRainViewerOverlays() {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(r => r.json())
        .then(data => {
            const radarFrames = data.radar && data.radar.past;
            if (radarFrames && radarFrames.length) {
                const latest = radarFrames[radarFrames.length - 1].path;
                precipOverlay = new google.maps.ImageMapType({
                    getTileUrl: (coord, zoom) =>
                        `https://tilecache.rainviewer.com${latest}/512/${zoom}/${coord.x}/${coord.y}/2/1_1.png`,
                    tileSize: new google.maps.Size(512, 512),
                    opacity:  0.6,
                    name:     'Precipitation Radar',
                });
            }
            const satFrames = data.satellite && data.satellite.infrared;
            if (satFrames && satFrames.length) {
                const latest = satFrames[satFrames.length - 1].path;
                cloudOverlay = new google.maps.ImageMapType({
                    getTileUrl: (coord, zoom) =>
                        `https://tilecache.rainviewer.com${latest}/512/${zoom}/${coord.x}/${coord.y}/0/0_0.png`,
                    tileSize: new google.maps.Size(512, 512),
                    opacity:  0.5,
                    name:     'Cloud Cover',
                });
            }
        })
        .catch(err => console.error('RainViewer overlay load failed:', err));
}

// ── Marker helpers ────────────────────────────────────────────────────────────
function addMarker(lat, lng, content) {
    const marker     = new google.maps.Marker({ position: { lat, lng }, map });
    const infoWindow = new google.maps.InfoWindow({ content });
    marker.addListener('click', function () {
        if (openInfoWindow) openInfoWindow.close();
        infoWindow.open(map, marker);
        openInfoWindow = infoWindow;
    });
    markers.push(marker);
    return marker;
}

function clearMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
    if (openInfoWindow) { openInfoWindow.close(); openInfoWindow = null; }
}

// ── Weather fetchers ──────────────────────────────────────────────────────────
function fetchSingaporeWeather() {
    const areas = [
        { area: 'City',        coordinates: [1.2830, 103.8514] },
        { area: 'Changi',      coordinates: [1.3644, 103.9915] },
        { area: 'Toa Payoh',   coordinates: [1.3346, 103.8560] },
        { area: 'Ang Mo Kio',  coordinates: [1.3691, 103.8454] },
        { area: 'Jurong West', coordinates: [1.3404, 103.7064] },
        { area: 'Jurong East', coordinates: [1.3324, 103.7438] },
        { area: 'Kallang',     coordinates: [1.3088, 103.8610] },
        { area: 'Pasir Ris',   coordinates: [1.3731, 103.9495] },
        { area: 'Tuas',        coordinates: [1.3214, 103.6490] },
        { area: 'Woodlands',   coordinates: [1.4360, 103.7863] },
    ];

    fetch('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast')
        .then(r => r.json())
        .then(data => {
            areas.forEach(area => {
                const forecast = data.items[0].forecasts.find(f => f.area && f.area.includes(area.area)) || {};
                let icon = '/icon/cloudy-sunny.ico';
                const desc = forecast.forecast || '';
                if (desc.includes('Cloudy'))                              icon = '/icon/cloudy.ico';
                else if (desc.includes('Thundery'))                       icon = '/icon/thunderstorm.ico';
                else if (desc.includes('Rain') || desc.includes('Showers')) icon = '/icon/light-rain.ico';
                else if (desc.includes('Sunny'))                          icon = '/icon/sunny.ico';

                addMarker(area.coordinates[0], area.coordinates[1], `
                    <b>Singapore (${esc(area.area)})</b><br>
                    <img src="${esc(icon)}" alt="Weather Icon" style="width:50px;"><br>
                    ${esc(desc || 'Forecast Data Available Soon')}<br>
                    Last Updated: ${esc(data.items[0]?.update_timestamp || 'Unknown')}
                `);
            });
        })
        .catch(() => {
            areas.forEach(a => addMarker(a.coordinates[0], a.coordinates[1],
                `<b>Singapore (${a.area})</b><br>Unable to fetch weather data.`));
        });
}

function fetchMalaysiaWeather() {
    const snapshot = currentLocation;
    fetch('https://api.data.gov.my/weather/warning?limit=10')
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(data => {
            if (currentLocation !== snapshot) return; // stale — location changed
            const warnings = Array.isArray(data) ? data : (data.data || []);

            const KlangValley = [
                { city: 'Kuala Lumpur',   coordinates: [3.1390, 101.6869] },
                { city: 'Petaling Jaya',  coordinates: [3.1073, 101.6067] },
                { city: 'Subang Jaya',    coordinates: [3.0818, 101.5745] },
                { city: 'Shah Alam',      coordinates: [3.0738, 101.5183] },
                { city: 'Puchong',        coordinates: [3.0331, 101.6220] },
                { city: 'Cheras',         coordinates: [3.0851, 101.7441] },
                { city: 'Ampang',         coordinates: [3.1579, 101.7530] },
                { city: 'Gombak',         coordinates: [3.2910, 101.6744] },
                { city: 'Bangi',          coordinates: [2.9178, 101.7739] },
                { city: 'Kajang',         coordinates: [2.9936, 101.7875] },
                { city: 'Sungai Buloh',   coordinates: [3.2115, 101.5742] },
                { city: 'Putrajaya',      coordinates: [2.9264, 101.6964] },
                { city: 'Klang',          coordinates: [3.0333, 101.4492] },
                { city: 'Seri Kembangan', coordinates: [3.0260, 101.7035] },
                { city: 'Selayang',       coordinates: [3.2656, 101.6506] },
                { city: 'Setia Alam',     coordinates: [3.1020, 101.4587] },
            ];
            const Penang = [
                { city: 'George Town',    coordinates: [5.4141, 100.3288] },
                { city: 'Bayan Lepas',    coordinates: [5.3012, 100.2761] },
                { city: 'Butterworth',    coordinates: [5.4053, 100.3682] },
                { city: 'Tanjung Tokong', coordinates: [5.4371, 100.3028] },
                { city: 'Tanjung Bungah', coordinates: [5.4325, 100.3057] },
                { city: 'Gelugor',        coordinates: [5.3806, 100.3190] },
                { city: 'Sungai Dua',     coordinates: [5.3845, 100.3188] },
                { city: 'Perai',          coordinates: [5.4025, 100.3793] },
                { city: 'Seberang Perai', coordinates: [5.3671, 100.3997] },
                { city: 'Balik Pulau',    coordinates: [5.3371, 100.1692] },
                { city: 'Air Itam',       coordinates: [5.4110, 100.2939] },
                { city: 'Bukit Mertajam', coordinates: [5.3561, 100.4763] },
            ];
            const OtherMY = [
                { city: 'Kuantan',     coordinates: [3.8070, 103.3200] },
                { city: 'Kota Bharu',  coordinates: [6.1294, 102.2393] },
                { city: 'Johor Bahru', coordinates: [1.4929, 103.7414] },
                { city: 'Muar',        coordinates: [2.0427, 102.5528] },
                { city: 'Seremban',    coordinates: [2.7297, 101.9381] },
                { city: 'Batu Pahat',  coordinates: [1.8541, 102.9325] },
                { city: 'Ipoh',        coordinates: [4.5961, 101.0901] },
                { city: 'Melaka',      coordinates: [2.1896, 102.2540] },
            ];

            const affectedRegions = ['Hulu Selangor', 'Gombak', 'Petaling', 'Hulu Langat', 'FT Kuala Lumpur'];

            if (warnings.length === 0) {
                // No active warnings — place a single "all clear" marker per region
                [...KlangValley, ...Penang, ...OtherMY].forEach(loc => {
                    addMarker(loc.coordinates[0], loc.coordinates[1],
                        `<b>${esc(loc.city)}</b><br>No active weather warnings.`);
                });
                return;
            }

            warnings.forEach(warning => {
                const text       = warning?.text_en || 'No warnings currently.';
                const validUntil = warning?.valid_to || 'Unknown';
                const isKLWarning = affectedRegions.some(r => text.includes(r));

                KlangValley.forEach(loc => {
                    let content = `<b>${esc(loc.city)}</b><br>${esc(text)}<br>Valid Until: ${esc(validUntil)}`;
                    if (isKLWarning) content += `<br><img src="/icon/light-rain.ico" style="width:50px;">`;
                    content += `<br><a href="https://www.met.gov.my/en/nowcasting" target="_blank">More Details</a>`;
                    addMarker(loc.coordinates[0], loc.coordinates[1], content);
                });

                [...Penang, ...OtherMY].forEach(loc => {
                    addMarker(loc.coordinates[0], loc.coordinates[1],
                        `<b>${esc(loc.city)}</b><br>${esc(text)}<br>Valid Until: ${esc(validUntil)}<br>
                         <a href="https://www.met.gov.my/en/nowcasting" target="_blank">More Details</a>`);
                });
            });
        })
        .catch(err => console.error('Error fetching Malaysia weather:', err));
}

const hongKongRegions = [
    { name: 'Central and Western', lat: 22.282,  lng: 114.158  },
    { name: 'Eastern District',    lat: 22.2849, lng: 114.221  },
    { name: 'Kowloon City',        lat: 22.3163, lng: 114.186  },
    { name: 'New Territories',     lat: 22.4477, lng: 114.1872 },
    { name: 'Kwun Tong',           lat: 22.308,  lng: 114.225  },
    { name: 'Sham Shui Po',        lat: 22.327,  lng: 114.163  },
    { name: 'Southern District',   lat: 22.247,  lng: 114.161  },
    { name: 'Wan Chai',            lat: 22.276,  lng: 114.176  },
    { name: 'Yau Tsim Mong',       lat: 22.319,  lng: 114.169  },
    { name: 'Tsuen Wan',           lat: 22.372,  lng: 114.114  },
    { name: 'Tuen Mun',            lat: 22.391,  lng: 113.973  },
    { name: 'Sha Tin',             lat: 22.382,  lng: 114.191  },
    { name: 'Tai Po',              lat: 22.450,  lng: 114.170  },
    { name: 'Yuen Long',           lat: 22.445,  lng: 114.022  },
    { name: 'Sai Kung',            lat: 22.383,  lng: 114.273  },
];

function fetchHongKongWeather() {
    const snapshot = currentLocation;
    Promise.all([
        fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en'),
        fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en'),
    ])
        .then(rs => Promise.all(rs.map(r => { if (!r.ok) throw new Error(r.status); return r.json(); })))
        .then(([reg, flw]) => {
            if (currentLocation !== snapshot) return; // stale — location changed
            const iconUrl = `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${reg.icon?.[0] || 0}.png`;
            // rhrread supplies temperature & current icon; flw supplies situation text & outlook
            const content = `
                <b>Max Temp:</b> ${esc(reg.temperature?.data?.[0]?.value ?? '?')}°C<br>
                <b>Min Temp:</b> ${esc(reg.temperature?.data?.[1]?.value ?? '?')}°C<br>
                <b>General Situation:</b> ${esc(flw.generalSituation || 'N/A')}<br>
                <b>Typhoon Info:</b> ${esc(flw.tcInfo || reg.tcInfo || 'No typhoon warnings')}<br>
                <b>Forecast:</b> ${esc(flw.forecastDesc || 'N/A')}<br>
                <b>Outlook:</b> ${esc(flw.outlook || 'N/A')}<br>
                <img src="${esc(iconUrl)}" style="width:50px;">
            `;
            hongKongRegions.forEach(r => addMarker(r.lat, r.lng, `<b>Weather for ${esc(r.name)}</b><br>${content}`));
        })
        .catch(err => console.error('Error fetching HK weather:', err));
}

// ── Location switcher ─────────────────────────────────────────────────────────
function switchLocation(location, skipRecenter) {
    const data = {
        'singapore':   { coords: { lat: 1.3521,  lng: 103.8198 }, fn: fetchSingaporeWeather },
        'hong-kong':   { coords: { lat: 22.3193, lng: 114.1694 }, fn: fetchHongKongWeather  },
        'klang-valley':{ coords: { lat: 3.1390,  lng: 101.6869 }, fn: fetchMalaysiaWeather  },
    };
    if (!data[location]) return;
    currentLocation = location;  // set before async fetch so stale-check works
    clearMarkers();
    if (!skipRecenter) {
        map.setCenter(data[location].coords);
        map.setZoom(10);
    }
    data[location].fn();
}

// ── Overlay helpers ───────────────────────────────────────────────────────────
function removeOverlay(overlay) {
    for (let i = 0; i < map.overlayMapTypes.getLength(); i++) {
        if (map.overlayMapTypes.getAt(i) === overlay) {
            map.overlayMapTypes.removeAt(i);
            return;
        }
    }
}

function toggleCloudLayer() {
    if (!cloudOverlay) return;
    if (cloudVisible) { removeOverlay(cloudOverlay); cloudVisible = false; }
    else              { map.overlayMapTypes.push(cloudOverlay); cloudVisible = true; }
}

function togglePrecipitationLayer() {
    if (!precipOverlay) return;
    if (precipVisible) { removeOverlay(precipOverlay); precipVisible = false; }
    else               { map.overlayMapTypes.push(precipOverlay); precipVisible = true; }
}

function toggleTrafficLayer() {
    if (!trafficLayer) trafficLayer = new google.maps.TrafficLayer();
    if (trafficVisible) {
        trafficLayer.setMap(null);
        trafficVisible = false;
    } else {
        trafficLayer.setMap(map);
        trafficVisible = true;
    }
}

// ── Map initialisation (called by Google Maps SDK callback) ───────────────────
function initMap() {
    const params = new URLSearchParams(window.location.search);
    const hasExplicitView = params.has('lat') || params.has('lng') || params.has('zoom');
    const { lat, lng, zoom } = getQueryParams();
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat, lng }, zoom, mapTypeId: 'roadmap',
        fullscreenControl: false,
    });
    loadRainViewerOverlays();
    // If URL has explicit coords, load SG markers without recentering so the
    // user's shared view is preserved; otherwise centre on Singapore as default.
    switchLocation('singapore', hasExplicitView);
}

// ── Settings modal ────────────────────────────────────────────────────────────
function showSettingsAlert(msg, type) {
    const el = document.getElementById('settings-alert');
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove('d-none');
}

function saveSettings() {
    const token   = document.getElementById('slackToken').value.trim();
    const channel = document.getElementById('slackChannel').value.trim();

    if (!token && !channel) {
        showSettingsAlert('Please enter at least one value.', 'warning');
        return;
    }

    const body = {};
    if (token)   body.SLACK_BOT_TOKEN  = token;
    if (channel) body.SLACK_CHANNEL_ID = channel;

    fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                showSettingsAlert(data.error, 'danger');
            } else {
                showSettingsAlert('Settings saved!', 'success');
                document.getElementById('slackToken').value = '';
            }
        })
        .catch(() => showSettingsAlert('Failed to save settings.', 'danger'));
}

// ── Bootstrap: wire up button listeners + load Google Maps SDK ────────────────
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-singapore').addEventListener('click', () => switchLocation('singapore'));
    document.getElementById('btn-hong-kong').addEventListener('click', () => switchLocation('hong-kong'));
    document.getElementById('btn-klang-valley').addEventListener('click', () => switchLocation('klang-valley'));
    document.getElementById('btn-cloud').addEventListener('click', toggleCloudLayer);
    document.getElementById('btn-precip').addEventListener('click', togglePrecipitationLayer);
    document.getElementById('btn-traffic').addEventListener('click', toggleTrafficLayer);
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    document.getElementById('settingsModal').addEventListener('show.bs.modal', function () {
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => {
                document.getElementById('slackChannel').value = data.SLACK_CHANNEL_ID || '';
                document.getElementById('settings-alert').classList.add('d-none');
            })
            .catch(() => {});
    });

    fetch('/api/gmaps/key')
        .then(r => r.json())
        .then(data => {
            if (!data.key) throw new Error('No Google Maps API key returned');
            const script = document.createElement('script');
            script.src   = `https://maps.googleapis.com/maps/api/js?key=${data.key}&callback=initMap`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        })
        .catch(err => {
            console.error('Failed to load Google Maps:', err);
            document.getElementById('map').innerHTML =
                '<p style="padding:2rem;color:red;">Map unavailable — GOOGLE_MAPS_API_KEY not configured.</p>';
        });
});
