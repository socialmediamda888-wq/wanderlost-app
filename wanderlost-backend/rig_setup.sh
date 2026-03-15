#!/bin/bash
# Wanderlost Backend Setup Script for AI Rig

echo "--- Starting Wanderløst Backend Setup ---"

# Create directory
mkdir -p ~/wanderlost-backend
cd ~/wanderlost-backend

# Create .env
cat <<EOF > .env
PORT=3000
GOOGLE_PLACES_API_KEY=AIzaSyB1RVtX565j0NYmTtFebx1nmDCrh6X0rYM
AI_RIG_URL=http://localhost:11434/api/generate
AI_MODEL_NAME=llama3
EOF

# Create package.json
cat <<EOF > package.json
{
  "name": "wanderlost-backend",
  "version": "1.0.0",
  "description": "Backend proxy for Google Places and Local AI Rig",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  }
}
EOF

# Create server.js
cat <<EOF > server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const AI_RIG_URL = process.env.AI_RIG_URL;

app.post('/api/discover', async (req, res) => {
    const { lat, lng } = req.body;
    console.log(\`Received discovery request: \${lat}, \${lng}\`);

    try {
        const searchResponse = await axios.post(
            'https://places.googleapis.com/v1/places:searchNearby',
            {
                locationRestriction: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: 2000.0
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
        const candidates = places.filter(p => p.rating >= 4.7);

        if (candidates.length === 0) {
            return res.json({ success: false, message: "No local gems matching criteria nearby." });
        }

        const target = candidates[0];
        const detailsResponse = await axios.get(
            \`https://maps.googleapis.com/maps/api/place/details/json?place_id=\${target.id}&fields=reviews&key=\${GOOGLE_KEY}\`
        );

        const reviews = detailsResponse.data.result.reviews || [];
        const reviewText = reviews.map(r => r.text).join("\n\n---\n\n");

        const aiResponse = await axios.post(AI_RIG_URL, {
            model: process.env.AI_MODEL_NAME,
            prompt: \`Review Content: \${reviewText}\\n\\nTask: Determine if this place is a "local gem" (at least 90% of reviews from locals/native language). Respond with JSON like this: {"isLocal": true/false, "reason": "short explanation"}.\`,
            stream: false,
            format: 'json'
        });

        const aiAnalysis = JSON.parse(aiResponse.data.response);

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
            res.json({ success: false, message: "Filtered out by AI: More touristy than local." });
        }

    } catch (error) {
        console.error("Discovery Error:", error.message);
        res.status(500).json({ success: false, message: "Backend error during discovery." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(\`Wanderløst Backend running on port \${PORT}\`);
});
EOF

echo "--- Installing dependencies ---"
npm install

echo "--- Setup Complete ---"
echo "Run 'npm start' to begin."
