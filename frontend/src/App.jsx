import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, 
  Scan, 
  MapPin, 
  History, 
  Leaf, 
  Trash2, 
  ShieldAlert, 
  ExternalLink, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Award,
  Zap,
  Info,
  Clock,
  Search
} from 'lucide-react';

// Chart.js imports & registrations
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Register ChartJS elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// During development, Vite proxies '/api' to localhost:5000.
// Replace the production URL placeholder with your actual Render backend URL after deploying.
const API_BASE_URL = import.meta.env.DEV 
  ? '/api' 
  : 'https://waste-guide-backend.onrender.com/api'; 

// Leaflet default icon fix
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom neon circle markers for Leaflet mapping
const getMarkerIcon = (category) => {
  let color = '#10b981'; // Green for Organic
  if (category === 'Recyclable') color = '#0ea5e9'; // Cyan
  if (category === 'E-Waste') color = '#a78bfa'; // Purple
  if (category === 'Hazardous') color = '#f43f5e'; // Red
  
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="
      background-color: ${color}; 
      width: 16px; 
      height: 16px; 
      border-radius: 50%; 
      border: 2px solid #ffffff; 
      box-shadow: 0 0 12px ${color};
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

// Seeded local collection centers for offline map fallback
const LOCAL_CENTERS = [
  {
    "id": "c1",
    "name": "Boston Central Recycling & Drop-off",
    "address": "400 Front St, Boston, MA 02118",
    "category": "Recyclable",
    "latitude": 42.3425,
    "longitude": -71.0638,
    "hours": "Mon-Fri: 8 AM - 5 PM, Sat: 9 AM - 2 PM",
    "phone": "(617) 555-0101",
    "acceptedTypes": ["Paper & Cardboard", "Plastics (#1-#7)", "Glass Bottles", "Metal Cans"]
  },
  {
    "id": "c2",
    "name": "Metro E-Waste & Electronics Disposal",
    "address": "150 Southampton St, Boston, MA 02119",
    "category": "E-Waste",
    "latitude": 42.3308,
    "longitude": -71.0722,
    "hours": "Tue-Sat: 9 AM - 4 PM",
    "phone": "(617) 555-0102",
    "acceptedTypes": ["Computers & Laptops", "Smartphones & Tablets", "Cables & Chargers", "Monitors & TVs"]
  },
  {
    "id": "c3",
    "name": "Greater Boston Hazardous Materials Facility",
    "address": "1200 Soldiers Field Rd, Boston, MA 02134",
    "category": "Hazardous",
    "latitude": 42.3618,
    "longitude": -71.1345,
    "hours": "Wed & Sat: 8 AM - 12 PM",
    "phone": "(617) 555-0103",
    "acceptedTypes": ["Household Batteries", "Paints & Solvents", "Motor Oil", "Fluorescent Bulbs"]
  },
  {
    "id": "c4",
    "name": "City Composting & Organics Drop Site",
    "address": "250 Free Street, Boston, MA 02127",
    "category": "Organic",
    "latitude": 42.3385,
    "longitude": -71.0450,
    "hours": "Daily: 7 AM - 7 PM",
    "phone": "(617) 555-0104",
    "acceptedTypes": ["Food Scraps", "Yard Waste", "Compostable Coffee Cups", "Untreated Wood"]
  },
  {
    "id": "c5",
    "name": "Beacon Hill Eco-Hub",
    "address": "75 Cambridge St, Boston, MA 02114",
    "category": "Recyclable",
    "latitude": 42.3601,
    "longitude": -71.0660,
    "hours": "Mon-Fri: 9 AM - 6 PM",
    "phone": "(617) 555-0105",
    "acceptedTypes": ["Paper", "Plastic Containers", "Aluminum Cans", "Small E-waste (phones)"]
  },
  {
    "id": "c6",
    "name": "Allston E-Cycle Depot",
    "address": "200 Harvard Ave, Allston, MA 02134",
    "category": "E-Waste",
    "latitude": 42.3503,
    "longitude": -71.1308,
    "hours": "Thu-Sun: 10 AM - 5 PM",
    "phone": "(617) 555-0106",
    "acceptedTypes": ["Household Electronics", "Office Printers", "Batteries", "Audio Equipment"]
  }
];

// Offline rules-based classification engine for frontend
const LOCAL_RULES_FRONTEND = {
  "battery": {
    "itemName": "Battery",
    "category": "Hazardous Waste",
    "isRecyclable": false,
    "disposalInstructions": [
      "Take to a certified retail battery recycler or hazard collection center.",
      "Do not throw in general trash to prevent soil and water contamination.",
      "Place clear tape over terminal ends (+/-) to prevent short-circuit fires."
    ],
    "recyclingProcedures": [
      "Batteries cannot be recycled in standard curbside bins.",
      "They are sent to specialized thermal or chemical facilities to safely extract heavy metals."
    ],
    "hazardWarnings": "Contains corrosive chemical electrolytes and toxic heavy metals (lead, cadmium, mercury, lithium) that can leak into groundwater and ignite if punctured.",
    "ecoSuggestions": [
      "Switch to high-quality rechargeable batteries.",
      "Use mains-powered appliances where possible.",
      "Always store old batteries in a cool, dry plastic container before disposal."
    ],
    "acceptedFacilities": ["Hazardous Waste Facility", "E-Waste Processing Center"]
  },
  "plastic bottle": {
    "itemName": "Plastic Bottle",
    "category": "Recyclable",
    "isRecyclable": true,
    "disposalInstructions": [
      "Empty all remaining liquids completely.",
      "Rinse the bottle thoroughly to prevent contamination.",
      "Remove the plastic cap and neck ring if they are made of different plastics.",
      "Crush the bottle flat to conserve space in the recycling container."
    ],
    "recyclingProcedures": [
      "Place in your blue curbside recycling bin.",
      "Verify the plastic resin code on the bottom (typically #1 PET or #2 HDPE are widely accepted)."
    ],
    "hazardWarnings": null,
    "ecoSuggestions": [
      "Invest in a reusable stainless steel or glass water bottle.",
      "Avoid purchasing single-use plastic packaging.",
      "Support brands that use 100% PCR (Post-Consumer Recycled) plastics."
    ],
    "acceptedFacilities": ["Recycling Center", "Municipal Recycling Center"]
  },
  "mobile phone": {
    "itemName": "Mobile Phone",
    "category": "E-Waste",
    "isRecyclable": true,
    "disposalInstructions": [
      "Back up all personal data and perform a complete factory reset.",
      "Remove the SIM card and any external microSD cards.",
      "Do not dump in ordinary trash bins; hand it over to authorized e-waste recyclers."
    ],
    "recyclingProcedures": [
      "E-waste is shredded and magnetically sorted to extract precious metals (gold, silver, copper).",
      "Harmful mercury, flame retardants, and lead are separated for isolated safe disposal."
    ],
    "hazardWarnings": "Contains lithium-ion batteries and heavy metals that pose serious fire hazards if compacted and release toxic fumes under heat.",
    "ecoSuggestions": [
      "Repair or upgrade your current device instead of buying a new one.",
      "Donate functional older electronics to schools or charities.",
      "Participate in brand-sponsored trade-in or recycling programs."
    ],
    "acceptedFacilities": ["E-Waste Processing Center", "Recycling Center"]
  },
  "apple core": {
    "itemName": "Apple Core",
    "category": "Organic Waste",
    "isRecyclable": true,
    "disposalInstructions": [
      "Separate any food labels/stickers from the core.",
      "Dispose of in your backyard compost bin or a green municipal organics bin.",
      "Do not seal in plastic bags before composting."
    ],
    "recyclingProcedures": [
      "Add to a compost pile along with dry carbon-rich materials like dry leaves and paper.",
      "Turn the pile regularly to supply oxygen for aerobic decomposition."
    ],
    "hazardWarnings": null,
    "ecoSuggestions": [
      "Plan grocery shopping to reduce food spoilage.",
      "Learn to home-compost or set up a simple vermicomposting (worm) bin.",
      "Utilize municipal organic collection services if available."
    ],
    "acceptedFacilities": ["Organic Collection Facility", "Community Compost Site"]
  }
};

const runLocalClassifierFrontend = (itemName) => {
  const query = itemName.trim().toLowerCase();
  
  // Keyword match
  for (const [key, data] of Object.entries(LOCAL_RULES_FRONTEND)) {
    if (key === query || query.includes(key) || key.includes(query)) {
      return { ...data, timestamp: new Date().toISOString() };
    }
  }

  // Fallbacks by category keywords
  if (/\b(plastic|glass|paper|cardboard|can|bottle|newspaper)\b/i.test(query)) {
    return {
      itemName: itemName.charAt(0).toUpperCase() + itemName.slice(1),
      category: "Recyclable",
      isRecyclable: true,
      disposalInstructions: [
        "Empty and clean the container.",
        "Flatten packaging where possible.",
        "Place in standard blue recycling bin."
      ],
      recyclingProcedures: [
        "Curbside collection goes to a Material Recovery Facility (MRF).",
        "Sorted items are baled and sent to processors for remanufacturing."
      ],
      hazardWarnings: null,
      ecoSuggestions: [
        "Choose items with minimal packaging.",
        "Reuse packaging containers where appropriate."
      ],
      acceptedFacilities: ["Recycling Center", "Municipal Recycling Center"],
      timestamp: new Date().toISOString()
    };
  } else if (/\b(battery|chemical|paint|oil|lightbulb|mercury|pesticide|acid)\b/i.test(query)) {
    return {
      itemName: itemName.charAt(0).toUpperCase() + itemName.slice(1),
      category: "Hazardous Waste",
      isRecyclable: false,
      disposalInstructions: [
        "Keep in a sealed container to prevent spills or reactions.",
        "Do not pour down drains, into storm sewers, or onto the ground.",
        "Deliver to a designated hazardous waste drop-off event or facility."
      ],
      recyclingProcedures: [
        "Hazardous chemicals are chemically neutralized, incinerated in safe facilities, or isolated.",
        "Heavy metals may be reclaimed under strict safety guidelines."
      ],
      hazardWarnings: "Contains toxic or reactive ingredients that pose environmental and fire safety threats if improperly discarded.",
      ecoSuggestions: [
        "Switch to non-toxic or green chemical alternatives.",
        "Only purchase the amount of chemicals or paint you actually need."
      ],
      acceptedFacilities: ["Hazardous Waste Facility"],
      timestamp: new Date().toISOString()
    };
  } else if (/\b(phone|laptop|tv|wire|charger|computer|keyboard|mouse|electronics|cable)\b/i.test(query)) {
    return {
      itemName: itemName.charAt(0).toUpperCase() + itemName.slice(1),
      category: "E-Waste",
      isRecyclable: true,
      disposalInstructions: [
        "Remove batteries if detachable, and recycle them separately.",
        "Wipe all personal data/storage clean.",
        "Drop off at a certified electronics retailer or recycling point."
      ],
      recyclingProcedures: [
        "Sent to specialized e-waste processors who extract precious minerals.",
        "Circuit boards are smelted to separate gold, copper, and palladium."
      ],
      hazardWarnings: "Circuit boards and batteries contain toxic heavy metals like cadmium and lead that cause chronic poisoning if leaked.",
      ecoSuggestions: [
        "Repair and reuse devices to extend their operating life.",
        "Donate usable gadgets to schools or non-profits."
      ],
      acceptedFacilities: ["E-Waste Processing Center"],
      timestamp: new Date().toISOString()
    };
  } else if (/\b(food|banana|apple|vegetable|fruit|bread|leaves|grass|compost|orange|peel|egg|coffee|tea|rice|meat|scraps|organic|plant)\b/i.test(query)) {
    return {
      itemName: itemName.charAt(0).toUpperCase() + itemName.slice(1),
      category: "Organic Waste",
      isRecyclable: true,
      disposalInstructions: [
        "Remove stickers, plastics, twist ties, or non-biodegradable pieces.",
        "Add to compost or place in green composting bin."
      ],
      recyclingProcedures: [
        "Undergoes decomposition by bacteria and fungi, turning into rich compost humus.",
        "Industrial organic facilities may use anaerobic digesters to capture biogas for energy."
      ],
      hazardWarnings: null,
      ecoSuggestions: [
        "Practice portion control to minimize leftovers.",
        "Start a backyard compost heap or use a compost bucket under the kitchen sink."
      ],
      acceptedFacilities: ["Organic Collection Facility", "Community Compost Site"],
      timestamp: new Date().toISOString()
    };
  } else {
    return {
      itemName: itemName.charAt(0).toUpperCase() + itemName.slice(1),
      category: "General Waste",
      isRecyclable: false,
      disposalInstructions: [
        "Securely bag the item.",
        "Place in standard black trash container for landfill disposal."
      ],
      recyclingProcedures: [
        "General waste is buried in landfills or sent to waste-to-energy incineration facilities."
      ],
      hazardWarnings: null,
      ecoSuggestions: [
        "Evaluate whether this item can be replaced with a reusable, recyclable, or compostable alternative."
      ],
      acceptedFacilities: ["Municipal Landfill", "Waste-to-Energy Plant"],
      timestamp: new Date().toISOString()
    };
  }
};

const getLocalAnalytics = (localHistory) => {
  let recyclableCount = 0;
  let nonRecyclableCount = 0;
  let categoryCounts = {
    "Recyclable": 0,
    "Hazardous Waste": 0,
    "E-Waste": 0,
    "Organic Waste": 0,
    "General Waste": 0
  };
  
  const today = new Date();
  const dateTracking = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dateTracking[dateStr] = 0;
  }

  localHistory.forEach(scan => {
    if (scan.isRecyclable) recyclableCount++;
    else nonRecyclableCount++;

    const cat = scan.category;
    if (cat in categoryCounts) categoryCounts[cat]++;
    else categoryCounts["General Waste"]++;

    const tsStr = scan.timestamp;
    if (tsStr) {
      const dateStr = tsStr.split('T')[0];
      if (dateStr in dateTracking) {
        dateTracking[dateStr]++;
      }
    }
  });

  const activityTimeline = Object.entries(dateTracking)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  const totalScanned = localHistory.length;
  const recycleRate = totalScanned > 0 ? parseFloat((recyclableCount / totalScanned * 100).toFixed(1)) : 0;

  return {
    totalScanned,
    recyclableCount,
    nonRecyclableCount,
    recycleRate,
    hazardousCount: categoryCounts["Hazardous Waste"] || 0,
    categoryCounts,
    activityTimeline
  };
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [analytics, setAnalytics] = useState({
    totalScanned: 0,
    recyclableCount: 0,
    nonRecyclableCount: 0,
    recycleRate: 0,
    hazardousCount: 0,
    categoryCounts: {
      "Recyclable": 0,
      "Hazardous Waste": 0,
      "E-Waste": 0,
      "Organic Waste": 0,
      "General Waste": 0
    },
    activityTimeline: []
  });
  
  const [centers, setCenters] = useState([]);
  const [mapFilter, setMapFilter] = useState('All');

  // Load history, analytics, and collection centers on mount
  useEffect(() => {
    fetchHistory();
    fetchAnalytics();
    fetchCenters();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/history`);
      setHistory(res.data);
    } catch (err) {
      console.warn("Backend offline, reading history from localStorage:", err.message);
      const localHist = JSON.parse(localStorage.getItem('waste_history') || '[]');
      setHistory(localHist);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/analytics`);
      setAnalytics(res.data);
    } catch (err) {
      console.warn("Backend offline, computing analytics from localStorage:", err.message);
      const localHist = JSON.parse(localStorage.getItem('waste_history') || '[]');
      setAnalytics(getLocalAnalytics(localHist));
    }
  };

  const fetchCenters = async (category = 'All') => {
    try {
      const catParam = category !== 'All' ? `?category=${category}` : '';
      const res = await axios.get(`${API_BASE_URL}/centers${catParam}`);
      setCenters(res.data);
    } catch (err) {
      console.warn("Backend offline, using local centers list:", err.message);
      if (category && category !== 'All') {
        setCenters(LOCAL_CENTERS.filter(c => c.category.toLowerCase() === category.toLowerCase()));
      } else {
        setCenters(LOCAL_CENTERS);
      }
    }
  };

  const handleScan = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/classify`, {
        item_name: searchQuery
      });
      setScanResult(res.data);
      // Refresh stats
      fetchHistory();
      fetchAnalytics();
    } catch (err) {
      console.warn("Backend offline, falling back to local frontend rules engine.");
      const result = runLocalClassifierFrontend(searchQuery);
      setScanResult(result);
      
      // Save locally to simulate database logs
      const localHist = JSON.parse(localStorage.getItem('waste_history') || '[]');
      localHist.push(result);
      localStorage.setItem('waste_history', JSON.stringify(localHist));
      
      // Refresh locally
      setHistory(localHist.reverse());
      setAnalytics(getLocalAnalytics(localHist));
    } finally {
      setScanLoading(false);
    }
  };

  const handleQuickScan = (itemName) => {
    setSearchQuery(itemName);
    setScanLoading(true);
    setScanResult(null);
    setActiveTab('scanner');
    
    axios.post(`${API_BASE_URL}/classify`, { item_name: itemName })
      .then(res => {
        setScanResult(res.data);
        fetchHistory();
        fetchAnalytics();
      })
      .catch(err => {
        console.warn("Backend offline, falling back to local frontend rules engine.");
        const result = runLocalClassifierFrontend(itemName);
        setScanResult(result);
        
        const localHist = JSON.parse(localStorage.getItem('waste_history') || '[]');
        localHist.push(result);
        localStorage.setItem('waste_history', JSON.stringify(localHist));
        
        setHistory(localHist.reverse());
        setAnalytics(getLocalAnalytics(localHist));
      })
      .finally(() => setScanLoading(false));
  };

  const handleMapFilterChange = (category) => {
    setMapFilter(category);
    fetchCenters(category);
  };

  // Filter local history list for History tab
  const filteredHistory = history.filter(item => 
    item.itemName.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.category.toLowerCase().includes(historySearch.toLowerCase())
  );

  // Setup Chart JS Data
  const doughnutData = {
    labels: ['Recyclable', 'Non-Recyclable'],
    datasets: [{
      data: [analytics.recyclableCount, analytics.nonRecyclableCount],
      backgroundColor: ['rgba(14, 165, 233, 0.75)', 'rgba(244, 63, 94, 0.75)'],
      borderColor: ['#0ea5e9', '#f43f5e'],
      borderWidth: 1.5,
    }]
  };

  const lineData = {
    labels: analytics.activityTimeline.map(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [{
      label: 'Scans',
      data: analytics.activityTimeline.map(t => t.count),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 2.5,
      tension: 0.3,
      fill: true,
      pointBackgroundColor: '#10b981',
      pointBorderColor: '#ffffff',
      pointHoverRadius: 6,
    }]
  };

  const barData = {
    labels: Object.keys(analytics.categoryCounts),
    datasets: [{
      label: 'Items',
      data: Object.values(analytics.categoryCounts),
      backgroundColor: [
        'rgba(14, 165, 233, 0.65)', // Recyclable
        'rgba(244, 63, 94, 0.65)',  // Hazardous
        'rgba(167, 139, 250, 0.65)', // E-Waste
        'rgba(16, 185, 129, 0.65)',  // Organic
        'rgba(100, 116, 139, 0.65)'  // General
      ],
      borderColor: [
        '#0ea5e9',
        '#f43f5e',
        '#a78bfa',
        '#10b981',
        '#64748b'
      ],
      borderWidth: 1.5,
      borderRadius: 6,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#e2e8f0',
          font: { family: 'Outfit', size: 12 }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' }, stepSize: 1 }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#e2e8f0',
          font: { family: 'Outfit', size: 12 }
        }
      }
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <Leaf className="logo-icon" size={28} />
          <span className="logo-text">WasteGuide AI</span>
        </div>
        
        <ul className="nav-links">
          <li>
            <div 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${activeTab === 'scanner' ? 'active' : ''}`}
              onClick={() => setActiveTab('scanner')}
            >
              <Scan size={20} />
              <span>Waste Scanner</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <MapPin size={20} />
              <span>Collection Centers</span>
            </div>
          </li>
          <li>
            <div 
              className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={20} />
              <span>Scan History</span>
            </div>
          </li>
        </ul>

        <div className="sidebar-footer">
          <p>Smart City Initiative</p>
          <p style={{fontSize: '0.75rem', marginTop: '0.25rem'}}>v1.0.0</p>
        </div>
      </aside>

      {/* Main Dashboard Space */}
      <main className="main-content">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <header>
              <h1>Sustainability Dashboard</h1>
              <p>Monitor waste separation trends, view collection statistics, and track your environmental footprint.</p>
            </header>

            {/* Quick Stats Grid */}
            <div className="dashboard-grid">
              <div className="stat-card">
                <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  <Leaf size={24} />
                </div>
                <div className="stat-info">
                  <h3>Total Scanned</h3>
                  <p>{analytics.totalScanned}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
                  <Award size={24} />
                </div>
                <div className="stat-info">
                  <h3>Recyclable Items</h3>
                  <p>{analytics.recyclableCount}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
                  <TrendingUp size={24} />
                </div>
                <div className="stat-info">
                  <h3>Recycle Rate</h3>
                  <p>{analytics.recycleRate}%</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                  <ShieldAlert size={24} />
                </div>
                <div className="stat-info">
                  <h3>Hazard Warnings</h3>
                  <p>{analytics.hazardousCount}</p>
                </div>
              </div>
            </div>

            {/* Charts Visualizations Section */}
            <div className="visuals-grid">
              <div className="chart-card">
                <h2>7-Day Scanning Frequency</h2>
                <div className="chart-container">
                  {analytics.activityTimeline.length > 0 ? (
                    <Line data={lineData} options={chartOptions} />
                  ) : (
                    <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8'}}>
                      No scan history logged yet. Run a scan to see charts!
                    </div>
                  )}
                </div>
              </div>

              <div className="chart-card">
                <h2>Recycle Viability</h2>
                <div className="chart-container doughnut-container">
                  {analytics.totalScanned > 0 ? (
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                  ) : (
                    <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8'}}>
                      No items scanned
                    </div>
                  )}
                </div>
              </div>

              <div className="chart-card" style={{ gridColumn: 'span 2' }}>
                <h2>Items Count By Waste Category</h2>
                <div className="chart-container">
                  {analytics.totalScanned > 0 ? (
                    <Bar data={barData} options={chartOptions} />
                  ) : (
                    <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8'}}>
                      No categories to display
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Box */}
            <div className="scanner-card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <Zap size={32} style={{ color: 'hsl(var(--color-primary))' }} />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '600', marginBottom: '0.25rem' }}>Ready to separate waste?</h3>
                  <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.95rem' }}>Quickly analyze items like plastic bottles, old dry batteries, apple cores, or keyboards.</p>
                </div>
                <button 
                  className="filter-button active" 
                  style={{ marginLeft: 'auto', width: 'auto', display: 'inline-flex', padding: '0.8rem 1.5rem', gap: '0.5rem' }}
                  onClick={() => setActiveTab('scanner')}
                >
                  Open Scanner <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCANNER TAB */}
        {activeTab === 'scanner' && (
          <div>
            <header>
              <h1>AI Waste Scanner</h1>
              <p>Type in any household item name below to receive a complete, AI-generated recycling and disposal report.</p>
            </header>

            <div className="scanner-card">
              <h3>Enter waste item name</h3>
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Examples: "plastic bottle", "alkaline battery", "broken laptop", "orange peel"</p>
              
              <form onSubmit={handleScan} className="search-box">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. alkaline battery"
                  disabled={scanLoading}
                />
                <button type="submit" disabled={scanLoading}>
                  <Scan size={18} />
                  {scanLoading ? 'Analyzing...' : 'Scan Item'}
                </button>
              </form>
            </div>

            {/* Spinner Loader */}
            {scanLoading && (
              <div className="loading-container">
                <div className="loader-spinner"></div>
                <p style={{ color: 'hsl(var(--text-secondary))', fontWeight: '500' }}>Classifying waste properties...</p>
              </div>
            )}

            {/* Scan Results Display */}
            {scanResult && (
              <div className="result-grid">
                
                {/* Left Card: Core Classification & Guidelines */}
                <div className="result-card-main">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{scanResult.itemName}</h2>
                    <span className={`category-badge ${
                      scanResult.category === 'Recyclable' ? 'cat-recyclable' :
                      scanResult.category === 'Hazardous Waste' ? 'cat-hazardous' :
                      scanResult.category === 'E-Waste' ? 'cat-ewaste' :
                      scanResult.category === 'Organic Waste' ? 'cat-organic' : 'cat-general'
                    }`}>
                      {scanResult.category}
                    </span>
                  </div>

                  {/* Hazard Alert Banner */}
                  {scanResult.hazardWarnings && (
                    <div className="hazard-warning-box">
                      <ShieldAlert className="warning-icon" size={22} />
                      <div>
                        <h4 style={{ color: '#fda4af', fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.2rem' }}>Hazard Alert</h4>
                        <p style={{ color: '#fda4af', fontSize: '0.85rem', lineHeight: '1.4' }}>{scanResult.hazardWarnings}</p>
                      </div>
                    </div>
                  )}

                  {/* Disposal steps Checklist */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 className="section-title">
                      <Trash2 size={18} style={{ color: 'hsl(var(--color-primary))' }} />
                      Safe Disposal Instructions
                    </h3>
                    <ul className="checklist">
                      {scanResult.disposalInstructions.map((step, idx) => (
                        <li className="checklist-item" key={idx}>
                          <CheckCircle2 className="checkbox-custom" size={16} />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recycling procedures Checklist */}
                  <div>
                    <h3 className="section-title">
                      <Leaf size={18} style={{ color: 'hsl(var(--color-primary))' }} />
                      Recycling Procedures
                    </h3>
                    <ul className="checklist">
                      {scanResult.recyclingProcedures.map((step, idx) => (
                        <li className="checklist-item" key={idx}>
                          <CheckCircle2 className="checkbox-custom" size={16} style={{ color: '#0ea5e9' }} />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Card: Alternatives & Accepted Centers */}
                <div className="result-card-main" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Eco-suggestions */}
                  <div>
                    <h3 className="section-title">
                      <Award size={18} style={{ color: 'hsl(var(--color-primary))' }} />
                      Eco-Friendly Suggestions
                    </h3>
                    <div style={{ marginTop: '0.5rem' }}>
                      {scanResult.ecoSuggestions.map((suggestion, idx) => (
                        <span className="suggestion-pill" key={idx}>{suggestion}</span>
                      ))}
                    </div>
                  </div>

                  {/* Accepted facilities types */}
                  <div>
                    <h3 className="section-title">
                      <MapPin size={18} style={{ color: 'hsl(var(--color-primary))' }} />
                      Accepted Facilities Types
                    </h3>
                    <ul className="checklist" style={{ marginTop: '0.5rem' }}>
                      {scanResult.acceptedFacilities.map((facility, idx) => (
                        <li className="checklist-item" key={idx}>
                          <CheckCircle2 className="checkbox-custom" size={16} />
                          <span>{facility}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Map redirection promotion */}
                  <div style={{ 
                    marginTop: 'auto', 
                    padding: '1.25rem', 
                    borderRadius: 'var(--radius-sm)', 
                    backgroundColor: 'hsl(var(--bg-base) / 0.8)',
                    border: '1px solid hsl(var(--border-color))'
                  }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      Locate nearest center?
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '1rem' }}>
                      This item is accepted at local disposal points. Find their locations on the map.
                    </p>
                    <button 
                      className="history-view-btn" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', width: 'auto' }}
                      onClick={() => {
                        const cat = scanResult.category;
                        if (cat === 'Hazardous Waste') handleMapFilterChange('Hazardous');
                        else if (cat === 'E-Waste') handleMapFilterChange('E-Waste');
                        else if (cat === 'Organic Waste') handleMapFilterChange('Organic');
                        else handleMapFilterChange('Recyclable');
                        setActiveTab('map');
                      }}
                    >
                      View Centers Map <ArrowRight size={14} />
                    </button>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* MAP TAB */}
        {activeTab === 'map' && (
          <div>
            <header>
              <h1>Disposal & Recycling Centers</h1>
              <p>Locate municipal hubs, specialized e-waste sites, hazardous containment points, and organic compost yards.</p>
            </header>

            <div className="map-view-layout">
              {/* Map filters sidebar */}
              <div className="map-sidebar">
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>Filter Facility</h3>
                
                <button 
                  className={`filter-button ${mapFilter === 'All' ? 'active' : ''}`}
                  onClick={() => handleMapFilterChange('All')}
                >
                  <MapPin size={16} /> All Facilities
                </button>
                <button 
                  className={`filter-button ${mapFilter === 'Recyclable' ? 'active' : ''}`}
                  onClick={() => handleMapFilterChange('Recyclable')}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0ea5e9' }}></div>
                  Recycling Hubs
                </button>
                <button 
                  className={`filter-button ${mapFilter === 'E-Waste' ? 'active' : ''}`}
                  onClick={() => handleMapFilterChange('E-Waste')}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#a78bfa' }}></div>
                  E-Waste Sites
                </button>
                <button 
                  className={`filter-button ${mapFilter === 'Organic' ? 'active' : ''}`}
                  onClick={() => handleMapFilterChange('Organic')}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  Organic Yard
                </button>
                <button 
                  className={`filter-button ${mapFilter === 'Hazardous' ? 'active' : ''}`}
                  onClick={() => handleMapFilterChange('Hazardous')}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f43f5e' }}></div>
                  Hazardous Depots
                </button>

                <div style={{ marginTop: 'auto', padding: '1rem', backgroundColor: 'hsl(var(--bg-base) / 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-color))' }}>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
                    <Info size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                    Map centers are pre-seeded in the Boston, MA metropolitan area for demonstration purposes.
                  </p>
                </div>
              </div>

              {/* Leaflet Map Wrapper */}
              <div className="map-wrapper">
                <MapContainer center={[42.345, -71.085]} zoom={12.5} scrollWheelZoom={true}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {centers.map(center => (
                    <Marker 
                      key={center.id} 
                      position={[center.latitude, center.longitude]}
                      icon={getMarkerIcon(center.category)}
                    >
                      <Popup>
                        <div className="map-popup-content">
                          <h3>{center.name}</h3>
                          <p><strong>Address:</strong> {center.address}</p>
                          <p><strong>Hours:</strong> {center.hours}</p>
                          <p><strong>Contact:</strong> {center.phone}</p>
                          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#e2e8f0' }}>
                            <strong>Accepts:</strong> {center.acceptedTypes.join(', ')}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div>
            <header>
              <h1>Scan History & Logs</h1>
              <p>Keep track of all items scanned locally, review AI separation reports, and access eco suggestions.</p>
            </header>

            <div className="history-layout">
              {/* History Search/Filter */}
              <div className="history-search">
                <input 
                  type="text" 
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search scanned items or categories..."
                />
              </div>

              {/* History Scans Table */}
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Waste Item</th>
                      <th>Category</th>
                      <th>Recyclable</th>
                      <th>Timestamp</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length > 0 ? (
                      filteredHistory.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '600' }}>{item.itemName}</td>
                          <td>
                            <span className={`category-badge ${
                              item.category === 'Recyclable' ? 'cat-recyclable' :
                              item.category === 'Hazardous Waste' ? 'cat-hazardous' :
                              item.category === 'E-Waste' ? 'cat-ewaste' :
                              item.category === 'Organic Waste' ? 'cat-organic' : 'cat-general'
                            }`} style={{ marginBottom: 0, padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}>
                              {item.category}
                            </span>
                          </td>
                          <td>
                            {item.isRecyclable ? (
                              <span style={{ color: '#10b981', fontWeight: '500' }}>Yes</span>
                            ) : (
                              <span style={{ color: '#f43f5e', fontWeight: '500' }}>No</span>
                            )}
                          </td>
                          <td style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Clock size={12} />
                              {new Date(item.timestamp).toLocaleString()}
                            </div>
                          </td>
                          <td>
                            <button 
                              className="history-view-btn"
                              onClick={() => {
                                setScanResult(item);
                                setSearchQuery(item.itemName);
                                setActiveTab('scanner');
                              }}
                            >
                              Show Report
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 0', color: 'hsl(var(--text-muted))' }}>
                          No matching scans found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
