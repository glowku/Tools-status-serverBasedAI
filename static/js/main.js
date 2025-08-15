document.addEventListener('DOMContentLoaded', function() {
    // Initialize unified background with particles and 3D cubes
    function initUnifiedBackground() {
        const container = document.getElementById('unified-background');
        if (!container) return;
        
        // Créer un élément pour le dégradé radial
        const gradientDiv = document.createElement('div');
        gradientDiv.style.position = 'absolute';
        gradientDiv.style.top = '0';
        gradientDiv.style.left = '0';
        gradientDiv.style.width = '100%';
        gradientDiv.style.height = '100%';
        gradientDiv.style.zIndex = '0';
        gradientDiv.style.background = 'radial-gradient(circle at center, rgba(0, 255, 255, 0.1), rgba(128, 128, 128, 0.05), rgba(0, 0, 0, 0.1))';
        gradientDiv.style.backgroundSize = '200% 200%';
        container.appendChild(gradientDiv);
        
        // Animer le dégradé
        let angle = 0;
        function animateGradient() {
            angle += 0.5;
            const x = 50 + 50 * Math.cos(angle * Math.PI / 180);
            const y = 50 + 50 * Math.sin(angle * Math.PI / 180);
            gradientDiv.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(0, 255, 255, 0.1), rgba(128, 128, 128, 0.05), rgba(0, 0, 0, 0.1))`;
            requestAnimationFrame(animateGradient);
        }
        animateGradient();
        
        // Create canvas for particles
        const particlesCanvas = document.createElement('canvas');
        particlesCanvas.style.position = 'absolute';
        particlesCanvas.style.top = '0';
        particlesCanvas.style.left = '0';
        particlesCanvas.style.width = '100%';
        particlesCanvas.style.height = '100%';
        particlesCanvas.style.zIndex = '1';
        container.appendChild(particlesCanvas);
        
        // Create container for 3D scene
        const threeContainer = document.createElement('div');
        threeContainer.style.position = 'absolute';
        threeContainer.style.top = '0';
        threeContainer.style.left = '0';
        threeContainer.style.width = '100%';
        threeContainer.style.height = '100%';
        threeContainer.style.zIndex = '2';
        container.appendChild(threeContainer);
        
        // Initialize particles
        const particlesCtx = particlesCanvas.getContext('2d');
        particlesCanvas.width = window.innerWidth;
        particlesCanvas.height = window.innerHeight;
        
        const particlesArray = [];
        const numberOfParticles = 50;
        
        class Particle {
            constructor() {
                this.x = Math.random() * particlesCanvas.width;
                this.y = Math.random() * particlesCanvas.height;
                this.size = Math.random() * 2 + 1;
                this.speedX = Math.random() * 1 - 0.5;
                this.speedY = Math.random() * 1 - 0.5;
                this.opacity = Math.random() * 0.5 + 0.2;
            }
            
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                
                if (this.x > particlesCanvas.width || this.x < 0) {
                    this.speedX = -this.speedX;
                }
                
                if (this.y > particlesCanvas.height || this.y < 0) {
                    this.speedY = -this.speedY;
                }
            }
            
            draw() {
                particlesCtx.fillStyle = `rgba(0, 255, 255, ${this.opacity})`;
                particlesCtx.beginPath();
                particlesCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                particlesCtx.fill();
            }
        }
        
        // Create particles
        for (let i = 0; i < numberOfParticles; i++) {
            particlesArray.push(new Particle());
        }
        
        // Draw connections between particles
        function connectParticles() {
            for (let a = 0; a < particlesArray.length; a++) {
                for (let b = a; b < particlesArray.length; b++) {
                    const dx = particlesArray[a].x - particlesArray[b].x;
                    const dy = particlesArray[a].y - particlesArray[b].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 100) {
                        particlesCtx.strokeStyle = `rgba(0, 255, 255, ${0.1 * (1 - distance/100)})`;
                        particlesCtx.lineWidth = 0.5;
                        particlesCtx.beginPath();
                        particlesCtx.moveTo(particlesArray[a].x, particlesArray[a].y);
                        particlesCtx.lineTo(particlesArray[b].x, particlesArray[b].y);
                        particlesCtx.stroke();
                    }
                }
            }
        }
        
        // Animation loop for particles
        function animateParticles() {
            particlesCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
            
            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].update();
                particlesArray[i].draw();
            }
            
            connectParticles();
            requestAnimationFrame(animateParticles);
        }
        
        animateParticles();
        
        // Initialize 3D scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        threeContainer.appendChild(renderer.domElement);
        
        // Create 3D cubes
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.1
        });
        
        const cubes = [];
        for (let i = 0; i < 10; i++) {
            const cube = new THREE.Mesh(geometry, material);
            cube.position.x = (Math.random() - 0.5) * 30;
            cube.position.y = (Math.random() - 0.5) * 30;
            cube.position.z = (Math.random() - 0.5) * 30;
            cube.rotation.x = Math.random() * Math.PI;
            cube.rotation.y = Math.random() * Math.PI;
            scene.add(cube);
            cubes.push(cube);
        }
        
        camera.position.z = 20;
        
        // 3D Animation
        function animate3D() {
            requestAnimationFrame(animate3D);
            
            cubes.forEach(cube => {
                cube.rotation.x += 0.003;
                cube.rotation.y += 0.003;
                
                // Add movement to cubes
                cube.position.x += Math.sin(Date.now() * 0.001 + cube.id) * 0.005;
                cube.position.y += Math.cos(Date.now() * 0.001 + cube.id) * 0.005;
            });
            
            renderer.render(scene, camera);
        }
        animate3D();
        
        // Handle resize
        window.addEventListener('resize', function() {
            particlesCanvas.width = window.innerWidth;
            particlesCanvas.height = window.innerHeight;
            
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    // Initialize unified background
    initUnifiedBackground();
    
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
    
    // Ajoutez cette fonction pour ajuster dynamiquement l'échelle
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
        
        // S'assurer que l'échelle minimale est au moins de 100ms pour les valeurs normales
        const finalMin = Math.min(adjustedMin, 50);
        const finalMax = Math.max(adjustedMax, 200);
        
        // Appliquer la nouvelle échelle
        latencyChart.options.scales.y.min = finalMin;
        latencyChart.options.scales.y.max = finalMax;
        latencyChart.update('none'); // Mettre à jour sans animation
    }
    
    // Remplacez la configuration du graphique par celle-ci
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
                    // Supprimer le min/max fixe pour permettre l'adaptation automatique
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
                            return value + ' ms';
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
                            return context.dataset.label + ': ' + context.parsed.y + ' ms';
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
    
    // Handle update interval - CORRIGÉ
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
        timestamp: "Aug 12 2025 05:42:20 AM (+02:00 UTC)"
    };
    
    // Convertir le timestamp en objet Date
    const lastBlockDate = new Date(lastKnownBlock.timestamp);
    
    // Variables pour le suivi de la panne RPC
    let rpcDowntimeStart = lastBlockDate; // Utiliser la date du dernier bloc comme début de la panne
    let rpcDowntimeAlert = null;
    
    // Stockage des alertes existantes pour les mettre à jour plutôt que de les remplacer
    let existingAlerts = [];
    
    // Système de cache intelligent pour les données du graphique
    let chartDataCache = {
        raw: [],      // Données brutes (toutes les entrées)
        minute: [],   // Données agrégées par minute
        hour: [],     // Données agrégées par heure
        day: []       // Données agrégées par jour
    };
    
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
    
    // Fonction pour mettre à jour les alertes

// Fonction pour mettre à jour les alertes
function updateAlerts(alerts) {
    const container = document.getElementById('alerts-container');
    
    // Si le conteneur est vide, initialiser avec un titre
    if (container.children.length === 0) {
        const title = document.createElement('div');
        title.className = 'alerts-title';
        title.textContent = 'System Alerts';
        container.appendChild(title);
    }
    
    // Vérifier si l'alerte RPC de panne existe déjà
    const rpcAlertIndex = existingAlerts.findIndex(alert => alert.id === 'rpc-downtime');
    
    // Vérifier si le RPC est actuellement en ligne
    const rpcOnline = alerts.some(alert => 
        alert.type === 'RPC' && 
        alert.message.includes('online') && 
        !alert.message.includes('offline → online')
    );
    
    if (!rpcOnline && rpcAlertIndex === -1) {
        // Créer l'alerte de panne RPC si elle n'existe pas et que le RPC est hors ligne
        rpcDowntimeAlert = {
            id: 'rpc-downtime',
            type: 'RPC Downtime',
            message: `RPC is offline since ${formatLocalDate(rpcDowntimeStart)}`,
            severity: 'critical',
            startTime: rpcDowntimeStart,
            resolved: false,
            endTime: null,
            resolvedMessage: null,
            isRPCDowntime: true
        };
        
        existingAlerts.push(rpcDowntimeAlert);
    } else if (rpcOnline && rpcAlertIndex !== -1) {
        // Si le RPC est de nouveau en ligne, mettre à jour l'alerte
        const existingAlert = existingAlerts[rpcAlertIndex];
        existingAlert.resolved = true;
        existingAlert.endTime = new Date();
        
        const duration = existingAlert.endTime - existingAlert.startTime;
        existingAlert.resolvedMessage = `RPC is back online. Downtime: ${formatDuration(duration)}`;
        existingAlert.message = `RPC was offline from ${formatLocalDate(existingAlert.startTime)} to ${formatLocalDate(existingAlert.endTime)}`;
        
        // Réinitialiser le suivi de la panne
        rpcDowntimeStart = null;
        rpcDowntimeAlert = null;
    }
    
    // Filtrer les alertes pour supprimer uniquement les transitions "offline → online"
    const filteredAlerts = alerts.filter(alert => {
        // Supprimer uniquement les alertes de transition RPC "offline → online"
        if (alert.type === 'RPC' && alert.message.includes('offline → online')) {
            return false;
        }
        return true;
    });
    
    // Mettre à jour les autres alertes
    filteredAlerts.forEach(newAlert => {
        // Ignorer l'alerte de panne RPC car nous la gérons séparément
        if (newAlert.type === 'RPC' && newAlert.message.includes('RPC is offline since')) {
            return;
        }
        
        // Vérifier si une alerte similaire existe déjà
        const existingAlertIndex = existingAlerts.findIndex(alert => 
            alert.type === newAlert.type && alert.message.includes(newAlert.message.split(' ')[0])
        );
        
        if (existingAlertIndex !== -1) {
            // Mettre à jour l'alerte existante
            const existingAlert = existingAlerts[existingAlertIndex];
            
            // Si le statut a changé (par exemple, de offline à online)
            if (existingAlert.status !== newAlert.status) {
                // Marquer comme résolu si le nouveau statut est online
                if (newAlert.status === 'online' || newAlert.status === 'success') {
                    existingAlert.resolved = true;
                    existingAlert.endTime = new Date();
                    existingAlert.resolvedMessage = `Issue resolved at ${formatLocalDate(existingAlert.endTime)}`;
                }
            }
            
            // Mettre à jour les autres informations
            existingAlert.status = newAlert.status;
            existingAlert.severity = newAlert.severity;
            existingAlert.timestamp = newAlert.timestamp;
        } else {
            // Créer une nouvelle alerte
            const alert = {
                ...newAlert,
                id: Date.now() + Math.random(),
                startTime: new Date(),
                resolved: false,
                endTime: null,
                resolvedMessage: null
            };
            existingAlerts.push(alert);
        }
    });
    
    // Vider le conteneur sauf le titre
    const title = container.querySelector('.alerts-title');
    container.innerHTML = '';
    if (title) container.appendChild(title);
    
    // Afficher toutes les alertes (y compris celles résolues)
    existingAlerts.forEach(alert => {
        const alertElement = document.createElement('div');
        
        // Déterminer la classe de l'alerte en fonction de son état
        if (alert.resolved) {
            alertElement.className = 'alert-item resolved';
        } else {
            alertElement.className = `alert-item ${alert.severity}`;
        }
        
        // Déterminer l'icône
        let iconClass = 'info';
        if (alert.resolved) {
            iconClass = 'check-circle';
        } else if (alert.severity === 'warning') {
            iconClass = 'exclamation-triangle';
        } else if (alert.severity === 'critical') {
            iconClass = 'times-circle';
        }
        
        // Préparer le message
        let message = alert.message;
        if (alert.resolved && alert.resolvedMessage) {
            message += `<br><span class="resolved-info">${alert.resolvedMessage}</span>`;
        }
        
        // Pour l'alerte de panne RPC, ajouter un compteur en temps réel si elle n'est pas résolue
        if (alert.isRPCDowntime && !alert.resolved) {
            const durationElement = document.createElement('span');
            durationElement.className = 'rpc-downtime-duration';
            durationElement.setAttribute('data-start', alert.startTime.getTime());
            message += `<br><span class="rpc-downtime-duration" data-start="${alert.startTime.getTime()}">Calculating downtime...</span>`;
        }
        
        alertElement.innerHTML = `
            <div class="alert-header">
                <div class="alert-icon ${alert.resolved ? 'resolved' : alert.severity}">
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
    
    // S'il n'y a aucune alerte, afficher un message
    if (existingAlerts.length === 0) {
        container.innerHTML = '<div class="no-alerts">No alerts</div>';
    }
    
    // Démarrer le compteur en temps réel pour les durées de panne RPC
    updateRPCDowntimeCounters();
}
    
    // Fonction pour mettre à jour les compteurs de durée de panne RPC en temps réel
    function updateRPCDowntimeCounters() {
        const counters = document.querySelectorAll('.rpc-downtime-duration');
        counters.forEach(counter => {
            const startTime = parseInt(counter.getAttribute('data-start'));
            const now = Date.now();
            const duration = now - startTime;
            
            counter.textContent = `Downtime: ${formatDuration(duration)}`;
        });
        
        // Continuer à mettre à jour toutes les secondes
        setTimeout(updateRPCDowntimeCounters, 1000);
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
    
    // Fonction pour formater la date en heure locale - CORRIGÉE
    function formatLocalDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
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
    
    // Fonction pour formater les étiquettes du graphique en fonction de l'unité sélectionnée - AMÉLIORÉE
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
    
    // Fonction pour mettre à jour l'heure actuelle - CORRIGÉE
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
    
    // Fonction pour obtenir des étiquettes uniques en fonction de l'unité
    function getUniqueLabels(data, unit) {
        if (!data || data.length === 0) return [];
        
        const uniqueLabels = new Map();
        
        data.forEach(item => {
            const date = new Date(item.timestamp);
            let label;
            
            if (unit === 'seconds') {
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                label = `${hours}:${minutes}:${seconds}`;
            } else if (unit === 'minutes') {
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                label = `${hours}:${minutes}`;
            } else if (unit === 'hours') {
                const hours = String(date.getHours()).padStart(2, '0');
                label = `${hours}:00`;
            } else if (unit === 'days') {
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                label = `${month}-${day}`;
            } else {
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                label = `${hours}:${minutes}:${seconds}`;
            }
            
            // Stocker la première valeur pour chaque étiquette unique
            if (!uniqueLabels.has(label)) {
                uniqueLabels.set(label, item.ping || 0);
            }
        });
        
        // Convertir la Map en tableau d'objets {label, value}
        return Array.from(uniqueLabels, ([label, value]) => ({ label, value }));
    }
    
    // Function to update ping chart in real-time - MODIFIÉE
    function updatePingChart() {
        console.log("Updating ping chart with interval:", chartUpdateInterval, "ms");
        
        fetch('/api/data')
            .then(response => response.json())
            .then(data => {
                // Mettre à jour les valeurs de ping en temps réel
                if (data.ping_value !== null && data.ping_value !== undefined && data.ping_value > 0) {
                    document.getElementById('ping-metric').textContent = `${data.ping_value.toFixed(2)} ms`;
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
                        // Convertir en ms si nécessaire
                        return item.rpc !== null ? (item.rpc < 1 ? item.rpc * 1000 : item.rpc) : null;
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
    
    // Modifier la fonction updateData() pour inclure la mise à jour des alertes - CORRIGÉE
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
                
                // Update server status
                const serverStatusElement = document.getElementById('server-status');
                const serverStatusText = document.getElementById('server-status-text');
                
                if (data.server_status === 'online') {
                    serverStatusElement.className = 'server-status online';
                    serverStatusText.textContent = 'Server Online';
                } else {
                    serverStatusElement.className = 'server-status offline';
                    serverStatusText.textContent = 'Server Offline';
                }
                
                // Update main statuses
                updateStatus('rpc-status', data.rpc_status);
                updateStatus('ping-status', data.ping_status);
                
                // Update metrics - ensure we show actual values, not 0
                if (data.rpc_value !== null && data.rpc_value !== undefined) {
                    // Convert from seconds to milliseconds if needed
                    const rpcMs = data.rpc_value < 1 ? data.rpc_value * 1000 : data.rpc_value;
                    document.getElementById('rpc-metric').textContent = `${rpcMs.toFixed(2)} ms`;
                } else {
                    document.getElementById('rpc-metric').textContent = '-- ms';
                }
                
                // Gérer spécifiquement les valeurs de ping
                if (data.ping_value !== null && data.ping_value !== undefined && data.ping_value > 0) {
                    document.getElementById('ping-metric').textContent = `${data.ping_value.toFixed(2)} ms`;
                } else {
                    document.getElementById('ping-metric').textContent = 'No data';
                }
                
                document.getElementById('dns-version').textContent = data.version_info || 'N/A';
                
                // Update detailed information
                document.getElementById('ip-subdomain').textContent = data.ip_info || 'N/A';
                document.getElementById('ip-domain').textContent = data.main_domain_info?.ip || 'N/A';
                document.getElementById('redirect').textContent = data.main_domain_info?.redirect || 'N/A';
                document.getElementById('security').textContent = data.security_info || 'N/A';
                
                // Update last check with local time format - CORRIGÉ
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
                
                // Update transaction information
                if (data.transactions) {
                    if (data.transactions.error) {
                        document.getElementById('latest-block').textContent = 'Error';
                        document.getElementById('tx-count').textContent = 'Error';
                        document.getElementById('tx-source').textContent = data.transactions.error;
                    } else {
                        document.getElementById('latest-block').textContent = 
                            data.transactions.block_number ? `#${data.transactions.block_number}` : 'N/A';
                        document.getElementById('tx-count').textContent = 
                            data.transactions.tx_count || 'N/A';
                        document.getElementById('tx-source').textContent = 
                            data.transactions.source || 'N/A';
                    }
                } else {
                    // Forcer l'affichage du dernier bloc connu si aucune donnée n'est disponible
                    document.getElementById('latest-block').textContent = `#${lastKnownBlock.height}`;
                    document.getElementById('tx-count').textContent = lastKnownBlock.size;
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
                        // Convertir en ms si nécessaire
                        return item.rpc !== null ? (item.rpc < 1 ? item.rpc * 1000 : item.rpc) : null;
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
                document.getElementById('tx-count').textContent = lastKnownBlock.size;
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