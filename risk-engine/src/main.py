from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import uvicorn
import socketio
import requests
from .scoring import evaluate_risk

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
app = FastAPI(title="Risk Engine Service", version="1.0.0")
sio_app = socketio.ASGIApp(sio, app)

ANOMALY_SERVICE_URL = "http://localhost:3004/analyze"
ENCRYPTION_SERVICE_URL = "http://localhost:3002/self-heal/rotate-keys"

class IngestEvent(BaseModel):
    user_id: str
    action_type: str
    ip_location_mismatch: int = 0
    download_count_last_1h: int = 0
    failed_logins_last_1h: int = 0
    bytes_transferred_last_1h: int = 0

@sio.event
async def connect(sid, environ):
    print("Dashboard Frontend connected via SocketIO:", sid)

@sio.event
async def disconnect(sid):
    print("Dashboard Frontend disconnected:", sid)

def trigger_self_healing(user_id: str):
    try:
        print(f"Triggering Post-Quantum Self-Healing for user {user_id}...")
        requests.post(ENCRYPTION_SERVICE_URL, timeout=10)
        print("Self-healing triggered successfully.")
    except Exception as e:
        print(f"Failed to trigger self-healing: {e}")

@app.post("/ingest")
async def ingest_event(event: IngestEvent, background_tasks: BackgroundTasks):
    # 1. Get real-time ML anomaly score from Anomaly Service
    try:
        response = requests.post(ANOMALY_SERVICE_URL, json=event.dict(), timeout=5)
        if response.status_code == 200:
            ml_data = response.json()
            is_anomaly = ml_data["is_anomaly"]
            anomaly_score = ml_data["anomaly_score"]
        else:
            is_anomaly = False
            anomaly_score = 0.1
    except Exception as e:
        print(f"Failed to reach anomaly service: {e}")
        is_anomaly = False
        anomaly_score = 0.1

    # 2. Process against Risk Engine EMA and Thresholds
    final_score, risk_level = evaluate_risk(
        user_id=event.user_id,
        anomaly_score=anomaly_score,
        login_fail=event.failed_logins_last_1h,
        geo_change=event.ip_location_mismatch,
        api_spike=1 if event.download_count_last_1h > 20 else 0,
        device_change=0
    )

    result = {
        "user_id": event.user_id,
        "action": event.action_type,
        "ml_anomaly_score": anomaly_score,
        "is_anomaly": is_anomaly,
        "final_composite_score": final_score,
        "risk_level": risk_level
    }

    # 3. Broadcast to any connected dashboards via SocketIO
    await sio.emit('risk_update', result)

    # 4. CRITICAL AUTOMATION: Auto-Heal Trigger
    if risk_level == "CRITICAL" and is_anomaly:
        background_tasks.add_task(trigger_self_healing, event.user_id)

    return result

@app.get("/health/live")
def liveness_probe():
    return {"status": "alive"}

@app.get("/health/ready")
def readiness_probe():
    return {"status": "ready"}

if __name__ == "__main__":
    uvicorn.run("src.main:sio_app", host="0.0.0.0", port=3005, reload=True)
