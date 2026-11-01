package id.jurkon.smsgateway

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val code: Int, message: String) : Exception(message)

/** Klien Supabase minimal (GoTrue + RPC). IOException dibiarkan naik untuk ditangani pemanggil. */
class Api(private val ctx: Context) {

    private fun base() = Store.get(ctx, "url").trim().trimEnd('/')
    private fun anon() = Store.get(ctx, "anon").trim()

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

    /** Panggil fungsi RPC. Login ulang sekali bila 401. */
    fun rpc(name: String, body: JSONObject): String {
        ensureToken()
        var r = post("/rest/v1/rpc/$name", body.toString(), Store.get(ctx, "access"))
        if (r.first == 401) {
            login()
            r = post("/rest/v1/rpc/$name", body.toString(), Store.get(ctx, "access"))
        }
        if (r.first !in 200..299) throw ApiException(r.first, r.second.take(160))
        return r.second
    }
}
