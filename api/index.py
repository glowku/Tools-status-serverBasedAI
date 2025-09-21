# api/index.py
from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return "Test Vercel - Ça marche !"

@app.route('/api/test')
def test():
    return {"status": "ok", "message": "Fonctionne"}

def handler(event, context):
    return app(event, context)
