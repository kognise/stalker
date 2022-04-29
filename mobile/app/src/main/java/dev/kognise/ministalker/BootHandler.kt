package dev.kognise.ministalker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager

class BootHandler : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Log.d("BootHandler", "Relaunching after boot!")

        val workManager = WorkManager.getInstance(context)
        val workRequest = OneTimeWorkRequest.from(Worker::class.java)
        workManager.enqueueUniqueWork("worker", ExistingWorkPolicy.KEEP, workRequest)
    }
}