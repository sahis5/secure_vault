import * as amqp from 'amqplib';
import nodemailer from 'nodemailer';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL || 'user@shieldcloud.io';
const SERVICE_EMAIL = process.env.SERVICE_EMAIL || 'security@shieldcloud.io';

// ── Mock SMTP Transporter (Ethereal — no real credentials needed) ─────────────
let transporter: nodemailer.Transporter;

async function createTransporter() {
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  console.log('[Notification] SMTP mock account ready:', testAccount.user);
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function sendSecurityAlert(payload: Record<string, any>) {
  const anomalyPct = (((payload['anomaly_score'] as number) ?? 0) * 100).toFixed(1);
  const geoKmh = ((payload['geo_velocity_kmh'] as number) ?? 0).toLocaleString();
  const bytesStr = formatBytes((payload['bytes_transferred'] as number) ?? 0);
  const ts = new Date((((payload['timestamp'] as number) ?? Date.now() / 1000)) * 1000).toISOString();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
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
    .footer { padding:20px 32px; background:#0D1117; text-align:center; color:#484F58; font-size:12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ShieldCloud Security Alert</h1>
      <p>Automated threat detection -- Immediate action taken</p>
    </div>
    <div class="body">
      <span class="alert-badge">CRITICAL THREAT NEUTRALIZED</span>
      <h2 style="margin:0 0 8px;font-size:18px;">Harvest-Now-Decrypt-Later Attack Detected</h2>
      <p style="color:#8B949E;font-size:14px;margin:0;">Our XGBoost ML model flagged anomalous activity on your account at <strong style="color:#E6EDF3;">${ts}</strong>. All cryptographic keys have been automatically rotated.</p>
      <div class="stat-grid">
        <div class="stat"><label>ML Anomaly Score</label><value>${anomalyPct}%</value></div>
        <div class="stat"><label>Geo Velocity</label><value>${geoKmh} km/h</value></div>
        <div class="stat"><label>Data Targeted</label><value>${bytesStr}</value></div>
        <div class="stat"><label>Attack Vector</label><value style="font-size:13px;">${payload['ip_location_mismatch'] ? 'Foreign IP / VPN' : 'Insider Threat'}</value></div>
      </div>
      <hr class="divider"/>
      <div class="success-box">
        <h3>Self-Healing Complete</h3>
        <p>- All AES-256-GCM session keys rotated</p>
        <p>- All CRYSTALS-Kyber ML-KEM-1024 keypairs regenerated</p>
        <p>- Attacker session forcibly terminated</p>
        <p>- Harvested ciphertext is now mathematically useless</p>
      </div>
      <p style="margin-top:24px;font-size:13px;color:#8B949E;">No action is required from you. Your files remain secure.</p>
    </div>
    <div class="footer">ShieldCloud 2026 - Post-Quantum Cloud Security</div>
  </div>
</body>
</html>`;

  try {
    const info = await transporter.sendMail({
      from: `"ShieldCloud Security" <${SERVICE_EMAIL}>`,
      to: ALERT_EMAIL_TO,
      subject: `[CRITICAL] Harvest-Now-Decrypt-Later Attack Neutralized -- ${ts}`,
      html,
    });
    console.log('\n================================================================');
    console.log('  SECURITY EMAIL DISPATCHED');
    console.log(`  To      : ${ALERT_EMAIL_TO}`);
    console.log(`  ML Score: ${anomalyPct}%  |  Geo Velocity: ${geoKmh} km/h`);
    console.log('----------------------------------------------------------------');
    console.log(`  PREVIEW : ${nodemailer.getTestMessageUrl(info)}`);
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
      // amqplib >= 0.10 connect() returns a ChannelModel (which has createChannel)
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
          channel.ack(msg);
        } catch (e) {
          channel.nack(msg, false, false);
        }
      });

      // Keep alive
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
