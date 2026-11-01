package id.jurkon.smsgateway

import android.content.Context
import org.json.JSONObject

/** Mengirim antrean lokal ke server (laporan hasil kirim + SMS masuk). Aman dipanggil dari banyak thread. */
object Flusher {
    private val lock = Any()
    private val dropCodes = setOf(401, 403, 408, 429)

    fun flush(ctx: Context, api: Api) {
        synchronized(lock) {
            drain(ctx, api, "q_reports", "report_outbox", false)
            drain(ctx, api, "q_inbox", "receive_sms", true)
        }
    }

    private fun drain(ctx: Context, api: Api, q: String, fn: String, countReceived: Boolean) {
        while (true) {
            val item: JSONObject = Store.qFirst(ctx, q) ?: return
            try {
                api.rpc(fn, item)
                if (countReceived) Status.received = Status.received + 1
                Store.qRemoveFirst(ctx, q)
            } catch (e: ApiException) {
                // Galat permanen (mis. data tidak valid): buang agar antrean tidak macet.
                if (e.code in 400..499 && e.code !in dropCodes) Store.qRemoveFirst(ctx, q) else throw e
            }
        }
    }
}
