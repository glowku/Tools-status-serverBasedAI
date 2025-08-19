document.addEventListener('DOMContentLoaded', function() {
    // Initialize Three.js background with particles and rotating cube
    initThreeJSBackground();
    
    // Handle menu navigation
    document.getElementById('easy-node-button').addEventListener('click', function() {
        window.location.href = 'https://based-node-installer.onrender.com/index.html';
    });
    document.getElementById('monitor-button').addEventListener('click', function() {
        window.location.href = 'https://based-node-installer.onrender.com/monitor.html';
    });
    document.getElementById('status-button').addEventListener('click', function() {
        window.location.href = 'https://tools-status-serverbasedai.onrender.com/';
    });
    
    // Handle menu visibility on scroll
    const menuBar = document.getElementById('menu-bar');
    let lastScrollTop = 0;
    let scrollTimeout;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Clear the timeout
        clearTimeout(scrollTimeout);
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            menuBar.classList.add('hidden');
        } else {
            // Scrolling up or at top
            menuBar.classList.remove('hidden');
        }
        
        // Set a timeout to show the menu if the user stops scrolling
        scrollTimeout = setTimeout(function() {
            if (scrollTop <= 100) {
                menuBar.classList.remove('hidden');
            }
        }, 1000);
        
        lastScrollTop = scrollTop;
    });
    
    // Initialize latency chart
    const ctx = document.getElementById('latency-chart').getContext('2d');
    
    // Fonction pour ajuster dynamiquement l'échelle
    function adjustChartScale() {
        // Récupérer toutes les valeurs de ping valides
        const pingValues = latencyChart.data.datasets[0].data.filter(v => v !== null && v > 0);
        const rpcValues = latencyChart.data.datasets[1].data.filter(v => v !== null && v > 0);
        const allValues = [...pingValues, ...rpcValues];
        
        if (allValues.length === 0) return;
        
        // Calculer min et max avec une marge
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        
        // Ajouter une marge de 20% pour une meilleure visualisation
        const margin = (maxValue - minValue) * 0.2;
        const adjustedMin = Math.max(0, minValue - margin);
        const adjustedMax = maxValue + margin;
        
        // S'assurer que l'échelle minimale est au moins de 10ms pour les valeurs normales
        const finalMin = Math.min(adjustedMin, 10);
        const finalMax = Math.max(adjustedMax, 100);
        
        // Appliquer la nouvelle échelle
        latencyChart.options.scales.y.min = finalMin;
        latencyChart.options.scales.y.max = finalMax;
        latencyChart.update('none'); // Mettre à jour sans animation
    }
    
    // Configuration du graphique
    const latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Ping (ms)',
                    data: [],
                    borderColor: '#00ff00',
                    backgroundColor: 'rgba(0, 255, 0, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'RPC (ms)',
                    data: [],
                    borderColor: '#ffff00',
                    backgroundColor: 'rgba(255, 255, 0, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Latency (ms)',
                        color: '#00ffff',
                        font: {
                            size: 12,
                            family: "'Orbitron', monospace"
                        }
                    },
                    grid: {
                        color: 'rgba(0, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#00ffff',
                        font: {
                            family: "'Orbitron', monospace"
                        },
                        callback: function(value) {
                            // Afficher en ms sans décimales pour plus de clarté
                            return Math.round(Number(value)) + ' ms';
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#00ffff',
                        font: {
                            family: "'Orbitron', monospace"
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#00ffff',
                        font: {
                            family: "'Orbitron', monospace"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#00ffff',
                    bodyColor: '#ffffff',
                    borderColor: '#00ffff',
                    borderWidth: 1,
                    titleFont: {
                        family: "'Orbitron', monospace"
                    },
                    bodyFont: {
                        family: "'Orbitron', monospace"
                    },
                    callbacks: {
                        label: function(context) {
                            // Afficher en ms sans décimales pour plus de clarté
                            return context.dataset.label + ': ' + Math.round(Number(context.parsed.y)) + ' ms';
                        }
                    }
                }
            }
        }
    });
    
    // Variable to store update interval
    let updateInterval;
    let pingUpdateInterval;
    let chartUpdateInterval = 2000; // Default ping chart update interval (2 seconds)
    let timeUpdateInterval; // Pour la mise à jour de l'heure toutes les minutes
    
    // Handle update interval
    document.getElementById('apply-interval').addEventListener('click', function() {
        const unit = document.getElementById('interval-unit').value;
        
        // Valeurs par défaut pour chaque unité
        const defaultValues = {
            'seconds': 2,    // 2 secondes
            'minutes': 1,    // 1 minute
            'hours': 1,      // 1 heure
            'days': 1        // 1 jour
        };
        
        const defaultValue = defaultValues[unit];
        
        // Calculer l'intervalle en millisecondes
        let intervalMs;
        if (unit === 'seconds') {
            intervalMs = defaultValue * 1000;
        } else if (unit === 'minutes') {
            intervalMs = defaultValue * 60 * 1000;
        } else if (unit === 'hours') {
            intervalMs = defaultValue * 60 * 60 * 1000;
        } else if (unit === 'days') {
            intervalMs = defaultValue * 24 * 60 * 60 * 1000;
        }
        
        // Mettre à jour l'intervalle de mise à jour du graphique
        chartUpdateInterval = intervalMs;
        
        // Effacer l'intervalle existant et en créer un nouveau
        if (pingUpdateInterval) {
            clearInterval(pingUpdateInterval);
        }
        
        // Créer le nouvel intervalle
        pingUpdateInterval = setInterval(updatePingChart, chartUpdateInterval);
        
        // Afficher un message de confirmation
        const applyButton = document.getElementById('apply-interval');
        const originalText = applyButton.textContent;
        applyButton.textContent = 'Applied!';
        applyButton.style.background = 'rgba(0, 255, 0, 0.3)';
        
        setTimeout(() => {
            applyButton.textContent = originalText;
            applyButton.style.background = 'rgba(0, 255, 255, 0.2)';
        }, 2000);
        
        console.log("Chart update interval changed to:", intervalMs, "ms");
        
        // Forcer une mise à jour immédiate du graphique
        updatePingChart();
        
        // Forcer un redessin complet du graphique après un court délai
        setTimeout(() => {
            if (latencyChart) {
                // Méthode plus radicale pour forcer la mise à jour
                latencyChart.data.labels = latencyChart.data.labels.slice();
                latencyChart.data.datasets[0].data = latencyChart.data.datasets[0].data.slice();
                latencyChart.data.datasets[1].data = latencyChart.data.datasets[1].data.slice();
                latencyChart.update('active');
                console.log("Chart forcefully redrawn");
            }
        }, 100);
    });
    
    // Function to update a status
    function updateStatus(elementId, status) {
        const element = document.getElementById(elementId);
        element.textContent = status;
        element.className = 'status-value';
        
        if (status === 'online' || status === 'success') {
            element.classList.add('online');
        } else if (status === 'offline' || status === 'failed') {
            element.classList.add('offline');
        } else if (status === 'warning') {
            element.classList.add('warning');
        } else if (status === 'error') {
            element.classList.add('error');
        }
    }
    
    // Modifiez la fonction updatePorts() pour mieux gérer les données manquantes
    function updatePorts(ports) {
        const container = document.getElementById('ports-status');
        container.innerHTML = '';
        
        if (!ports || Object.keys(ports).length === 0) {
            container.innerHTML = '<div class="no-ports">No port data available</div>';
            return;
        }
        
        for (const [port, status] of Object.entries(ports)) {
            const portElement = document.createElement('div');
            portElement.className = `port-item ${status}`;
            portElement.textContent = `${port}: ${status}`;
            container.appendChild(portElement);
        }
    }
    
    // Informations du dernier bloc connu
    const lastKnownBlock = {
        height: 1952248,
        size: 518,
        timestamp: "2025-08-12T05:42:20+02:00"
    };
    
    // Convertir le timestamp en objet Date
    const lastBlockDate = new Date(lastKnownBlock.timestamp);
    
    // Variables pour le suivi de la panne RPC - MODIFIÉ
    const rpcDowntimeStart = new Date("2025-08-10T22:43:00+02:00"); // Date du premier down de transaction
    let rpcDowntimeAlert = null;
    let blockDowntimeAlert = null;
    
    // Stockage des alertes existantes pour les mettre à jour plutôt que de les remplacer
    let existingAlerts = [];
    
    // Système de cache intelligent pour les données du graphique
    let chartDataCache = {
        raw: [],      // Données brutes (toutes les entrées)
        minute: [],   // Données agrégées par minute
        hour: [],     // Données agrégées par heure
        day: []       // Données agrégées par jour
    };
    
    // Variable pour stocker le dernier nombre de transactions
    let lastTxCount = 0;
    
    // Fonction pour formater la durée en jours, heures, minutes, secondes
    function formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        const remainingHours = hours % 24;
        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;
        
        let result = '';
        if (days > 0) result += `${days} day${days > 1 ? 's' : ''} `;
        if (remainingHours > 0) result += `${remainingHours} hour${remainingHours > 1 ? 's' : ''} `;
        if (remainingMinutes > 0) result += `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} `;
        if (remainingSeconds > 0 || result === '') result += `${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
        
        return result.trim();
    }
    
    // Fonction pour mettre à jour les alertes - CORRIGÉE
    function updateAlerts(alerts, rpcStatus, serverStatus) {
        const container = document.getElementById('alerts-container');
        
        // Réinitialiser le conteneur
        container.innerHTML = '';
        
        // Ajouter un titre si nécessaire
        const title = document.createElement('div');
        title.className = 'alerts-title';
        title.textContent = 'System Alerts';
        container.appendChild(title);
        
        // Filtrer les alertes pour supprimer toutes les alertes RPC et de bloc
        const filteredAlerts = alerts.filter(alert => {
            // Supprimer toutes les alertes de type RPC
            if (alert.type === 'RPC') {
                return false;
            }
            
            // Supprimer toutes les alertes de type Block
            if (alert.type === 'Block') {
                return false;
            }
            
            return true;
        });
        
        // Afficher les alertes restantes
        if (filteredAlerts.length === 0) {
            container.innerHTML = '<div class="no-alerts">No alerts</div>';
        } else {
            filteredAlerts.forEach(alert => {
                const alertElement = document.createElement('div');
                alertElement.className = `alert-item ${alert.severity}`;
                
                // Déterminer l'icône
                let iconClass = 'info';
                if (alert.severity === 'warning') {
                    iconClass = 'exclamation-triangle';
                } else if (alert.severity === 'critical') {
                    iconClass = 'times-circle';
                }
                
                // Corriger l'affichage des valeurs de latence dans les alertes
                let message = alert.message;
                
                // Remplacer les valeurs de latence RPC incorrectes
                message = message.replace(/(\d+\.\d+)s/g, function(match, p1) {
                    const seconds = parseFloat(p1);
                    const ms = Math.round(seconds * 1000);
                    return `${ms}ms`;
                });
                
                alertElement.innerHTML = `
                    <div class="alert-header">
                        <div class="alert-icon ${alert.severity}">
                            <i class="fas fa-${iconClass}"></i>
                        </div>
                        <div class="alert-type">${alert.type}</div>
                    </div>
                    <div class="alert-content">
                        <div class="alert-message">${message}</div>
                    </div>
                `;
                
                container.appendChild(alertElement);
            });
        }
    }
    
    // Fonction pour mettre à jour les compteurs de durée de panne en temps réel
    function updateDowntimeCounters() {
        // Compteurs RPC
        const rpcCounters = document.querySelectorAll('.rpc-downtime-duration');
        rpcCounters.forEach(counter => {
            const startTime = parseInt(counter.getAttribute('data-start'));
            const now = Date.now();
            const duration = now - startTime;
            
            counter.textContent = `Downtime: ${formatDuration(duration)}`;
        });
        
        // Compteurs Bloc
        const blockCounters = document.querySelectorAll('.block-downtime-duration');
        blockCounters.forEach(counter => {
            const startTime = parseInt(counter.getAttribute('data-start'));
            const now = Date.now();
            const duration = now - startTime;
            
            counter.textContent = `Downtime: ${formatDuration(duration)}`;
        });
        
        // Continuer à mettre à jour toutes les secondes
        setTimeout(updateDowntimeCounters, 1000);
    }
    
    // Fonction pour ajouter des données au cache intelligent
    function addToChartDataCache(data) {
        // Ajouter aux données brutes
        chartDataCache.raw.push(data);
        
        // Nettoyer les données anciennes (plus de 7 jours)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        chartDataCache.raw = chartDataCache.raw.filter(item => 
            new Date(item.timestamp).getTime() > sevenDaysAgo
        );
        
        // Agréger par minute
        aggregateChartData('minute');
        
        // Agréger par heure
        aggregateChartData('hour');
        
        // Agréger par jour
        aggregateChartData('day');
    }
    
    // Fonction pour agréger les données selon une granularité
    function aggregateChartData(granularity) {
        const cache = chartDataCache[granularity];
        const raw = chartDataCache.raw;
        
        // Vider le cache actuel
        chartDataCache[granularity] = [];
        
        // Grouper les données par période
        const groups = {};
        
        raw.forEach(item => {
            const date = new Date(item.timestamp);
            let key;
            
            switch(granularity) {
                case 'minute':
                    key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
                    break;
                case 'hour':
                    key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:00`;
                    break;
                case 'day':
                    key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                    break;
            }
            
            if (!groups[key]) {
                groups[key] = {
                    timestamp: item.timestamp,
                    pingValues: [],
                    rpcValues: []
                };
            }
            
            if (item.ping !== null && item.ping !== undefined) {
                groups[key].pingValues.push(item.ping);
            }
            
            if (item.rpc !== null && item.rpc !== undefined) {
                groups[key].rpcValues.push(item.rpc);
            }
        });
        
        // Calculer les moyennes pour chaque groupe
        for (const key in groups) {
            const group = groups[key];
            
            // Calculer la moyenne des pings
            let pingAvg = null;
            if (group.pingValues.length > 0) {
                pingAvg = group.pingValues.reduce((sum, val) => sum + val, 0) / group.pingValues.length;
            }
            
            // Calculer la moyenne des RPC
            let rpcAvg = null;
            if (group.rpcValues.length > 0) {
                rpcAvg = group.rpcValues.reduce((sum, val) => sum + val, 0) / group.rpcValues.length;
            }
            
            chartDataCache[granularity].push({
                timestamp: group.timestamp,
                ping: pingAvg,
                rpc: rpcAvg
            });
        }
        
        // Trier par timestamp
        chartDataCache[granularity].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
    }
    
    // Fonction pour obtenir les données du graphique selon la granularité sélectionnée
    function getChartDataForGranularity(granularity) {
        // Déterminer la quantité de données à retourner selon la granularité
        let maxDataPoints;
        switch(granularity) {
            case 'seconds':
                maxDataPoints = 30; // 30 minutes de données (une point par seconde)
                break;
            case 'minutes':
                maxDataPoints = 60; // 60 minutes de données (une point par minute)
                break;
            case 'hours':
                maxDataPoints = 24; // 24 heures de données (une point par heure)
                break;
            case 'days':
                maxDataPoints = 7;  // 7 jours de données (une point par jour)
                break;
            default:
                maxDataPoints = 30;
        }
        
        // Sélectionner la source de données selon la granularité
        let dataSource;
        switch(granularity) {
            case 'seconds':
                dataSource = chartDataCache.raw;
                break;
            case 'minutes':
                dataSource = chartDataCache.minute;
                break;
            case 'hours':
                dataSource = chartDataCache.hour;
                break;
            case 'days':
                dataSource = chartDataCache.day;
                break;
            default:
                dataSource = chartDataCache.raw;
        }
        
        // Limiter le nombre de points de données
        if (dataSource.length > maxDataPoints) {
            return dataSource.slice(dataSource.length - maxDataPoints);
        }
        
        return dataSource;
    }
    
    // Fonction pour afficher des notifications
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animation d'apparition
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Disparaître après 3 secondes
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Fonction pour formater la date en heure locale
    function formatLocalDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            let date;
            if (typeof dateString === 'string') {
                date = new Date(dateString);
            } else {
                date = dateString;
            }
            
            // Vérifier si la date est valide
            if (isNaN(date.getTime())) return 'N/A';
            
            // Formater en heure locale
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch (e) {
            console.error('Error formatting date:', e);
            return dateString;
        }
    }
    
    // Fonction pour formater les étiquettes du graphique en fonction de l'unité sélectionnée
    function formatChartLabel(dateString, unit, index, totalLabels) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            // Vérifier si la date est valide
            if (isNaN(date.getTime())) return 'N/A';
            
            // Formater en fonction de l'unité sélectionnée
            if (unit === 'seconds') {
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                return `${hours}:${minutes}:${seconds}`;
            } else if (unit === 'minutes') {
                // Pour les minutes, afficher seulement une étiquette par minute unique
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${hours}:${minutes}`;
            } else if (unit === 'hours') {
                // Pour les heures, afficher seulement une étiquette par heure unique
                const hours = String(date.getHours()).padStart(2, '0');
                return `${hours}:00`;
            } else if (unit === 'days') {
                // Pour les jours, afficher seulement une étiquette par jour unique
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${month}-${day}`;
            }
            
            // Format par défaut (secondes)
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        } catch (e) {
            console.error('Error formatting chart label:', e);
            return dateString;
        }
    }
    
    // Fonction pour mettre à jour l'heure actuelle
    function updateCurrentTime() {
        const now = new Date();
        
        // Obtenir l'heure locale
        const localYear = now.getFullYear();
        const localMonth = String(now.getMonth() + 1).padStart(2, '0');
        const localDay = String(now.getDate()).padStart(2, '0');
        const localHours = String(now.getHours()).padStart(2, '0');
        const localMinutes = String(now.getMinutes()).padStart(2, '0');
        const localSeconds = String(now.getSeconds()).padStart(2, '0');
        
        // Afficher l'heure locale
        const localTimeString = `${localYear}-${localMonth}-${localDay} ${localHours}:${localMinutes}:${localSeconds}`;
        
        // Mettre à jour l'élément avec l'heure locale
        document.getElementById('last-check').textContent = localTimeString;
    }
    
    // Function to update ping chart in real-time
    function updatePingChart() {
        console.log("Updating ping chart with interval:", chartUpdateInterval, "ms");
        
        fetch('/api/data')
            .then(response => response.json())
            .then(data => {
                // Mettre à jour les valeurs de ping en temps réel
                if (data.ping_value !== null && data.ping_value !== undefined && data.ping_value > 0) {
                    document.getElementById('ping-metric').textContent = `${Math.round(data.ping_value)} ms`;
                } else {
                    // Si pas de valeur valide, afficher "No data"
                    document.getElementById('ping-metric').textContent = 'No data';
                }
                
                // Mettre à jour le statut
                updateStatus('ping-status', data.ping_status);
                
                // Ajouter les nouvelles données au cache
                if (data.ping_value !== null && data.ping_value !== undefined) {
                    addToChartDataCache({
                        timestamp: new Date().toISOString(),
                        ping: data.ping_value,
                        rpc: data.rpc_value
                    });
                }
                
                // Récupérer l'unité sélectionnée
                const selectedUnit = document.getElementById('interval-unit').value;
                
                // Obtenir les données selon la granularité
                const chartData = getChartDataForGranularity(selectedUnit);
                
                if (chartData.length > 0) {
                    // Préparer les données pour le graphique
                    const labels = chartData.map(item => {
                        const date = new Date(item.timestamp);
                        return formatChartLabel(date.toISOString(), selectedUnit);
                    });
                    
                    const pingData = chartData.map(item => item.ping);
                    const rpcData = chartData.map(item => {
                        // Les valeurs sont déjà en ms, pas besoin de conversion
                        return item.rpc !== null ? item.rpc : null;
                    });
                    
                    // Mettre à jour les données du graphique
                    latencyChart.data.labels = labels;
                    latencyChart.data.datasets[0].data = pingData;
                    latencyChart.data.datasets[1].data = rpcData;
                    
                    // Ajuster l'échelle du graphique
                    adjustChartScale();
                    
                    // Forcer un redessin complet du graphique
                    latencyChart.update('active');
                    
                    console.log("Chart updated successfully with", chartData.length, "data points");
                }
            })
            .catch(error => console.error('Error updating ping chart:', error));
    }
    
    // Variable pour suivre le dernier timestamp des données
    let lastDataTimestamp = null;
    
    // Modifier la fonction updateData() pour inclure la mise à jour des alertes
    function updateData() {
        console.log("Updating data...");
        document.getElementById('sync-status').textContent = 'Synchronizing...';
        
        // Ajouter un timestamp pour éviter la mise en cache
        const timestamp = new Date().getTime();
        const cacheBuster = `?_=${timestamp}`;
        
        fetch(`/api/data${cacheBuster}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Data received:", data);
                
                // Vérifier si les données sont nouvelles
                const currentTimestamp = new Date(data.last_check).getTime();
                if (lastDataTimestamp && currentTimestamp <= lastDataTimestamp) {
                    console.log("Data hasn't changed, skipping UI update");
                    document.getElementById('sync-status').textContent = 'Synchronised';
                    return;
                }
                
                // Mettre à jour le timestamp
                lastDataTimestamp = currentTimestamp;
                
                // Update server status - Set to online as per user request
                const serverStatusElement = document.getElementById('server-status');
                const serverStatusText = document.getElementById('server-status-text');
                serverStatusElement.className = 'server-status online';
                serverStatusText.textContent = 'Server Online';
                
                // Update main statuses
                updateStatus('rpc-status', data.rpc_status);
                updateStatus('ping-status', data.ping_status);
                
                // Update metrics - ensure we show actual values, not 0
                if (data.rpc_value !== null && data.rpc_value !== undefined) {
                    // Afficher la valeur RPC en ms sans décimales
                    document.getElementById('rpc-metric').textContent = `${Math.round(data.rpc_value)} ms`;
                } else {
                    document.getElementById('rpc-metric').textContent = '-- ms';
                }
                
                // Gérer spécifiquement les valeurs de ping
                if (data.ping_value !== null && data.ping_value !== undefined && data.ping_value > 0) {
                    document.getElementById('ping-metric').textContent = `${Math.round(data.ping_value)} ms`;
                } else {
                    document.getElementById('ping-metric').textContent = 'No data';
                }
                
                document.getElementById('dns-version').textContent = data.version_info || 'N/A';
                
                // Update detailed information
                document.getElementById('ip-subdomain').textContent = data.ip_info || 'N/A';
                document.getElementById('ip-domain').textContent = data.main_domain_info?.ip || 'N/A';
                
                // Correction pour la redirection - afficher "no redirection" au lieu de "Error"
                const redirectValue = data.main_domain_info?.redirect;
                if (redirectValue === 'Error') {
                    document.getElementById('redirect').textContent = 'no redirection';
                } else {
                    document.getElementById('redirect').textContent = redirectValue || 'N/A';
                }
                
                document.getElementById('security').textContent = data.security_info || 'N/A';
                
                // Update last check with local time format
                updateCurrentTime();
                
                // Update TXT Records
                const txtContainer = document.getElementById('txt-records');
                if (Array.isArray(data.txt_info) && data.txt_info.length > 0) {
                    txtContainer.innerHTML = '';
                    data.txt_info.forEach(record => {
                        const recordElement = document.createElement('div');
                        recordElement.className = 'txt-record';
                        recordElement.textContent = record;
                        txtContainer.appendChild(recordElement);
                    });
                } else {
                    txtContainer.textContent = 'N/A';
                }
                
                // Update SSL information
                if (data.ssl_info) {
                    document.getElementById('ssl-issuer').textContent = 
                        data.ssl_info.issuer ? data.ssl_info.issuer.organizationName || 'N/A' : 'N/A';
                    document.getElementById('ssl-subject').textContent = 
                        data.ssl_info.subject ? data.ssl_info.subject.commonName || 'N/A' : 'N/A';
                    document.getElementById('ssl-expiry').textContent = 
                        data.ssl_info.notAfter || 'N/A';
                    document.getElementById('ssl-days-left').textContent = 
                        data.ssl_info.days_left !== undefined ? `${data.ssl_info.days_left} days` : 'N/A';
                }
                
                // Update transaction information - Correction pour afficher les transactions
                if (data.transactions) {
                    if (data.transactions.error) {
                        document.getElementById('latest-block').textContent = 'Error';
                        document.getElementById('tx-count').textContent = 'Error';
                        document.getElementById('tx-source').textContent = data.transactions.error;
                    } else {
                        document.getElementById('latest-block').textContent = 
                            data.transactions.block_number ? `#${data.transactions.block_number}` : 'N/A';
                        
                        // Afficher le nombre de transactions formaté si disponible, sinon le nombre brut
                        if (data.transactions.formatted_txns) {
                            document.getElementById('tx-count').textContent = data.transactions.formatted_txns;
                        } else if (data.transactions.tx_count !== null && data.transactions.tx_count !== undefined) {
                            document.getElementById('tx-count').textContent = data.transactions.tx_count;
                        } else {
                            document.getElementById('tx-count').textContent = '94.079K'; // Valeur par défaut
                        }
                        
                        document.getElementById('tx-source').textContent = 
                            data.transactions.source || 'N/A';
                    }
                } else {
                    // Forcer l'affichage du dernier bloc connu si aucune donnée n'est disponible
                    document.getElementById('latest-block').textContent = `#${lastKnownBlock.height}`;
                    document.getElementById('tx-count').textContent = '94.079K'; // Valeur par défaut
                    document.getElementById('tx-source').textContent = `Last seen: ${lastKnownBlock.timestamp}`;
                }
                
                // Update ports
                updatePorts(data.port_statuses);
                
                // Update alerts
                updateAlerts(data.alerts);
                
                // Ajouter les nouvelles données au cache
                if (data.history && data.history.length > 0) {
                    data.history.forEach(item => {
                        addToChartDataCache({
                            timestamp: item.timestamp,
                            ping: item.ping,
                            rpc: item.rpc
                        });
                    });
                }
                
                // Mettre à jour le graphique avec les données du cache
                const selectedUnit = document.getElementById('interval-unit').value;
                const chartData = getChartDataForGranularity(selectedUnit);
                
                if (chartData.length > 0) {
                    // Préparer les données pour le graphique
                    const labels = chartData.map(item => {
                        const date = new Date(item.timestamp);
                        return formatChartLabel(date.toISOString(), selectedUnit);
                    });
                    
                    const pingData = chartData.map(item => item.ping);
                    const rpcData = chartData.map(item => {
                        // Les valeurs sont déjà en ms, pas besoin de conversion
                        return item.rpc !== null ? item.rpc : null;
                    });
                    
                    // Mettre à jour les données du graphique
                    latencyChart.data.labels = labels;
                    latencyChart.data.datasets[0].data = pingData;
                    latencyChart.data.datasets[1].data = rpcData;
                    
                    // Ajuster l'échelle du graphique
                    adjustChartScale();
                    
                    // Forcer un redessin complet du graphique
                    latencyChart.update('active');
                }
                
                document.getElementById('sync-status').textContent = 'Synchronised';
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                document.getElementById('sync-status').textContent = 'Sync Error';
                
                // En cas d'erreur, afficher quand même le dernier bloc connu
                document.getElementById('latest-block').textContent = `#${lastKnownBlock.height}`;
                document.getElementById('tx-count').textContent = '94.079K'; // Valeur par défaut
                document.getElementById('tx-source').textContent = `Last seen: ${lastKnownBlock.timestamp}`;
            });
    }
    
    // Initial update
    updateData();
    
    // Set initial update interval (60 seconds)
    updateInterval = setInterval(updateData, 60000);
    
    // Set ping update interval (2 seconds)
    pingUpdateInterval = setInterval(updatePingChart, chartUpdateInterval);
    
    // Mettre à jour l'heure actuelle toutes les minutes
    timeUpdateInterval = setInterval(updateCurrentTime, 60000); // 60000ms = 1 minute
    
    // Mettre à jour l'heure immédiatement au démarrage
    updateCurrentTime();
});

// Three.js Background Functions
function initThreeJSBackground() {
    // Créer un conteneur pour Three.js s'il n'existe pas
    let container = document.getElementById('three-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'three-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.zIndex = '-1';
        document.body.appendChild(container);
    }
    
    // Create scene
    const scene = new THREE.Scene();
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 5000;
    const posArray = new Float32Array(particlesCount * 3);
    
    // Fill position array with random values
    for(let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 10;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    // Create particles material
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.005,
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    // Create particles mesh
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    // Create rotating cube - 20% smaller and positioned optimally
    const cubeGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8); // 20% smaller
    const cubeMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.7
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    
    // Position cube in the upper part of the viewport
    cube.position.y = -2;  // Position higher up
    cube.position.z = 1;   // Move cube closer to camera
    
    scene.add(cube);
    
    // Create animated gradient background
    const gradientTexture = createGradientTexture();
    scene.background = gradientTexture;
    
    // Handle window resize
    window.addEventListener('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Animation variables
    let baseRotationSpeed = 0.01;
    let baseParticleSpeed = 0.001;
    let currentRotationSpeed = baseRotationSpeed;
    let currentParticleSpeed = baseParticleSpeed;
    let targetRotationSpeed = baseRotationSpeed;
    let targetParticleSpeed = baseParticleSpeed;
    
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        // Smooth transition for rotation speed
        currentRotationSpeed += (targetRotationSpeed - currentRotationSpeed) * 0.1;
        currentParticleSpeed += (targetParticleSpeed - currentParticleSpeed) * 0.1;
        
        // Rotate cube with current speed
        cube.rotation.x += currentRotationSpeed;
        cube.rotation.y += currentRotationSpeed;
        
        // Add floating animation to cube
        cube.position.y = 2 + Math.sin(Date.now() * 0.001) * 0.2;
        
        // Rotate particles with current speed
        particlesMesh.rotation.y += currentParticleSpeed;
        
        // Animate gradient
        updateGradientTexture(gradientTexture);
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    console.log('Three.js background initialized successfully');
}

function createGradientTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(0.5, '#0a0a2a');
    gradient.addColorStop(1, '#0a0a1a');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    return texture;
}

function updateGradientTexture(texture) {
    // Add subtle animation to gradient
    const time = Date.now() * 0.0001;
    const canvas = texture.image;
    const context = canvas.getContext('2d');
    
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    
    // Animate gradient colors
    const r1 = Math.sin(time) * 5 + 10;
    const g1 = Math.sin(time * 0.7) * 5 + 10;
    const b1 = Math.sin(time * 1.3) * 10 + 26;
    
    const r2 = Math.sin(time * 0.5) * 5 + 10;
    const g2 = Math.sin(time * 1.2) * 5 + 10;
    const b2 = Math.sin(time * 0.8) * 10 + 42;
    
    gradient.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
    gradient.addColorStop(0.5, `rgb(${r2}, ${g2}, ${b2})`);
    gradient.addColorStop(1, `rgb(${r1}, ${g1}, ${b1})`);
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    texture.needsUpdate = true;
}