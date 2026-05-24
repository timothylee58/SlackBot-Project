const { locations, singaporeAreas, hongKongRegions, klangValleyCities } = require('../../config/locations');

describe('config/locations', () => {
    describe('locations', () => {
        it('should export three location keys', () => {
            const keys = Object.keys(locations);
            expect(keys).toEqual(['klang-valley', 'singapore', 'hong-kong']);
        });

        it.each(['klang-valley', 'singapore', 'hong-kong'])('%s should have name, weatherLocation, coordinates, and zoomLevel', (key) => {
            const loc = locations[key];
            expect(loc).toHaveProperty('name');
            expect(loc).toHaveProperty('weatherLocation');
            expect(loc).toHaveProperty('coordinates');
            expect(loc).toHaveProperty('zoomLevel');
            expect(loc.coordinates).toHaveLength(2);
            expect(typeof loc.zoomLevel).toBe('number');
        });
    });

    describe('singaporeAreas', () => {
        it('should be a non-empty array', () => {
            expect(Array.isArray(singaporeAreas)).toBe(true);
            expect(singaporeAreas.length).toBeGreaterThan(0);
        });

        it('each area should have area name and coordinates', () => {
            singaporeAreas.forEach(item => {
                expect(item).toHaveProperty('area');
                expect(item).toHaveProperty('coordinates');
                expect(item.coordinates).toHaveLength(2);
            });
        });
    });

    describe('hongKongRegions', () => {
        it('should be a non-empty array', () => {
            expect(Array.isArray(hongKongRegions)).toBe(true);
            expect(hongKongRegions.length).toBeGreaterThan(0);
        });

        it('each region should have name, lat, and lng', () => {
            hongKongRegions.forEach(item => {
                expect(item).toHaveProperty('name');
                expect(item).toHaveProperty('lat');
                expect(item).toHaveProperty('lng');
            });
        });
    });

    describe('klangValleyCities', () => {
        it('should be a non-empty array', () => {
            expect(Array.isArray(klangValleyCities)).toBe(true);
            expect(klangValleyCities.length).toBeGreaterThan(0);
        });

        it('each city should have city name and coordinates', () => {
            klangValleyCities.forEach(item => {
                expect(item).toHaveProperty('city');
                expect(item).toHaveProperty('coordinates');
                expect(item.coordinates).toHaveLength(2);
            });
        });
    });
});
