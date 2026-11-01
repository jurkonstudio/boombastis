package id.jurkon.smsgateway

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.telephony.SubscriptionManager
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
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
    private lateinit var dot: View
    private lateinit var tvState: TextView
    private lateinit var tvDetail: TextView
    private lateinit var tvSent: TextView
    private lateinit var tvRecv: TextView
    private lateinit var tvBeat: TextView
    private lateinit var btnPerm: Button
    private lateinit var btnBat: Button
    private var simIds: List<Int> = listOf(-1)

    private val tick = object : Runnable {
        override fun run() { render(); handler.postDelayed(this, 2000) }
    }

    private val BRAND = Color.parseColor("#2457F5")
    private val INK = Color.parseColor("#101828")
    private val MUTED = Color.parseColor("#5B6475")
    private val LINE = Color.parseColor("#E3E7EE")
    private val BG = Color.parseColor("#F4F6FA")
    private val OK = Color.parseColor("#12804A")
    private val ERR = Color.parseColor("#C62828")
    private val WARN = Color.parseColor("#A15C07")

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun box(fill: Int, r: Int, stroke: Int = 0) = GradientDrawable().apply {
        setColor(fill); cornerRadius = dp(r).toFloat()
        if (stroke != 0) setStroke(dp(1), stroke)
    }

    private fun oval(c: Int) = GradientDrawable().apply { setShape(GradientDrawable.OVAL); setColor(c) }

    private fun lp(top: Int = 0) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(top) }

    private fun LinearLayout.put(v: View, top: Int = 0) = addView(v, lp(top))

    private fun label(t: String, sp: Float = 15f, color: Int = INK, bold: Boolean = false) = TextView(this).apply {
        text = t; textSize = sp; setTextColor(color)
        if (bold) typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
    }

    private fun field(hint: String, type: Int) = EditText(this).apply {
        this.hint = hint
        inputType = type
        setSingleLine()
        textSize = 16f
        setTextColor(INK)
        setHintTextColor(Color.parseColor("#98A2B3"))
        background = box(Color.WHITE, 10, LINE)
        setPadding(dp(14), dp(12), dp(14), dp(12))
    }

    // kind 0 = utama (biru), 1 = sekunder (outline), 2 = bahaya (merah)
    private fun btn(text: String, kind: Int = 0, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 16f
        stateListAnimator = null
        minHeight = dp(52)
        minimumHeight = dp(52)
        typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
        if (kind == 0) { setTextColor(Color.WHITE); background = box(BRAND, 12) }
        else { setTextColor(if (kind == 1) BRAND else ERR); background = box(Color.WHITE, 12, LINE) }
        setOnClickListener { onClick() }
    }

    private fun chip(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 14f
        stateListAnimator = null
        minHeight = 0; minimumHeight = 0; minWidth = dp(76); minimumWidth = dp(76)
        setTextColor(Color.WHITE)
        background = box(BRAND, 20)
        setPadding(dp(14), dp(8), dp(14), dp(8))
        setOnClickListener { onClick() }
    }

    private fun setChip(b: Button, ok: Boolean) {
        b.text = if (ok) "Aktif" else "Atur"
        b.isEnabled = !ok
        b.setTextColor(if (ok) OK else Color.WHITE)
        b.background = if (ok) box(Color.parseColor("#E7F6EE"), 20) else box(BRAND, 20)
    }

    private fun card(parent: LinearLayout, top: Int = 12): LinearLayout {
        val c = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = box(Color.WHITE, 16, LINE)
            setPadding(dp(16), dp(16), dp(16), dp(16))
        }
        parent.put(c, top)
        return c
    }

    private fun row(parent: LinearLayout, title: String, desc: String, action: Button, top: Int) {
        val r = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val t = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        t.put(label(title, 15f, INK, true))
        t.put(label(desc, 13f, MUTED))
        r.addView(t, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        r.addView(action, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { marginStart = dp(12) })
        parent.put(r, top)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(28), dp(20), dp(32))
        }
        setContentView(ScrollView(this).apply { setBackgroundColor(BG); isFillViewport = true; addView(col) })

        // Header
        val head = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        head.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_launcher_foreground)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            background = box(BRAND, 14)
        }, LinearLayout.LayoutParams(dp(48), dp(48)))
        val ht = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        ht.put(label("Boombastis Gateway", 20f, INK, true))
        ht.put(label("Kirim SMS dari HP ini", 13f, MUTED))
        head.addView(ht, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { marginStart = dp(12) })
        col.put(head)

        // Kartu status
        val sc = card(col, 20)
        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        dot = View(this)
        top.addView(dot, LinearLayout.LayoutParams(dp(12), dp(12)).apply { marginEnd = dp(10) })
        tvState = label("", 18f, INK, true)
        top.addView(tvState)
        sc.put(top)
        tvDetail = label("", 14f, MUTED)
        sc.put(tvDetail, 4)
        tvSent = label("0", 24f, INK, true)
        tvRecv = label("0", 24f, INK, true)
        val stats = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        for ((n, cap) in listOf(tvSent to "Terkirim", tvRecv to "Diterima")) {
            val c = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            c.addView(n); c.addView(label(cap, 13f, MUTED))
            stats.addView(c, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }
        sc.put(stats, 16)
        tvBeat = label("", 12f, MUTED)
        sc.put(tvBeat, 12)

        // Siapkan HP
        val sp = card(col)
        sp.put(label("Siapkan HP", 16f, INK, true))
        btnPerm = chip("Atur") { requestPerms() }
        btnBat = chip("Atur") {
            try {
                startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
            } catch (e: Exception) {
                startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            }
        }
        row(sp, "Izin SMS", "Untuk kirim dan terima SMS", btnPerm, 12)
        row(sp, "Tetap berjalan", "Matikan penghematan baterai", btnBat, 14)
        row(sp, "Setelan terbatas", "Perlu untuk aplikasi dari luar Play Store", chip("Buka") {
            Toast.makeText(
                this,
                "Ketuk ⋮ di kanan atas, lalu pilih 'Izinkan setelan terbatas', baru izinkan SMS.",
                Toast.LENGTH_LONG
            ).show()
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }, 14)

        // Pairing
        etUrl = field("Project URL (https://xxxx.supabase.co)", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI)
        etAnon = field("Anon key", InputType.TYPE_CLASS_TEXT)
        etEmail = field("Email akun HP", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        etPass = field("Password akun HP", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        etUrl.setText(Store.get(this, "url"))
        etAnon.setText(Store.get(this, "anon"))
        etEmail.setText(Store.get(this, "email"))
        if (Store.get(this, "pass").isNotEmpty()) etPass.hint = "Password tersimpan (kosongkan jika tidak diganti)"

        val pc = card(col)
        pc.put(label(if (Store.get(this, "mode") == "pair") "Pasangkan ulang HP ini" else "Pasangkan HP ini", 16f, INK, true))
        pc.put(label("Di panel Boombastis: Perangkat > Tambah perangkat, lalu masukkan kodenya di sini.", 13f, MUTED), 4)
        etCode = field("KODE 8 KARAKTER", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS).apply {
            gravity = Gravity.CENTER
            textSize = 22f
            letterSpacing = 0.15f
            filters = arrayOf(InputFilter.LengthFilter(8))
        }
        pc.put(etCode, 14)
        pc.put(btn("Pasangkan & Mulai") { pairAndStart() }, 12)

        // SIM
        val ic = card(col)
        ic.put(label("SIM untuk mengirim", 16f, INK, true))
        spSim = Spinner(this)
        ic.put(spSim, 6)

        col.put(btn("Berhenti", 2) { stopGateway() }, 16)

        legacyBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        legacyBox.put(etUrl, 8); legacyBox.put(etAnon, 8); legacyBox.put(etEmail, 8); legacyBox.put(etPass, 8)
        legacyBox.put(btn("Simpan & Mulai (email)", 1) { saveAndStart() }, 8)
        legacyBox.visibility =
            if (Store.get(this, "email").isNotEmpty() && Store.get(this, "mode") != "pair") View.VISIBLE else View.GONE
        col.put(btn("Mode lanjutan (email & password)", 1) {
            legacyBox.visibility = if (legacyBox.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }, 10)
        col.put(legacyBox)

        col.put(label("Samsung: matikan Auto Blocker sebelum memasang APK, dan masukkan aplikasi ini ke daftar 'Aplikasi yang tidak pernah tidur'.", 12f, MUTED), 16)

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
        val m = Status.message
        val (st, c) = when {
            m.startsWith("Online") -> "Terhubung" to OK
            m.startsWith("Gagal") || m.contains("bermasalah", true) -> "Bermasalah" to ERR
            m.startsWith("Berhenti") || m.startsWith("Belum") -> "Tidak aktif" to MUTED
            else -> "Menyambungkan…" to WARN
        }
        tvState.text = st
        tvState.setTextColor(c)
        dot.background = oval(c)
        val dn = Store.get(this, "device_name")
        tvDetail.text = if (Store.get(this, "mode") == "pair" && dn.isNotEmpty()) "$dn · $m" else m
        tvSent.text = Status.sent.toString()
        tvRecv.text = Status.received.toString()
        val hb = if (Status.lastHeartbeat == 0L) "-"
        else SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(Status.lastHeartbeat))
        tvBeat.text = "Terakhir sinkron: $hb"
        setChip(btnPerm, hasPerm(Manifest.permission.SEND_SMS) && hasPerm(Manifest.permission.RECEIVE_SMS))
        setChip(btnBat, getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName))
    }
}
