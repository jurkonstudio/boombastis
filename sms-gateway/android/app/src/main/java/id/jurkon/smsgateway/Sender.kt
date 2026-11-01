package id.jurkon.smsgateway

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.telephony.SmsManager
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

object Sender {
    private val counter = AtomicInteger(1000)

    @Suppress("DEPRECATION")
    private fun manager(ctx: Context): SmsManager {
        val sub = Store.get(ctx, "sim").toIntOrNull() ?: -1
        return if (Build.VERSION.SDK_INT >= 31) {
            val base = ctx.getSystemService(SmsManager::class.java)
            if (sub >= 0) base.createForSubscriptionId(sub) else base
        } else {
            if (sub >= 0) SmsManager.getSmsManagerForSubscriptionId(sub) else SmsManager.getDefault()
        }
    }

    /** Kembalikan null jika SEMUA bagian SMS terkirim (RESULT_OK), selain itu kode galat. */
    fun send(appCtx: Context, id: String, to: String, body: String): String? {
        val ctx = appCtx.applicationContext
        val action = "id.jurkon.smsgateway.SENT.$id"
        val sm = try { manager(ctx) } catch (e: Exception) { return "no_sms_manager" }
        val parts = sm.divideMessage(body)
        val latch = CountDownLatch(parts.size)
        val error = AtomicReference<String?>(null)
        val rcv = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                if (resultCode != Activity.RESULT_OK) error.compareAndSet(null, "sms_error_$resultCode")
                latch.countDown()
            }
        }
        val filter = IntentFilter(action)
        if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(rcv, filter, Context.RECEIVER_NOT_EXPORTED)
        else ctx.registerReceiver(rcv, filter)
        try {
            val intents = ArrayList<PendingIntent>()
            for (i in parts.indices) {
                intents.add(
                    PendingIntent.getBroadcast(
                        ctx, counter.incrementAndGet(),
                        Intent(action).setPackage(ctx.packageName),
                        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                    )
                )
            }
            sm.sendMultipartTextMessage(to, null, parts, intents, null)
            if (!latch.await(60, TimeUnit.SECONDS)) return "timeout"
            return error.get()
        } catch (e: InterruptedException) {
            return "interrupted"
        } catch (e: Exception) {
            return "exception_" + e.javaClass.simpleName
        } finally {
            try { ctx.unregisterReceiver(rcv) } catch (_: Exception) {}
        }
    }
}
