package id.jurkon.smsgateway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONObject
import kotlin.concurrent.thread

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val app = context.applicationContext
        if (!Store.enabled(app)) return
        val msgs = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        // Gabungkan bagian SMS panjang dari pengirim yang sama.
        val grouped = LinkedHashMap<String, StringBuilder>()
        for (m in msgs) {
            grouped.getOrPut(m.originatingAddress ?: "unknown") { StringBuilder() }
                .append(m.messageBody ?: "")
        }
        for ((from, body) in grouped) {
            Store.qAdd(
                app, "q_inbox",
                JSONObject().put("p_from", from.take(40)).put("p_body", body.toString().take(2000))
            )
        }
        val pending = goAsync()
        thread {
            try { Flusher.flush(app, Api(app)) } catch (_: Exception) { /* tetap di antrean */ }
            finally { pending.finish() }
        }
    }
}
