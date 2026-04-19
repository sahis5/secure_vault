# 🚀 ShieldCloud Complete Demonstration / Execution Guide

This guide will walk you exactly step-by-step through running the project and presenting everything.

---

## 🛠️ Phase 1: Booting the System

1.  **Open PowerShell or VS Code Terminal.** Ensure you are in the root directory: `C:\Users\sahis\Desktop\Final_proj_8th_sem`.
2.  **Run the startup script.** This script automatically orchestrates the 8 microservices.
    ```powershell
    .\start.ps1
    ```
    *Wait about 15-20 seconds for the `[OK]` messages to appear for all services. The script will then automatically open the React Dashboard in your browser (`http://localhost:5173`).*

---

## 🖥️ Phase 2: Live Demonstration Workflow

Follow these exact steps to demonstrate all the features of the application, from standard hybrid encryption to the AI self-healing.

### Step 1: Login & Infrastructure Tour
1.  **Login:** On the `http://localhost:5173` dashboard, perform a login (the mock user is `demo` / `password`, or it will auto-populate).
    *   **What this shows:** The frontend communicating with the **Auth Service (NestJS :3001)** via REST. 
2.  **Explain the Architecture:** Point out that under the hood, Docker is running **PostgreSQL** (metadata), **MinIO S3** (physical files), **RabbitMQ** (message broker), and **Redis** (rate limiting).

### Step 2: Upload & Quantum-Safe Encryption
1.  **Upload a File:** Click the **Upload Secure File** button. Pick any small `.txt` or `.png` file.
    *   **What this shows:** The file is sent to the **Storage Service (:3003)**, which proxies it to the **Encryption Service (:3002)**.
2.  **Explain the Cryptography:** While the tile appears in the vault list, explain what happened:
    *   The backend generated a 256-bit AES key. The physical physical file bytes were encrypted with `AES-256-GCM` and stored in MinIO.
    *   Simultaneously, the `liboqs` binding generated a Lattice-based **CRYSTALS-Kyber (ML-KEM-1024)** Keypair. The AES key was encapsulated by Kyber, becoming the `kyber_ciphertext`.
3.  **Prove the Cryptography:** Click the **`</>` (Code) icon** on the uploaded file tile.
    *   **What this shows:** It queries live data from PostgreSQL to reveal exactly what the quantum-secure keys look like. Point out the massive `kyber_ciphertext` string. This is pure lattice math, immune to Shor's Algorithm.

### Step 3: Machine Learning & Anomaly Detection
1.  **The ML Context:** Point to the "Live Anomaly Detection" area chart. It should be resting safely between `0.05` and `0.15`.
    *   **What this shows:** The React dashboard is connected to the **Risk Engine Service (:3005)** via WebSocket (`Socket.IO`).
2.  **Explain the AI:** Inform the audience that every single upload/download request is silently passed to the **Anomaly ML Service (:3004)**.
    *   The service extracts 20 features (Geo-location, Request Volume, IP mapping, Time of Day, etc.) and evaluates them through an industry-standard **XGBoost (eXtreme Gradient Boosting)** Model trained on thousands of synthetic attack logs via `SMOTE` class balancing.

### Step 4: Triggering the Harvest-Now-Decrypt-Later Attack
1.  **The Attack:** Inform the audience that hackers want to steal encrypted BLOBs *now* to decrypt them later when quantum computers exist.
2.  **Inject Threat:** Click the red **Inject Harvesting Attack** button.
    *   **What this shows:** The dashboard sends an extremely anomalous payload to the Risk Engine (simulating a foreign IP attempting to bulk download 5GB of `.bin` files in 60 minutes).
3.  **Detection:**
    *   Watch the chart immediately spike to `~0.98` and turn red.
    *   The Risk Threshold goes from `LOW` to `CRITICAL`.
    *   The Risk Engine instantly pushes a `risk.high` message to **RabbitMQ**.

### Step 5: AI-Driven Autonomous Self-Healing
1.  **The Worker Reacts:** Point out the yellow "Self-Healing Active" spinner animation and the rotating arrow icon.
    *   **What this shows:** The Python **Self-Healing Consumer** picked up the `risk.high` AMQP message. No human security administrator had to approve this play; the AI reacted intrinsically.
2.  **The Rotation:** The consumer triggered the Encryption Service to initiate a massive key rotation.
    *   The compromised user is locked out.
    *   The backend reaches into MinIO, downloads the `.bin` blobs using the OLD AES Key.
    *   It generates a **brand new AES Key**.
    *   It generates a **brand new Kyber-1024 Keypair**.
    *   It re-encrypts the bytes with the NEW keys, overwrites the vault storage, and overwrites PostgreSQL.
3.  **The Audit Log:** A few seconds later, the chart resets to `0.08`, and a massive Audit Log modal will pop up on the screen.
    *   **What this shows:** Point out the difference between the **OLD Kyber Key** and the **NEW Kyber Key** inside the JSON log.
    *   **The Checkmate:** Explain that the hacker is currently downloading useless ciphertexts because the keys they intended to harvest have been mathematically rotated out of existence.

---

## 🛑 Shutting Down
To gracefully stop all 8 microservices, simply click inside the PowerShell window where `start.ps1` is running and press `Ctrl + C`. Wait about 5 seconds while it performs a safe teardown of the jobs.
