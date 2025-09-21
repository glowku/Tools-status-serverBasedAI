# api/index.py
from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return "CA MARCHE !"

@app.route('/api/test')
def test():
    return {"status": "ok", "message": "Vercel fonctionne"}

def handler(event, context):
    return app(event, context)