package mn.onikishin.hub

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var notificationManager: NativeNotificationManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        notificationManager = NativeNotificationManager(this)
        webView = WebView(this)
        setContentView(webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(VoiceBridge(), "ONIVoice")
        webView.addJavascriptInterface(NotificationBridge(), "ONINotifications")
        loadDeepLink(intent.getStringExtra(NativeNotificationManager.EXTRA_DEEP_LINK))
        requestVoicePermissions()
    }

    private fun loadDeepLink(rawPath: String?) {
        val path = NativeNotificationManager.safePath(rawPath)
        val suffix = if (path == "/") "/?source=android-native" else "$path?source=android-native"
        webView.loadUrl("https://oni-hub-v3.vercel.app$suffix")
    }

    private fun requestVoicePermissions() {
        val permissions = listOf(Manifest.permission.RECORD_AUDIO)
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 9001)
        }
    }

    private fun requestNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT < 33) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 9002)
    }

    inner class VoiceBridge {
        @JavascriptInterface
        fun postMessage(raw: String) {
            val payload = runCatching { JSONObject(raw) }.getOrNull() ?: return
            val intent = Intent(this@MainActivity, VoiceService::class.java).apply {
                action = "mn.onikishin.hub.VOICE_COMMAND"
                putExtra("payload", payload.toString())
            }
            ContextCompat.startForegroundService(this@MainActivity, intent)
        }
    }

    inner class NotificationBridge {
        @JavascriptInterface
        fun postMessage(raw: String) {
            val payload = runCatching { JSONObject(raw) }.getOrNull() ?: return
            runOnUiThread {
                notificationManager.handle(payload) { requestNotificationPermission() }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadDeepLink(intent.getStringExtra(NativeNotificationManager.EXTRA_DEEP_LINK))
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
