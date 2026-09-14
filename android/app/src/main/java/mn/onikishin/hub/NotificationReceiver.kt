package mn.onikishin.hub

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(NativeNotificationManager.EXTRA_ID) ?: return
        val title = intent.getStringExtra(NativeNotificationManager.EXTRA_TITLE) ?: return
        val body = intent.getStringExtra(NativeNotificationManager.EXTRA_BODY) ?: return
        val url = intent.getStringExtra(NativeNotificationManager.EXTRA_DEEP_LINK)
        NativeNotificationManager.show(context, id, title, body, url)
    }
}
