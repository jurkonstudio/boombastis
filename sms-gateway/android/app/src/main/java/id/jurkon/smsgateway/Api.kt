package id.jurkon.smsgateway

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val code: Int, message: String) : Exception(message)

/** Klien Supabase minimal (GoTrue + RPC). IOException dibiarkan naik untuk ditangani pemanggil. */
class Api(private val ctx: Context) {

    private fun base() = Store.get(ctx, "url").ifBlank { BuildConfig.SB_URL }.trim().trimEnd('/')
    private fun anon() = Store.get(ctx, "anon").ifBlank { BuildConfig.SB_ANON }.trim()

    private fun post(path: String, body: String, token: String?): Pair<Int, String> {
        val c = URL(base() + path).openConnection() as HttpURLConnection
        try {
            c.requestMethod = "POST"
            c.connectTimeout = 15000
            c.readTimeout = 30000
            c.doOutput = true
            c.setRequestProperty("apikey", anon())
            c.setRequestProperty("Content-Type", "application/json")
            if (token != null) c.setRequestProperty("Authorization", "Bearer $token")
            c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = c.responseCode
            val stream = if (code in 200..299) c.inputStream else c.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            return code to text
        } finally {
            c.disconnect()
        }
    }

    private fun saveToken(text: String) {
        val j = JSONObject(text)
        Store.put(ctx, "access", j.getString("access_token"))
        Store.put(ctx, "refresh", j.optString("refresh_token", ""))
        val exp = System.currentTimeMillis() + j.optLong("expires_in", 3600L) * 1000L
        Store.put(ctx, "exp", exp.toString())
    }

    @Synchronized
    fun login() {
        // HP yang dipasangkan lewat kode memakai akun anonim: tidak ada email/password untuk login ulang.
        if (Store.get(ctx, "mode") == "pair") {
            throw ApiException(401, "Sesi habis, pasangkan ulang HP dengan kode baru dari panel")
        }
        val b = JSONObject()
            .put("email", Store.get(ctx, "email").trim())
            .put("password", Store.get(ctx, "pass"))
        val (code, text) = post("/auth/v1/token?grant_type=password", b.toString(), null)
        if (code !in 200..299) throw ApiException(code, "Login gagal (cek email/password/URL/anon key)")
        saveToken(text)
    }

    private fun refresh(): Boolean {
        val b = JSONObject().put("refresh_token", Store.get(ctx, "refresh"))
        val (code, text) = post("/auth/v1/token?grant_type=refresh_token", b.toString(), null)
        if (code !in 200..299) return false
        saveToken(text)
        return true
    }

    @Synchronized
    fun ensureToken() {
        val exp = Store.get(ctx, "exp").toLongOrNull() ?: 0L
        val need = Store.get(ctx, "access").isEmpty() || System.currentTimeMillis() > exp - 60_000L
        if (need) {
            val ok = Store.get(ctx, "refresh").isNotEmpty() && refresh()
            if (!ok) login()
        }
    }

    /** Pasangkan HP dengan kode dari panel: sesi anonim + claim_device. Mengembalikan nama perangkat. */
    fun pair(code: String): String {
        if (base().isEmpty() || anon().isEmpty()) throw ApiException(0, "URL / anon key belum ada di aplikasi")
        val (c, t) = post("/auth/v1/signup", "{}", null)
        if (c !in 200..299) {
            throw ApiException(c, "Gagal membuat sesi. Pastikan Anonymous sign-ins aktif di Supabase. " + msgOf(t))
        }
        saveToken(t)
        val r = post(
            "/rest/v1/rpc/claim_device",
            JSONObject().put("p_code", code.trim()).toString(),
            Store.get(ctx, "access")
        )
        if (r.first !in 200..299) {
            Store.put(ctx, "access", ""); Store.put(ctx, "refresh", ""); Store.put(ctx, "exp", "0")
            throw ApiException(r.first, msgOf(r.second))
        }
        Store.put(ctx, "mode", "pair")
        val name = try { JSONObject(r.second).optString("name", "") } catch (_: Exception) { "" }
        Store.put(ctx, "device_name", name)
        return name
    }

    private fun msgOf(text: String): String =
        try { JSONObject(text).optString("message").ifEmpty { text.take(160) } } catch (_: Exception) { text.take(160) }

    /** Panggil fungsi RPC. Login ulang sekali bila 401. */
    fun rpc(name: String, body: JSONObject): String {
        ensureToken()
        var r = post("/rest/v1/rpc/$name", body.toString(), Store.get(ctx, "access"))
        if (r.first == 401) {
            login()
            r = post("/rest/v1/rpc/$name", body.toString(), Store.get(ctx, "access"))
        }
        if (r.first !in 200..299) throw ApiException(r.first, msgOf(r.second))
        return r.second
    }
}
