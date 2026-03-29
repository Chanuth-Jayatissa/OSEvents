import sys
from pymongo import MongoClient
import ssl
import certifi

uri = "mongodb+srv://backend_user:uGIkgCA04ZbYR9Ul@eventos.i7uam9a.mongodb.net/?appName=EventOS"

print("Attempting to connect with standard options...")
try:
    client = MongoClient(uri, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
    client.admin.command('ping')
    print("✅ Connection successful!")
except Exception as e:
    print(f"❌ Connection failed: {e}")
