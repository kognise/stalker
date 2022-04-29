package dev.kognise.ministalker

import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import kotlinx.coroutines.delay

class Worker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager

    private val preferences = context.getSharedPreferences(
        "${BuildConfig.APPLICATION_ID}.prefs",
        Context.MODE_PRIVATE
    )

    override suspend fun doWork(): Nothing {
        setForeground(createForegroundInfo())
        val http = HttpClient(CIO) { expectSuccess = true }

        while (true) {
            val password = preferences.getString("password", "")!!
            if (password.isEmpty()) {
                delay(10000)
                continue
            }

            var delaySecs: Long = 60
            try {
                if (isPhoneActive()) {
                    http.get {
                        url("https://api.kognise.dev/ping/mobile")
                        bearerAuth(password)
                    }
                } else {
                    delaySecs = 10
                }
            } catch (e: Exception) {
                Log.e("Worker", "${e.message}")
                delaySecs = 30
            }

            Log.d("Worker", "Next tick in ${delaySecs}s")
            delay(delaySecs * 1000)
        }
    }

    private fun isPhoneActive(): Boolean {
        return powerManager.isInteractive && !keyguardManager.isKeyguardLocked
    }

    private fun createForegroundInfo(): ForegroundInfo {
        notificationManager.createNotificationChannel(
            NotificationChannel(
                "worker",
                "Background worker",
                NotificationManager.IMPORTANCE_MIN
            ).apply { setShowBadge(false) }
        )
        val notification = NotificationCompat.Builder(applicationContext, "worker")
            .setContentTitle("MiniStalker")
            .setContentText("I'm watching you...")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .build()

        notificationManager.createNotificationChannel(
            NotificationChannel(
                "default",
                "MiniStalker",
                NotificationManager.IMPORTANCE_DEFAULT
            )
        )

        val notificationId = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
        return ForegroundInfo(notificationId, notification)
    }
}