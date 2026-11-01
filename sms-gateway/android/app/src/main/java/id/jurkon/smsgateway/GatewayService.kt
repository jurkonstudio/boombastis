package id.jurkon.smsgateway

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import kotlin.random.Random

class GatewayService : Service() {
    @Volatile private var running = false
    private var worker: Thread? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundCompat()
        if (!Store.enabled(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!running) {
            running = true
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "smsgateway:loop").apply {
                setReferenceCounted(false)
                acquire()
            }
            worker = Thread { loop() }.also { it.start() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        worker?.interrupt()
        wakeLock?.let { if (it.isHeld) it.release() }
        Status.message = "Berhenti"
        super.onDestroy()
    }

    private fun startForegroundCompat() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel("gateway", "SMS Gateway", NotificationManager.IMPORTANCE_LOW)
        )
        val pi = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        val n = Notification.Builder(this, "gateway")
            .setContentTitle("SMS Gateway aktif")
            .setContentText("Mengirim dan menerima SMS lewat Supabase")
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, n)
        }
    }

    private fun nap(ms: Long) {
        try { Thread.sleep(ms) } catch (_: InterruptedException) { /* dicek lewat flag running */ }
    }

    private fun loop() {
        val api = Api(applicationContext)
        var lastHb = 0L
        var backoff = 5_000L
        while (running) {
            try {
                Flusher.flush(applicationContext, api)
                val now = System.currentTimeMillis()
                if (now - lastHb >= 60_000L) {
                    api.rpc("device_heartbeat", JSONObject())
                    lastHb = now
                    Status.lastHeartbeat = now
                }
                val arr = JSONArray(api.rpc("claim_outbox", JSONObject().put("batch", 5)))
                Status.message = "Online, login berhasil"
                backoff = 5_000L
                for (i in 0 until arr.length()) {
                    if (!running) break
                    process(api, arr.getJSONObject(i))
                    nap(1_000L + Random.nextLong(2_000L))
                }
                nap(if (arr.length() > 0) 2_000L else 15_000L)
            } catch (e: ApiException) {
                Status.message = "Ditolak server (${e.code}): ${e.message}"
                nap(backoff); backoff = minOf(backoff * 2, 120_000L)
            } catch (e: IOException) {
                Status.message = "Jaringan bermasalah, mencoba lagi..."
                nap(backoff); backoff = minOf(backoff * 2, 120_000L)
            } catch (e: Exception) {
                Status.message = "Galat: ${e.javaClass.simpleName}"
                nap(backoff); backoff = minOf(backoff * 2, 120_000L)
            }
        }
    }

    private fun process(api: Api, o: JSONObject) {
        val id = o.getString("id")
        val err = Sender.send(this, id, o.getString("to_number"), o.getString("body"))
        if (err == "interrupted") return // layanan dihentikan; server memulihkan pesan 'sending' sendiri
        if (err == null) Status.sent = Status.sent + 1
        // Hasil disimpan dulu ke antrean lokal agar tidak hilang bila jaringan putus (mencegah kirim ganda).
        Store.qAdd(
            this, "q_reports",
            JSONObject().put("p_id", id).put("p_ok", err == null).put("p_error", err ?: JSONObject.NULL)
        )
        Flusher.flush(this, api)
    }
}
