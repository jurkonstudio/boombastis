package id.jurkon.smsgateway

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject

/** Penyimpanan terenkripsi: konfigurasi, token, dan antrean lokal (SMS masuk + laporan). */
object Store {
    @Volatile private var prefs: SharedPreferences? = null

    private fun p(ctx: Context): SharedPreferences {
        prefs?.let { return it }
        synchronized(this) {
            prefs?.let { return it }
            val app = ctx.applicationContext
            val key = MasterKey.Builder(app).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            val sp = EncryptedSharedPreferences.create(
                app, "gateway_cfg", key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
            prefs = sp
            return sp
        }
    }

    fun get(ctx: Context, k: String): String = p(ctx).getString(k, "") ?: ""
    fun put(ctx: Context, k: String, v: String) { p(ctx).edit().putString(k, v).commit() }
    fun enabled(ctx: Context): Boolean = get(ctx, "enabled") == "1"
    fun setEnabled(ctx: Context, v: Boolean) = put(ctx, "enabled", if (v) "1" else "0")

    // ---- antrean persisten (nama: "q_inbox" atau "q_reports") ----
    private fun load(ctx: Context, name: String): JSONArray =
        try { JSONArray(get(ctx, name).ifEmpty { "[]" }) } catch (e: Exception) { JSONArray() }

    @Synchronized fun qAdd(ctx: Context, name: String, item: JSONObject) {
        val a = load(ctx, name)
        a.put(item)
        while (a.length() > 500) a.remove(0)
        put(ctx, name, a.toString())
    }

    @Synchronized fun qFirst(ctx: Context, name: String): JSONObject? {
        val a = load(ctx, name)
        return if (a.length() == 0) null else a.getJSONObject(0)
    }

    @Synchronized fun qRemoveFirst(ctx: Context, name: String) {
        val a = load(ctx, name)
        if (a.length() > 0) a.remove(0)
        put(ctx, name, a.toString())
    }
}

/** Status in-memory untuk ditampilkan di layar. */
object Status {
    @Volatile var message = "Belum dimulai"
    @Volatile var sent = 0
    @Volatile var received = 0
    @Volatile var lastHeartbeat = 0L
}
