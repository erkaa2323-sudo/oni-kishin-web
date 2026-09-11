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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(VoiceBridge(), "ONIVoice")
        webView.loadUrl("https://oni-hub-v3.vercel.app/?source=android-native")
        requestVoicePermissions()
    }

    private fun requestVoicePermissions() {
        val permissions = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (android.os.Build.VERSION.SDK_INT >= 33) permissions += Manifest.permission.POST_NOTIFICATIONS
        val missing = permissions.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) ActivityCompat.requestPermissions(this, missing.toTypedArray(), 9001)
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

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
