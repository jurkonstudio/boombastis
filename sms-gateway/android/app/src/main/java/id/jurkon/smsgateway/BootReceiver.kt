package id.jurkon.smsgateway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val app = context.applicationContext
        if (Store.enabled(app) && Store.get(app, "url").isNotEmpty()) {
            try { app.startForegroundService(Intent(app, GatewayService::class.java)) } catch (_: Exception) {}
        }
    }
}
