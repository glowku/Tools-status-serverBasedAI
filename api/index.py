# api/index.py
import sys
import os

# Ajouter le répertoire parent au chemin
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importer TON app.py
from app import app

# Handler pour Vercel - ça remplace le "python app.py"
def handler(event, context):
    return app(event, context)
