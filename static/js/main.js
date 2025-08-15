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
    
    // Fonction pour mettre à jour les alertes
    function updateAlerts(alerts) {
        const container = document.getElementById('alerts-container');
        container.innerHTML = '';
        
        if (alerts.length === 0) {
            container.innerHTML = '<div class="no-alerts">No alerts</div>';
            return;
        }
        
        // Ajouter un bouton pour tout effacer
        const clearAllBtn = document.createElement('div');
        clearAllBtn.className = 'clear-all-btn';
        clearAllBtn.innerHTML = '<i class="fas fa-trash"></i> Clear All';
        clearAllBtn.onclick = clearAllAlerts;
        container.appendChild(clearAllBtn);
        
        alerts.forEach((alert, index) => {
            const alertElement = document.createElement('div');
            alertElement.className = `alert-item ${alert.severity}`;
            alertElement.dataset.index = index;
            
            let iconClass = 'info';
            if (alert.severity === 'warning') iconClass = 'warning';
            else if (alert.severity === 'critical') iconClass = 'critical';
            
            // Calculer le temps restant avant expiration
            let timeRemaining = '';
            if (alert.timestamp) {
                const now = Date.now() / 1000; // Convertir en secondes
                const elapsed = now - alert.timestamp;
                const remaining = Math.max(0, 1800 - elapsed); // 30 minutes = 1800 secondes
                
                if (remaining > 0) {
                    const minutes = Math.floor(remaining / 60);
                    const seconds = Math.floor(remaining % 60);
                    timeRemaining = `<div class="alert-timer" data-index="${index}">Expires in: ${minutes}:${seconds.toString().padStart(2, '0')}</div>`;
                }
            }
            
            alertElement.innerHTML = `
                <div class="alert-header">
                    <div class="alert-icon ${iconClass}">
                        <i class="fas fa-${iconClass === 'info' ? 'info-circle' : iconClass === 'warning' ? 'exclamation-triangle' : 'times-circle'}"></i>
                    </div>
                    <div class="alert-actions">
                        <div class="alert-type">${alert.type}</div>
                        <div class="alert-close" onclick="dismissAlert(${index})">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                </div>
                <div class="alert-content">
                    <div class="alert-message">${alert.message}</div>
                    ${timeRemaining}
                </div>
            `;
            
            container.appendChild(alertElement);
        });
        
        // Démarrer le compte à rebours pour les alertes
        startAlertTimers();
    }
    
    // Fonction pour supprimer une alerte individuelle
    function dismissAlert(index) {
        fetch('/api/dismiss_alert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ index: index })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateAlerts(data.alerts);
                showNotification('Alert dismissed', 'success');
            }
        })
        .catch(error => {
            console.error('Error dismissing alert:', error);
            showNotification('Error dismissing alert', 'error');
        });
    }
    
    // Fonction pour supprimer toutes les alertes
    function clearAllAlerts() {
        if (confirm('Are you sure you want to clear all alerts?')) {
            fetch('/api/clear_alerts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateAlerts([]);
                    showNotification('All alerts cleared', 'success');
                }
            })
            .catch(error => {
                console.error('Error clearing alerts:', error);
                showNotification('Error clearing alerts', 'error');
            });
        }
    }
    
    // Variable pour stocker l'intervalle des timers d'alerte
    let alertTimerInterval = null;
    
    // Fonction pour gérer les compte à rebours
    function startAlertTimers() {
        // Effacer l'intervalle existant pour éviter les doublons
        if (alertTimerInterval) {
            clearInterval(alertTimerInterval);
        }
        
        // Mettre à jour les compte à rebours toutes les secondes
        alertTimerInterval = setInterval(() => {
            const timers = document.querySelectorAll('.alert-timer');
            timers.forEach(timer => {
                const index = parseInt(timer.dataset.index);
                
                // Récupérer les données d'alerte mises à jour
                fetch('/api/data')
                    .then(response => response.json())
                    .then(data => {
                        if (data.alerts && data.alerts[index]) {
                            const alert = data.alerts[index];
                            const now = Date.now() / 1000;
                            const elapsed = now - alert.timestamp;
                            const remaining = Math.max(0, 1800 - elapsed);
                            
                            if (remaining > 0) {
                                const minutes = Math.floor(remaining / 60);
                                const seconds = Math.floor(remaining % 60);
                                timer.textContent = `Expires in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                                
                                // Changer la couleur quand il reste moins de 5 minutes
                                if (remaining < 300) {
                                    timer.style.color = '#ff9800';
                                }
                                if (remaining < 60) {
                                    timer.style.color = '#f44336';
                                }
                            } else {
                                // L'alerte a expiré, la supprimer
                                const alertItem = timer.closest('.alert-item');
                                if (alertItem) {
                                    alertItem.style.opacity = '0';
                                    setTimeout(() => alertItem.remove(), 300);
                                }
                            }
                        }
                    });
            });
        }, 1000);
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
    
    // Function to update ping chart in real-time
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
                
                // Mettre à jour le graphique avec l'historique du ping
                if (data.ping_history && data.ping_history.length > 0) {
                    const labels = data.ping_history.map(h => {
                        const date = new Date(h.timestamp);
                        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                    });
                    
                    const pingData = data.ping_history.map(h => h.ping || 0);
                    
                    // Filtrer les valeurs 0 pour éviter d'afficher des lignes à 0
                    const filteredPingData = pingData.map(value => value > 0 ? value : null);
                    
                    // Only update the ping dataset, keep RPC data as is
                    latencyChart.data.labels = labels;
                    latencyChart.data.datasets[0].data = filteredPingData;
                    
                    // Ajuster l'échelle du graphique
                    adjustChartScale();
                    
                    // Mettre à jour sans animation pour un rendu plus fluide
                    latencyChart.update('none');
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
                document.getElementById('last-check').textContent = data.last_check;
                
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
                }
                
                // Update ports
                updatePorts(data.port_statuses);
                
                // Update alerts
                updateAlerts(data.alerts);
                
                // Mettre à jour le graphique avec les données de ping filtrées
                if (data.history && data.history.length > 0) {
                    const labels = data.history.map(h => {
                        const date = new Date(h.timestamp);
                        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                    });
                    
                    const pingData = data.history.map(h => h.ping || 0);
                    const rpcData = data.history.map(h => {
                        // Convert from seconds to milliseconds if needed
                        return (h.rpc || 0) < 1 ? (h.rpc || 0) * 1000 : (h.rpc || 0);
                    });
                    
                    // Filtrer les valeurs 0 pour éviter d'afficher des lignes à 0
                    const filteredPingData = pingData.map(value => value > 0 ? value : null);
                    
                    latencyChart.data.labels = labels;
                    latencyChart.data.datasets[0].data = filteredPingData;
                    latencyChart.data.datasets[1].data = rpcData;
                    
                    // Ajuster l'échelle du graphique
                    adjustChartScale();
                    
                    latencyChart.update();
                }
                
                document.getElementById('sync-status').textContent = 'Synchronised';
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                document.getElementById('sync-status').textContent = 'Sync Error';
            });
    }
    
    // Initial update
    updateData();
    
    // Set initial update interval (60 seconds)
    updateInterval = setInterval(updateData, 60000);
    
    // Set ping update interval (2 seconds)
    pingUpdateInterval = setInterval(updatePingChart, chartUpdateInterval);
});