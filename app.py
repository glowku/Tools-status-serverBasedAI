import requests
import time
import socket
import subprocess
import re
import json
from datetime import datetime
import logging
import os
import sys
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import threading
import webbrowser
import ssl
import platform
import concurrent.futures

# Configuration
CONFIG = {
    "rpc_url": "http://mainnet.basedaibridge.com/rpc",
    "rpc_port": 8545,
    "domain": "mainnet.basedaibridge.com",
    "main_domain": "basedaibridge.com",
    "check_interval": 60,
    "dns_check_interval": 600,
    "log_file": "basedai_monitor.log",
    "ports_to_check": [80, 443, 8545, 30333, 9933, 9944],
    "latency_threshold": 0.5,
    "history_size": 120,  # Augmenté pour stocker 2 heures de données (120 points * 60 secondes)
    "web_port": 5000,
    "fallback_rpc_urls": [
        "https://eth.public-rpc.com",
        "https://rpc.ankr.com/eth",
        "https://cloudflare-eth.com"
    ],
    "disable_dns_checks": os.environ.get('DISABLE_DNS_CHECKS', 'false').lower() == 'true',
    "disable_port_checks": os.environ.get('DISABLE_PORT_CHECKS', 'false').lower() == 'true',
    "ping_timeout": 5,
    "ping_retries": 3,
    "use_tcp_ping": os.environ.get('USE_TCP_PING', 'true').lower() == 'true'
}

# Variables globales
check_history = []
previous_results = {}
last_dns_serial = None
ping_history = []
ping_update_interval = 5  # Secondes entre les mises à jour du ping
latest_data = {
    "rpc_status": "unknown",
    "ping_status": "unknown",
    "server_status": "unknown",
    "version_info": "N/A",
    "ip_info": "N/A",
    "http_info": "N/A",
    "security_info": "N/A",
    "txt_info": "N/A",
    "main_domain_info": {"ip": "N/A", "redirect": "N/A"},
    "port_statuses": {},
    "last_check": "",
    "history": [],
    "alerts": [],
    "ssl_info": {},
    "dns_records": {},
    "network_info": {},
    "transactions": {},
    "ping_history": []
}

# Variables pour les alertes persistantes
rpc_status_alert = None
server_status_alert = None

app = Flask(__name__)
CORS(app)

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(CONFIG["log_file"], encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

def tcp_ping(host, port=80, timeout=5):
    """
    Effectue un ping TCP plus rapide que HTTP
    """
    try:
        start_time = time.time()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        sock.close()
        return (time.time() - start_time) * 1000  # Convertir en ms
    except:
        return None

def ping_host():
    """
    Mesure la latence avec la méthode appropriée pour l'environnement
    """
    # Sur Render, utiliser TCP ping qui est plus fiable
    if os.environ.get('RENDER') == 'true' and CONFIG["use_tcp_ping"]:
        try:
            # Essayer plusieurs ports pour plus de fiabilité
            ports = [80, 443]
            results = []
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                futures = [executor.submit(tcp_ping, CONFIG['domain'], port, CONFIG["ping_timeout"]) for port in ports]
                
                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    if result is not None:
                        results.append(result)
            
            if results:
                # Prendre la valeur la plus basse
                ping_time = min(results)
                return {"status": "success", "time": ping_time}
                
        except Exception as e:
            logging.error(f"TCP ping failed: {str(e)}")
    
    # Pour les autres environnements ou en cas d'échec, utiliser la méthode standard
    try:
        # Construire la commande ping en fonction du système d'exploitation
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        command = ['ping', param, '3', CONFIG['domain']]
        response = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if response.returncode == 0:
            # Extraire les temps de ping et calculer la moyenne
            time_pattern = r'time[=<](\d+\.?\d*)\s*ms'
            times = re.findall(time_pattern, response.stdout)
            
            if times:
                # Prendre la valeur médiane pour éviter les pics
                times = sorted([float(t) for t in times])
                if len(times) >= 3:
                    ping_time = times[1]  # Médiane
                else:
                    ping_time = times[0]
                
                return {"status": "success", "time": ping_time}
    except Exception as e:
        logging.error(f"System ping failed: {str(e)}")
    
    # Dernier recours : requête HTTP
    try:
        start_time = time.time()
        response = requests.get(f"http://{CONFIG['domain']}", timeout=5)
        response_time = (time.time() - start_time) * 1000  # Convertir en ms
        
        if response.status_code == 200:
            return {"status": "success", "time": response_time}
        else:
            return {"status": "failed", "message": f"HTTP {response.status_code}"}
            
    except Exception as e2:
        logging.error(f"HTTP ping failed: {str(e2)}")
        return {"status": "error", "message": "All ping methods failed"}

def check_rpc_endpoint():
    """
    Vérifie le point de terminaison RPC avec une meilleure gestion des erreurs
    """
    rpc_payload = {"jsonrpc": "2.0", "method": "eth_chainId", "params": [], "id": 1}
    
    # D'abord essayer avec l'URL principale
    try:
        start_time = time.time()
        response = requests.post(
            CONFIG["rpc_url"], 
            json=rpc_payload, 
            timeout=15,  # Timeout plus long
            headers={'User-Agent': 'Mozilla/5.0 (compatible; BasedAI-Monitor/1.0)'}
        )
        response_time = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            if "result" in result:
                return {
                    "status": "online",
                    "chain_id": result["result"],
                    "response_time": response_time
                }
            else:
                logging.error(f"Invalid RPC response: {result}")
                return {"status": "offline", "message": "Invalid RPC response"}
        elif response.status_code == 502:
            logging.error("RPC returned 502 Bad Gateway - server may be temporarily unavailable")
            return {"status": "offline", "message": "RPC server temporarily unavailable (502)"}
        else:
            logging.error(f"RPC HTTP error: {response.status_code}")
            return {"status": "offline", "code": response.status_code}
            
    except requests.exceptions.RequestException as e:
        logging.error(f"RPC request failed: {str(e)}")
        
        # Essayer avec les URLs de secours
        for fallback_url in CONFIG["fallback_rpc_urls"]:
            try:
                logging.info(f"Trying fallback RPC: {fallback_url}")
                start_time = time.time()
                response = requests.post(
                    fallback_url, 
                    json=rpc_payload, 
                    timeout=15,
                    headers={'User-Agent': 'Mozilla/5.0 (compatible; BasedAI-Monitor/1.0)'}
                )
                response_time = time.time() - start_time
                
                if response.status_code == 200:
                    result = response.json()
                    if "result" in result:
                        logging.info(f"Successfully connected to fallback RPC: {fallback_url}")
                        return {
                            "status": "online",
                            "chain_id": result["result"],
                            "response_time": response_time,
                            "source": fallback_url
                        }
            except requests.exceptions.RequestException as fallback_error:
                logging.error(f"Fallback RPC failed: {fallback_url} - {str(fallback_error)}")
                continue
        
        # Si toutes les tentatives échouent, retourner une erreur
        return {"status": "offline", "message": "All RPC endpoints failed"}

def check_ports_alt():
    """
    Alternative à check_ports qui utilise des requêtes HTTP au lieu de sockets
    """
    port_results = {}
    
    # Si les vérifications de ports sont désactivées, retourner des valeurs par défaut
    if CONFIG["disable_port_checks"]:
        logging.info("Port checks disabled, using default values")
        for port in CONFIG["ports_to_check"]:
            if port in [80, 443]:
                port_results[port] = "open"
            else:
                port_results[port] = "unknown"
        return port_results
    
    # Pour les ports HTTP/HTTPS, utiliser des requêtes HTTP
    if 80 in CONFIG["ports_to_check"]:
        try:
            response = requests.get(f"http://{CONFIG['domain']}", timeout=10)
            port_results[80] = "open" if response.status_code < 500 else "closed"
        except:
            port_results[80] = "closed"
    
    if 443 in CONFIG["ports_to_check"]:
        try:
            response = requests.get(f"https://{CONFIG['domain']}", timeout=10)
            port_results[443] = "open" if response.status_code < 500 else "closed"
        except:
            port_results[443] = "closed"
    
    # Pour les autres ports, utiliser socket si possible
    for port in CONFIG["ports_to_check"]:
        if port not in [80, 443]:  # On a déjà vérifié les ports 80 et 443
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(10)  # Timeout plus long
                result = sock.connect_ex((CONFIG["domain"], port))
                sock.close()
                
                if result == 0:
                    port_results[port] = "open"
                else:
                    port_results[port] = "closed"
                    
            except Exception as e:
                logging.error(f"Error checking port {port}: {str(e)}")
                # En cas d'erreur, essayer avec une méthode alternative
                try:
                    # Essayer de se connecter via une requête HTTP si c'est un port web
                    if port in [8080, 8000, 3000, 5000]:
                        response = requests.get(f"http://{CONFIG['domain']}:{port}", timeout=10)
                        port_results[port] = "open" if response.status_code < 500 else "closed"
                    else:
                        port_results[port] = "unknown"
                except:
                    port_results[port] = "unknown"
    
    return port_results

def get_ip_info():
    try:
        ip = socket.gethostbyname(CONFIG["domain"])
        return ip
    except:
        return "N/A"

def get_http_info():
    try:
        response = requests.get(f"http://{CONFIG['domain']}", timeout=5)
        server = response.headers.get("Server", "Unknown")
        status_code = response.status_code
        
        return f"{server} ({status_code})"
    except:
        return "N/A"

def get_ssl_info():
    ssl_info = {}
    try:
        context = ssl.create_default_context()
        with socket.create_connection((CONFIG['domain'], 443)) as sock:
            with context.wrap_socket(sock, server_hostname=CONFIG['domain']) as ssock:
                cert = ssock.getpeercert()
                ssl_info['issuer'] = dict(x[0] for x in cert['issuer'])
                ssl_info['subject'] = dict(x[0] for x in cert['subject'])
                ssl_info['version'] = cert.get('version', 'N/A')
                ssl_info['serialNumber'] = cert.get('serialNumber', 'N/A')
                ssl_info['notBefore'] = cert.get('notBefore', 'N/A')
                ssl_info['notAfter'] = cert.get('notAfter', 'N/A')
                ssl_info['signatureAlgorithm'] = cert.get('signatureAlgorithm', 'N/A')
                
                # Calculate remaining days
                expire_date = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                days_left = (expire_date - datetime.now()).days
                ssl_info['days_left'] = days_left
    except Exception as e:
        ssl_info['error'] = str(e)
    
    return ssl_info

def get_security_info():
    try:
        response = requests.get(f"https://{CONFIG['domain']}", timeout=5)
        
        security_headers = []
        if response.headers.get("Strict-Transport-Security"):
            security_headers.append("HSTS")
        if response.headers.get("Content-Security-Policy"):
            security_headers.append("CSP")
        if response.headers.get("X-Content-Type-Options"):
            security_headers.append("XCTO")
        if response.headers.get("X-Frame-Options"):
            security_headers.append("XFO")
        if response.headers.get("X-XSS-Protection"):
            security_headers.append("XSS")
        
        # Get SSL certificate info
        cert_info = ""
        try:
            context = ssl.create_default_context()
            with socket.create_connection((CONFIG['domain'], 443)) as sock:
                with context.wrap_socket(sock, server_hostname=CONFIG['domain']) as ssock:
                    cert = ssock.getpeercert()
                    issuer = dict(x[0] for x in cert['issuer'])
                    expire_date = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                    days_left = (expire_date - datetime.now()).days
                    cert_info = f"Certificate: {issuer.get('organizationName', 'Unknown')} - Expires in {days_left} days"
        except Exception as e:
            cert_info = f"Certificate error: {str(e)}"
        
        if security_headers:
            return ", ".join(security_headers) + f" | {cert_info}"
        else:
            return f"Info SSL | {cert_info}"
    except Exception as e:
        return f"Error: {str(e)}"

def get_main_domain_info():
    """
    Récupère les informations du domaine principal avec une meilleure gestion des erreurs
    """
    result = {"ip": "N/A", "redirect": "N/A"}
    
    # Récupérer l'IP
    try:
        ip = socket.gethostbyname(CONFIG["main_domain"])
        result["ip"] = ip
    except Exception as e:
        logging.error(f"Error getting main domain IP: {str(e)}")
        result["ip"] = "Error"
    
    # Vérifier la redirection
    try:
        response = requests.get(f"http://{CONFIG['main_domain']}", timeout=10, allow_redirects=True)
        if response.history:
            final_url = response.url
            if CONFIG["domain"] in final_url:
                result["redirect"] = f"→ {CONFIG['domain']}"
            else:
                result["redirect"] = f"→ {final_url}"
        else:
            result["redirect"] = "None"
    except Exception as e:
        logging.error(f"Error checking main domain redirect: {str(e)}")
        result["redirect"] = "Error"
    
    return result

def get_dns_serial():
    global last_dns_serial
    
    # Forcer l'activation des vérifications DNS sur Render
    force_dns_checks = os.environ.get('FORCE_DNS_CHECKS', 'false').lower() == 'true'
    
    # Si les vérifications DNS sont désactivées mais qu'on force quand même
    if CONFIG["disable_dns_checks"] and not force_dns_checks:
        logging.info("DNS checks disabled, using default serial")
        today = datetime.now()
        date_serial = today.strftime("%Y%m%d")
        last_dns_serial = date_serial
        return date_serial
    
    try:
        # Méthode 1: Utiliser une API DNS externe plus fiable - Google DNS API
        try:
            domain = CONFIG["main_domain"]  # Utiliser le domaine principal au lieu du sous-domaine
            url = f"https://dns.google/resolve?name={domain}&type=SOA"
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if "Answer" in data:
                    for answer in data["Answer"]:
                        if answer.get("type") == 6:  # Type SOA
                            # Extraire le serial du champ data
                            soa_data = answer.get("data", "").split(" ")
                            if len(soa_data) >= 3:
                                serial = soa_data[2]
                                logging.info(f"DNS serial found using Google DNS API: {serial}")
                                last_dns_serial = serial
                                return serial
        except Exception as e:
            logging.error(f"Error with Google DNS API: {str(e)}")
        
        # Méthode 2: Utiliser l'API de Cloudflare DNS
        try:
            domain = CONFIG["main_domain"]
            url = f"https://cloudflare-dns.com/dns-query?name={domain}&type=SOA"
            
            headers = {
                "Accept": "application/dns-json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if "Answer" in data:
                    for answer in data["Answer"]:
                        if answer.get("type") == 6:  # Type SOA
                            # Extraire le serial du champ data
                            soa_data = answer.get("data", "").split(" ")
                            if len(soa_data) >= 3:
                                serial = soa_data[2]
                                logging.info(f"DNS serial found using Cloudflare DNS API: {serial}")
                                last_dns_serial = serial
                                return serial
        except Exception as e:
            logging.error(f"Error with Cloudflare DNS API: {str(e)}")
        
        # Méthode 3: Utiliser l'API de Whois
        try:
            domain = CONFIG["main_domain"]  # Utiliser le domaine principal au lieu du sous-domaine
            url = f"https://www.whois.com/whois/{domain}"
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                # Chercher le serial dans la réponse
                serial_patterns = [
                    r'Registry Expiry Date:[^0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2})',
                    r'Expiration Date:[^0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2})',
                    r'paid-till:[^0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2})',
                    r'expires:[^0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2})'
                ]
                
                for pattern in serial_patterns:
                    match = re.search(pattern, response.text, re.IGNORECASE)
                    if match:
                        date_str = match.group(1)
                        # Convertir la date en format YYYYMMDD
                        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                        serial = date_obj.strftime("%Y%m%d")
                        logging.info(f"DNS serial found using Whois API: {serial}")
                        last_dns_serial = serial
                        return serial
        except Exception as e:
            logging.error(f"Error with Whois API: {str(e)}")
        
        # Méthode 4: Utiliser l'API JSON Whois
        try:
            domain = CONFIG["main_domain"]
            url = f"https://jsonwhoisapi.com/api/v1/whois?domainName={domain}"
            
            headers = {
                "Authorization": "Bearer demo",  # Clé de démonstration
                "Content-Type": "application/json"
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "WhoisRecord" in data and "registryData" in data["WhoisRecord"]:
                    registry_data = data["WhoisRecord"]["registryData"]
                    
                    # Chercher la date d'expiration
                    if "expirationDate" in registry_data:
                        exp_date = registry_data["expirationDate"]
                        if exp_date:
                            # Formater la date
                            date_obj = datetime.strptime(exp_date.split("T")[0], "%Y-%m-%d")
                            serial = date_obj.strftime("%Y%m%d")
                            logging.info(f"DNS serial found using JSON Whois API: {serial}")
                            last_dns_serial = serial
                            return serial
        except Exception as e:
            logging.error(f"Error with JSON Whois API: {str(e)}")
            
    except Exception as e:
        logging.error(f"Error executing DNS commands: {str(e)}")
    
    # Si toutes les méthodes échouent, utiliser une valeur par défaut basée sur la date actuelle
    today = datetime.now()
    date_serial = today.strftime("%Y%m%d")
    logging.warning(f"All DNS methods failed, using date-based serial: {date_serial}")
    last_dns_serial = date_serial
    return date_serial

def get_txt_records():
    # Si les vérifications DNS sont désactivées, retourner une valeur par défaut
    if CONFIG["disable_dns_checks"]:
        logging.info("DNS checks disabled, using default TXT records")
        return []
    
    try:
        # Try using Python's socket.getaddrinfo instead of nslookup
        try:
            import dns.resolver
            answers = dns.resolver.resolve(CONFIG["domain"], 'TXT')
            txt_records = [str(rdata) for rdata in answers]
            if txt_records:
                logging.info(f"TXT Records found using dns.resolver: {txt_records}")
                return txt_records
        except ImportError:
            pass
        except Exception as e:
            logging.error(f"Error with dns.resolver: {str(e)}")
        
        # Fallback to nslookup
        command = ['nslookup', '-type=TXT', CONFIG["domain"]]
        response = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if response.returncode == 0:
            txt_records = []
            lines = response.stdout.split('\n')
            
            for line in lines:
                if 'text =' in line or 'text=' in line:
                    txt_match = re.search(r'"([^"]*)"', line)
                    if txt_match:
                        txt_records.append(txt_match.group(1))
            
            if txt_records:
                logging.info(f"TXT Records found: {txt_records}")
                return txt_records
            else:
                logging.info("No TXT records found")
                return []
        else:
            logging.error(f"nslookup TXT command failed: {response.stderr}")
            return []
    except Exception as e:
        logging.error(f"Error executing nslookup TXT: {str(e)}")
        return []

def get_dns_records():
    dns_records = {}
    
    # Si les vérifications DNS sont désactivées, retourner des valeurs par défaut
    if CONFIG["disable_dns_checks"]:
        logging.info("DNS checks disabled, using default DNS records")
        return {"A": [], "MX": [], "NS": []}
    
    # Get A records
    try:
        command = ['nslookup', '-type=A', CONFIG["domain"]]
        response = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if response.returncode == 0:
            a_records = []
            lines = response.stdout.split('\n')
            for line in lines:
                if 'Address:' in line and CONFIG["domain"] not in line:
                    ip_match = re.search(r'Address:\s*(\d+\.\d+\.\d+\.\d+)', line)
                    if ip_match:
                        a_records.append(ip_match.group(1))
            dns_records['A'] = a_records
    except Exception as e:
        logging.error(f"Error fetching A records: {str(e)}")
    
    # Get MX records
    try:
        command = ['nslookup', '-type=MX', CONFIG["domain"]]
        response = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if response.returncode == 0:
            mx_records = []
            lines = response.stdout.split('\n')
            for line in lines:
                if 'mail exchanger' in line:
                    mx_match = re.search(r'mail exchanger = (.+)', line)
                    if mx_match:
                        mx_records.append(mx_match.group(1))
            dns_records['MX'] = mx_records
    except Exception as e:
        logging.error(f"Error fetching MX records: {str(e)}")
    
    # Get NS records
    try:
        command = ['nslookup', '-type=NS', CONFIG["domain"]]
        response = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if response.returncode == 0:
            ns_records = []
            lines = response.stdout.split('\n')
            for line in lines:
                if 'nameserver' in line:
                    ns_match = re.search(r'nameserver = (.+)', line)
                    if ns_match:
                        ns_records.append(ns_match.group(1))
            dns_records['NS'] = ns_records
    except Exception as e:
        logging.error(f"Error fetching NS records: {str(e)}")
    
    return dns_records

def get_network_info():
    network_info = {}
    
    # Test connectivity with different DNS servers
    dns_servers = ['8.8.8.8', '1.1.1.1', '208.67.222.222']
    dns_results = {}
    
    for dns in dns_servers:
        try:
            response = subprocess.run(['nslookup', CONFIG["domain"], dns], 
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if response.returncode == 0:
                dns_results[dns] = "OK"
            else:
                dns_results[dns] = "Failed"
        except:
            dns_results[dns] = "Error"
    
    network_info['dns_connectivity'] = dns_results
    
    # Test latency with different endpoints
    endpoints = [
        f"https://{CONFIG['domain']}",
        f"http://{CONFIG['domain']}",
        CONFIG["rpc_url"]
    ]
    
    latency_results = {}
    for endpoint in endpoints:
        try:
            start_time = time.time()
            response = requests.get(endpoint, timeout=5)
            latency = (time.time() - start_time) * 1000
            latency_results[endpoint] = f"{latency:.2f}ms"
        except:
            latency_results[endpoint] = "Failed"
    
    network_info['endpoint_latency'] = latency_results
    
    return network_info

def get_latest_transactions():
    # Try with our primary RPC first
    try:
        rpc_payload = {"jsonrpc": "2.0", "method": "eth_getBlockByNumber", "params": ["latest", True], "id": 1}
        response = requests.post(CONFIG["rpc_url"], json=rpc_payload, timeout=10)
        if response.status_code == 200:
            result = response.json()
            if "result" in result:
                block = result["result"]
                return {
                    "block_number": int(block["number"], 16),
                    "tx_count": len(block["transactions"]),
                    "source": "Primary RPC"
                }
    except:
        pass
    
    # If primary fails, try fallback RPCs
    for fallback_url in CONFIG["fallback_rpc_urls"]:
        try:
            rpc_payload = {"jsonrpc": "2.0", "method": "eth_getBlockByNumber", "params": ["latest", True], "id": 1}
            response = requests.post(fallback_url, json=rpc_payload, timeout=10)
            if response.status_code == 200:
                result = response.json()
                if "result" in result:
                    block = result["result"]
                    return {
                        "block_number": int(block["number"], 16),
                        "tx_count": len(block["transactions"]),
                        "source": fallback_url
                    }
        except:
            continue
    
    # If all RPCs fail, try a public block explorer API
    try:
        response = requests.get("https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=YourApiKeyToken")
        if response.status_code == 200:
            result = response.json()
            if result["status"] == "1":
                block_number = int(result["result"], 16)
                return {
                    "block_number": block_number,
                    "tx_count": "Unknown",
                    "source": "Etherscan API"
                }
    except:
        pass
    
    return {"error": "Unable to fetch transaction data"}

def detect_changes(current_results):
    global previous_results
    alerts = []
    
    if not previous_results:
        previous_results = current_results.copy()
        return alerts
    
    # Check for ping latency changes - seulement si significatif
    if "ping" in current_results and "ping" in previous_results:
        if current_results["ping"]["status"] == "success" and previous_results["ping"]["status"] == "success":
            current_ping = current_results["ping"]["time"]
            previous_ping = previous_results["ping"]["time"]
            
            # Seulement si la différence est supérieure à 50ms et relative > 20%
            if abs(current_ping - previous_ping) > 50 and current_ping > previous_ping * 1.2:
                alerts.append({
                    "type": "latency_ping",
                    "message": f"⚠️ Ping latency increased: {previous_ping:.0f}ms → {current_ping:.0f}ms",
                    "severity": "warning"
                })
    
    # Check for RPC latency changes - seulement si significatif
    if "rpc" in current_results and "rpc" in previous_results:
        if current_results["rpc"]["status"] == "online" and previous_results["rpc"]["status"] == "online":
            current_rpc = current_results["rpc"]["response_time"]
            previous_rpc = previous_results["rpc"]["response_time"]
            
            # Seulement si la différence est supérieure à 0.2s et relative > 20%
            if abs(current_rpc - previous_rpc) > 0.2 and current_rpc > previous_rpc * 1.2:
                alerts.append({
                    "type": "latency_rpc",
                    "message": f"⚠️ RPC latency increased: {previous_rpc:.2f}s → {current_rpc:.2f}s",
                    "severity": "warning"
                })
    
    # Check for DNS changes
    if "version_info" in current_results and "version_info" in previous_results:
        if current_results["version_info"] != previous_results["version_info"]:
            alerts.append({
                "type": "dns_change",
                "message": f"🔄 DNS change: Serial {previous_results['version_info']} → {current_results['version_info']}",
                "severity": "info"
            })
    
    # Check for main domain changes
    if "main_domain_info" in current_results and "main_domain_info" in previous_results:
        current_ip = current_results["main_domain_info"].get("ip", "N/A")
        previous_ip = previous_results["main_domain_info"].get("ip", "N/A")
        if current_ip != previous_ip:
            alerts.append({
                "type": "domain_ip_change",
                "message": f"🔄 Domain IP change: {previous_ip} → {current_ip}",
                "severity": "warning"
            })
        
        current_redirect = current_results["main_domain_info"].get("redirect", "N/A")
        previous_redirect = previous_results["main_domain_info"].get("redirect", "N/A")
        if current_redirect != previous_redirect:
            alerts.append({
                "type": "domain_redirect_change",
                "message": f"🔄 Domain redirect change: {previous_redirect} → {current_redirect}",
                "severity": "info"
            })
    
    # Check for TXT changes
    if "txt_info" in current_results and "txt_info" in previous_results:
        if current_results["txt_info"] != previous_results["txt_info"]:
            alerts.append({
                "type": "txt_change",
                "message": f"🔄 TXT change: {previous_results['txt_info']} → {current_results['txt_info']}",
                "severity": "info"
            })
    
    # Check for IP changes
    if "ip_info" in current_results and "ip_info" in previous_results:
        if current_results["ip_info"] != previous_results["ip_info"]:
            alerts.append({
                "type": "ip_change",
                "message": f"🔄 IP change: {previous_results['ip_info']} → {current_results['ip_info']}",
                "severity": "warning"
            })
    
    # Check for HTTP changes
    if "http_info" in current_results and "http_info" in previous_results:
        if current_results["http_info"] != previous_results["http_info"]:
            alerts.append({
                "type": "http_change",
                "message": f"🔄 HTTP change: {previous_results['http_info']} → {current_results['http_info']}",
                "severity": "info"
            })
    
    # Check for security changes
    if "security_info" in current_results and "security_info" in previous_results:
        if current_results["security_info"] != previous_results["security_info"]:
            alerts.append({
                "type": "security_change",
                "message": f"🔄 Security change: {previous_results['security_info']} → {current_results['security_info']}",
                "severity": "warning"
            })
    
    # Check for port status changes
    if "ports" in current_results and "ports" in previous_results:
        for port in CONFIG["ports_to_check"]:
            if port in current_results["ports"] and port in previous_results["ports"]:
                if current_results["ports"][port] != previous_results["ports"][port]:
                    alerts.append({
                        "type": "port_change",
                        "message": f"🔄 Port {port}: {previous_results['ports'][port]} → {current_results['ports'][port]}",
                        "severity": "warning"
                    })
    
    # Update previous results
    previous_results = current_results.copy()
    
    return alerts

def cleanup_expired_alerts():
    global latest_data
    current_time = time.time()
    
    if "alerts" in latest_data:
        # Supprimer les alertes expirées (plus de 30 minutes) sauf les alertes persistantes
        latest_data["alerts"] = [
            alert for alert in latest_data["alerts"] 
            if (current_time - alert.get("timestamp", 0) < 1800 or  # 30 minutes = 1800 secondes
                alert.get("type") in ["rpc_status", "server_status"])  # Alertes persistantes
        ]
        
        # Limiter le nombre total d'alertes (max 10)
        if len(latest_data["alerts"]) > 10:
            latest_data["alerts"] = latest_data["alerts"][-10:]

def update_data():
    global latest_data, check_history, rpc_status_alert, server_status_alert
    
    current_time_seconds = time.time()
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    logging.info(f"Starting data update at {timestamp_str}")
    
    # Nettoyer les alertes expirées
    cleanup_expired_alerts()
    
    # Check RPC
    try:
        rpc_result = check_rpc_endpoint()
    except Exception as e:
        logging.error(f"Error checking RPC: {str(e)}")
        rpc_result = {"status": "error", "message": str(e)}
    
    rpc_status = rpc_result.get("status", "offline")
    
    # Check ports - utiliser la fonction alternative
    try:
        port_results = check_ports_alt()
    except Exception as e:
        logging.error(f"Error checking ports: {str(e)}")
        port_results = {}
    
    # Check ping - utiliser la fonction alternative
    try:
        ping_result = ping_host()
    except Exception as e:
        logging.error(f"Error checking ping: {str(e)}")
        ping_result = {"status": "error", "message": str(e)}
    
    ping_status = ping_result.get("status", "error")
    
    # Déterminer le statut global du serveur
    essential_services = [rpc_status, ping_status]
    if any(status in ["online", "success"] for status in essential_services):
        server_status = "online"
    else:
        server_status = "offline"
    
    # Gérer l'alerte RPC persistante
    if rpc_status_alert is None:
        # Créer l'alerte RPC si elle n'existe pas
        rpc_status_alert = {
            "type": "rpc_status",
            "message": f"RPC Status: {rpc_status}",
            "severity": "info" if rpc_status == "online" else "warning",
            "timestamp": current_time_seconds,
            "start_time": current_time_seconds if rpc_status == "offline" else None,
            "end_time": None,
            "persistent": True
        }
        latest_data["alerts"].append(rpc_status_alert)
    else:
        # Mettre à jour l'alerte RPC existante
        if rpc_status_alert.get("severity") == "warning" and rpc_status == "online":
            # RPC est revenu en ligne
            rpc_status_alert["end_time"] = current_time_seconds
            rpc_status_alert["severity"] = "success"
            
            # Calculer la durée de l'indisponibilité
            duration = current_time_seconds - rpc_status_alert["start_time"]
            hours = int(duration // 3600)
            minutes = int((duration % 3600) // 60)
            duration_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"
            
            rpc_status_alert["message"] = f"✅ RPC is back online after {duration_str}"
        elif rpc_status_alert.get("severity") == "success" and rpc_status == "offline":
            # RPC est redevenu hors ligne
            rpc_status_alert["start_time"] = current_time_seconds
            rpc_status_alert["end_time"] = None
            rpc_status_alert["severity"] = "warning"
            rpc_status_alert["message"] = f"⚠️ RPC is down since {datetime.fromtimestamp(current_time_seconds).strftime('%Y-%m-%d %H:%M:%S')}"
        elif rpc_status_alert.get("severity") == "warning" and rpc_status == "offline":
            # RPC reste hors ligne - mettre à jour le message
            start_time = rpc_status_alert.get("start_time", current_time_seconds)
            rpc_status_alert["message"] = f"⚠️ RPC is down since {datetime.fromtimestamp(start_time).strftime('%Y-%m-%d %H:%M:%S')}"
        
        # Mettre à jour le timestamp pour éviter l'expiration
        rpc_status_alert["timestamp"] = current_time_seconds
    
    # Gérer l'alerte Serveur persistante
    if server_status_alert is None:
        # Créer l'alerte Serveur si elle n'existe pas
        server_status_alert = {
            "type": "server_status",
            "message": f"Server Status: {server_status}",
            "severity": "info" if server_status == "online" else "warning",
            "timestamp": current_time_seconds,
            "start_time": current_time_seconds if server_status == "offline" else None,
            "end_time": None,
            "persistent": True
        }
        latest_data["alerts"].append(server_status_alert)
    else:
        # Mettre à jour l'alerte Serveur existante
        if server_status_alert.get("severity") == "warning" and server_status == "online":
            # Serveur est revenu en ligne
            server_status_alert["end_time"] = current_time_seconds
            server_status_alert["severity"] = "success"
            
            # Calculer la durée de l'indisponibilité
            duration = current_time_seconds - server_status_alert["start_time"]
            hours = int(duration // 3600)
            minutes = int((duration % 3600) // 60)
            duration_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"
            
            server_status_alert["message"] = f"✅ Server is back online after {duration_str}"
        elif server_status_alert.get("severity") == "success" and server_status == "offline":
            # Serveur est redevenu hors ligne
            server_status_alert["start_time"] = current_time_seconds
            server_status_alert["end_time"] = None
            server_status_alert["severity"] = "warning"
            server_status_alert["message"] = f"⚠️ Server is down since {datetime.fromtimestamp(current_time_seconds).strftime('%Y-%m-%d %H:%M:%S')}"
        elif server_status_alert.get("severity") == "warning" and server_status == "offline":
            # Serveur reste hors ligne - mettre à jour le message
            start_time = server_status_alert.get("start_time", current_time_seconds)
            server_status_alert["message"] = f"⚠️ Server is down since {datetime.fromtimestamp(start_time).strftime('%Y-%m-%d %H:%M:%S')}"
        
        # Mettre à jour le timestamp pour éviter l'expiration
        server_status_alert["timestamp"] = current_time_seconds
    
    # Check IP
    try:
        ip_info = get_ip_info()
    except Exception as e:
        logging.error(f"Error getting IP info: {str(e)}")
        ip_info = "Error"
    
    # Check HTTP
    try:
        http_info = get_http_info()
    except Exception as e:
        logging.error(f"Error getting HTTP info: {str(e)}")
        http_info = "Error"
    
    # Check security
    try:
        security_info = get_security_info()
    except Exception as e:
        logging.error(f"Error getting security info: {str(e)}")
        security_info = "Error"
    
    # Check SSL
    try:
        ssl_info = get_ssl_info()
    except Exception as e:
        logging.error(f"Error getting SSL info: {str(e)}")
        ssl_info = {"error": str(e)}
    
    # Check DNS
    try:
        if current_time_seconds - (latest_data.get("last_dns_check", 0)) > CONFIG["dns_check_interval"]:
            version_info = get_dns_serial()
            latest_data["last_dns_check"] = current_time_seconds
        else:
            version_info = latest_data.get("version_info", "N/A")
    except Exception as e:
        logging.error(f"Error getting DNS version: {str(e)}")
        version_info = "Error"
    
    # Check TXT Records
    try:
        txt_info = get_txt_records()
    except Exception as e:
        logging.error(f"Error getting TXT records: {str(e)}")
        txt_info = []
    
    # Check DNS records
    try:
        dns_records = get_dns_records()
    except Exception as e:
        logging.error(f"Error getting DNS records: {str(e)}")
        dns_records = {}
    
    # Check network info
    try:
        network_info = get_network_info()
    except Exception as e:
        logging.error(f"Error getting network info: {str(e)}")
        network_info = {}
    
    # Check transactions
    try:
        transactions_info = get_latest_transactions()
    except Exception as e:
        logging.error(f"Error getting transactions: {str(e)}")
        transactions_info = {"error": str(e)}
    
    # Check main domain
    try:
        main_domain_info = get_main_domain_info()
    except Exception as e:
        logging.error(f"Error getting main domain info: {str(e)}")
        main_domain_info = {"ip": "Error", "redirect": "Error"}
    
    # Détecter les changements et anomalies
    current_results = {
        "rpc": rpc_result,
        "ports": port_results,
        "ping": ping_result,
        "ip_info": ip_info,
        "http_info": http_info,
        "security_info": security_info,
        "ssl_info": ssl_info,
        "version_info": version_info,
        "txt_info": txt_info,
        "dns_records": dns_records,
        "network_info": network_info,
        "transactions": transactions_info,
        "main_domain_info": main_domain_info,
        "timestamp": timestamp_str
    }
    
    try:
        new_alerts = detect_changes(current_results)
        # Ajouter un timestamp à chaque nouvelle alerte
        for alert in new_alerts:
            alert["timestamp"] = current_time_seconds
        alerts = new_alerts
    except Exception as e:
        logging.error(f"Error detecting changes: {str(e)}")
        alerts = []
    
    # Mettre à jour les alertes en évitant les doublons récents
    if "alerts" not in latest_data:
        latest_data["alerts"] = []
    
    # Vérifier les doublons (même message dans les 5 dernières minutes)
    existing_messages = [
        alert["message"] for alert in latest_data["alerts"] 
        if current_time_seconds - alert.get("timestamp", 0) < 300  # 5 minutes
        and not alert.get("persistent", False)  # Ne pas considérer les alertes persistantes
    ]
    
    for alert in alerts:
        if alert["message"] not in existing_messages:
            latest_data["alerts"].append(alert)
    
    # Update global data
    latest_data.update({
        "server_status": server_status,
        "rpc_status": rpc_status,
        "ping_status": ping_status,
        "ping_value": ping_result.get("time", 0) if ping_status == "success" else None,
        "rpc_value": rpc_result.get("response_time", 0) if rpc_status == "online" else None,
        "version_info": version_info,
        "ip_info": ip_info,
        "http_info": http_info,
        "security_info": security_info,
        "ssl_info": ssl_info,
        "txt_info": txt_info,
        "dns_records": dns_records,
        "network_info": network_info,
        "transactions": transactions_info,
        "main_domain_info": main_domain_info,
        "port_statuses": port_results,
        "last_check": timestamp_str,
        "alerts": latest_data["alerts"]  # Utiliser les alertes mises à jour
    })
    
    logging.info(f"Data updated with {len(latest_data['alerts'])} alerts")
    
    # Add to history
    check_history.append({
        "ping": ping_result.get("time", 0),
        "rpc": rpc_result.get("response_time", 0) if rpc_status == "online" else None,
        "timestamp": timestamp_str
    })
    
    if len(check_history) > CONFIG["history_size"]:
        check_history.pop(0)
    
    # Update history in latest_data
    latest_data["history"] = check_history.copy()

def monitor_loop():
    while True:
        update_data()
        time.sleep(CONFIG["check_interval"])

def ping_monitor_loop():
    global ping_history
    while True:
        ping_result = ping_host()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Mettre à jour les données de ping dans latest_data
        latest_data["ping_status"] = ping_result.get("status", "error")
        latest_data["ping_value"] = ping_result.get("time", 0) if ping_result.get("status") == "success" else None
        
        # Ajouter à l'historique du ping
        ping_history.append({
            "ping": ping_result.get("time", 0),
            "timestamp": timestamp
        })
        
        # Limiter la taille de l'historique
        if len(ping_history) > 20:
            ping_history.pop(0)
        
        latest_data["ping_history"] = ping_history.copy()
        time.sleep(ping_update_interval)

# Routes Flask
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    return jsonify(latest_data)

@app.route('/api/history')
def get_history():
    return jsonify(latest_data.get("history", []))

@app.route('/api/alerts')
def get_alerts():
    return jsonify(latest_data.get("alerts", []))

@app.route('/api/ssl')
def get_ssl():
    return jsonify(latest_data.get("ssl_info", {}))

@app.route('/api/dns')
def get_dns():
    return jsonify(latest_data.get("dns_records", {}))

@app.route('/api/network')
def get_network():
    return jsonify(latest_data.get("network_info", {}))

@app.route('/api/transactions')
def get_transactions():
    return jsonify(latest_data.get("transactions", {}))

@app.route('/api/dismiss_alert', methods=['POST'])
def dismiss_alert():
    global latest_data
    
    data = request.json
    index = data.get('index')
    
    if index is not None and "alerts" in latest_data:
        if 0 <= index < len(latest_data["alerts"]):
            # Vérifier si l'alerte est persistante
            alert = latest_data["alerts"][index]
            if not alert.get("persistent", False):
                # Supprimer l'alerte seulement si elle n'est pas persistante
                latest_data["alerts"].pop(index)
                return jsonify({"success": True, "alerts": latest_data["alerts"]})
            else:
                # Ne pas supprimer les alertes persistantes
                return jsonify({"success": False, "message": "Cannot dismiss persistent alerts"})
    
    return jsonify({"success": False})

@app.route('/api/clear_alerts', methods=['POST'])
def clear_alerts():
    global latest_data
    
    # Ne supprimer que les alertes non persistantes
    latest_data["alerts"] = [alert for alert in latest_data["alerts"] if alert.get("persistent", False)]
    return jsonify({"success": True, "alerts": latest_data["alerts"]})

@app.route('/api/update_interval', methods=['POST'])
def update_interval():
    global CONFIG
    data = request.json
    interval = data.get('interval', 60)
    unit = data.get('unit', 'seconds')
    
    if unit == 'minutes':
        interval = interval * 60
    elif unit == 'hours':
        interval = interval * 60 * 60
    elif unit == 'days':
        interval = interval * 60 * 60 * 24
    
    CONFIG["check_interval"] = interval
    return jsonify({"success": True, "interval": CONFIG["check_interval"]})

if __name__ == "__main__":
    # Configuration pour Render
    port = int(os.environ.get('PORT', 5000))
    
    # Forcer l'activation des vérifications DNS sur Render
    if os.environ.get('RENDER') == 'true':
        os.environ['FORCE_DNS_CHECKS'] = 'true'
        logging.info("Forcing DNS checks on Render environment")
    
    # Initialize DNS serial
    if last_dns_serial is None:
        logging.info("Initial DNS serial retrieval...")
        last_dns_serial = get_dns_serial()
        latest_data["version_info"] = last_dns_serial
    
    # Perform first data update
    logging.info("First data update...")
    update_data()
    
    # Start background monitoring
    monitor_thread = threading.Thread(target=monitor_loop)
    monitor_thread.daemon = True
    monitor_thread.start()
    
    # Start ping monitoring
    ping_monitor_thread = threading.Thread(target=ping_monitor_loop)
    ping_monitor_thread.daemon = True
    ping_monitor_thread.start()
    
    # Ne pas ouvrir le navigateur sur Render
    if os.environ.get('RENDER') != 'true':
        webbrowser.open(f'http://localhost:{port}')
    
    # Start web server
    print(f"Web server started at http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)