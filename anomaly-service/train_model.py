import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report
import joblib

def train():
    print("Loading synthetic dataset...")
    df = pd.read_csv("access_logs.csv")
    
    # Feature Engineering
    # One-hot encode the action_type
    df = pd.get_dummies(df, columns=['action_type'])
    
    # Ensure all expected columns exist even if some actions weren't in the random split (unlikely but safe)
    expected_actions = ['action_type_download', 'action_type_list', 'action_type_login', 'action_type_upload']
    for act in expected_actions:
        if act not in df.columns:
            df[act] = 0

    features = [
        'ip_location_mismatch', 
        'download_count_last_1h', 
        'failed_logins_last_1h', 
        'bytes_transferred_last_1h'
    ] + expected_actions

    X = df[features]
    y_true = df['label_anomaly'] # for validation only

    print("Training IsolationForest model...")
    # contamination=0.05 because we injected 5% anomalies
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(X)

    # Predict: IsolationForest returns -1 for anomaly, 1 for normal
    preds = model.predict(X)
    # Convert to 1 for anomaly, 0 for normal
    y_pred = [1 if p == -1 else 0 for p in preds]

    print("\nModel Evaluation (Validation against synthetic labels):")
    print(classification_report(y_true, y_pred))

    joblib.dump(model, "xgb_anomaly_model.pkl")
    print("Model saved to xgb_anomaly_model.pkl")

if __name__ == "__main__":
    train()
