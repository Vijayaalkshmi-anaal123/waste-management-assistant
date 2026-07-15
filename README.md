# WasteGuide AI - Sustainable Waste Management Assistant Using Generative AI

WasteGuide AI is an AI-powered smart city sustainability dashboard designed to help urban residents identify waste items, receive disposal guidelines, understand recycling procedures, and locate nearby waste collection centers. 

It provides a single-page dashboard where users can enter a waste item name and instantly receive a complete AI-powered classification guide covering waste categories, safe disposal steps, hazard warnings, recycling instructions, and eco-friendly recommendations.

---

### 🌐 Live Production Demo: **[https://wasteguide-ai-project.surge.sh](https://wasteguide-ai-project.surge.sh)**

---

## 🚀 Key Features & Scenarios

*   **Scenario 1: Safe Hazardous Waste Disposal**
    Scanning a hazardous item like a `"battery"` returns a rose-red **Hazardous Waste** classification, presents a glowing warning banner detailing heavy metal pollution risks, lists terminal taping instructions, and suggests reusable alternatives.
*   **Scenario 2: Rinsing & Curbside Recycling**
    Scanning a `"plastic bottle"` returns a cyan **Recyclable** badge, lists step-by-step curbside instructions (emptying, rinsing, cap separation, crushing), and recommends reusable containers.
*   **Scenario 3: Collection Centers Map**
    Displays a premium custom dark-themed Leaflet.js map pre-seeded with disposal centers. Markers are color-coded by category (Recyclable, E-waste, Hazardous, Organic) and display hours, address, phone numbers, and accepted items when clicked.
*   **Scenario 4: Analytics Habits Dashboard**
    Chart.js widgets visualize scanning habits, showing:
    *   A doughnut chart of Recyclable vs. Non-recyclable items.
    *   A 7-day scan frequency line chart.
    *   A bar chart of waste category distributions.
    *   Dynamic stats counters (Total Items, Recycle Rate %, Hazard Alerts).

---

## 🛠️ Technology Stack

*   **Frontend**: React.js (Vite), Tailwind-equivalent Custom Glassmorphic CSS.
*   **Backend**: Flask (Python) with CORS middleware.
*   **Database**: Firebase Firestore (with automatic local offline JSON fallback storage).
*   **AI Engine**: Groq API integration (LLaMA 3.3 70B Versatile model) with rules-based local fallback.
*   **Mapping**: Leaflet.js & OpenStreetMap (Inverted Dark Theme Tiles filter).
*   **Data Visualization**: Chart.js (via `react-chartjs-2`).

---

## 📁 Folder Structure

```text
waste-management-assistant/
├── backend/
│   ├── app.py                # Main Flask API service
│   ├── db.py                 # Database controller (Firestore / Local JSON)
│   ├── requirements.txt      # Python dependencies (Flask, Groq, Gunicorn)
│   └── .env                  # Configuration variables
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React UI shell & state engine
│   │   ├── main.jsx          # Vite React entry point
│   │   └── index.css         # Typography, glassmorphic styles & animations
│   ├── package.json          # Node dependencies (Leaflet, ChartJS, Axios)
│   ├── vite.config.js        # Vite port (5173) and backend API proxy settings
│   └── index.html            # HTML shell with SEO meta tags
├── deploy.bat                # Double-click script to host on Vercel
├── README.md                 # Project documentation (This file)
└── .gitignore                # Node/Python files to ignore in Git
```

---

## 📦 Local Installation & Setup

### 1. Start Flask Backend (Port 5000)
Navigate to the `backend` directory, install packages, and start the app:
```bash
cd backend
pip install -r requirements.txt
python app.py
```
*(Optionally copy your `GROQ_API_KEY` into `.env` to connect live AI, otherwise the built-in rules classifier will run automatically).*

### 2. Start Vite Frontend (Port 5173)
Navigate to the `frontend` directory, install packages, and start the development server:
```bash
cd ../frontend
npm install --legacy-peer-deps
npm run dev
```

### 3. Expose to Public Tunnel (Optional)
Expose your local port 5173 to share a temporary preview link:
```bash
npx localtunnel --port 5173
```

---

## 🌐 Production Deployment

The project is designed with an **offline-first client fallback layer** in `App.jsx`. If the backend server is offline or not deployed, the application operates 100% in the browser using local storage for database simulation, enabling seamless 24/7 hosting.

*   **Deploying Frontend (Vercel)**: Double-click the **`deploy.bat`** script in the project root to automatically upload and host the React interface.
*   **Deploying Backend (Render)**: Set root directory as `backend`, build command as `pip install -r requirements.txt`, and start command as `gunicorn app:app`.

---

## 👥 Development Team
*   Manisha paneti
*   Susmitha annadhanam
*   Venkata Naga Neha Mamilla
*   Ala sailaja
*   A Vijayalakshmi Anala
