# Wanderlost 🧭

> A premium travel discovery app. Find your next adventure.

**Wanderlost** is a high-end, glassmorphism-styled travel discovery app built on Google Maps. Explore curated places around you — restaurants, galleries, parks, artisan workshops, and more — through a beautiful, minimal interface.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🗺️ **Silver Map** | Custom minimalist Google Maps style — no clutter, just terrain |
| 🎬 **Power Zoom** | 2.5s cinematic zoom from global view to your GPS on load |
| 🔍 **Discover Button** | Morphs into a full discovery sheet with spring physics |
| 📍 **Smart Markers** | AdvancedMarkerElement with breathing glow + sonar ring |
| 🏷️ **Category Strip** | 13 discovery categories with horizontal glass scroll |
| 📏 **Haversine Distance** | Real-time distance calculation to each discovered place |
| 💾 **Save Places** | Heart button to collect your favorite spots |
| ⌨️ **Keyboard Controls** | `V` to collapse to pill · `X` to dismiss & reset |
| 🔐 **Premium Gate** | Free credits system with blur-overlay paywall |

## 🧱 Tech Stack

- **HTML + Vanilla JS** — zero build step, works anywhere
- **Tailwind CSS CDN** — utility-first styling with custom config
- **Google Maps JS API** — maps, places, AdvancedMarkerElement
- **Lucide Icons** — clean, consistent icon set

## 🚀 Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/MisfitProject/wanderlost-app.git
   cd wanderlost-app
   ```

2. Open `index.html` in your browser — no build step required!
   > For local dev with a live server, use VS Code's **Live Server** extension or `python -m http.server 3000`.

3. Allow **location access** when prompted for the best experience.

## 🗝️ API Keys

The app ships with a development API key. For production use, replace the key in `index.html`:
```js
const MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
const MAP_ID       = 'YOUR_MAP_ID';
```

Required API services:
- Maps JavaScript API
- Places API
- Map IDs (for AdvancedMarkerElement)

## 🎨 Design System

**The Lens Material**: All UI elements use:
```css
background: rgba(255,255,255,0.08);
backdrop-filter: blur(40px);
border: 1px solid rgba(255,255,255,0.15);
box-shadow: 0 25px 50px rgba(0,0,0,0.25);
```

**Spring Physics**: All interactions use spring-based motion (stiffness: 150, damping: 20).

## 📦 Project Structure

```
wanderlost/
└── index.html    ← entire app in one file
└── README.md
```

---

Built with ❤️ by MisfitProject
