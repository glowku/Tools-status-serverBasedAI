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
    "history_size": 120,
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
    "use_tcp_ping": os.environ.get('USE_TCP_PING', 'true').lower() == 'true',
    "bfexplorer_api_url": "https://explorer.bf1337.org/api/v1",
    "dns_api_timeout": 10,
    "http_request_timeout": 15,
    "http_retry_attempts": 3,
    "http_retry_delay": 1
}

# Variables globales
check_history = []
previous_results = {}
last_dns_serial = None
ping_history = []
ping_update_interval = 5
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
    "ping_history": [],
    "ip_consistent": False
}

# Variables pour les alertes persistantes
rpc_status_alert = None
server_status_alert = None
last_ip_log_time = 0  # Pour le logging périodique des IP

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
    try:
        start_time = time.time()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        sock.close()
        return (time.time() - start_time) * 1000
    except:
        return None

def ping_host():
    if os.environ.get('RENDER') == 'true' and CONFIG["use_tcp_ping"]:
        try:
            # Ajouter le port RPC (8545) à la liste des ports à tester
            ports = [80, 443, 8545]  # Ajout du port 8545
            results = []
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                futures = [executor.submit(tcp_ping, CONFIG['domain'], port, CONFIG["ping_timeout"]) for port in ports]
                
                for future in concurrent.futures.as_completed(futures):
                    result = future.result()
                    if result is not None:
                        results.append(result)
            
            if results:
                ping_time = min(results)
                return {"status": "success", "time": ping_time}
                
        except Exception as e:
            logging.error(f"TCP ping failed: {str(e)}")
    
    try:
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        command = ['ping', param, '3', CONFIG['domain']]
        response = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if response.returncode == 0:
            time_pattern = r'time[=<](\\d+\\.?\\d*)\\s*ms'
            times = re.findall(time_pattern, response.stdout)
            
            if times:
                times = sorted([float(t) for t in times])
                if len(times) >= 3:
                    ping_time = times[1]
                else:
                    ping_time = times[0]
                
                return {"status": "success", "time": ping_time}
    except Exception as e:
        logging.error(f"System ping failed: {str(e)}")
    
    try:
        start_time = time.time()
        response = requests.get(f"http://{CONFIG['domain']}", timeout=5)
        response_time = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            return {"status": "success", "time": response_time}
        else:
            return {"status": "failed", "message": f"HTTP {response.status_code}"}
            
    except Exception as e2:
        logging.error(f"HTTP ping failed: {str(e2)}")
        return {"status": "error", "message": "All ping methods failed"}

def check_rpc_endpoint():
    rpc_payload = {"jsonrpc": "2.0", "method": "eth_chainId", "params": [], "id": 1}
    
    try:
        start_time = time.time()
        # Réduire le timeout de 15 à 5 secondes
        response = requests.post(
            CONFIG["rpc_url"], 
            json=rpc_payload, 
            timeout=5,  # Changé de 15 à 5
            headers={'User-Agent': 'Mozilla/5.0 (compatible; BasedAI-Monitor/1.0)'}
        )
        response_time = time.time() - start_time
        
        # Ajouter un logging pour le temps de réponse
        logging.info(f"RPC response time: {response_time:.3f} seconds")
        
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
        
        return {"status": "offline", "message": "All RPC endpoints failed"}

def check_ports_alt():
    port_results = {}
    
    if CONFIG["disable_port_checks"]:
        logging.info("Port checks disabled, using default values")
        for port in CONFIG["ports_to_check"]:
            if port in [80, 443]:
                port_results[port] = "open"
            else:
                port_results[port] = "unknown"
        return port_results
    
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
    
    for port in CONFIG["ports_to_check"]:
        if port not in [80, 443]:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(10)
                result = sock.connect_ex((CONFIG["domain"], port))
                sock.close()
                
                if result == 0:
                    port_results[port] = "open"
                else:
                    port_results[port] = "closed"
                    
            except Exception as e:
                logging.error(f"Error checking port {port}: {str(e)}")
                try:
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
    result = {"ip": "N/A", "redirect": "N/A"}
    
    try:
        ip = socket.gethostbyname(CONFIG["main_domain"])
        result["ip"] = ip
    except Exception as e:
        logging.error(f"Error getting main domain IP: {str(e)}")
        result["ip"] = "Error"
    
    max_retries = CONFIG["http_retry_attempts"]
    for attempt in range(max_retries):
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(
                f"http://{CONFIG['main_domain']}", 
                timeout=CONFIG["http_request_timeout"], 
                headers=headers, 
                allow_redirects=True
            )
            
            if response.history:
                final_url = response.url
                if CONFIG["domain"] in final_url:
                    result["redirect"] = f"→ {CONFIG['domain']}"
                else:
                    result["redirect"] = f"→ {final_url}"
                break
            else:
                result["redirect"] = "no redirection"  # Correction: afficher "no redirection" au lieu de "None"
                break
        except requests.exceptions.RequestException as e:
            logging.error(f"Attempt {attempt+1} failed: {str(e)}")
            if attempt == max_retries - 1:
                result["redirect"] = "no redirection"  # Correction: afficher "no redirection" au lieu de "Error"
            time.sleep(CONFIG["http_retry_delay"])
    
    return result

def verify_ip_consistency():
    try:
        subdomain_ip = socket.gethostbyname(CONFIG["domain"])
        main_domain_ip = socket.gethostbyname(CONFIG["main_domain"])
        
        if subdomain_ip == main_domain_ip:
            logging.info(f"IP consistency verified: {subdomain_ip}")
            return True
        else:
            logging.warning(f"IP inconsistency: subdomain={subdomain_ip}, domain={main_domain_ip}")
            return False
    except Exception as e:
        logging.error(f"Error verifying IP consistency: {str(e)}")
        return False

def get_dns_serial():
    global last_dns_serial
    
    force_dns_checks = os.environ.get('FORCE_DNS_CHECKS', 'false').lower() == 'true'
    
    if CONFIG["disable_dns_checks"] and not force_dns_checks:
        logging.info("DNS checks disabled, using default serial")
        today = datetime.now()
        date_serial = today.strftime("%Y%m%d")
        last_dns_serial = date_serial
        return date_serial
    
    try:
        try:
            domain = CONFIG["main_domain"]
            url = f"https://dns.google/resolve?name={domain}&type=SOA"
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            response = requests.get(url, headers=headers, timeout=CONFIG["dns_api_timeout"])
            if response.status_code == 200:
                data = response.json()
                if "Answer" in data:
                    for answer in data["Answer"]:
                        if answer.get("type") == 6:
                            soa_data = answer.get("data", "").split(" ")
                            if len(soa_data) >= 3:
                                serial = soa_data[2]
                                logging.info(f"DNS serial found using Google DNS API: {serial}")
                                last_dns_serial = serial
                                return serial
        except Exception as e:
            logging.error(f"Error with Google DNS API: {str(e)}")
        
        try:
            domain = CONFIG["main_domain"]
            url = f"https://cloudflare-dns.com/dns-query?name={domain}&type=SOA"
            
            headers = {
                "Accept": "application/dns-json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            response = requests.get(url, headers=headers, timeout=CONFIG["dns_api_timeout"])
            if response.status_code == 200:
                data = response.json()
                if "Answer" in data:
                    for answer in data["Answer"]:
                        if answer.get("type") == 6:
                            soa_data = answer.get("data", "").split(" ")
                            if len(soa_data) >= 3:
                                serial = soa_data[2]
                                logging.info(f"DNS serial found using Cloudflare DNS API: {serial}")
                                last_dns_serial = serial
                                return serial
        except Exception as e:
            logging.error(f"Error with Cloudflare DNS API: {str(e)}")
        
        try:
            domain = CONFIG["main_domain"]
            url = f"https://www.whois.com/whois/{domain}"
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            response = requests.get(url, headers=headers, timeout=CONFIG["dns_api_timeout"])
            if response.status_code == 200:
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
                        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                        serial = date_obj.strftime("%Y%m%d")
                        logging.info(f"DNS serial found using Whois API: {serial}")
                        last_dns_serial = serial
                        return serial
        except Exception as e:
            logging.error(f"Error with Whois API: {str(e)}")
        
        try:
            domain = CONFIG["main_domain"]
            url = f"https://jsonwhoisapi.com/api/v1/whois?domainName={domain}"
            
            headers = {
                "Authorization": "Bearer demo",
                "Content-Type": "application/json"
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "WhoisRecord" in data and "registryData" in data["WhoisRecord"]:
                    registry_data = data["WhoisRecord"]["registryData"]
                    
                    if "expirationDate" in registry_data:
                        exp_date = registry_data["expirationDate"]
                        if exp_date:
                            date_obj = datetime.strptime(exp_date.split("T")[0], "%Y-%m-%d")
                            serial = date_obj.strftime("%Y%m%d")
                            logging.info(f"DNS serial found using JSON Whois API: {serial}")
                            last_dns_serial = serial
                            return serial
        except Exception as e:
            logging.error(f"Error with JSON Whois API: {str(e)}")
            
    except Exception as e:
        logging.error(f"Error executing DNS commands: {str(e)}")
    
    today = datetime.now()
    date_serial = today.strftime("%Y%m%d")
    logging.warning(f"All DNS methods failed, using date-based serial: {date_serial}")
    last_dns_serial = date_serial
    return date_serial

def get_txt_records():
    if CONFIG["disable_dns_checks"]:
        logging.info("DNS checks disabled, using default TXT records")
        return []
    
    try:
        url = f"https://dns.google/resolve?name={CONFIG['domain']}&type=TXT"
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=CONFIG["dns_api_timeout"])
        
        if response.status_code == 200:
            data = response.json()
            if "Answer" in data:
                txt_records = []
                for answer in data["Answer"]:
                    if answer.get("type") == 16:
                        txt_value = answer.get("data", '').replace('"', '')
                        txt_records.append(txt_value)
                
                if txt_records:
                    logging.info(f"TXT Records found using Google DNS API: {txt_records}")
                    return txt_records
    except Exception as e:
        logging.error(f"Error with Google DNS API: {str(e)}")
    
    try:
        import dns.resolver
        answers = dns.resolver.resolve(CONFIG["domain"], 'TXT')
        txt_records = [str(rdata).replace('"', '') for rdata in answers]
        if txt_records:
            logging.info(f"TXT Records found using dns.resolver: {txt_records}")
            return txt_records
    except ImportError:
        pass
    except Exception as e:
        logging.error(f"Error with dns.resolver: {str(e)}")
    
    try:
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
                logging.info(f"TXT Records found using nslookup: {txt_records}")
                return txt_records
    except Exception as e:
        logging.error(f"Error with nslookup: {str(e)}")
    
    logging.info("No TXT records found")
    return []

def get_dns_records():
    dns_records = {}
    
    if CONFIG["disable_dns_checks"]:
        logging.info("DNS checks disabled, using default DNS records")
        return {"A": [], "MX": [], "NS": []}
    
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
    try:
        response = requests.get(f"{CONFIG['bfexplorer_api_url']}/stats", timeout=CONFIG["http_request_timeout"])
        if response.status_code == 200:
            data = response.json()
            if "total_transactions" in data:
                total_txns = data["total_transactions"]
                # Formater le nombre de transactions
                if isinstance(total_txns, str):
                    # Si c'est une chaîne comme "94.078K", la convertir en nombre
                    if 'K' in total_txns:
                        total_txns = float(total_txns.replace('K', '')) * 1000
                    elif 'M' in total_txns:
                        total_txns = float(total_txns.replace('M', '')) * 1000000
                    else:
                        total_txns = float(total_txns)
                
                return {
                    "total_txns": total_txns,
                    "formatted_txns": data["total_transactions"],  # Garder le format original pour l'affichage
                    "source": "bfexplorer API"
                }
    except Exception as e:
        logging.error(f"Error with bfexplorer API: {str(e)}")
    
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
    
    if "ping" in current_results and "ping" in previous_results:
        if current_results["ping"]["status"] == "success" and previous_results["ping"]["status"] == "success":
            current_ping = current_results["ping"]["time"]
            previous_ping = previous_results["ping"]["time"]
            
            if abs(current_ping - previous_ping) > 50 and current_ping > previous_ping * 1.2:
                alerts.append({
                    "type": "latency_ping",
                    "message": f"⚠️ Ping latency increased: {previous_ping:.0f}ms → {current_ping:.0f}ms",
                    "severity": "warning"
                })
    
    if "rpc" in current_results and "rpc" in previous_results:
        if current_results["rpc"]["status"] == "online" and previous_results["rpc"]["status"] == "online":
            current_rpc = current_results["rpc"]["response_time"]
            previous_rpc = previous_results["rpc"]["response_time"]
            
            if abs(current_rpc - previous_rpc) > 0.2 and current_rpc > previous_rpc * 1.2:
                alerts.append({
                    "type": "latency_rpc",
                    "message": f"⚠️ RPC latency increased: {previous_rpc:.2f}s → {current_rpc:.2f}s",
                    "severity": "warning"
                })
    
    if "version_info" in current_results and "version_info" in previous_results:
        if current_results["version_info"] != previous_results["version_info"]:
            alerts.append({
                "type": "dns_change",
                "message": f"🔄 DNS change: Serial {previous_results['version_info']} → {current_results['version_info']}",
                "severity": "info"
            })
    
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
    
    if "txt_info" in current_results and "txt_info" in previous_results:
        if current_results["txt_info"] != previous_results["txt_info"]:
            alerts.append({
                "type": "txt_change",
                "message": f"🔄 TXT change: {previous_results['txt_info']} → {current_results['txt_info']}",
                "severity": "info"
            })
    
    if "ip_info" in current_results and "ip_info" in previous_results:
        if current_results["ip_info"] != previous_results["ip_info"]:
            alerts.append({
                "type": "ip_change",
                "message": f"🔄 IP change: {previous_results['ip_info']} → {current_results['ip_info']}",
                "severity": "warning"
            })
    
    if "http_info" in current_results and "http_info" in previous_results:
        if current_results["http_info"] != previous_results["http_info"]:
            alerts.append({
                "type": "http_change",
                "message": f"🔄 HTTP change: {previous_results['http_info']} → {current_results['http_info']}",
                "severity": "info"
            })
    
    if "security_info" in current_results and "security_info" in previous_results:
        if current_results["security_info"] != previous_results["security_info"]:
            alerts.append({
                "type": "security_change",
                "message": f"🔄 Security change: {previous_results['security_info']} → {current_results['security_info']}",
                "severity": "warning"
            })
    
    if "ports" in current_results and "ports" in previous_results:
        for port in CONFIG["ports_to_check"]:
            if port in current_results["ports"] and port in previous_results["ports"]:
                if current_results["ports"][port] != previous_results["ports"][port]:
                    alerts.append({
                        "type": "port_change",
                        "message": f"🔄 Port {port}: {previous_results['ports'][port]} → {current_results['ports'][port]}",
                        "severity": "warning"
                    })
    
    previous_results = current_results.copy()
    
    return alerts

def cleanup_expired_alerts():
    global latest_data
    current_time = time.time()
    
    if "alerts" in latest_data:
        latest_data["alerts"] = [
            alert for alert in latest_data["alerts"] 
            if (current_time - alert.get("timestamp", 0) < 1800 or
                alert.get("type") in ["rpc_status", "server_status"])
        ]
        
        if len(latest_data["alerts"]) > 10:
            latest_data["alerts"] = latest_data["alerts"][-10:]

def update_data():
    global latest_data, check_history, rpc_status_alert, server_status_alert, last_ip_log_time
    
    current_time_seconds = time.time()
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    logging.info(f"Starting data update at {timestamp_str}")
    
    cleanup_expired_alerts()
    
    # Log IP resolution une fois par minute
    if current_time_seconds - last_ip_log_time > 60:
        try:
            domain_ip = socket.gethostbyname(CONFIG['domain'])
            logging.info(f"Ping domain: {CONFIG['domain']}, resolved IP: {domain_ip}")
            
            from urllib.parse import urlparse
            parsed_url = urlparse(CONFIG["rpc_url"])
            rpc_domain = parsed_url.netloc
            rpc_ip = socket.gethostbyname(rpc_domain)
            logging.info(f"RPC domain: {rpc_domain}, resolved IP: {rpc_ip}")
            
            last_ip_log_time = current_time_seconds
        except Exception as e:
            logging.error(f"Error resolving domains: {str(e)}")
    
    try:
        rpc_result = check_rpc_endpoint()
    except Exception as e:
        logging.error(f"Error checking RPC: {str(e)}")
        rpc_result = {"status": "error", "message": str(e)}
    
    rpc_status = rpc_result.get("status", "offline")
    
    try:
        port_results = check_ports_alt()
    except Exception as e:
        logging.error(f"Error checking ports: {str(e)}")
        port_results = {}
    
    try:
        ping_result = ping_host()
    except Exception as e:
        logging.error(f"Error checking ping: {str(e)}")
        ping_result = {"status": "error", "message": str(e)}
    
    ping_status = ping_result.get("status", "error")
    
    essential_services = [rpc_status, ping_status]
    if any(status in ["online", "success"] for status in essential_services):
        server_status = "online"
    else:
        server_status = "offline"
    
    if rpc_status_alert is None:
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
        if rpc_status == "online":
            rpc_status_alert["severity"] = "info"
            rpc_status_alert["message"] = "✅ RPC Status: online"
            rpc_status_alert["end_time"] = None
            rpc_status_alert["start_time"] = None
        else:
            if rpc_status_alert.get("severity") == "info":
                rpc_status_alert["start_time"] = current_time_seconds
                rpc_status_alert["end_time"] = None
            rpc_status_alert["severity"] = "warning"
            rpc_status_alert["message"] = f"⚠️ RPC is down since {datetime.fromtimestamp(current_time_seconds).strftime('%Y-%m-%d %H:%M:%S')}"
        
        rpc_status_alert["timestamp"] = current_time_seconds
    
    if server_status_alert is None:
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
        if server_status == "online":
            server_status_alert["severity"] = "info"
            server_status_alert["message"] = "✅ Server Status: online"
            server_status_alert["end_time"] = None
            server_status_alert["start_time"] = None
        else:
            if server_status_alert.get("severity") == "info":
                server_status_alert["start_time"] = current_time_seconds
                server_status_alert["end_time"] = None
            server_status_alert["severity"] = "warning"
            server_status_alert["message"] = f"⚠️ Server is down since {datetime.fromtimestamp(current_time_seconds).strftime('%Y-%m-%d %H:%M:%S')}"
        
        server_status_alert["timestamp"] = current_time_seconds
    
    try:
        ip_info = get_ip_info()
    except Exception as e:
        logging.error(f"Error getting IP info: {str(e)}")
        ip_info = "Error"
    
    try:
        http_info = get_http_info()
    except Exception as e:
        logging.error(f"Error getting HTTP info: {str(e)}")
        http_info = "Error"
    
    try:
        security_info = get_security_info()
    except Exception as e:
        logging.error(f"Error getting security info: {str(e)}")
        security_info = "Error"
    
    try:
        ssl_info = get_ssl_info()
    except Exception as e:
        logging.error(f"Error getting SSL info: {str(e)}")
        ssl_info = {"error": str(e)}
    
    try:
        if current_time_seconds - (latest_data.get("last_dns_check", 0)) > CONFIG["dns_check_interval"]:
            version_info = get_dns_serial()
            latest_data["last_dns_check"] = current_time_seconds
        else:
            version_info = latest_data.get("version_info", "N/A")
    except Exception as e:
        logging.error(f"Error getting DNS version: {str(e)}")
        version_info = "Error"
    
    try:
        txt_info = get_txt_records()
    except Exception as e:
        logging.error(f"Error getting TXT records: {str(e)}")
        txt_info = []
    
    try:
        dns_records = get_dns_records()
    except Exception as e:
        logging.error(f"Error getting DNS records: {str(e)}")
        dns_records = {}
    
    try:
        network_info = get_network_info()
    except Exception as e:
        logging.error(f"Error getting network info: {str(e)}")
        network_info = {}
    
    try:
        transactions_info = get_latest_transactions()
    except Exception as e:
        logging.error(f"Error getting transactions: {str(e)}")
        transactions_info = {"error": str(e)}
    
    try:
        main_domain_info = get_main_domain_info()
    except Exception as e:
        logging.error(f"Error getting main domain info: {str(e)}")
        main_domain_info = {"ip": "Error", "redirect": "Error"}
    
    try:
        ip_consistent = verify_ip_consistency()
    except Exception as e:
        logging.error(f"Error verifying IP consistency: {str(e)}")
        ip_consistent = False
    
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
        "ip_consistent": ip_consistent,
        "timestamp": timestamp_str
    }
    
    try:
        new_alerts = detect_changes(current_results)
        for alert in new_alerts:
            alert["timestamp"] = current_time_seconds
        alerts = new_alerts
    except Exception as e:
        logging.error(f"Error detecting changes: {str(e)}")
        alerts = []
    
    if "alerts" not in latest_data:
        latest_data["alerts"] = []
    
    existing_messages = [
        alert["message"] for alert in latest_data["alerts"] 
        if current_time_seconds - alert.get("timestamp", 0) < 300
        and not alert.get("persistent", False)
    ]
    
    for alert in alerts:
        if alert["message"] not in existing_messages:
            latest_data["alerts"].append(alert)
    
    latest_data.update({
        "server_status": server_status,
        "rpc_status": rpc_status,
        "ping_status": ping_status,
        "ping_value": ping_result.get("time", 0) if ping_status == "success" else None,
        # Convertir le temps de réponse RPC en millisecondes
        "rpc_value": rpc_result.get("response_time", 0) * 1000 if rpc_status == "online" else None,
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
        "ip_consistent": ip_consistent,
        "last_check": timestamp_str,
        "alerts": latest_data["alerts"]
    })
    
    logging.info(f"Data updated with {len(latest_data['alerts'])} alerts")
    
    check_history.append({
        "ping": ping_result.get("time", 0),
        "rpc": rpc_result.get("response_time", 0) * 1000 if rpc_status == "online" else None,
        "timestamp": timestamp_str
    })
    
    if len(check_history) > CONFIG["history_size"]:
        check_history.pop(0)
    
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
        
        latest_data["ping_status"] = ping_result.get("status", "error")
        latest_data["ping_value"] = ping_result.get("time", 0) if ping_result.get("status") == "success" else None
        
        ping_history.append({
            "ping": ping_result.get("time", 0),
            "timestamp": timestamp
        })
        
        if len(ping_history) > 20:
            ping_history.pop(0)
        
        latest_data["ping_history"] = ping_history.copy()
        
        time.sleep(ping_update_interval)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    return jsonify(latest_data)

if __name__ == '__main__':
    monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
    monitor_thread.start()
    
    ping_thread = threading.Thread(target=ping_monitor_loop, daemon=True)
    ping_thread.start()
    
    update_data()
    
    app.run(host='0.0.0.0', port=CONFIG["web_port"], debug=False)