package id.jurkon.smsgateway

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telephony.SubscriptionManager
import android.text.InputType
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var etUrl: EditText
    private lateinit var etAnon: EditText
    private lateinit var etEmail: EditText
    private lateinit var etPass: EditText
    private lateinit var etCode: EditText
    private lateinit var legacyBox: LinearLayout
    private lateinit var spSim: Spinner
    private lateinit var tvStatus: TextView
    private var simIds: List<Int> = listOf(-1)

    private val tick = object : Runnable {
        override fun run() { render(); handler.postDelayed(this, 2000) }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun field(hint: String, type: Int) = EditText(this).apply {
        this.hint = hint
        inputType = type
        setSingleLine()
    }

    private fun btn(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setOnClickListener { onClick() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(32), dp(16), dp(24))
        }
        setContentView(ScrollView(this).apply { addView(col) })

        col.addView(TextView(this).apply { text = "SMS Gateway"; textSize = 22f })
        etUrl = field("Project URL (https://xxxx.supabase.co)", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI)
        etAnon = field("Anon key", InputType.TYPE_CLASS_TEXT)
        etEmail = field("Email akun HP", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        etPass = field("Password akun HP", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        etUrl.setText(Store.get(this, "url"))
        etAnon.setText(Store.get(this, "anon"))
        etEmail.setText(Store.get(this, "email"))
        if (Store.get(this, "pass").isNotEmpty()) etPass.hint = "Password tersimpan (kosongkan jika tidak diganti)"
        etCode = field("Kode pairing dari panel (8 karakter)", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS)
        col.addView(TextView(this).apply { text = "Pasangkan HP ini"; textSize = 16f })
        col.addView(etCode)
        col.addView(btn("Pasangkan & Mulai") { pairAndStart() })

        legacyBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        legacyBox.addView(etUrl); legacyBox.addView(etAnon); legacyBox.addView(etEmail); legacyBox.addView(etPass)
        legacyBox.addView(btn("Simpan & Mulai (email)") { saveAndStart() })
        legacyBox.visibility =
            if (Store.get(this, "email").isNotEmpty() && Store.get(this, "mode") != "pair") View.VISIBLE else View.GONE
        col.addView(btn("Mode email & password (lama)") {
            legacyBox.visibility = if (legacyBox.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        })
        col.addView(legacyBox)

        col.addView(TextView(this).apply { text = "SIM untuk mengirim"; setPadding(0, dp(8), 0, 0) })
        spSim = Spinner(this)
        col.addView(spSim)

        col.addView(btn("Berhenti") { stopGateway() })

        tvStatus = TextView(this).apply { setPadding(0, dp(12), 0, dp(12)); textSize = 15f }
        col.addView(tvStatus)

        col.addView(btn("Izinkan SMS, telepon & notifikasi") { requestPerms() })
        col.addView(btn("Pengecualian baterai") {
            try {
                startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
            } catch (e: Exception) {
                startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            }
        })
        col.addView(btn("Buka Info Aplikasi (setelan terbatas)") {
            Toast.makeText(
                this,
                "Ketuk ⋮ di kanan atas, lalu pilih 'Izinkan setelan terbatas', baru izinkan SMS.",
                Toast.LENGTH_LONG
            ).show()
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        })
        col.addView(TextView(this).apply {
            text = "Samsung: matikan Auto Blocker sebelum memasang APK, dan masukkan aplikasi ini ke " +
                "daftar 'Aplikasi yang tidak pernah tidur'."
            setPadding(0, dp(8), 0, 0)
        })

        refreshSims()
    }

    override fun onResume() { super.onResume(); handler.post(tick) }
    override fun onPause() { handler.removeCallbacks(tick); super.onPause() }

    private fun hasPerm(p: String) = checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED

    private fun requestPerms() {
        val list = mutableListOf(Manifest.permission.SEND_SMS, Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= 33) list.add(Manifest.permission.POST_NOTIFICATIONS)
        requestPermissions(list.filter { !hasPerm(it) }.toTypedArray(), 1)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refreshSims()
    }

    private fun refreshSims() {
        val labels = mutableListOf("SIM bawaan")
        val ids = mutableListOf(-1)
        if (hasPerm(Manifest.permission.READ_PHONE_STATE)) {
            try {
                val sm = getSystemService(SubscriptionManager::class.java)
                for (s in sm.activeSubscriptionInfoList ?: emptyList()) {
                    ids.add(s.subscriptionId)
                    labels.add("SIM ${s.simSlotIndex + 1} - ${s.carrierName}")
                }
            } catch (_: Exception) {}
        }
        simIds = ids
        spSim.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, labels)
        val saved = Store.get(this, "sim").toIntOrNull() ?: -1
        spSim.setSelection(ids.indexOf(saved).coerceAtLeast(0))
        spSim.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                Store.put(this@MainActivity, "sim", simIds[pos].toString())
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
    }

    private fun saveAndStart() {
        val u = etUrl.text.toString().trim()
        val a = etAnon.text.toString().trim()
        val e = etEmail.text.toString().trim()
        val pw = etPass.text.toString().ifEmpty { Store.get(this, "pass") }
        if (u.isEmpty() || a.isEmpty() || e.isEmpty() || pw.isEmpty()) {
            Toast.makeText(this, "Lengkapi semua kolom", Toast.LENGTH_SHORT).show(); return
        }
        if (!u.startsWith("https://")) {
            Toast.makeText(this, "URL harus diawali https://", Toast.LENGTH_SHORT).show(); return
        }
        Store.put(this, "mode", "")
        Store.put(this, "url", u); Store.put(this, "anon", a)
        Store.put(this, "email", e); Store.put(this, "pass", pw)
        Store.put(this, "access", ""); Store.put(this, "refresh", ""); Store.put(this, "exp", "0")
        etPass.setText("")
        if (!hasPerm(Manifest.permission.SEND_SMS) || !hasPerm(Manifest.permission.RECEIVE_SMS)) {
            Toast.makeText(this, "Izinkan SMS dulu (lihat tombol di bawah), lalu tekan Simpan & Mulai lagi", Toast.LENGTH_LONG).show()
            requestPerms(); return
        }
        Store.setEnabled(this, true)
        Status.message = "Memulai..."
        startForegroundService(Intent(this, GatewayService::class.java))
    }

    private fun pairAndStart() {
        val code = etCode.text.toString().trim()
        if (code.length < 6) {
            Toast.makeText(this, "Masukkan kode pairing dari panel", Toast.LENGTH_SHORT).show(); return
        }
        if (!hasPerm(Manifest.permission.SEND_SMS) || !hasPerm(Manifest.permission.RECEIVE_SMS)) {
            Toast.makeText(this, "Izinkan SMS dulu, lalu tekan Pasangkan & Mulai lagi", Toast.LENGTH_LONG).show()
            requestPerms(); return
        }
        Status.message = "Memasangkan..."
        val app = applicationContext
        Thread {
            try {
                val name = Api(app).pair(code)
                runOnUiThread {
                    etCode.setText("")
                    Store.setEnabled(this, true)
                    Status.message = "Terpasang" + if (name.isNotEmpty()) ": $name" else ""
                    startForegroundService(Intent(this, GatewayService::class.java))
                    Toast.makeText(this, "HP berhasil dipasangkan", Toast.LENGTH_LONG).show()
                }
            } catch (e: ApiException) {
                runOnUiThread {
                    Status.message = "Gagal memasangkan: ${e.message}"
                    Toast.makeText(this, e.message ?: "Gagal memasangkan", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Status.message = "Jaringan bermasalah, coba lagi"
                    Toast.makeText(this, "Jaringan bermasalah", Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun stopGateway() {
        Store.setEnabled(this, false)
        stopService(Intent(this, GatewayService::class.java))
        Status.message = "Berhenti"
    }

    private fun render() {
        val hb = if (Status.lastHeartbeat == 0L) "-"
        else SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(Status.lastHeartbeat))
        val dn = Store.get(this, "device_name")
        tvStatus.text = "Status: ${Status.message}\n" +
            (if (Store.get(this, "mode") == "pair" && dn.isNotEmpty()) "Perangkat: $dn\n" else "") +
            "Terkirim sesi ini: ${Status.sent}\n" +
            "Diterima sesi ini: ${Status.received}\n" +
            "Heartbeat terakhir: $hb"
    }
}
