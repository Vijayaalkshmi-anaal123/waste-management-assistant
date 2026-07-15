import os
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from db import get_db

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Enable CORS for the React frontend (running on port 5173 by default)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Rule-based offline classifier backup
LOCAL_CLASSIFICATION_RULES = {
    "battery": {
        "itemName": "Battery",
        "category": "Hazardous Waste",
        "isRecyclable": False,
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
        "isRecyclable": True,
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
        "hazardWarnings": None,
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
        "isRecyclable": True,
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
        "isRecyclable": True,
        "disposalInstructions": [
            "Separate any food labels/stickers from the core.",
            "Dispose of in your backyard compost bin or a green municipal organics bin.",
            "Do not seal in plastic bags before composting."
        ],
        "recyclingProcedures": [
            "Add to a compost pile along with dry carbon-rich materials like dry leaves and paper.",
            "Turn the pile regularly to supply oxygen for aerobic decomposition."
        ],
        "hazardWarnings": None,
        "ecoSuggestions": [
            "Plan grocery shopping to reduce food spoilage.",
            "Learn to home-compost or set up a simple vermicomposting (worm) bin.",
            "Utilize municipal organic collection services if available."
        ],
        "acceptedFacilities": ["Organic Collection Facility", "Community Compost Site"]
    }
}

def call_groq_ai(item_name):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or api_key == "your_groq_api_key_here" or api_key.strip() == "":
        raise ValueError("Groq API key not configured")

    from groq import Groq
    client = Groq(api_key=api_key)
    
    prompt = f"""
    Analyze the following waste item: "{item_name}"
    Provide a JSON response representing how to dispose of this waste responsibly.
    The JSON must match this schema EXACTLY:
    {{
      "itemName": "{item_name}",
      "category": "Recyclable" | "Hazardous Waste" | "E-Waste" | "Organic Waste" | "General Waste",
      "isRecyclable": true | false,
      "disposalInstructions": ["step 1", "step 2", ...],
      "recyclingProcedures": ["step 1", "step 2", ...],
      "hazardWarnings": "warning description" | null,
      "ecoSuggestions": ["suggestion 1", "suggestion 2", ...],
      "acceptedFacilities": ["recycling center", "e-waste collection facility", ...]
    }}
    Ensure category is exactly one of the five listed options.
    Do not include any markup, markdown (like ```json), or explanations outside of the raw JSON object.
    """
    
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    return json.loads(chat_completion.choices[0].message.content)

def local_fallback_classify(item_name):
    # Standardize input string
    query = item_name.strip().lower()
    
    # Check for direct keyword matches
    for key, data in LOCAL_CLASSIFICATION_RULES.items():
        if key in query or query in key:
            return data

    # Broader category guess based on common keywords
    if any(k in query for k in ["plastic", "glass", "paper", "cardboard", "can", "bottle", "newspaper"]):
        return {
            "itemName": item_name.capitalize(),
            "category": "Recyclable",
            "isRecyclable": True,
            "disposalInstructions": [
                "Empty and clean the container.",
                "Flatten packaging where possible.",
                "Place in standard blue recycling bin."
            ],
            "recyclingProcedures": [
                "Curbside collection goes to a Material Recovery Facility (MRF).",
                "Sorted items are baled and sent to processors for remanufacturing."
            ],
            "hazardWarnings": None,
            "ecoSuggestions": [
                "Choose items with minimal packaging.",
                "Reuse packaging containers where appropriate."
            ],
            "acceptedFacilities": ["Recycling Center", "Municipal Recycling Center"]
        }
    elif any(k in query for k in ["battery", "chemical", "paint", "oil", "lightbulb", "mercury", "pesticide", "acid"]):
        return {
            "itemName": item_name.capitalize(),
            "category": "Hazardous Waste",
            "isRecyclable": False,
            "disposalInstructions": [
                "Keep in a sealed container to prevent spills or reactions.",
                "Do not pour down drains, into storm sewers, or onto the ground.",
                "Deliver to a designated hazardous waste drop-off event or facility."
            ],
            "recyclingProcedures": [
                "Hazardous chemicals are chemically neutralized, incinerated in safe facilities, or isolated.",
                "Heavy metals may be reclaimed under strict safety guidelines."
            ],
            "hazardWarnings": "Contains toxic or reactive ingredients that pose environmental and fire safety threats if improperly discarded.",
            "ecoSuggestions": [
                "Switch to non-toxic or green chemical alternatives.",
                "Only purchase the amount of chemicals or paint you actually need."
            ],
            "acceptedFacilities": ["Hazardous Waste Facility"]
        }
    elif any(k in query for k in ["phone", "laptop", "tv", "wire", "charger", "computer", "keyboard", "mouse", "electronics", "cable"]):
        return {
            "itemName": item_name.capitalize(),
            "category": "E-Waste",
            "isRecyclable": True,
            "disposalInstructions": [
                "Remove batteries if detachable, and recycle them separately.",
                "Wipe all personal data/storage clean.",
                "Drop off at a certified electronics retailer or recycling point."
            ],
            "recyclingProcedures": [
                "Sent to specialized e-waste processors who extract precious minerals.",
                "Circuit boards are smelted to separate gold, copper, and palladium."
            ],
            "hazardWarnings": "Circuit boards and batteries contain toxic heavy metals like cadmium and lead that cause chronic poisoning if leaked.",
            "ecoSuggestions": [
                "Repair and reuse devices to extend their operating life.",
                "Donate usable gadgets to schools or non-profits."
            ],
            "acceptedFacilities": ["E-Waste Processing Center"]
        }
    elif any(k in query for k in ["food", "banana", "apple", "vegetable", "fruit", "bread", "leaves", "grass", "compost", "orange", "peel", "egg", "coffee", "tea", "rice", "meat", "scraps", "organic", "plant"]):
        return {
            "itemName": item_name.capitalize(),
            "category": "Organic Waste",
            "isRecyclable": True,
            "disposalInstructions": [
                "Remove stickers, plastics, twist ties, or non-biodegradable pieces.",
                "Add to compost or place in green composting bin."
            ],
            "recyclingProcedures": [
                "Undergoes decomposition by bacteria and fungi, turning into rich compost humus.",
                "Industrial organic facilities may use anaerobic digesters to capture biogas for energy."
            ],
            "hazardWarnings": None,
            "ecoSuggestions": [
                "Practice portion control to minimize leftovers.",
                "Start a backyard compost heap or use a compost bucket under the kitchen sink."
            ],
            "acceptedFacilities": ["Organic Collection Facility", "Community Compost Site"]
        }
    else:
        # General/Trash fallback
        return {
            "itemName": item_name.capitalize(),
            "category": "General Waste",
            "isRecyclable": False,
            "disposalInstructions": [
                "Securely bag the item.",
                "Place in standard black trash container for landfill disposal."
            ],
            "recyclingProcedures": [
                "General waste is buried in landfills or sent to waste-to-energy incineration facilities."
            ],
            "hazardWarnings": None,
            "ecoSuggestions": [
                "Evaluate whether this item can be replaced with a reusable, recyclable, or compostable alternative."
            ],
            "acceptedFacilities": ["Municipal Landfill", "Waste-to-Energy Plant"]
        }

# Pre-seeded collection centers in Boston area
COLLECTION_CENTERS = [
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
]

@app.route("/api/classify", methods=["POST"])
def classify_waste():
    data = request.json or {}
    item_name = data.get("item_name", "").strip()
    if not item_name:
        return jsonify({"error": "Item name is required"}), 400

    try:
        # Attempt AI classification
        result = call_groq_ai(item_name)
    except Exception as e:
        # Fall back to rules engine
        print(f"AI Classification failed or key missing: {e}. Falling back to rules engine.")
        result = local_fallback_classify(item_name)

    # Append timestamp
    result["timestamp"] = datetime.utcnow().isoformat() + "Z"

    # Save to history database
    db = get_db()
    db.save_scan(result)

    return jsonify(result)

@app.route("/api/history", methods=["GET"])
def get_history():
    db = get_db()
    history = db.get_history()
    return jsonify(history)

@app.route("/api/centers", methods=["GET"])
def get_centers():
    category = request.args.get("category", "").strip().capitalize()
    if category and category != "All":
        filtered_centers = [c for c in COLLECTION_CENTERS if c["category"].lower() == category.lower()]
        return jsonify(filtered_centers)
    return jsonify(COLLECTION_CENTERS)

@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    db = get_db()
    history = db.get_history()

    # Default/Empty structures
    recyclable_count = 0
    non_recyclable_count = 0
    category_counts = {
        "Recyclable": 0,
        "Hazardous Waste": 0,
        "E-Waste": 0,
        "Organic Waste": 0,
        "General Waste": 0
    }

    # Initialize 7-day tracking structure
    today = datetime.utcnow().date()
    date_tracking = { (today - timedelta(days=i)).isoformat(): 0 for i in range(6, -1, -1) }

    for scan in history:
        # 1. Recyclability check
        if scan.get("isRecyclable", False):
            recyclable_count += 1
        else:
            non_recyclable_count += 1

        # 2. Category distribution
        cat = scan.get("category", "General Waste")
        if cat in category_counts:
            category_counts[cat] += 1
        else:
            category_counts["General Waste"] += 1

        # 3. Scanning activity (7-day timeline)
        ts_str = scan.get("timestamp", "")
        if ts_str:
            try:
                # Handle different ISO date formats (e.g. Z or milliseconds)
                scan_date = ts_str.split("T")[0]
                if scan_date in date_tracking:
                    date_tracking[scan_date] += 1
            except Exception:
                pass

    # Format 7-day activity chart list (sorted chronologically)
    activity_timeline = [{"date": d, "count": count} for d, count in sorted(date_tracking.items())]

    total_scanned = len(history)
    recycle_rate = round((recyclable_count / total_scanned * 100), 1) if total_scanned > 0 else 0.0

    return jsonify({
        "totalScanned": total_scanned,
        "recyclableCount": recyclable_count,
        "nonRecyclableCount": non_recyclable_count,
        "recycleRate": recycle_rate,
        "hazardousCount": category_counts.get("Hazardous Waste", 0),
        "categoryCounts": category_counts,
        "activityTimeline": activity_timeline
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
