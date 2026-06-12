import os
from dashboard.app import app

if __name__ == '__main__':
    # Ensure standard directory structure exists
    os.makedirs('data', exist_ok=True)
    os.makedirs('outputs/reports', exist_ok=True)
    
    print("----------------------------------------------------------------")
    print(" IoT Vehicle Tracking & Theft Prevention System")
    print(" Local Web Interface & Simulation Dashboard")
    print(" URL: http://127.0.0.1:5000")
    print("----------------------------------------------------------------")
    
    # Start the Flask web app
    app.run(debug=True, host='0.0.0.0', port=5000)
