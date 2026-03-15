const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const AI_RIG_URL = process.env.AI_RIG_URL;

// Main discovery endpoint
app.post('/api/discover', async (req, res) => {
    const { lat, lng } = req.body;

    try {
        // 1. Search Google for nearby high-rated places
        // Note: Using the New Places API (v1) for better performance
        const searchResponse = await axios.post(
            'https://places.googleapis.com/v1/places:searchNearby',
            {
                locationRestriction: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: 2000.0 // 2km
                    }
                },
                includedTypes: ['restaurant', 'cafe', 'tourist_attraction', 'park', 'museum'],
                maxResultCount: 10
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_KEY,
                    'X-Goog-FieldMask': 'places.displayName,places.id,places.rating,places.location,places.editorialSummary'
                }
            }
        );

        const places = searchResponse.data.places || [];
        
        // Filter for > 4.7 stars
        const candidates = places.filter(p => p.rating >= 4.7);

        if (candidates.length === 0) {
            return res.json({ success: false, message: "No local gems matching criteria nearby." });
        }

        // 2. Pick a candidate and fetch reviews (using the older Place Details API for specific reviews)
        // For brevity in this demo, we pick the top one
        const target = candidates[0];
        
        const detailsResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${target.id}&fields=reviews&key=${GOOGLE_KEY}`
        );

        const reviews = detailsResponse.data.result.reviews || [];
        const reviewText = reviews.map(r => r.text).join("\n\n---\n\n");

        // 3. Ask the AI Rig if this is a "Local" favorite
        let aiAnalysis = { 
            isLocal: true, 
            reason: "AI Rig Signal Dim: Showing results based on high community authenticity." 
        };

        try {
            const aiResponse = await axios.post(AI_RIG_URL, {
                model: process.env.AI_MODEL_NAME,
                prompt: `Review Content: ${reviewText}\n\nTask: Determine if this place is a "local gem". Respond with JSON: {"isLocal": true/false, "reason": "short explanation"}.`,
                stream: false,
                format: 'json'
            }, { timeout: 6000 });

            if (aiResponse.data && aiResponse.data.response) {
                aiAnalysis = JSON.parse(aiResponse.data.response);
            }
        } catch (aiError) {
            console.error("AI Rig unreachable or timed out. Bypassing filter:", aiError.message);
            // Default to true so user sees results even if tunnel is down
        }

        if (aiAnalysis.isLocal) {
            res.json({
                success: true,
                data: {
                    title: target.displayName.text,
                    desc: target.editorialSummary?.text || "A secret spot favored by locals.",
                    lat: target.location.latitude,
                    lng: target.location.longitude,
                    reason: aiAnalysis.reason
                }
            });
        } else {
            res.json({ success: false, message: "Filtered out by AI: This area shows heavy tourist activity." });
        }

    } catch (error) {
        console.error("Discovery Error:", error.message);
        res.status(500).json({ success: false, message: "Backend error during discovery." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Wanderløst Backend running on port ${PORT}`);
});
