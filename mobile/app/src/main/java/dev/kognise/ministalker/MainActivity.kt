package dev.kognise.ministalker

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.TextView
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager

class MainActivity : AppCompatActivity() {
    private lateinit var preferences: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        preferences = getSharedPreferences(
            "${BuildConfig.APPLICATION_ID}.prefs",
            Context.MODE_PRIVATE
        )

        // Sync password field with preferences.
        val passwordField = findViewById<TextView>(R.id.password)
        passwordField.text = preferences.getString("password", "")!!
        passwordField.addTextChangedListener(textWatcher)

        // Start the background service.
        val workManager = WorkManager.getInstance(this)
        val workRequest = OneTimeWorkRequest.from(Worker::class.java)
        workManager.enqueueUniqueWork("worker", ExistingWorkPolicy.REPLACE, workRequest)
    }

    private val textWatcher = object : TextWatcher {
        override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) {
            preferences.edit().putString("password", text.toString()).apply()
        }

        override fun beforeTextChanged(text: CharSequence?, start: Int, before: Int, after: Int) {}
        override fun afterTextChanged(editable: Editable?) {}
    }
}