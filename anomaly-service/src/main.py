from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
import joblib
import pandas as pd
import os

app = FastAPI(title="Anomaly Detection Service", version="1.0.0")

# Load model globally if it exists
MODEL_PATH = "xgb_anomaly_model.pkl"
try:
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print("Loaded ML model successfully.")
    else:
        model = None
        print("Warning: ML model not found. Using fallback heuristics.")
except Exception as e:
    model = None
    print(f"Error loading model: {e}")

class EventPayload(BaseModel):
    user_id: str
    action_type: str
    ip_location_mismatch: int
    download_count_last_1h: int
    failed_logins_last_1h: int
    bytes_transferred_last_1h: int

@app.get("/health/live")
def liveness_probe():
    return {"status": "alive"}

@app.get("/health/ready")
def readiness_probe():
    return {"status": "ready", "model_loaded": model is not None}

@app.post("/analyze")
def analyze_event(event: EventPayload):
    # If ML model isn't loaded (dev environment), fallback to simple heuristic
    if not model:
        score = 0.9 if event.download_count_last_1h > 50 else 0.1
        return {"anomaly_score": score, "is_anomaly": score > 0.8}

    # Prepare DataFrame matching training features
    # expected: ip_location_mismatch, download_count_last_1h, failed_logins_last_1h, bytes_transferred_last_1h, 
    # action_type_download, action_type_list, action_type_login, action_type_upload
    
    # One-hot encoding logic matching training
    is_download = 1 if event.action_type == 'download' else 0
    is_list = 1 if event.action_type == 'list' else 0
    is_login = 1 if event.action_type == 'login' else 0
    is_upload = 1 if event.action_type == 'upload' else 0

    df = pd.DataFrame([{
        'ip_location_mismatch': event.ip_location_mismatch,
        'download_count_last_1h': event.download_count_last_1h,
        'failed_logins_last_1h': event.failed_logins_last_1h,
        'bytes_transferred_last_1h': event.bytes_transferred_last_1h,
        'action_type_download': is_download,
        'action_type_list': is_list,
        'action_type_login': is_login,
        'action_type_upload': is_upload
    }])

    # Predict: -1 is anomaly, 1 is normal
    prediction = model.predict(df)[0]
    
    # We can also get decision_function: lower is more anomalous
    # Normalized roughly to 0-1 for probability proxy
    raw_score = model.decision_function(df)[0]
    
    if prediction == -1:
        # It's an anomaly. Clamp score between 0.8 and 1.0 based on how negative
        anomaly_score = min(1.0, 0.8 + abs(raw_score))
    else:
        # Normal. Clamp score between 0.0 and 0.5
        anomaly_score = max(0.0, 0.5 - raw_score)

    return {
        "anomaly_score": round(anomaly_score, 3),
        "is_anomaly": prediction == -1,
        "raw_isolation_score": raw_score
    }

if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=3004, reload=True)
