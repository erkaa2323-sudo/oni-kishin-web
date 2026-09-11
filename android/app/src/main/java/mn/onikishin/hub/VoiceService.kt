package mn.onikishin.hub

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

class VoiceService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var room: Room? = null

    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel(CHANNEL_ID, "ONI Meet Voice", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setContentTitle("ONI Meet Voice")
            .setContentText("Voice background-д идэвхтэй")
            .setOngoing(true)
            .build())

        val raw = intent?.getStringExtra("payload") ?: return START_NOT_STICKY
        val payload = runCatching { JSONObject(raw) }.getOrNull() ?: return START_NOT_STICKY
        when (payload.optString("action")) {
            "join" -> join(payload.optString("url"), payload.optString("token"))
            "mute" -> setMuted(payload.optBoolean("muted"))
            "leave" -> leave()
        }
        return START_STICKY
    }

    private fun join(url: String, token: String) {
        if (url.isBlank() || token.isBlank()) return
        scope.launch {
            room?.disconnect()
            val next = LiveKit.create(applicationContext)
            room = next
            next.connect(url, token)
            next.localParticipant.setMicrophoneEnabled(true)
        }
    }

    private fun setMuted(muted: Boolean) {
        scope.launch { room?.localParticipant?.setMicrophoneEnabled(!muted) }
    }

    private fun leave() {
        scope.launch {
            room?.disconnect()
            room = null
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    override fun onDestroy() {
        room?.disconnect()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val CHANNEL_ID = "oni_meet_voice"
        private const val NOTIFICATION_ID = 6301
    }
}
