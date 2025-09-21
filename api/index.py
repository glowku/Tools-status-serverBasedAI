# api/index.py
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importer TON app.py et l'utiliser
from app import app

def handler(event, context):
    return app(event, context)