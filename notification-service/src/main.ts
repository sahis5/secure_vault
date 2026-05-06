import * as amqp from 'amqplib';
import nodemailer from 'nodemailer';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL || 'security-team@shieldcloud.io';
const SERVICE_EMAIL = process.env.SERVICE_EMAIL || 'no-reply@shieldcloud.io';
const NOTIF_PORT = parseInt(process.env.NOTIF_PORT || '3006', 10);

// ── Socket.IO server for real-time frontend push ────────────────────────────
const httpServer = createServer();
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/notifications',
});

io.on('connection', (socket) => {
  console.log('[Notification] Dashboard connected via Socket.IO:', socket.id);
  socket.on('disconnect', () => {
    console.log('[Notification] Dashboard disconnected:', socket.id);
  });
});

httpServer.listen(NOTIF_PORT, '0.0.0.0', () => {
  console.log(`[Notification] Real-time Socket.IO server on http://0.0.0.0:${NOTIF_PORT}`);
});

// ── Ethereal SMTP Transporter (preview URL in console) ─────────────────────
let transporter: nodemailer.Transporter;

async function createTransporter() {
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  console.log('[Notification] Ethereal SMTP ready:', testAccount.user);
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function sendSecurityAlert(payload: Record<string, any>) {
  const anomalyPct = (((payload['anomaly_score'] as number) ?? 0) * 100).toFixed(1);
  const geoKmh = ((payload['geo_velocity_kmh'] as number) ?? 0).toLocaleString();
  const bytesStr = formatBytes((payload['bytes_transferred'] as number) ?? 0);
  const ts = new Date((((payload['timestamp'] as number) ?? Date.now() / 1000)) * 1000).toISOString();
  const tempPassword = generateTempPassword();

  // ── 1. Push real-time toast to ALL connected dashboards ──────────────────
  const alertPayload = {
    type: 'critical',
    message: `🚨 HNDL Attack neutralized! ML Score: ${anomalyPct}% · All keys rotated. Re-login required.`,
    anomaly_score: payload['anomaly_score'],
    geo_velocity_kmh: payload['geo_velocity_kmh'],
    timestamp: ts,
    user_id: payload['user_id'],
    temp_password: tempPassword,
  };
  io.emit('security_alert', alertPayload);
  // Also emit force_logout to boot ALL connected sessions
  io.emit('force_logout', {
    reason: 'Harvest-Now-Decrypt-Later attack detected. All sessions invalidated for security.',
    timestamp: ts,
    temp_password: tempPassword,
  });
  console.log(`[Notification] Pushed security_alert + force_logout to ${io.engine.clientsCount} connected clients`);

  // ── 2. Determine recipients (user email from payload, fallback to admin) ──
  const recipientEmail = (payload['user_email'] as string) || ALERT_EMAIL_TO;
  const userName = (payload['user_name'] as string) || 'ShieldCloud User';

  // ── 3. Send Ethereal preview email ───────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { margin:0; padding:0; background:#0D1117; font-family: 'Segoe UI', Arial, sans-serif; color: #E6EDF3; }
    .container { max-width:600px; margin:40px auto; background:#161B22; border-radius:12px; border:1px solid #30363D; overflow:hidden; }
    .header { background:linear-gradient(135deg,#C0392B,#8E1010); padding:32px; text-align:center; }
    .header h1 { font-size:24px; font-weight:800; margin:0; letter-spacing:0.05em; }
    .header p { margin:8px 0 0; color:#FECACA; font-size:14px; }
    .body { padding:32px; }
    .alert-badge { display:inline-block; background:#C0392B22; border:1px solid #C0392B; color:#FC8181; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; letter-spacing:.1em; margin-bottom:24px; }
    .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:24px 0; }
    .stat { background:#0D1117; border:1px solid #30363D; border-radius:8px; padding:16px; }
    .stat label { display:block; font-size:10px; color:#8B949E; text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px; }
    .stat value { font-size:18px; font-weight:700; color:#F85149; }
    .divider { border:none; border-top:1px solid #30363D; margin:24px 0; }
    .success-box { background:#0F2A1E; border:1px solid #238636; border-radius:8px; padding:16px; margin-top:24px; }
    .success-box h3 { color:#3FB950; margin:0 0 8px; font-size:14px; }
    .success-box p { color:#7EE8A2; font-size:13px; margin:4px 0; }
    .pw-box { background:#1A1226; border:2px solid #7C3AED; border-radius:8px; padding:16px; margin-top:16px; text-align:center; }
    .pw-box p { color:#A78BFA; font-size:12px; margin:0 0 8px; text-transform:uppercase; letter-spacing:.08em; }
    .pw-box .pw { font-family:monospace; font-size:22px; font-weight:900; color:#DDD6FE; letter-spacing:.15em; }
    .warning-box { background:#1C1205; border:1px solid #F59E0B; border-radius:8px; padding:16px; margin-top:16px; }
    .warning-box p { color:#FCD34D; font-size:13px; margin:4px 0; }
    .footer { padding:20px 32px; background:#0D1117; text-align:center; color:#484F58; font-size:12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡 ShieldCloud Security Alert</h1>
      <p>Automated threat detection — Immediate action taken</p>
    </div>
    <div class="body">
      <span class="alert-badge">CRITICAL THREAT NEUTRALIZED</span>
      <h2 style="margin:0 0 8px;font-size:18px;">Harvest-Now-Decrypt-Later Attack Detected</h2>
      <p style="color:#8B949E;font-size:14px;margin:0 0 4px;">Hi <strong style="color:#E6EDF3;">${userName}</strong>,</p>
      <p style="color:#8B949E;font-size:14px;margin:0;">Our XGBoost ML model flagged an anomalous access attempt on your account at <strong style="color:#E6EDF3;">${ts}</strong>. All cryptographic keys have been automatically rotated and your session has been terminated for security.</p>
      <div class="stat-grid">
        <div class="stat"><label>ML Anomaly Score</label><value>${anomalyPct}%</value></div>
        <div class="stat"><label>Geo Velocity</label><value>${geoKmh} km/h</value></div>
        <div class="stat"><label>Data Targeted</label><value>${bytesStr}</value></div>
        <div class="stat"><label>Attack Vector</label><value style="font-size:13px;">${payload['ip_location_mismatch'] ? 'Foreign IP / VPN' : 'Insider Threat'}</value></div>
      </div>
      <hr class="divider"/>
      <div class="success-box">
        <h3>✅ Self-Healing Complete</h3>
        <p>— All AES-256-GCM session keys rotated</p>
        <p>— All CRYSTALS-Kyber ML-KEM-1024 keypairs regenerated</p>
        <p>— Your session has been forcibly terminated</p>
        <p>— Harvested ciphertext is now mathematically useless</p>
      </div>
      <div class="warning-box">
        <p><strong>⚠ ACTION REQUIRED:</strong> You have been logged out of all devices.</p>
        <p>Use your existing password to log back in. If you suspect your password was compromised, use the temporary password below:</p>
      </div>
      <div class="pw-box">
        <p>Temporary Password (valid 24h)</p>
        <div class="pw">${tempPassword}</div>
      </div>
      <p style="margin-top:24px;font-size:12px;color:#8B949E;">If you did not initiate this, no action is needed — our system has already neutralized the threat. Change your password after logging in.</p>
    </div>
    <div class="footer">ShieldCloud 2026 — Post-Quantum Cloud Security</div>
  </div>
</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from: `"ShieldCloud Security" <${SERVICE_EMAIL}>`,
      to: recipientEmail,
      subject: `[CRITICAL] Security Alert — HNDL Attack Neutralized & Sessions Invalidated — ${ts}`,
      html,
    });
    console.log('\n================================================================');
    console.log('  SECURITY EMAIL DISPATCHED');
    console.log(`  To       : ${recipientEmail}`);
    console.log(`  ML Score : ${anomalyPct}%  |  Geo: ${geoKmh} km/h`);
    console.log(`  Temp PW  : ${tempPassword}`);
    console.log('----------------------------------------------------------------');
    console.log(`  PREVIEW  : ${nodemailer.getTestMessageUrl(info)}`);
    console.log('================================================================\n');
  } catch (e) {
    console.error('[Notification] Email send failed:', e);
  }
}

async function startConsumer(): Promise<void> {
  await createTransporter();

  let retries = 0;
  while (true) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      const channel = await (conn as any).createChannel();

      await channel.assertQueue('risk.high', { durable: true });
      await channel.assertQueue('healing.complete', { durable: true });

      console.log('[Notification] Connected to RabbitMQ. Waiting for security events...');
      retries = 0;

      channel.consume('risk.high', async (msg: amqp.GetMessage | null) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString()) as Record<string, any>;
          console.log('[Notification] CRITICAL alert received for user:', payload['user_id']);
          await sendSecurityAlert(payload);
          channel.ack(msg);
        } catch (e) {
          console.error('[Notification] Failed to process alert:', e);
          channel.nack(msg, false, false);
        }
      });

      channel.consume('healing.complete', async (msg: amqp.GetMessage | null) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString()) as Record<string, any>;
          console.log('[Notification] Healing complete for:', payload['user_id']);
          io.emit('healing_complete', {
            message: `✅ Key rotation complete. Your vault is secure again.`,
            timestamp: new Date().toISOString(),
          });
          channel.ack(msg);
        } catch (e) {
          channel.nack(msg, false, false);
        }
      });

      await new Promise<void>((_, reject) => {
        (conn as any).on('error', reject);
        (conn as any).on('close', reject);
      });
    } catch (e) {
      retries++;
      const wait = Math.min(retries * 3, 30);
      console.log(`[Notification] RabbitMQ unavailable. Retry in ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
    }
  }
}

startConsumer().catch(console.error);
