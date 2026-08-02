import subprocess
import sys
import os
import time

def main():
    print("==================================================================")
    print("🚀 Starting JobPilot AI Platform (Node Express + Python FastAPI)")
    print("==================================================================")

    # 1. Start Node.js Express server
    node_cmd = [sys.executable, "-c", "import os; os.system('npm start')"] if sys.platform != "win32" else ["cmd", "/c", "npm start"]
    # Alternatively run node server directly
    node_process = subprocess.Popen(["node", "server/index.js"])

    # 2. Start Python FastAPI uvicorn engine
    fastapi_process = subprocess.Popen([sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"])

    print("\n✅ Node.js Express Server running at: http://localhost:3000")
    print("✅ Python FastAPI AI Engine running at: http://localhost:8000")
    print("👉 Open your browser at: http://localhost:3000\n")
    print("Press Ctrl+C to stop all services.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping JobPilot AI services...")
        node_process.terminate()
        fastapi_process.terminate()
        print("Services stopped gracefully.")

if __name__ == "__main__":
    main()
