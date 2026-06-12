# Circuit Diagram & Hardware Wiring Guide

This document defines the physical electrical connections required to build the hardware portion of the **IoT Vehicle Tracking & Theft Prevention System** using an ESP32, Neo-6M GPS, Piezo Buzzer, Status LED, and a 5V Relay.

---

## 1. Schematic Connections Table

| Component | Component Pin | ESP32 Pin | Description |
| :--- | :--- | :--- | :--- |
| **Neo-6M GPS** | VCC | 3.3V / VIN | 3.3V or 5V Power Input (matches board variant) |
| **Neo-6M GPS** | GND | GND | Ground Reference |
| **Neo-6M GPS** | TX | RX2 (GPIO 16) | Serial data transmission (GPS to ESP32) |
| **Neo-6M GPS** | RX | TX2 (GPIO 17) | Serial data reception (ESP32 to GPS - optional) |
| **Active Buzzer**| Positive (+) | GPIO 18 | Triggers alarm signal when logic is HIGH |
| **Active Buzzer**| Negative (-) | GND | Ground Reference |
| **5V Relay** | VCC | VIN / 5V | Power supply for electromagnetic coil |
| **5V Relay** | GND | GND | Ground Reference |
| **5V Relay** | IN | GPIO 19 | Actuator control pin (LOW = Closed/Locked, HIGH = Open) |
| **Status LED** | Anode (+) | GPIO 2 | System health indicator LED |
| **Status LED** | Cathode (-) | GND | Ground Reference (via 220Ω resistor) |

---

## 2. ASCII Block Diagram

```text
                      +-------------------+
                      |   USB / Battery   |
                      |    5V Power In    |
                      +---------+---------+
                                |
                                ▼
  +-------------------------------------------------------------+
  |                        ESP32 Board                          |
  |                                                             |
  |  3.3V  GND   RX2(16) TX2(17) GPIO18  GPIO19   GPIO2   VIN   |
  +---+-----+-------+-------+-------+-------+-------+---+----+--+
      |     |       |       |       |       |       |   |    |
      |     |       |       |       |       |       |   |    |
      |     |       |       |       |       |       |   |    |
  +---v-----v-------v-------v---+   |       |       |   |    |
  | VCC    GND     TX      RX   |   |       |       |   |    |
  |                             |   |       |       |   |    |
  |      NEO-6M GPS Module      |   |       |       |   |    |
  +-----------------------------+   |       |       |   |    |
                                    |       |       |   |    |
  +---------------------------------v---+   |       |   |    |
  | (+)                             (-) |   |       |   |    |
  |                                     |   |       |   |    |
  |            PIEZO BUZZER             |   |       |   |    |
  +-------------------------------------+   |       |   |    |
                                            |       |   |    |
  +-----------------------------------------v---+   |   |    |
  | IN                                     GND  |   |   |    |
  |                                             |   |   |    |
  |         5V SINGLE CHANNEL RELAY             |   |   |    |
  |  (COM & NC in series with Ignition Line)    |   |   |    |
  +---+-------------------------------------v---+   |   |    |
      |                                     |       |   |    |
      |                                     +-------+   |    |
      |                                     |           |    |
      |                                     |     +-----v----+
      |                                     |     |  VCC     |
      |                                     |     +----------+
      |                                     |
  +---v-------------------------------------v---+
  | (+) Anode                      (-) Cathode  |
  |                                             |
  |      STATUS LED (with 220 Ohm Resistor)     |
  +---------------------------------------------+
```

---

## 3. Component Details & Connection Rationale

1. **GPS UART Connection:**
   The Neo-6M GPS module transmits data standard over TTL Serial logic. While SoftwareSerial is common in Arduino Uno systems, the ESP32 contains three hardware UART interfaces. We map GPS to hardware UART2 (`RX2/GPIO16` and `TX2/GPIO17`) to achieve high performance, reliability, and zero CPU overhead.

2. **Relay Control Switch:**
   The relay acts as an automated switch in the vehicle's electrical circuit. We connect the **Common (COM)** terminal of the relay to the ignition key cylinder and the **Normally Closed (NC)** terminal to the fuel pump/starter circuit. Under normal operation, the relay is unenergized (NC connected to COM), letting the engine start. When a theft event is registered, ESP32 pulls the control pin `IN` to energize the coil, opening the COM-NC contact and instantly stalling the engine.

3. **Audible Piezo Alarm:**
   The buzzer's positive lead is connected to GPIO 18. Setting this pin `HIGH` outputs 3.3V, causing the buzzer to emit a continuous high-frequency tone. We can also toggle the pin using PWM code to generate pulse alerts (beeping).

4. **Visual Indicator LED:**
   We configure GPIO 2 (builtin LED on many ESP32 modules) to provide physical status updates:
   - **Slow Blink (1Hz):** The ESP32 is powered on and attempting to locate GPS satellites.
   - **Solid ON:** GPS Lock successfully established with valid coordinates.
   - **Fast Blink (5Hz):** Geofence or vibration alert active.
