document.addEventListener('DOMContentLoaded', function() {
    // Initialize particles (reduced)
    particlesJS('particles-js', {
        particles: {
            number: {
                value: 20,
                density: {
                    enable: true,
                    value_area: 800
                }
            },
            color: {
                value: "#00ffff"
            },
            shape: {
                type: "circle",
                stroke: {
                    width: 0,
                    color: "#000000"
                }
            },
            opacity: {
                value: 0.3,
                random: false,
                anim: {
                    enable: false
                }
            },
            size: {
                value: 2,
                random: true
            },
            line_linked: {
                enable: true,
                distance: 150,
                color: "#00ffff",
                opacity: 0.2,
                width: 1
            },
            move: {
                enable: true,
                speed: 1,
                direction: "none",
                random: false,
                straight: false,
                out_mode: "out",
                bounce: false
            }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: {
                    enable: true,
                    mode: "grab"
                },
                onclick: {
                    enable: true,
                    mode: "push"
                },
                resize: true
            }
        },
        retina_detect: true
    });
    
    // Initialize 3D background with square cubes
    function init3DBackground() {
        const container = document.getElementById('3d-background');
        if (!container) return;
        
        // Remove existing content
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);
        
        // Create 3D cubes (square 1:1)
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });
        
        const cubes = [];
        for (let i = 0; i < 15; i++) {
            const cube = new THREE.Mesh(geometry, material);
            cube.position.x = (Math.random() - 0.5) * 50;
            cube.position.y = (Math.random() - 0.5) * 50;
            cube.position.z = (Math.random() - 0.5) * 50;
            cube.rotation.x = Math.random() * Math.PI;
            cube.rotation.y = Math.random() * Math.PI;
            scene.add(cube);
            cubes.push(cube);
        }
        
        camera.position.z = 30;
        
        // 3D Animation
        function animate() {
            requestAnimationFrame(animate);
            
            cubes.forEach(cube => {
                cube.rotation.x += 0.005;
                cube.rotation.y += 0.005;
            });
            
            renderer.render(scene, camera);
        }
        animate();
        
        // Handle resize
        window.addEventListener('resize', function() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    // Initialize 3D background
    init3DBackground();
    
    // Handle menu visibility on scroll
    const menuBar = document.getElementById('menu-bar');
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            menuBar.classList.add('hidden');
        } else {
            // Scrolling up or at top
            menuBar.classList.remove('hidden');
        }
        
        lastScrollTop = scrollTop;
    });
    
    // Initialize latency chart
    const ctx = document.getElementById('latency-chart').getContext('2d');
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
                    min: 0,
                    max: 300, // Set max to 300ms to show values between 140-180ms clearly
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
    
    // Variable to store chart update interval
    let chartUpdateInterval;
    
    // Handle update interval
    document.getElementById('apply-interval').addEventListener('click', function() {
        const value = document.getElementById('interval-value').value;
        const unit = document.getElementById('interval-unit').value;
        
        // Clear existing interval
        if (chartUpdateInterval) {
            clearInterval(chartUpdateInterval);
        }
        
        // Calculate interval in milliseconds
        let intervalMs;
        if (unit === 'seconds') {
            intervalMs = value * 1000;
        } else if (unit === 'minutes') {
            intervalMs = value * 60 * 1000;
        } else if (unit === 'hours') {
            intervalMs = value * 60 * 60 * 1000;
        } else if (unit === 'days') {
            intervalMs = value * 24 * 60 * 60 * 1000;
        }
        
        // Set new interval for chart updates only
        chartUpdateInterval = setInterval(updateChart, intervalMs);
        
        // Show success message
        const applyButton = document.getElementById('apply-interval');
        const originalText = applyButton.textContent;
        applyButton.textContent = 'Applied!';
        applyButton.style.background = 'rgba(0, 255, 0, 0.3)';
        
        setTimeout(() => {
            applyButton.textContent = originalText;
            applyButton.style.background = 'rgba(0, 255, 255, 0.2)';
        }, 2000);
    });
    
    // Function to update data
    function updateData() {
        console.log("Updating data...");
        document.getElementById('sync-status').textContent = 'Synchronizing...';
        
        fetch('/api/data')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Data received:", data);
                
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
                    document.getElementById('rpc-metric').textContent = `${(data.rpc_value * 1000).toFixed(2)} ms`;
                } else {
                    document.getElementById('rpc-metric').textContent = '-- ms';
                }
                
                if (data.ping_value !== null && data.ping_value !== undefined && data.ping_value > 0) {
                    document.getElementById('ping-metric').textContent = `${data.ping_value.toFixed(2)} ms`;
                } else {
                    document.getElementById('ping-metric').textContent = '-- ms';
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
                
                // Update chart
                updateChart(data.history);
                
                document.getElementById('sync-status').textContent = 'Synchronisé';
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                document.getElementById('sync-status').textContent = 'Sync Error';
            });
    }
    
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
    
    // Function to update ports
    function updatePorts(ports) {
        const container = document.getElementById('ports-status');
        container.innerHTML = '';
        
        for (const [port, status] of Object.entries(ports)) {
            const portElement = document.createElement('div');
            portElement.className = `port-item ${status}`;
            portElement.textContent = `${port}: ${status}`;
            container.appendChild(portElement);
        }
    }
    
    // Function to update alerts
    function updateAlerts(alerts) {
        const container = document.getElementById('alerts-container');
        container.innerHTML = '';
        
        if (alerts.length === 0) {
            container.innerHTML = '<div class="no-alerts">No alerts</div>';
            return;
        }
        
        alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `alert-item ${alert.severity}`;
            
            let iconClass = 'info';
            if (alert.severity === 'warning') iconClass = 'warning';
            else if (alert.severity === 'critical') iconClass = 'critical';
            
            alertElement.innerHTML = `
                <div class="alert-icon ${iconClass}">
                    <i class="fas fa-${iconClass === 'info' ? 'info-circle' : iconClass === 'warning' ? 'exclamation-triangle' : 'times-circle'}"></i>
                </div>
                <div>${alert.message}</div>
            `;
            
            container.appendChild(alertElement);
        });
    }
    
    // Function to update chart
    function updateChart(history) {
        if (!history || history.length === 0) return;
        
        const labels = history.map(h => {
            const date = new Date(h.timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        });
        
        const pingData = history.map(h => h.ping || 0);
        const rpcData = history.map(h => (h.rpc || 0) * 1000); // Convert to ms
        
        latencyChart.data.labels = labels;
        latencyChart.data.datasets[0].data = pingData;
        latencyChart.data.datasets[1].data = rpcData;
        latencyChart.update();
    }
    
    // Initial update
    updateData();
    
    // Periodic update for data (every 60 seconds)
    setInterval(updateData, 60000);
    
    // Initial chart update interval (every 60 seconds)
    chartUpdateInterval = setInterval(updateChart, 60000);
});