# 🛰️ IoT Vehicle Tracking & Theft Prevention System

An industry-grade, placement-ready Internet of Things (IoT) project featuring an **ESP32 C++ hardware firmware blueprint** and an **interactive Web-based simulation dashboard** built using Python Flask, Leaflet.js, and Chart.js.

This project is designed to act as a **proof of work** in your engineering portfolio, demonstrating full-stack IoT capabilities: embedded development, API routing, geofencing algorithms, mapping visualization, and automated corporate report generation.

![Dashboard Design Mockup](docs/dashboard_mockup.png)

---

## 🚀 Key Features

- **Dual-Mode Implementation:** Runnable both with physical hardware (ESP32 + Neo-6M GPS) and virtually via an interactive frontend routes simulator.
- **Sleek Glassmorphic UI:** Modern, responsive dark-mode dashboard with real-time status banners, CSS micro-interactions, and status counters.
- **Leaflet.js Mapping:** Dynamic route positioning with colored status markers, breadcrumb trails, and interactive geofencing radius overlays.
- **Chart.js Telemetry:** Interactive real-time velocity line graphs with tooltips and fluid transitions.
- **Remote Ignition Control:** Bidirectional REST API that lets owners send "Engine Lock" (relay cutoff) commands to stall the vehicle.
- **Web Audio Alert Synthesis:** Emits pulsing warning alarm buzzer sounds directly in the browser when boundaries are breached or vibration is detected.
- **Automated Report Engine:** Logs vehicle coordinates to a CSV database and compiles them into professional PDF reports with tables and statistics.

---

## ⚙️ System Architecture

```text
       [INPUTS]                         [PROCESSING]                         [OUTPUTS]
  ┌─────────────────┐             ┌──────────────────────┐             ┌─────────────────────┐
  │  Neo-6M GPS     │             │ ESP32 Parse Engine   │             │ Piezo Alarm Buzzer  │
  │  UART Telemetry │ ──(NMEA)──► │ (TinyGPS++ Decoder)  │ ──────────► │ GPIO Trigger        │
  └─────────────────┘             └──────────┬───────────┘             └─────────────────────┘
                                             │
                                       (HTTP POST API)
                                             ▼
                                  ┌──────────────────────┐
                                  │ Flask Backend Server │
                                  │ (CSV logs & PDF gen) │
                                  └──────────┬───────────┘
                                             │
                                       (JSON REST API)
                                             ▼
                                  ┌──────────────────────┐             ┌─────────────────────┐
                                  │ Glassmorphic Web UI  │ ──────────► │ Leaflet Map Tracking│
                                  │ (Telemetry Dashboard)│ ──────────► │ Chart.js Graphs     │
                                  └──────────────────────┘             └─────────────────────┘
```

---

## 📦 Project Directory Structure

```text
IoT-Vehicle-Tracking-Theft-Prevention/
│
├── arduino_code/
│   └── vehicle_tracker/
│       ├── vehicle_tracker.ino      # ESP32 firmware (GPS UART, local Haversine geofence, buzzer/relay outputs)
│       ├── diagram.json             # Wokwi simulation schematic diagram configuration
│       └── wokwi.toml               # Wokwi simulation startup configuration
│
├── dashboard/
│   ├── app.py                       # Python Flask web server (API endpoints, CSV logs, PDF compiling routes)
│   ├── report_generator.py          # Python report engine compiling CSV logs into PDF using ReportLab
│   ├── templates/
│   │   └── index.html               # Clean HTML5 layout with Leaflet maps, ChartJS, and console logs
│   └── static/
│       ├── css/
│       │   └── style.css            # Custom glassmorphic styles, neon alerts, grids, and keyframe animations
│       └── js/
│           └── app.js               # Leaflet map, Chart.js, sound synthesis, simulation routes, buttons logic
│
├── data/
│   └── vehicle_logs.csv             # Automated telemetric CSV database (created on run)
│
├── outputs/
│   └── reports/                     # Output directory for generated PDF reports (created on run)
│
├── circuit_diagram/
│   └── schematic.md                 # ASCII block diagram & wiring instructions for ESP32 + GPS + Buzzer + Relay
│
├── docs/
│   └── documentation.md             # Complete theory, industry use cases, and 10 interview preparation Q&As
│   └── dashboard_mockup.png         # Glassmorphic user interface design mockup
│
├── requirements.txt                 # Python libraries list (Flask, reportlab, requests)
├── main.py                          # Startup script (starts local Flask server and opens dashboards)
└── README.md                        # Master repository documentation
```

---

## 🛠️ Hardware Connection Pinout

If you are building the physical device, connect your components according to the table below. For further details, refer to the [Schematic Wiring Guide](circuit_diagram/schematic.md).

| Component | Component Pin | ESP32 GPIO Pin | Description |
| :--- | :--- | :--- | :--- |
| **NEO-6M GPS** | VCC | 3V3 | Power (3.3V) |
| | GND | GND | Ground Reference |
| | TX | RX2 (GPIO 16) | Serial Transmission to ESP32 |
| | RX | TX2 (GPIO 17) | Serial Reception from ESP32 |
| **5V Relay Module** | VCC | 5V | Power (5V) |
| | GND | GND | Ground Reference |
| | IN | GPIO 19 | Active LOW coil control (Ignition Lock) |
| | COM | 3V3 | Common terminal |
| | NO | Green LED Anode | Normally Open output line |
| **Active Buzzer** | Positive (+) | GPIO 18 | High output triggers sound |
| | Negative (-) | GND | Ground Reference |
| **Status LED (Blue)** | Anode (+) | GPIO 2 | System visual indicator |
| | Cathode (-) | GND (via 220Ω resistor) | Current limiting ground |
| **Engine LED (Green)**| Anode (+) | Relay NO | Engine activity indicator |
| | Cathode (-) | GND (via 220Ω resistor) | Current limiting ground |

---

## 🔌 API Endpoints Reference

The Flask server hosts several REST API routes to exchange telemetry and commands between the hardware (or virtual frontend simulator) and the browser dashboard.

### 1. Device Telemetry
* **Endpoint:** `POST /api/telemetry`
* **Content-Type:** `application/json`
* **Payload Structure:**
  ```json
  {
    "latitude": 18.520400,
    "longitude": 73.856700,
    "speed": 22.5,
    "satellites": 8,
    "geofence_breached": false,
    "engine_locked": false
  }
  ```
* **Success Response (200 OK):** Returns commands from the server to control the ESP32 state:
  ```json
  {
    "status": "success",
    "lock_command": false,
    "arm_command": true
  }
  ```

### 2. User Commands
* **Endpoint:** `POST /api/command`
* **Content-Type:** `application/json`
* **Payload Options:**
  * Lock/Unlock: `{"command": "lock"}` or `{"command": "unlock"}`
  * Arm/Disarm: `{"command": "arm"}` or `{"command": "disarm"}`
  * Reconfigure Geofence: `{"geofence_lat": 18.5204, "geofence_lon": 73.8567, "geofence_radius": 150.0}`
* **Success Response (200 OK):** Returns updated server state.

### 3. Reporting and Logs
* **GET `/api/logs`** - Returns the last 15 logged database records from `vehicle_logs.csv`.
* **POST `/api/logs/clear`** - Clears all entries in the local CSV file.
* **POST `/api/reports/generate`** - Automatically compiles local telemetry database logs into a professional PDF report.
* **GET `/api/reports/download`** - Downloads the generated PDF summary report.

---

## 🌐 Wokwi Virtual Hardware Simulation

You can run the physical microcontroller and sensor hardware virtually using Wokwi!

### File Locations:
- **Wokwi configuration:** [wokwi.toml](arduino_code/vehicle_tracker/wokwi.toml)
- **Circuit schematic:** [diagram.json](arduino_code/vehicle_tracker/diagram.json)

### How to Run:
1. **Online (Wokwi.com):**
   - Go to the [Wokwi ESP32 Simulator](https://wokwi.com/projects/new/esp32).
   - Copy the C++ code from [vehicle_tracker.ino](arduino_code/vehicle_tracker/vehicle_tracker.ino) into the `sketch.ino` editor tab.
   - Click on the `diagram.json` tab, and paste the contents of our [diagram.json](arduino_code/vehicle_tracker/diagram.json) file there. The circuit layout (ESP32, Neo-6M GPS, Relay, Buzzer, LED) will automatically connect!
   - Click **Start Simulation**.
2. **Offline (VS Code extension):**
   - Install the **Wokwi Simulator** extension in VS Code.
   - Open the `arduino_code/vehicle_tracker/` folder.
   - Press `F1` and select **Wokwi: Start Simulator**. Wokwi will compile the code and execute the interactive virtual circuit locally!

### ⚠️ Network Configuration (Crucial)
To let the virtual ESP32 send tracking data to your local dashboard:
* When you run `python main.py`, note the host IP output in your terminal (e.g., `http://10.170.2.253:5000`).
* Open `vehicle_tracker.ino` and update `telemetryUrl` to match that IP:
  ```cpp
  const char* telemetryUrl = "http://YOUR_LOCAL_IP:5000/api/telemetry";
  ```
* If the IP is incorrect or the backend is offline, the firmware's HTTP POST call will hit a **5-second timeout**, which freezes the simulation's main loop and prevents indicators from updating dynamically.

### 💡 LED Bulb Indicator Behavior
* **Blue Bulb (Status/WiFi - Pin 2):**
  * **Solid ON:** System is running normally (connected to WiFi with a valid GPS lock).
  * **Slow Blink (2-sec):** Searching/waiting for a valid GPS signal lock.
  * **Rapid Blink (100ms):** ALERT! Geofence breach or remote engine cutoff activated.
* **Green Bulb (Engine Ignition - Relay NO):**
  * **Solid ON:** Engine is running (Normal state).
  * **Solid OFF:** Engine cutoff is activated (Theft/Breach state).
  * *Note: The green bulb is a static power indicator for the ignition circuit and does not flash.*

---

## 🚀 Getting Started & Local Simulation

You do not need physical hardware to run and evaluate this project! The virtual simulation mode mimics exactly how the ESP32 posts GPS data to the server.

### Prerequisites
Make sure Python 3 is installed on your computer.

### Step 1: Install Dependencies
Open a terminal in the project directory and run:
```bash
pip install -r requirements.txt
```

### Step 2: Start the Web Dashboard
Execute the server startup entrypoint:
```bash
python main.py
```

### Step 3: Access the Interface
Open your web browser and navigate to:
```text
http://127.0.0.1:5000
```

---

## 🖥️ Using the Simulation Dashboard

1. **Simulation Control Deck (Bottom Panel):**
   - Click between the route presets:
     - **Route A (Normal Commute):** Loops a driver route staying inside the 150m geofence safety radius.
     - **Route B (Parked / Armed):** Simulates static parking. Tick the "System Anti-Theft Arming" toggle. After a few seconds, the simulator triggers a vibration bump alert, sounding the alarm!
     - **Route C (Vehicle Theft):** Simulates theft. Coordinates move while the system is Armed, sounding alarms. Click **LOCK ENGINE** to activate the relay, forcing the vehicle speed to 0.0 and shutting down movement.
     - **Route D (Geofence Escape):** Vehicle drives in a straight line out of the 150m boundary. Instantly triggers geofence alarms.
2. **Active Audio Alarm:**
   - The browser will generate a physical warning tone (beeping) when alert states trigger. Make sure your speaker volume is up!
3. **Geofence Dials (Right Panel):**
   - Redefine geofence centers by entering coordinates and radius, then click **UPDATE GEOFENCE ZONE**. The map overlay will adjust instantly.
4. **Reports Section:**
   - Click **DOWNLOAD CSV** to fetch telemetry points.
   - Click **COMPILE PDF REPORT** to generate a structured analysis table (stored in `outputs/reports/`).

---

## 🛠️ Troubleshooting Guide

> [!TIP]
> **Issue: Wokwi Simulator is freezing or LEDs are unresponsive.**
> * **Cause:** The ESP32 is attempting to connect to an unreachable or incorrect local IP address.
> * **Fix:** Ensure `telemetryUrl` in `vehicle_tracker.ino` is updated with your computer's local IP address (printed when starting `main.py`).

> [!WARNING]
> **Issue: `Address already in use` or Port 5000 is blocked.**
> * **Cause:** Another process (or a zombie python process) is already listening on port 5000.
> * **Fix:** Terminate the other process or change the port in `main.py` (e.g. `port=5001`) and reflect it in the ESP32 code.

> [!NOTE]
> **Issue: Blue LED flashes slowly every 2 seconds.**
> * **Cause:** The ESP32 does not have a valid GPS lock (`gps.location.isValid()` is false).
> * **Fix:** In Wokwi, ensure the GPS module is active. On real hardware, place the GPS antenna near a window or outdoors to get a clear sky view.

---

## 📁 GitHub Portfolio Upload Strategy

Use this strategy to showcase this project to tech recruiters and placement coordinators on GitHub:

### 1. Recommended Repository Settings
- **Repository Name:** `iot-vehicle-tracking-theft-prevention`
- **Description:** `Production-grade IoT vehicle telematics platform using ESP32, Python Flask, and Leaflet maps. Features real-time GPS tracking, local Haversine geofencing, remote engine cutoff, and automatic PDF reports.`
- **GitHub Tags:** `iot`, `esp32`, `python`, `flask`, `leafletjs`, `geofencing`, `telematics`, `embedded-systems`, `sensors`

### 2. Suggested Commit Plan
- **Commit 1:** `feat: initialize folder structure and documentation guides`
- **Commit 2:** `feat: add esp32 arduino C++ tracking firmware`
- **Commit 3:** `feat: build python flask server with telemetry and report generator`
- **Commit 4:** `feat: create glassmorphic HTML/CSS/JS telemetry dashboard`
- **Commit 5:** `docs: finalize master README and startup guidelines`
