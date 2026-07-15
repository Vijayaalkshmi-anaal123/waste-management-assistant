import os
import json
from datetime import datetime

class LocalDB:
    def __init__(self, filepath="local_db.json"):
        # Put local_db.json in the current working directory of the Flask app
        self.filepath = filepath
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w") as f:
                json.dump([], f)

    def save_scan(self, scan_data):
        try:
            if os.path.exists(self.filepath):
                with open(self.filepath, "r") as f:
                    history = json.load(f)
            else:
                history = []
        except Exception:
            history = []
        
        history.append(scan_data)
        
        try:
            with open(self.filepath, "w") as f:
                json.dump(history, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving to local db: {e}")
            return False

    def get_history(self):
        try:
            if os.path.exists(self.filepath):
                with open(self.filepath, "r") as f:
                    history = json.load(f)
                # Sort by timestamp descending
                history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
                return history
            return []
        except Exception as e:
            print(f"Error reading local db: {e}")
            return []

class FirebaseDB:
    def __init__(self, cert_path):
        import firebase_admin
        from firebase_admin import credentials, firestore
        self.cred = credentials.Certificate(cert_path)
        try:
            self.app = firebase_admin.initialize_app(self.cred)
        except ValueError:
            # Already initialized
            self.app = firebase_admin.get_app()
        self.db = firestore.client()

    def save_scan(self, scan_data):
        try:
            doc_ref = self.db.collection("scans").document()
            doc_ref.set(scan_data)
            return True
        except Exception as e:
            print(f"Error saving to Firestore: {e}")
            return False

    def get_history(self):
        try:
            docs = self.db.collection("scans").order_by("timestamp", direction="DESCENDING").stream()
            history = []
            for doc in docs:
                data = doc.to_dict()
                # If timestamp has an isoformat method (like datetime objects or firebase timestamps)
                if data.get("timestamp") and hasattr(data["timestamp"], "isoformat"):
                    data["timestamp"] = data["timestamp"].isoformat()
                history.append(data)
            return history
        except Exception as e:
            print(f"Error reading from Firestore: {e}")
            return []

# Singleton database client instance
db_client = None

def init_db():
    global db_client
    cert_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    if cert_path and os.path.exists(cert_path):
        print(f"Initializing Firebase DB with path: {cert_path}")
        try:
            db_client = FirebaseDB(cert_path)
        except Exception as e:
            print(f"Error initializing Firebase, falling back to LocalDB: {e}")
            db_client = LocalDB()
    else:
        print("Firebase credentials path not provided or file missing. Using local JSON database.")
        db_client = LocalDB()

def get_db():
    global db_client
    if db_client is None:
        init_db()
    return db_client
