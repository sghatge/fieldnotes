package com.fieldnotes.privatework

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var speechTarget: String? = null
    private var recognizer: SpeechRecognizer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?
                ): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "image/*"
                    }
                    startActivityForResult(intent, FILE_REQUEST)
                    return true
                }
            }
            val bridge = NativeBridge()
            addJavascriptInterface(bridge, "AndroidBridge")
            addJavascriptInterface(bridge, "AndroidShare")
        }
        setContentView(web)
        web.loadUrl("file:///android_asset/www/index.html")
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun recognizeReceipt(base64: String) {
            runOnUiThread {
                try {
                    val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        ?: return@runOnUiThread deliverOcrError("Could not read that image. Try another receipt photo.")
                    val client = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                    client.process(InputImage.fromBitmap(bitmap, 0))
                        .addOnSuccessListener { result ->
                            val recognized = result.text
                            deliverOcrResult(recognized)
                            client.close()
                            bitmap.recycle()
                        }
                        .addOnFailureListener {
                            deliverOcrError("On-device OCR could not read this image. You can enter the details manually.")
                            client.close()
                            bitmap.recycle()
                        }
                } catch (_: Exception) {
                    deliverOcrError("On-device OCR could not read this image. You can enter the details manually.")
                }
            }
        }

        @JavascriptInterface
        fun startOnDeviceSpeech(target: String) {
            runOnUiThread {
                speechTarget = target
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || !SpeechRecognizer.isOnDeviceRecognitionAvailable(this@MainActivity)) {
                    deliverSpeechError("This phone does not offer an on-device speech recognizer. Type instead; no network speech fallback is used.")
                    return@runOnUiThread
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), AUDIO_REQUEST)
                } else startSpeechRecognition()
            }
        }

        @JavascriptInterface
        fun shareText(text: String) {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                startActivity(Intent.createChooser(intent, "Share from Fieldnotes"))
            }
        }
    }

    private fun startSpeechRecognition() {
        try {
            recognizer?.destroy()
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(this).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) = Unit
                    override fun onBeginningOfSpeech() = Unit
                    override fun onRmsChanged(rmsdB: Float) = Unit
                    override fun onBufferReceived(buffer: ByteArray?) = Unit
                    override fun onEndOfSpeech() = Unit
                    override fun onPartialResults(partialResults: Bundle?) = Unit
                    override fun onEvent(eventType: Int, params: Bundle?) = Unit
                    override fun onError(error: Int) = deliverSpeechError("On-device dictation stopped or was unavailable. Type instead.")
                    override fun onResults(results: Bundle?) {
                        val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                        if (text.isBlank()) deliverSpeechError("No speech was recognized. Try again or type instead.")
                        else deliverSpeechResult(speechTarget.orEmpty(), text)
                    }
                })
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                }
                startListening(intent)
            }
        } catch (_: Exception) {
            deliverSpeechError("On-device dictation could not start. Type instead.")
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (requestCode == AUDIO_REQUEST) {
            if (results.firstOrNull() == PackageManager.PERMISSION_GRANTED) startSpeechRecognition()
            else deliverSpeechError("Microphone permission was not granted. Type instead.")
        }
    }

    @Deprecated("Deprecated by Android; required for the WebView file chooser callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_REQUEST) {
            val uris = if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null
            fileCallback?.onReceiveValue(uris)
            fileCallback = null
        }
    }

    private fun jsString(value: String) = JSONObject.quote(value)
    // Block bodies so these return Unit (web.post returns Boolean), as RecognitionListener.onError requires.
    private fun runJs(script: String) {
        web.post { web.evaluateJavascript(script, null) }
    }
    private fun deliverOcrResult(value: String) {
        runJs("window.onNativeOcrResult(${jsString(value)})")
    }
    private fun deliverOcrError(value: String) {
        runJs("window.onNativeOcrError(${jsString(value)})")
    }
    private fun deliverSpeechResult(target: String, value: String) {
        runJs("window.onNativeSpeechResult(${jsString(target)},${jsString(value)})")
    }
    private fun deliverSpeechError(value: String) {
        runJs("window.onNativeSpeechError(${jsString(value)})")
    }

    override fun onDestroy() {
        recognizer?.destroy()
        web.destroy()
        super.onDestroy()
    }

    companion object {
        private const val FILE_REQUEST = 81
        private const val AUDIO_REQUEST = 82
    }
}
