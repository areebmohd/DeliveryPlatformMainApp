package com.zorodelivery.app

import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class DeviceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String {
        return "DeviceModule"
    }

    override fun getConstants(): MutableMap<String, Any> {
        val constants = mutableMapOf<String, Any>()
        try {
            val pInfo = reactApplicationContext.packageManager.getPackageInfo(reactApplicationContext.packageName, 0)
            val versionCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                pInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode
            }
            constants["versionCode"] = versionCode
            constants["versionName"] = pInfo.versionName ?: ""
        } catch (e: Exception) {
            constants["versionCode"] = 1
            constants["versionName"] = "1.0.0"
        }
        return constants
    }

    @ReactMethod
    fun getAndroidId(promise: Promise) {
        try {
            val androidId = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ANDROID_ID
            )
            promise.resolve(androidId)
        } catch (e: Exception) {
            promise.reject("ERR_ANDROID_ID", e.message)
        }
    }
}
