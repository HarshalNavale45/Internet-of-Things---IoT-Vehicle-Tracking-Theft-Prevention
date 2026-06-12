// IoT Vehicle Telematics Dashboard Logic

// Global variables
let map, vehicleMarker, geofenceCircle;
let speedChart;
let simulationInterval = null;
let simStep = 0;
let currentRouteName = 'normal';
let mockSpeedData = [];
let mockTimeLabels = [];
let prevLat = null;
let prevLon = null;
let travelHistory = [];
let pathPolyline = null;

// Audio Context for Web-based Alarm Buzzer
let audioCtx = null;
let alarmOscillator = null;
let alarmInterval = null;

// Preset Simulation Paths (centered around Bangalore [12.9716, 77.5946])
const SIMULATION_ROUTES = {
    normal: [
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: false },
        { lat: 18.5206, lon: 73.8570, speed: 18.5, vibration: false },
        { lat: 18.5209, lon: 73.8572, speed: 25.0, vibration: false },
        { lat: 18.5211, lon: 73.8574, speed: 32.4, vibration: false },
        { lat: 18.5213, lon: 73.8571, speed: 38.0, vibration: false },
        { lat: 18.5211, lon: 73.8567, speed: 35.2, vibration: false },
        { lat: 18.5208, lon: 73.8564, speed: 22.1, vibration: false },
        { lat: 18.5205, lon: 73.8565, speed: 12.0, vibration: false },
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: false }
    ],
    parked: [
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: false },
        { lat: 18.520401, lon: 73.856702, speed: 0.0, vibration: false },
        { lat: 18.520399, lon: 73.856698, speed: 0.0, vibration: false },
        // Trigger a slight bump vibration alert on step 4 to simulate tamper detection
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: true },
        { lat: 18.520402, lon: 73.856701, speed: 0.0, vibration: true },
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: false },
        { lat: 18.520398, lon: 73.856699, speed: 0.0, vibration: false }
    ],
    theft: [
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: false },
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: true }, // vibration trigger
        { lat: 18.5206, lon: 73.8570, speed: 20.0, vibration: true }, // driving off while armed
        { lat: 18.5209, lon: 73.8573, speed: 35.5, vibration: true },
        { lat: 18.5213, lon: 73.8577, speed: 45.0, vibration: true },
        { lat: 18.5218, lon: 73.8583, speed: 52.3, vibration: true },
        { lat: 18.5224, lon: 73.8590, speed: 60.1, vibration: true },
        { lat: 18.5230, lon: 73.8597, speed: 64.0, vibration: true }
    ],
    escape: [
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: false },
        { lat: 18.5207, lon: 73.8572, speed: 15.0, vibration: false },
        { lat: 18.5210, lon: 73.8577, speed: 28.5, vibration: false },
        // Crossed 150m boundary
        { lat: 18.5214, lon: 73.8583, speed: 40.2, vibration: false },
        { lat: 18.5220, lon: 73.8591, speed: 48.0, vibration: false },
        { lat: 18.5226, lon: 73.8599, speed: 55.4, vibration: false },
        { lat: 18.5232, lon: 73.8607, speed: 62.0, vibration: false }
    ],
    pune: [
        { lat: 18.5204, lon: 73.8567, speed: 0.0, vibration: false },
        { lat: 18.5201, lon: 73.8582, speed: 15.2, vibration: false },
        { lat: 18.5193, lon: 73.8578, speed: 25.4, vibration: false },
        { lat: 18.5178, lon: 73.8569, speed: 30.1, vibration: false },
        { lat: 18.5162, lon: 73.8563, speed: 35.8, vibration: false },
        { lat: 18.5172, lon: 73.8601, speed: 40.5, vibration: false },
        { lat: 18.5185, lon: 73.8632, speed: 45.2, vibration: false },
        { lat: 18.5211, lon: 73.8654, speed: 38.0, vibration: false },
        { lat: 18.5230, lon: 73.8682, speed: 42.4, vibration: false },
        { lat: 18.5255, lon: 73.8711, speed: 50.1, vibration: false },
        { lat: 18.5278, lon: 73.8732, speed: 45.6, vibration: false },
        { lat: 18.5289, lon: 73.8744, speed: 10.0, vibration: false },
        { lat: 18.5289, lon: 73.8744, speed: 0.0, vibration: false }
    ]
};

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", () => {
    initMap();
    initChart();
    initClock();
    startConsolePolling();
    setupEventListeners();
    startSimulation('normal'); // Start normal loop simulator by default
});

// 1. Initializing Leaflet map with Google Maps tiles
function initMap() {
    // Center map on Pune default coordinates
    map = L.map('map-viewport').setView([18.5204, 73.8567], 16);

    // Apply standard Google Maps Roadmap tile layer
    L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; Google Maps',
        maxZoom: 20
    }).addTo(map);

    // Add geofence boundary circle (Blue transluscent)
    geofenceCircle = L.circle([18.5204, 73.8567], {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        radius: 150 // default radius in meters
    }).addTo(map);

    // Create custom vehicle marker using L.marker and divIcon (top-down rotatable vehicle representation)
    const carIconHtml = `
    <div id="vehicle-icon-div" style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; filter: drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.55)); transition: var(--transition-normal);">
      <svg id="vehicle-svg" width="30" height="40" viewBox="0 0 30 50" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(0deg); transition: transform 0.5s ease-out;">
        <!-- Shadow -->
        <rect x="3" y="5" width="24" height="40" rx="6" fill="rgba(0,0,0,0.35)"/>
        <!-- Main Outer Body -->
        <rect x="4" y="4" width="22" height="42" rx="7" fill="var(--vehicle-color, #10b981)" stroke="#ffffff" stroke-width="2" style="transition: fill 0.3s ease;"/>
        <!-- Cabin Windshield -->
        <path d="M7 16 C7 13, 23 13, 23 16 L21 21 L9 21 Z" fill="#1e293b"/>
        <!-- Cabin Rear glass -->
        <path d="M8 36 C8 38, 22 38, 22 36 L20 33 L10 33 Z" fill="#1e293b"/>
        <!-- Roof -->
        <rect x="8" y="21" width="14" height="12" rx="2" fill="var(--vehicle-color-dark, #059669)" style="transition: fill 0.3s ease;"/>
        <!-- Headlights -->
        <rect x="7" y="3" width="3" height="2" rx="1" fill="#ffea00"/>
        <rect x="20" y="3" width="3" height="2" rx="1" fill="#ffea00"/>
        <!-- Taillights -->
        <rect x="6" y="45" width="4" height="1.5" fill="#ff0000"/>
        <rect x="20" y="45" width="4" height="1.5" fill="#ff0000"/>
      </svg>
    </div>
    `;

    const vehicleIcon = L.divIcon({
        html: carIconHtml,
        className: 'vehicle-map-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });

    vehicleMarker = L.marker([18.5204, 73.8567], { icon: vehicleIcon }).addTo(map);
    
    vehicleMarker.bindPopup("<b>Target Vehicle</b><br>Engine Status: OK").openPopup();
}

// 2. Initializing Chart.js for real-time telemetry graphs
function initChart() {
    const ctx = document.getElementById('speed-chart').getContext('2d');
    
    // Fill telemetry arrays with empty values
    for (let i = 0; i < 15; i++) {
        mockSpeedData.push(0);
        mockTimeLabels.push("");
    }

    speedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: mockTimeLabels,
            datasets: [{
                label: 'Velocity (km/h)',
                data: mockSpeedData,
                borderColor: '#00f0ff',
                backgroundColor: 'rgba(0, 240, 255, 0.05)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b', font: { family: 'Outfit' } },
                    min: 0,
                    max: 80
                }
            }
        }
    });
}

// 3. UI Clock Indicator
function initClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('time-display').textContent = now.toTimeString().split(' ')[0];
    }, 1000);
}

// 4. Simulator Engine loops
function startSimulation(routeKey) {
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    
    currentRouteName = routeKey;
    simStep = 0;
    
    const route = SIMULATION_ROUTES[routeKey];
    const delay = parseInt(document.getElementById('sim-speed-select').value) || 1000;
    
    writeToConsole(`[SIMULATOR] Switched path to: ${routeKey.toUpperCase()} route.`, 'system');

    simulationInterval = setInterval(() => {
        if (simStep >= route.length) {
            simStep = 0; // Loop the route coordinates
        }
        
        const point = route[simStep];
        simStep++;
        
        // POST to backend API just like the hardware client would
        transmitTelemetry(point.lat, point.lon, point.speed, point.vibration);
    }, delay);
}

// 5. POST telemetry coordinates to the Flask REST API
function transmitTelemetry(lat, lon, speed, vibration) {
    // If the system engine is locked, force speed to 0 (simulates fuel line cut-off relay)
    const activeSpeed = document.getElementById('state-badge').textContent.includes('LOCKED') ? 0.0 : speed;

    const payload = {
        latitude: lat,
        longitude: lon,
        speed: activeSpeed,
        satellites: 8,
        vibration_alert: vibration
    };

    fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            // Check for server response switches (Remote lock relay trigger)
            syncDashboardState();
        }
    })
    .catch(err => {
        console.error("Telemetry upload error: ", err);
        document.getElementById('heartbeat-indicator').className = 'heartbeat disconnected';
        document.getElementById('connection-text').textContent = 'CONNECTION ERROR';
    });
}

// 6. Poll server states to update UI metrics and logs
function syncDashboardState() {
    fetch('/api/status')
    .then(res => res.json())
    .then(state => {
        // Sync hardware switches on dashboard UI
        document.getElementById('toggle-arm').checked = state.is_armed;
        document.getElementById('heartbeat-indicator').className = 'heartbeat connected';
        document.getElementById('connection-text').textContent = 'SYSTEM ONLINE';

        // Update basic telemetry text cards
        document.getElementById('val-lat').textContent = state.latitude.toFixed(6);
        document.getElementById('val-lon').textContent = state.longitude.toFixed(6);
        document.getElementById('val-speed').textContent = `${state.speed.toFixed(1)} km/h`;
        document.getElementById('val-sats').textContent = `${state.satellites} Connected`;
        document.getElementById('val-time').textContent = state.last_updated;

        // Geofence configuration text boxes
        document.getElementById('geo-lat').placeholder = state.geofence_lat;
        document.getElementById('geo-lon').placeholder = state.geofence_lon;
        document.getElementById('geo-radius').placeholder = state.geofence_radius;

        // Redraw Map components
        const currentLoc = [state.latitude, state.longitude];
        vehicleMarker.setLatLng(currentLoc);
        
        // If there's a previous coordinate and it's different, calculate bearing and rotate vehicle
        if (prevLat !== null && prevLon !== null && (prevLat !== state.latitude || prevLon !== state.longitude)) {
            const heading = calculateBearing(prevLat, prevLon, state.latitude, state.longitude);
            const carSvg = document.getElementById('vehicle-svg');
            if (carSvg) {
                carSvg.style.transform = `rotate(${heading}deg)`;
            }
        }
        
        // Update previous coords
        prevLat = state.latitude;
        prevLon = state.longitude;

        // Draw path trail history
        const lastHistoryPoint = travelHistory[travelHistory.length - 1];
        if (!lastHistoryPoint || lastHistoryPoint[0] !== state.latitude || lastHistoryPoint[1] !== state.longitude) {
            travelHistory.push(currentLoc);
            
            if (!pathPolyline) {
                pathPolyline = L.polyline(travelHistory, {
                    color: '#00f0ff',
                    weight: 4,
                    opacity: 0.75,
                    dashArray: '5, 8' // clean dashed line for tracker aesthetic
                }).addTo(map);
            } else {
                pathPolyline.setLatLngs(travelHistory);
            }
        }
        
        // Center the camera on the vehicle if it is moving
        if (state.speed > 1.0) {
            map.panTo(currentLoc);
        }

        // Draw and update Geofence Circle
        geofenceCircle.setLatLng([state.geofence_lat, state.geofence_lon]);
        geofenceCircle.setRadius(state.geofence_radius);

        // Adjust badge and markers based on alarm states
        const badge = document.getElementById('state-badge');
        badge.textContent = state.status;

        const iconDiv = document.getElementById('vehicle-icon-div');

        if (state.status === 'Locked/Immobilized') {
            badge.className = 'badge bg-red';
            if (iconDiv) {
                iconDiv.style.setProperty('--vehicle-color', '#64748b');
                iconDiv.style.setProperty('--vehicle-color-dark', '#475569');
                iconDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                iconDiv.classList.remove('pulse-marker');
            }
            triggerWebBuzzer(false); // Silent when locked
            triggerAlertUI(true, "VEHICLE IMMOBILIZED", "Ignition Relay coil is active. Engine startup is locked.");
        } 
        else if (state.status === 'Geofence Breach') {
            badge.className = 'badge bg-red';
            if (iconDiv) {
                iconDiv.style.setProperty('--vehicle-color', '#ff0055');
                iconDiv.style.setProperty('--vehicle-color-dark', '#b91c1c');
                iconDiv.style.boxShadow = '0 0 15px rgba(255,0,85,0.7)';
                iconDiv.classList.add('pulse-marker');
            }
            geofenceCircle.setStyle({ color: '#ff0055', fillColor: '#ff0055' });
            triggerWebBuzzer(true); // Sound buzzer
            triggerAlertUI(true, "GEOFENCE BREACH DETECTED", "Vehicle has exited the allowed security radius!");
        } 
        else if (state.status === 'Stolen/Vibration') {
            badge.className = 'badge bg-orange';
            if (iconDiv) {
                iconDiv.style.setProperty('--vehicle-color', '#f97316');
                iconDiv.style.setProperty('--vehicle-color-dark', '#c2410c');
                iconDiv.style.boxShadow = '0 0 15px rgba(249,115,22,0.7)';
                iconDiv.classList.add('pulse-marker');
            }
            triggerWebBuzzer(true); // Sound buzzer
            triggerAlertUI(true, "ANTI-THEFT SYSTEM TRIGGERED", "Vibration sensor logs movement while system was ARMED!");
        } 
        else if (state.status === 'Driving') {
            badge.className = 'badge bg-blue';
            if (iconDiv) {
                iconDiv.style.setProperty('--vehicle-color', '#3b82f6');
                iconDiv.style.setProperty('--vehicle-color-dark', '#1d4ed8');
                iconDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                iconDiv.classList.remove('pulse-marker');
            }
            geofenceCircle.setStyle({ color: '#3b82f6', fillColor: '#3b82f6' });
            triggerWebBuzzer(false);
            triggerAlertUI(false);
        } 
        else {
            badge.className = 'badge bg-green';
            if (iconDiv) {
                iconDiv.style.setProperty('--vehicle-color', '#10b981');
                iconDiv.style.setProperty('--vehicle-color-dark', '#047857');
                iconDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                iconDiv.classList.remove('pulse-marker');
            }
            geofenceCircle.setStyle({ color: '#3b82f6', fillColor: '#3b82f6' });
            triggerWebBuzzer(false);
            triggerAlertUI(false);
        }

        // Add coordinate to speed chart
        updateTelemetryChart(state.speed, state.last_updated.split(' ')[1] || "");
    });
}

// 7. Update Speed chart
function updateTelemetryChart(speed, label) {
    mockSpeedData.push(speed);
    mockSpeedData.shift();
    
    mockTimeLabels.push(label);
    mockTimeLabels.shift();

    speedChart.update('none'); // Update without full animation for low CPU load
}

// 8. Scrolling Log Consol feed
function startConsolePolling() {
    setInterval(() => {
        fetch('/api/logs?limit=8')
        .then(res => res.json())
        .then(logs => {
            const terminal = document.getElementById('console-terminal');
            terminal.innerHTML = ""; // Clear
            
            if (logs.length === 0) {
                terminal.innerHTML = '<div class="log-line system">[SYSTEM] Ready. Start simulation routes to populate log database.</div>';
                return;
            }

            logs.forEach(log => {
                let alertStr = "";
                let type = 'telemetry';
                
                if (log.status === 'Locked/Immobilized') {
                    alertStr = "[LOCK ACTIVE]";
                    type = 'alert';
                } else if (log.status === 'Geofence Breach') {
                    alertStr = "[GEOFENCE ALARM]";
                    type = 'alert';
                } else if (log.status === 'Stolen/Vibration') {
                    alertStr = "[THEFT ALARM]";
                    type = 'alert';
                } else if (log.status === 'Driving') {
                    type = 'system';
                }

                const line = document.createElement('div');
                line.className = `log-line ${type}`;
                line.innerHTML = `<span>[${log.timestamp.split(' ')[1]}]</span> <span>Pos: ${parseFloat(log.latitude).toFixed(4)}, ${parseFloat(log.longitude).toFixed(4)}</span> | <span>Speed: ${parseFloat(log.speed).toFixed(1)} km/h</span> | <span>Status: ${log.status} ${alertStr}</span>`;
                
                terminal.appendChild(line);
            });
            
            // Scroll to bottom
            terminal.scrollTop = terminal.scrollHeight;
        });
    }, 1500);
}

// Helper to append generic text to log terminal
function writeToConsole(message, type = 'system') {
    const terminal = document.getElementById('console-terminal');
    const now = new Date().toTimeString().split(' ')[0];
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.innerHTML = `<span>[${now}]</span> <span>${message}</span>`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

// 9. Audio Alarm Sound synthesis (Simulates buzzer hardware)
function triggerWebBuzzer(play) {
    if (play) {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!alarmInterval) {
            alarmInterval = setInterval(() => {
                beep(880, 150); // Beep at 880Hz for 150ms
            }, 300);
        }
    } else {
        if (alarmInterval) {
            clearInterval(alarmInterval);
            alarmInterval = null;
        }
    }
}

function beep(frequency, duration) {
    if (!audioCtx) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'square'; // Harsh square wave mimics piezo sound
        osc.frequency.value = frequency;
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime); // keep volume low
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration/1000);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + duration/1000);
    } catch (e) {
        console.warn("Audio Context beep error: ", e);
    }
}

// 10. Dashboard Alert UI overlays
function triggerAlertUI(active, title = "", desc = "") {
    const card = document.getElementById('alarm-box');
    const titleEl = document.getElementById('alert-title');
    const descEl = document.getElementById('alert-desc');

    if (active) {
        card.className = "glass-card alert-card alarm-state";
        titleEl.textContent = title;
        descEl.textContent = desc;
    } else {
        card.className = "glass-card alert-card clean-state";
        titleEl.textContent = "VEHICLE SECURE";
        descEl.textContent = "No active anomalies detected.";
    }
}

// 11. UI Buttons Event Listeners
function setupEventListeners() {
    // Speed update selection
    document.getElementById('sim-speed-select').addEventListener('change', () => {
        startSimulation(currentRouteName);
    });

    // Preset route buttons
    const routeButtons = {
        'sim-route-normal': 'normal',
        'sim-route-parked': 'parked',
        'sim-route-theft': 'theft',
        'sim-route-escape': 'escape',
        'sim-route-pune': 'pune'
    };

    Object.entries(routeButtons).forEach(([btnId, routeKey]) => {
        document.getElementById(btnId).addEventListener('click', (e) => {
            // Remove active classes
            document.querySelectorAll('.btn-sim').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            startSimulation(routeKey);
        });
    });

    // Remote engine lock switches
    document.getElementById('btn-lock').addEventListener('click', () => {
        fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'lock' })
        })
        .then(res => res.json())
        .then(data => {
            writeToConsole("[COMMAND SENT] Engine Lock Immobilizer command executed.", "command");
            syncDashboardState();
        });
    });

    document.getElementById('btn-unlock').addEventListener('click', () => {
        fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'unlock' })
        })
        .then(res => res.json())
        .then(data => {
            writeToConsole("[COMMAND SENT] Engine released. Vehicle is ready to drive.", "command");
            syncDashboardState();
        });
    });

    // Arming Toggle switch
    document.getElementById('toggle-arm').addEventListener('change', (e) => {
        const commandVal = e.target.checked ? 'arm' : 'disarm';
        fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: commandVal })
        })
        .then(res => res.json())
        .then(data => {
            writeToConsole(`[COMMAND SENT] System Anti-Theft Arming set to: ${commandVal.toUpperCase()}`, "command");
            syncDashboardState();
        });
    });

    // Save Geofence parameters
    document.getElementById('btn-save-geofence').addEventListener('click', () => {
        const lat = parseFloat(document.getElementById('geo-lat').value);
        const lon = parseFloat(document.getElementById('geo-lon').value);
        const rad = parseFloat(document.getElementById('geo-radius').value);

        if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
            alert("Invalid Geofence input values. Check numerical values.");
            return;
        }

        fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                geofence_lat: lat,
                geofence_lon: lon,
                geofence_radius: rad
            })
        })
        .then(res => res.json())
        .then(data => {
            writeToConsole(`[CONFIG UPDATED] Geofence redefined: Lat=${lat}, Lon=${lon}, Rad=${rad}m`, "system");
            syncDashboardState();
        });
    });

    // Clear logs from database
    document.getElementById('btn-clear-logs').addEventListener('click', () => {
        if (confirm("Are you sure you want to delete all stored vehicle telemetry logs from CSV?")) {
            fetch('/api/logs/clear', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                writeToConsole(`[SYSTEM DATABASE] CSV database cleared.`, "system");
                // Reset chart
                mockSpeedData = mockSpeedData.map(() => 0);
                speedChart.update();
                
                // Clear map trails
                travelHistory = [];
                if (pathPolyline) {
                    map.removeLayer(pathPolyline);
                    pathPolyline = null;
                }
                prevLat = null;
                prevLon = null;
            });
        }
    });

    // PDF compilation triggers
    document.getElementById('btn-gen-pdf').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "COMPILING REPORT...";
        
        fetch('/api/reports/generate', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                writeToConsole(`[REPORTS ENGINE] PDF generated successfully. Downloading file...`, "system");
                // Force browser download
                window.location.href = data.download_url;
            } else {
                alert("Report Generation failed: " + data.message);
            }
        })
        .catch(err => alert("Error compiling report: " + err))
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
    });

    // CSV Direct Download
    document.getElementById('btn-download-csv').addEventListener('click', () => {
        // Simple raw download of data/vehicle_logs.csv
        // Create an invisible anchor tag to download
        fetch('/api/logs?limit=500')
        .then(res => res.json())
        .then(logs => {
            if (logs.length === 0) {
                alert("No telemetry records logged yet. Start simulation paths first.");
                return;
            }
            
            // Build CSV string
            const headers = Object.keys(logs[0]).join(",");
            const rows = logs.map(row => Object.values(row).join(",")).join("\n");
            const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `vehicle_history_log_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            writeToConsole(`[REPORTS ENGINE] Telemetry CSV downloaded.`, "system");
        });
    });
}

// 12. Helper to calculate bearing between two coordinates for vehicle icon rotation
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
              
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}
