import os
import csv
import math
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from dashboard.report_generator import generate_pdf_report

app = Flask(__name__, template_folder='templates', static_folder='static')

# File Paths - Resolved as absolute paths relative to the project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CSV_PATH = os.path.join(PROJECT_ROOT, 'data', 'vehicle_logs.csv')
PDF_DIR = os.path.join(PROJECT_ROOT, 'outputs', 'reports')
PDF_PATH = os.path.join(PDF_DIR, 'vehicle_history_report.pdf')

# Global System State (represents the live cloud status)
system_state = {
    'latitude': 18.5204,
    'longitude': 73.8567,
    'speed': 0.0,
    'satellites': 8,
    'geofence_lat': 18.5204,
    'geofence_lon': 73.8567,
    'geofence_radius': 150.0,  # in meters
    'is_armed': False,          # True = alert if moved/vibrated
    'engine_locked': False,     # True = immobilizer relay active
    'geofence_breached': False,
    'vibration_alert': False,   # True = theft vibration detected
    'status': 'Parked',         # Parked, Driving, Stolen, Geofence Breach
    'last_updated': 'N/A'
}

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """
    Computes distance in meters between two lat/lon points on a sphere.
    """
    R = 6371000.0  # Earth radius in meters
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2.0) ** 2 + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(d_lon / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def log_telemetry_to_csv(data):
    """
    Appends a new line of telemetry to the CSV history log.
    """
    file_exists = os.path.exists(CSV_PATH)
    
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    
    fields = [
        'timestamp', 'latitude', 'longitude', 'speed', 
        'satellites', 'geofence_breached', 'vibration_alert', 
        'engine_locked', 'status'
    ]
    
    try:
        with open(CSV_PATH, 'a', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            if not file_exists:
                writer.writeheader()
            writer.writerow(data)
    except Exception as e:
        print(f"Error logging telemetry to CSV: {str(e)}")

# Routes

@app.route('/')
def index():
    """
    Renders the modern visual dashboard.
    """
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    """
    Fetches the current live state of the vehicle tracker.
    """
    return jsonify(system_state)

@app.route('/api/telemetry', methods=['POST'])
def post_telemetry():
    """
    Receives incoming GPS updates from either ESP32 hardware or frontend simulator.
    """
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid JSON data payload'}), 400

    # Read values from request
    lat = float(data.get('latitude', system_state['latitude']))
    lon = float(data.get('longitude', system_state['longitude']))
    speed = float(data.get('speed', system_state['speed']))
    satellites = int(data.get('satellites', system_state['satellites']))
    vibration = bool(data.get('vibration_alert', system_state['vibration_alert']))

    # Perform backend geofence verification
    distance = calculate_haversine_distance(lat, lon, system_state['geofence_lat'], system_state['geofence_lon'])
    geofence_breached = distance > system_state['geofence_radius']

    # Update system state
    system_state['latitude'] = lat
    system_state['longitude'] = lon
    system_state['speed'] = speed
    system_state['satellites'] = satellites
    system_state['geofence_breached'] = geofence_breached
    system_state['vibration_alert'] = vibration
    system_state['last_updated'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Determine vehicle status
    if system_state['engine_locked']:
        system_state['status'] = 'Locked/Immobilized'
    elif geofence_breached:
        system_state['status'] = 'Geofence Breach'
    elif vibration and system_state['is_armed']:
        system_state['status'] = 'Stolen/Vibration'
    elif speed > 1.0:
        system_state['status'] = 'Driving'
    else:
        system_state['status'] = 'Parked'

    # Save details to CSV
    log_record = {
        'timestamp': system_state['last_updated'],
        'latitude': lat,
        'longitude': lon,
        'speed': speed,
        'satellites': satellites,
        'geofence_breached': geofence_breached,
        'vibration_alert': vibration,
        'engine_locked': system_state['engine_locked'],
        'status': system_state['status']
    }
    log_telemetry_to_csv(log_record)

    # Return commands so the device knows what switches to pull (Immobilizer/Buzzer)
    return jsonify({
        'status': 'success',
        'lock_command': system_state['engine_locked'],
        'arm_command': system_state['is_armed']
    })

@app.route('/api/command', methods=['POST'])
def send_command():
    """
    Accepts commands from the dashboard control center to update server locks,
    arm modes, or redefine geofence centers.
    """
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'No command JSON provided'}), 400

    if 'command' in data:
        cmd = data['command']
        if cmd == 'lock':
            system_state['engine_locked'] = True
            system_state['status'] = 'Locked/Immobilized'
        elif cmd == 'unlock':
            system_state['engine_locked'] = False
            system_state['status'] = 'Parked'
        elif cmd == 'arm':
            system_state['is_armed'] = True
        elif cmd == 'disarm':
            system_state['is_armed'] = False
            system_state['vibration_alert'] = False

    if 'geofence_lat' in data:
        system_state['geofence_lat'] = float(data['geofence_lat'])
    if 'geofence_lon' in data:
        system_state['geofence_lon'] = float(data['geofence_lon'])
    if 'geofence_radius' in data:
        system_state['geofence_radius'] = float(data['geofence_radius'])

    return jsonify({
        'status': 'success',
        'message': 'Command processed successfully',
        'state': system_state
    })

@app.route('/api/reports/generate', methods=['POST'])
def trigger_report():
    """
    Generates a PDF report from the logged tracking history.
    """
    os.makedirs(PDF_DIR, exist_ok=True)
    success, message = generate_pdf_report(CSV_PATH, PDF_PATH)
    
    if success:
        return jsonify({'status': 'success', 'message': message, 'download_url': '/api/reports/download'})
    else:
        return jsonify({'status': 'error', 'message': message}), 500

@app.route('/api/reports/download', methods=['GET'])
def download_report():
    """
    Serves the compiled PDF report for local download.
    """
    if os.path.exists(PDF_PATH):
        return send_file(PDF_PATH, as_attachment=True, download_name="vehicle_history_report.pdf")
    else:
        return jsonify({'status': 'error', 'message': 'Report not generated yet'}), 404

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """
    Returns the latest logs from the CSV file.
    """
    limit = request.args.get('limit', default=15, type=int)
    if not os.path.exists(CSV_PATH):
        return jsonify([])

    logs = []
    try:
        with open(CSV_PATH, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                logs.append(row)
        # Return recent records first
        return jsonify(logs[-limit:])
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/logs/clear', methods=['POST'])
def clear_logs():
    """
    Clears all logs in the CSV log file.
    """
    try:
        if os.path.exists(CSV_PATH):
            os.remove(CSV_PATH)
        return jsonify({'status': 'success', 'message': 'Telemetry logs successfully cleared.'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
