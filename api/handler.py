# api/handler.py
import sys
import os

# Ajouter le répertoire parent au chemin
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, render_template

# Importer l'app originale sans la modifier
from app import app as original_app, latest_data

# Créer une app Flask pour Vercel
vercel_app = Flask(__name__, 
                   template_folder='../templates',
                   static_folder='../static')

@vercel_app.route('/')
def index():
    return render_template('index.html')

@vercel_app.route('/api/status')
def get_status():
    return jsonify(latest_data)

# Handler pour Vercel
def handler(event, context):
    return vercel_app(event, context)