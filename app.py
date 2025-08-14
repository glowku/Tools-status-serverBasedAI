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

# Configuration
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
    "history_size": 5,
    "web_port": 5000,
    "fallback_rpc_urls": [
        "https://eth.public-rpc.com",
        "https://rpc.ankr.com/eth",
        "https://cloudflare-eth.com"
    ],
    # Ajout d'une option pour désactiver les vérifications DNS
    "disable_dns_checks": os.environ.get('DISABLE_DNS_CHECKS', 'false').lower() == 'true'
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

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def check_rpc_endpoint():
    rpc_payload = {"jsonrpc": "2.0", "method": "eth_chainId", "params": [], "id": 1}
    
    # Essayer d'abord avec l'URL principale
    try:
        start_time = time.time()
        response = requests.post(
            CONFIG["rpc_url"], 
            json=rpc_payload, 
            timeout=10
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
                return {"status": "offline", "message": "Invalid RPC response"}
        else:
            return {"status": "offline", "code": response.status_code}
            
    except requests.exceptions.RequestException as e:
        logging.error(f"RPC request failed: {str(e)}")
        
        # Essayer avec les URLs de secours
        for fallback_url in CONFIG["fallback_rpc_urls"]:
            try:
                start_time = time.time()
                response = requests.post(
                    fallback_url, 
                    json=rpc_payload, 
                    timeout=10
                )
                response_time = time.time() - start_time
                
                if response.status_code == 200:
                    result = response.json()
                    if "result" in result:
                        return {
                            "status": "online",
                            "chain_id": result["result"],
                            "response_time": response_time,
                            "source": fallback_url
                        }
            except requests.exceptions.RequestException:
                continue
        
        # Si toutes les tentatives échouent
        return {"status": "offline", "message": str(e)}
def check_ports():
    port_results = {}
    
    for port in CONFIG["ports_to_check"]:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((CONFIG["domain"], port))
            sock.close()
            
            if result == 0:
                port_results[port] = "open"
            else:
                port_results[port] = "closed"
                
        except Exception as e:
            port_results[port] = "error"
    
    return port_results

def ping_host():
    try:
        # Essayer d'abord avec le domaine
        param = '-n' if os.name == 'nt' else '-c'
        command = ['ping', param, '1', CONFIG["domain"]]
        response = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if response.returncode == 0:
            # Chercher les temps dans la réponse
            time_patterns = [
                r'Temps.*?=(\d+)ms',
                r'Time.*?=(\d+)ms',
                r'time[=<](\d+)ms',
                r'time=(\d+)ms',
                r'<(\d+)ms',
                r'=(\d+)ms'
            ]
            
            for pattern in time_patterns:
                matches = re.findall(pattern, response.stdout)
                if matches:
                    last_ping = float(matches[-1])
                    if last_ping > 0:
                        return {"status": "success", "time": last_ping}
            
            # Si aucun temps trouvé, chercher la moyenne
            patterns = [
                r'Moyenne = (\d+)ms',
                r'Average = (\d+)ms',
                r'rtt min/avg/max/mdev = [\d.]+/([\d.]+)/[\d.]+/[\d.]+ ms',
                r'Avg = (\d+)ms',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, response.stdout)
                if match:
                    avg_ping = float(match.group(1))
                    if avg_ping > 0:
                        return {"status": "success", "time": avg_ping}
            
            return {"status": "error", "message": "No ping time found in output"}
        else:
            return {"status": "failed", "error": "Ping command failed"}
            
    except Exception as e:
        logging.error(f"Error in ping_host: {str(e)}")
        return {"status": "error", "message": str(e)}


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
            return f"No security headers | {cert_info}"
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
    
    try:
        response = requests.get(f"http://{CONFIG['main_domain']}", timeout=5, allow_redirects=True)
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
    
    # Si les vérifications DNS sont désactivées, retourner une valeur par défaut
    if CONFIG["disable_dns_checks"]:
        logging.info("DNS checks disabled, using default serial")
        today = datetime.now()
        date_serial = today.strftime("%Y%m%d")
        last_dns_serial = date_serial
        return date_serial
    
    try:
        # Try using Python's socket.getaddrinfo instead of nslookup
        try:
            import dns.resolver
            answers = dns.resolver.resolve(CONFIG["domain"], 'SOA')
            for rdata in answers:
                if hasattr(rdata, 'serial'):
                    serial = str(rdata.serial)
                    logging.info(f"DNS serial found using dns.resolver: {serial}")
                    last_dns_serial = serial
                    return serial
        except ImportError:
            pass
        except Exception as e:
            logging.error(f"Error with dns.resolver: {str(e)}")
        
        # Fallback to nslookup
        command = ['nslookup', '-type=SOA', CONFIG["domain"]]
        response = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if response.returncode == 0:
            patterns = [
                r'serial\s*=\s*(\d+)',
                r'serial\s*(\d+)',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, response.stdout)
                if match:
                    serial = match.group(1)
                    logging.info(f"DNS serial found: {serial}")
                    last_dns_serial = serial
                    return serial
            
            serial_match = re.search(r'\b(\d{10})\b', response.stdout)
            if serial_match:
                serial = serial_match.group(1)
                logging.info(f"DNS serial found (10 digits format): {serial}")
                last_dns_serial = serial
                return serial
            
            logging.error("DNS serial not found in nslookup output")
            # If we can't find DNS serial, generate one based on current date
            today = datetime.now()
            date_serial = today.strftime("%Y%m%d")
            logging.info(f"Generated DNS serial based on current date: {date_serial}")
            last_dns_serial = date_serial
            return date_serial
        else:
            logging.error(f"nslookup command failed: {response.stderr}")
            # If nslookup fails, generate one based on current date
            today = datetime.now()
            date_serial = today.strftime("%Y%m%d")
            logging.info(f"Generated DNS serial based on current date: {date_serial}")
            last_dns_serial = date_serial
            return date_serial
    except Exception as e:
        logging.error(f"Error executing nslookup: {str(e)}")
        # If there's an exception, generate one based on current date
        today = datetime.now()
        date_serial = today.strftime("%Y%m%d")
        logging.info(f"Generated DNS serial based on current date: {date_serial}")
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
    
    # Check for ping latency changes
    if "ping" in current_results and "ping" in previous_results:
        if current_results["ping"]["status"] == "success" and previous_results["ping"]["status"] == "success":
            current_ping = current_results["ping"]["time"]
            previous_ping = previous_results["ping"]["time"]
            
            if current_ping > previous_ping * (1 + CONFIG["latency_threshold"]):
                alerts.append({
                    "type": "latency_ping",
                    "message": f"⚠️ Ping latency increased: {previous_ping:.2f}ms → {current_ping:.2f}ms",
                    "severity": "warning"
                })
    
    # Check for RPC latency changes
    if "rpc" in current_results and "rpc" in previous_results:
        if current_results["rpc"]["status"] == "online" and previous_results["rpc"]["status"] == "online":
            current_rpc = current_results["rpc"]["response_time"]
            previous_rpc = previous_results["rpc"]["response_time"]
            
            if current_rpc > previous_rpc * (1 + CONFIG["latency_threshold"]):
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
    
    # Check for RPC status changes
    if "rpc" in current_results and "rpc" in previous_results:
        if current_results["rpc"]["status"] != previous_results["rpc"]["status"]:
            alerts.append({
                "type": "rpc_change",
                "message": f"🔄 RPC: {previous_results['rpc']['status']} → {current_results['rpc']['status']}",
                "severity": "critical"
            })
    
    # Check for SSL changes
    if "ssl_info" in current_results and "ssl_info" in previous_results:
        current_days = current_results["ssl_info"].get("days_left", "N/A")
        previous_days = previous_results["ssl_info"].get("days_left", "N/A")
        
        if current_days != "N/A" and previous_days != "N/A":
            if current_days < 30 and previous_days >= 30:
                alerts.append({
                    "type": "ssl_expiry_warning",
                    "message": f"⚠️ SSL certificate expires in {current_days} days",
                    "severity": "warning"
                })
            elif current_days < 7 and previous_days >= 7:
                alerts.append({
                    "type": "ssl_expiry_critical",
                    "message": f"🚨 SSL certificate expires in {current_days} days",
                    "severity": "critical"
                })
    
    # Update previous results
    previous_results = current_results.copy()
    
    return alerts

def update_data():
    global latest_data, check_history
    
    current_time = time.time()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    logging.info(f"Starting data update at {timestamp}")
    
    # Check RPC
    try:
        rpc_result = check_rpc_endpoint()
    except Exception as e:
        logging.error(f"Error checking RPC: {str(e)}")
        rpc_result = {"status": "error", "message": str(e)}
    
    rpc_status = rpc_result.get("status", "offline")
    
    # Check ports
    try:
        port_results = check_ports()
    except Exception as e:
        logging.error(f"Error checking ports: {str(e)}")
        port_results = {}
    
    # Check ping
    try:
        ping_result = ping_host()
    except Exception as e:
        logging.error(f"Error checking ping: {str(e)}")
        ping_result = {"status": "error", "message": str(e)}
    
    ping_status = ping_result.get("status", "error")
    
    # Déterminer le statut global du serveur
    # Le serveur est considéré en ligne si au moins un des services essentiels fonctionne
    essential_services = [rpc_status, ping_status]
    if any(status in ["online", "success"] for status in essential_services):
        server_status = "online"
    else:
        server_status = "offline"
    
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
        if current_time - (latest_data.get("last_dns_check", 0)) > CONFIG["dns_check_interval"]:
            version_info = get_dns_serial()
            latest_data["last_dns_check"] = current_time
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
    
    # Detect changes and anomalies
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
        "timestamp": timestamp
    }
    
    try:
        alerts = detect_changes(current_results)
    except Exception as e:
        logging.error(f"Error detecting changes: {str(e)}")
        alerts = []
    
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
        "last_check": timestamp,
        "alerts": alerts
    })
    
    logging.info(f"Data updated with {len(alerts)} alerts")
    
    # Add to history
    check_history.append({
        "ping": ping_result.get("time", 0),
        "rpc": rpc_result.get("response_time", 0) if rpc_status == "online" else None,
        "timestamp": timestamp
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
    
    # Open browser
    webbrowser.open(f'http://localhost:{CONFIG["web_port"]}')
    
    # Start web server
    print(f"Web server started at http://localhost:{CONFIG['web_port']}")
    app.run(host='0.0.0.0', port=CONFIG["web_port"], debug=False)


if __name__ == "__main__":
    # Configuration pour Render
    port = int(os.environ.get('PORT', 5000))
    
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