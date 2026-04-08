// All static location data used across the app
// Add a new region here to extend coverage — no other files need changing

const locations = {
    'klang-valley': {
        name: 'Klang Valley',
        weatherLocation: 'Kuala Lumpur, Malaysia',
        coordinates: [3.1390, 101.6869],
        zoomLevel: 9
    },
    'singapore': {
        name: 'Singapore',
        weatherLocation: 'Singapore',
        coordinates: [1.3521, 103.8198],
        zoomLevel: 12
    },
    'hong-kong': {
        name: 'Hong Kong',
        weatherLocation: 'Hong Kong',
        coordinates: [22.3193, 114.1694],
        zoomLevel: 12
    }
};

const singaporeAreas = [
    { area: "City", coordinates: [1.2830, 103.8514] },
    { area: "Changi", coordinates: [1.3644, 103.9915] },
    { area: "Toa Payoh", coordinates: [1.3346, 103.8560] },
    { area: "Ang Mo Kio", coordinates: [1.3691, 103.8454] },
    { area: "Jurong West", coordinates: [1.3404, 103.7064] },
    { area: "Jurong East", coordinates: [1.3324, 103.7438] },
    { area: "Kallang", coordinates: [1.3088, 103.8610] },
    { area: "Pasir Ris", coordinates: [1.3731, 103.9495] },
    { area: "Tuas", coordinates: [1.3214, 103.6490] },
    { area: "Woodlands", coordinates: [1.4360, 103.7863] },
    { area: "Bukit Merah", coordinates: [1.2830, 103.8000] },
    { area: "Bukit Panjang", coordinates: [1.3932, 103.7795] },
    { area: "Bukit Timah", coordinates: [1.3323, 103.7852] },
    { area: "Serangoon", coordinates: [1.3532, 103.8700] },
    { area: "Sengkang", coordinates: [1.3913, 103.8951] },
    { area: "Yishun", coordinates: [1.4304, 103.8354] },
    { area: "Marine Parade", coordinates: [1.3009, 103.8992] },
    { area: "Bedok", coordinates: [1.3236, 103.9304] },
    { area: "Clementi", coordinates: [1.3151, 103.7643] },
    { area: "Tampines", coordinates: [1.3496, 103.9568] },
    { area: "Queenstown", coordinates: [1.2942, 103.7861] },
    { area: "Geylang", coordinates: [1.3201, 103.8918] },
    { area: "Hougang", coordinates: [1.3612, 103.8863] },
    { area: "Punggol", coordinates: [1.3984, 103.9072] },
    { area: "Sembawang", coordinates: [1.4491, 103.8185] },
    { area: "Novena", coordinates: [1.3204, 103.8438] },
    { area: "Bishan", coordinates: [1.3526, 103.8352] },
    { area: "Tengah", coordinates: [1.3648, 103.7095] },
    { area: "Sentosa", coordinates: [1.2494, 103.8303] },
    { area: "Pulau Ubin", coordinates: [1.4044, 103.9625] },
    { area: "Mandai", coordinates: [1.4043, 103.8066] },
    { area: "Jurong Island", coordinates: [1.2660, 103.6991] },
    { area: "Lim Chu Kang", coordinates: [1.4305, 103.7178] },
    { area: "Choa Chu Kang", coordinates: [1.3840, 103.7470] }
];

const hongKongRegions = [
    { name: 'Central and Western', lat: 22.282, lng: 114.158 },
    { name: 'Eastern District', lat: 22.2849, lng: 114.221 },
    { name: 'Kowloon City', lat: 22.3163, lng: 114.186 },
    { name: 'New Territories', lat: 22.4477, lng: 114.1872 },
    { name: 'Kwun Tong', lat: 22.308, lng: 114.225 },
    { name: 'Sham Shui Po', lat: 22.327, lng: 114.163 },
    { name: 'Southern District', lat: 22.247, lng: 114.161 },
    { name: 'Wan Chai', lat: 22.276, lng: 114.176 },
    { name: 'Yau Tsim Mong', lat: 22.319, lng: 114.169 },
    { name: 'Tsuen Wan', lat: 22.372, lng: 114.114 },
    { name: 'Tuen Mun', lat: 22.391, lng: 113.973 },
    { name: 'Sha Tin', lat: 22.382, lng: 114.191 },
    { name: 'Tai Po', lat: 22.450, lng: 114.170 },
    { name: 'Yuen Long', lat: 22.445, lng: 114.022 },
    { name: 'Sai Kung', lat: 22.383, lng: 114.273 }
];

const klangValleyCities = [
    { city: "Kuala Lumpur", coordinates: [3.1390, 101.6869] },
    { city: "Petaling Jaya", coordinates: [3.1073, 101.6067] },
    { city: "Subang Jaya", coordinates: [3.0818, 101.5745] },
    { city: "Shah Alam", coordinates: [3.0738, 101.5183] },
    { city: "Puchong", coordinates: [3.0331, 101.6220] },
    { city: "Cheras", coordinates: [3.0851, 101.7441] },
    { city: "Ampang", coordinates: [3.1579, 101.7530] },
    { city: "Gombak", coordinates: [3.2910, 101.6744] },
    { city: "Bangi", coordinates: [2.9178, 101.7739] },
    { city: "Kajang", coordinates: [2.9936, 101.7875] }
];

module.exports = { locations, singaporeAreas, hongKongRegions, klangValleyCities };
