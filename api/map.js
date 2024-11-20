// Serve map page with location handling
export default function handler(req, res) {
    const { lat, lng, zoom } = req.query;

    if (!lat || !lng || !zoom) {
        return res.status(400).json({
            error: 'Invalid or missing parameters. Please provide lat, lng, and zoom.',
        });
    }

    // Provide a basic response for testing
    res.status(200).json({
        message: 'Map endpoint called successfully',
        lat,
        lng,
        zoom,
    });
}
