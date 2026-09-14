package mn.onikishin.hub

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.time.Instant

class NativeNotificationManager(private val context: Context) {
    private val notificationManager = context.getSystemService(NotificationManager::class.java)
    private val alarmManager = context.getSystemService(AlarmManager::class.java)

    init {
        ensureChannel(context)
    }

    fun handle(payload: JSONObject, requestPermission: () -> Unit) {
        when (payload.optString("type")) {
            "requestPermission" -> requestPermission()
            "show" -> {
                val item = notificationFrom(payload) ?: return
                show(context, item.id, item.title, item.body, item.url)
            }
            "schedule" -> schedule(payload)
            "cancel" -> cancel(payload.optString("id"))
            "clearBadge" -> notificationManager.cancelAll()
        }
    }

    private fun schedule(payload: JSONObject) {
        val item = notificationFrom(payload) ?: return
        val fireAt = runCatching { Instant.parse(payload.optString("fireAt")).toEpochMilli() }.getOrNull()
            ?: return
        if (fireAt <= System.currentTimeMillis() + 1_000L) {
            show(context, item.id, item.title, item.body, item.url)
            return
        }

        val intent = Intent(context, NotificationReceiver::class.java).apply {
            action = ACTION_FIRE
            putExtra(EXTRA_ID, item.id)
            putExtra(EXTRA_TITLE, item.title)
            putExtra(EXTRA_BODY, item.body)
            putExtra(EXTRA_DEEP_LINK, item.url)
        }
        val pending = PendingIntent.getBroadcast(
            context,
            item.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pending)
    }

    private fun cancel(rawId: String) {
        val id = safeId(rawId) ?: return
        val intent = Intent(context, NotificationReceiver::class.java).apply { action = ACTION_FIRE }
        val pending = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        )
        if (pending != null) {
            alarmManager.cancel(pending)
            pending.cancel()
        }
        notificationManager.cancel(id.hashCode())
    }

    private fun notificationFrom(payload: JSONObject): NotificationItem? {
        val id = safeId(payload.optString("id")) ?: return null
        val title = safeText(payload.optString("title"), 100) ?: return null
        val body = safeText(payload.optString("body"), 300) ?: return null
        return NotificationItem(id, title, body, safePath(payload.optString("url")))
    }

    private fun safeId(raw: String): String? {
        val id = raw.trim()
        return id.takeIf { it.isNotEmpty() && it.length <= 160 }
    }

    private fun safeText(raw: String, max: Int): String? {
        val value = raw.trim()
        return value.takeIf { it.isNotEmpty() }?.take(max)
    }

    private data class NotificationItem(
        val id: String,
        val title: String,
        val body: String,
        val url: String,
    )

    companion object {
        const val EXTRA_DEEP_LINK = "oniDeepLink"
        const val EXTRA_ID = "oniNotificationId"
        const val EXTRA_TITLE = "oniNotificationTitle"
        const val EXTRA_BODY = "oniNotificationBody"
        private const val ACTION_FIRE = "mn.onikishin.hub.NOTIFICATION_FIRE"
        private const val CHANNEL_ID = "oni_events"
        private val allowedPaths = setOf("/meet", "/profile", "/garage", "/street-ops", "/gallery", "/admin")

        fun safePath(raw: String?): String {
            val value = raw.orEmpty().substringBefore('?').substringBefore('#')
            return if (value in allowedPaths) value else "/"
        }

        fun ensureChannel(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ONI HUB events",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Meet, progression болон ONI activity мэдэгдэл"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }

        fun show(context: Context, id: String, title: String, body: String, rawUrl: String?) {
            ensureChannel(context)
            val url = safePath(rawUrl)
            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(EXTRA_DEEP_LINK, url)
            }
            val openPending = PendingIntent.getActivity(
                context,
                id.hashCode(),
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title.take(100))
                .setContentText(body.take(300))
                .setStyle(NotificationCompat.BigTextStyle().bigText(body.take(300)))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(openPending)
                .build()
            try {
                context.getSystemService(NotificationManager::class.java).notify(id.hashCode(), notification)
            } catch (_: SecurityException) {
                // Android 13+ permission may still be denied by the user.
            }
        }
    }
}
