# ╔══════════════════════════════════════════════════════════════╗
# ║  ShieldCloud — Single-Command Launcher (start.ps1)          ║
# ║  Starts all services: Docker + Auth + Storage + Encrypt + UI ║
# ╚══════════════════════════════════════════════════════════════╝

$root = $PSScriptRoot
$banner = @"
 ____  _     _      _     _  ____ _                 _ 
/ ___|| |__ (_) ___| | __| |/ ___| | ___  _   _  __| |
\___ \| '_ \| |/ _ \ |/ _` | |   | |/ _ \| | | |/ _` |
 ___) | | | | |  __/ | (_| | |___| | (_) | |_| | (_| |
|____/|_| |_|_|\___|_|\__,_|\____|_|\___/ \__,_|\__,_|

Post-Quantum Cloud Storage System  |  Starting all services...
"@
Write-Host $banner -ForegroundColor Cyan

# ── 1. Docker Infrastructure (PostgreSQL, MinIO, Redis, RabbitMQ) ──────────────
Write-Host "`n[1/5] Starting Docker infrastructure..." -ForegroundColor Yellow
$dockerJob = Start-Job -ScriptBlock {
    param($r)
    Set-Location "$r\infra"
    docker-compose up -d 2>&1
} -ArgumentList $root
Wait-Job $dockerJob -Timeout 30 | Out-Null
Write-Host "      ✓ Docker containers started (PostgreSQL, MinIO, Redis, RabbitMQ)" -ForegroundColor Green
Start-Sleep -Seconds 3

# ── 2. Auth Service (NestJS :3001) ──────────────────────────────────────────────
Write-Host "[2/5] Starting Auth Service on :3001..." -ForegroundColor Yellow
$authJob = Start-Job -ScriptBlock {
    param($r)
    Set-Location "$r\auth-service"
    npm run start 2>&1
} -ArgumentList $root
Start-Sleep -Seconds 2
Write-Host "      ✓ Auth Service started" -ForegroundColor Green

# ── 3. Storage Service (NestJS :3003) ───────────────────────────────────────────
Write-Host "[3/5] Starting Storage Service on :3003..." -ForegroundColor Yellow
$storageJob = Start-Job -ScriptBlock {
    param($r)
    Set-Location "$r\storage-service"
    npm run start 2>&1
} -ArgumentList $root
Start-Sleep -Seconds 2
Write-Host "      ✓ Storage Service started" -ForegroundColor Green

# ── 4. Encryption Service (FastAPI/Uvicorn :3002) ───────────────────────────────
Write-Host "[4/5] Starting Encryption Service on :3002..." -ForegroundColor Yellow
$encJob = Start-Job -ScriptBlock {
    param($r)
    Set-Location "$r\encryption-service"
    # Try to use the venv python if available, else fall back to system python
    $python = if (Test-Path "$r\encryption-service\venv\Scripts\python.exe") {
        "$r\encryption-service\venv\Scripts\python.exe"
    } else { "python" }
    & $python -m uvicorn src.main:app --host 0.0.0.0 --port 3002 --reload 2>&1
} -ArgumentList $root
Start-Sleep -Seconds 3
Write-Host "      ✓ Encryption Service started" -ForegroundColor Green

# ── 5. Frontend (Vite / React :5173) ────────────────────────────────────────────
Write-Host "[5/5] Starting Frontend on :5173..." -ForegroundColor Yellow
$frontJob = Start-Job -ScriptBlock {
    param($r)
    Set-Location "$r\frontend"
    npm run dev 2>&1
} -ArgumentList $root
Start-Sleep -Seconds 4
Write-Host "      ✓ Frontend started" -ForegroundColor Green

# ── All Done ─────────────────────────────────────────────────────────────────────
Write-Host "`n╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  All services are running!                       ║" -ForegroundColor Cyan
Write-Host "║                                                  ║" -ForegroundColor Cyan
Write-Host "║  Dashboard  →  http://localhost:5173             ║" -ForegroundColor Cyan
Write-Host "║  Auth API   →  http://localhost:3001             ║" -ForegroundColor Cyan
Write-Host "║  Storage    →  http://localhost:3003             ║" -ForegroundColor Cyan
Write-Host "║  Encrypt    →  http://localhost:3002             ║" -ForegroundColor Cyan
Write-Host "║  MinIO UI   →  http://localhost:9001             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Auto-open browser after 5 seconds
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"
Write-Host "Browser opened. Press Ctrl+C to stop all services." -ForegroundColor Gray

# Keep script alive, stream logs from all jobs
try {
    while ($true) {
        $jobs = @($authJob, $storageJob, $encJob, $frontJob)
        foreach ($job in $jobs) {
            $output = Receive-Job $job 2>&1
            if ($output) { Write-Host $output }
        }
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host "`nShutting down all services..." -ForegroundColor Red
    Stop-Job $authJob, $storageJob, $encJob, $frontJob
    Remove-Job $authJob, $storageJob, $encJob, $frontJob -Force
}
