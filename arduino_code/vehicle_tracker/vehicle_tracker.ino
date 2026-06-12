/**
 * IoT Vehicle Tracking & Theft Prevention System
 * ESP32 Firmware
 * 
 * Hardware requirements:
 * - ESP32 Development Board
 * - NEO-6M GPS Module connected to UART2 (RX2=GPIO16, TX2=GPIO17)
 * - 5V Relay Module connected to GPIO19 (Ignition Lock - Active Low)
 * - Active Piezo Buzzer connected to GPIO18 (Alarm Output)
 * - Status LED connected to GPIO2 (Visual indicator)
 * 
 * Library dependencies:
 * - TinyGPS++ (by Mikal Hart)
 * - WiFi (built-in ESP32)
 * - HTTPClient (built-in ESP32)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>

// Wi-Fi Credentials
// For Wokwi Virtual Simulator, use "Wokwi-GUEST" and empty password. For real ESP32, use your home router credentials.
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// Server API Endpoint (for local dashboard or cloud integrations)
// - If using Wokwi web simulator: Use a public tunnel URL (e.g., ngrok or localtunnel on port 5000, like "https://your-subdomain.ngrok-free.app/api/telemetry").
// - If using VS Code Wokwi extension or real hardware: Use your computer's local IP address (e.g., "http://192.168.1.100:5000/api/telemetry").
const char* telemetryUrl = "http://10.170.2.253:5000/api/telemetry"; 

// Pin Definitions
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
#define RELAY_PIN 19   // Controls ignition power (LOW = Engine cut-off/locked, HIGH = Normal)
#define BUZZER_PIN 18  // Sounds alarm (HIGH = Active sound)
#define STATUS_LED 2   // Built-in LED or status LED (HIGH = On)

// Geofence Configuration
double geofenceLat = 18.5204;  // Default Geofence Center Latitude (e.g., Pune Center)
double geofenceLon = 73.8567;  // Default Geofence Center Longitude
double geofenceRadius = 150.0; // Geofence radius in meters

// System States
bool isArmed = false;          // True when owner locks vehicle via dashboard
bool engineLocked = false;      // True when remote kill-switch or theft alert is triggered
bool geofenceBreached = false; // True when vehicle exits geofence radius

// GPS Parsing Engine
TinyGPSPlus gps;
HardwareSerial gpsSerial(2); // Use ESP32 Hardware Serial 2

// Timer variables
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 2000; // Send telemetry every 2 seconds

// Function declarations
double calculateDistance(double lat1, double lon1, double lat2, double lon2);
void handleIndicators();
void updateCloud(double lat, double lon, double speed, double satCount);
void checkGeofence(double currentLat, double currentLon);

void setup() {
  Serial.begin(115200);
  
  // Initialize GPS Serial
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  
  // Pin modes
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  
  // Set default hardware states (Engine Unlocked, Alarm Silent)
  digitalWrite(RELAY_PIN, HIGH); // Normally Open/Closed logic depends on relay wiring, HIGH enables NC (Ignition line connected)
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(STATUS_LED, LOW);
  
  // Connect to Wi-Fi Network
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  // Blink LED while connecting
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(STATUS_LED, HIGH);
    delay(250);
    digitalWrite(STATUS_LED, LOW);
    delay(250);
    Serial.print(".");
  }
  
  Serial.println("\nWi-Fi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  
  digitalWrite(STATUS_LED, HIGH); // Solid light indicates successful setup and Wi-Fi connection
}

void loop() {
  // Feed GPS serial stream into parser
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Handle local indicators based on alerts
  handleIndicators();

  // Periodically send data to server
  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();

    // Check if GPS has a valid location lock
    if (gps.location.isValid()) {
      double currentLat = gps.location.lat();
      double currentLon = gps.location.lng();
      double currentSpeed = gps.speed.kmph();
      int satellites = gps.satellites.value();

      Serial.printf("GPS Lock: Lat=%.6f, Lon=%.6f, Speed=%.2f km/h, Sats=%d\n", 
                    currentLat, currentLon, currentSpeed, satellites);

      // Check geofence status
      checkGeofence(currentLat, currentLon);

      // Upload parsed data to the server/cloud
      updateCloud(currentLat, currentLon, currentSpeed, satellites);
    } else {
      Serial.println("Waiting for valid GPS signal lock...");
      // Rapid LED flash when searching for satellites
      digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
    }
  }
}

/**
 * Calculates distance between two coordinates using the Haversine Formula.
 * Returns distance in meters.
 */
double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
  const double R = 6371000.0; // Earth radius in meters
  
  double dLat = (lat2 - lat1) * DEG_TO_RAD;
  double dLon = (lon2 - lon1) * DEG_TO_RAD;
  
  double a = sin(dLat / 2.0) * sin(dLat / 2.0) +
             cos(lat1 * DEG_TO_RAD) * cos(lat2 * DEG_TO_RAD) *
             sin(dLon / 2.0) * sin(dLon / 2.0);
             
  double c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  return R * c;
}

/**
 * Computes geofence breach and controls output relays and buzzers locally.
 */
void checkGeofence(double currentLat, double currentLon) {
  double distance = calculateDistance(currentLat, currentLon, geofenceLat, geofenceLon);
  Serial.printf("Distance to geofence center: %.2fm\n", distance);

  if (distance > geofenceRadius) {
    if (!geofenceBreached) {
      Serial.println("ALERT: Geofence boundary crossed!");
      geofenceBreached = true;
    }
  } else {
    geofenceBreached = false;
  }
}

/**
 * Updates indicators and actuators depending on system alarm states.
 */
void handleIndicators() {
  // Trigger relay lock and buzzer if theft is active, engine is locked or geofence is breached
  if (geofenceBreached || engineLocked) {
    // Sound buzzer in pulsing pattern
    int buzzerState = (millis() / 200) % 2; // Beep every 200ms
    digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
    
    // Fast flashing LED
    int ledState = (millis() / 100) % 2; // Flash LED every 100ms
    digitalWrite(STATUS_LED, ledState ? HIGH : LOW);
    
    // Lock ignition relay (cut fuel pump/spark plug circuit)
    digitalWrite(RELAY_PIN, LOW); // Pull low to open NC relays (breaks engine power line)
  } 
  else {
    // Standard status - alarm off, ignition active (HIGH outputs to NC connection)
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(RELAY_PIN, HIGH); // Closed ignition line
    
    // Solid LED when Wi-Fi is connected and GPS is locked
    if (gps.location.isValid()) {
      digitalWrite(STATUS_LED, HIGH);
    }
  }
}

/**
 * Transmits telemetry coordinates and checks for server override lock commands
 */
void updateCloud(double lat, double lon, double speed, double satCount) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(telemetryUrl);
    http.addHeader("Content-Type", "application/json");

    // Package details in JSON format
    String jsonPayload = "{";
    jsonPayload += "\"latitude\":" + String(lat, 6) + ",";
    jsonPayload += "\"longitude\":" + String(lon, 6) + ",";
    jsonPayload += "\"speed\":" + String(speed, 2) + ",";
    jsonPayload += "\"satellites\":" + String(satCount) + ",";
    jsonPayload += "\"geofence_breached\":" + String(geofenceBreached ? "true" : "false") + ",";
    jsonPayload += "\"engine_locked\":" + String(engineLocked ? "true" : "false");
    jsonPayload += "}";

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("HTTP Success Response: ");
      Serial.println(response);

      // Server can reply with a command to change engine lock state: {"lock_command": true/false, "arm_command": true/false}
      // Simple parser check for command triggers
      if (response.indexOf("\"lock_command\":true") >= 0) {
        engineLocked = true;
        Serial.println("Remote Lock command received from server.");
      } else if (response.indexOf("\"lock_command\":false") >= 0) {
        engineLocked = false;
        Serial.println("Remote Unlock command received from server.");
      }
      
      if (response.indexOf("\"arm_command\":true") >= 0) {
        isArmed = true;
      } else if (response.indexOf("\"arm_command\":false") >= 0) {
        isArmed = false;
      }
    } else {
      Serial.print("Error sending POST telemetry: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("Error: WiFi Connection lost!");
  }
}
