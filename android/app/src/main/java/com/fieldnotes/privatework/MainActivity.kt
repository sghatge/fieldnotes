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
import android.view.View
import android.view.WindowInsets
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
    private var pendingSave: PendingSave? = null

    private class PendingSave(val name: String, val content: String)

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
        keepClearOfSystemBars(web)
        setContentView(web)
        web.loadUrl("file:///android_asset/www/index.html")
    }

    /**
     * Android 15 (targetSdk 35) draws apps edge-to-edge. Without this the header sits under
     * the status bar, the tab bar sits under the gesture bar, and the keyboard covers inputs.
     */
    private fun keepClearOfSystemBars(view: View) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        view.setOnApplyWindowInsetsListener { v, insets ->
            val bars = insets.getInsets(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime()
            )
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsets.CONSUMED
        }
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun recognizeReceipt(base64: String) {
            runOnUiThread {
                try {
                    val bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    if (bitmap == null) {
                        deliverOcrError("Could not read that image. Try another receipt photo.")
                        return@runOnUiThread
                    }
                    val client = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                    client.process(InputImage.fromBitmap(bitmap, 0))
                        .addOnSuccessListener { result ->
                            deliverOcrResult(result.text)
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
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                    !SpeechRecognizer.isOnDeviceRecognitionAvailable(this@MainActivity)
                ) {
                    deliverSpeechError("This phone does not offer on-device dictation. Please type instead; Fieldnotes never sends audio to a server.")
                    return@runOnUiThread
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), AUDIO_REQUEST)
                } else {
                    startSpeechRecognition()
                }
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

        /** WebView ignores `<a download>`; let the user pick where the file goes instead. */
        @JavascriptInterface
        fun saveFile(name: String, mimeType: String, content: String) {
            runOnUiThread {
                pendingSave = PendingSave(name, content)
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType.ifBlank { "text/plain" }
                    putExtra(Intent.EXTRA_TITLE, name)
                }
                startActivityForResult(intent, SAVE_REQUEST)
            }
        }
    }

    private fun speechIntent() = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, SPEECH_LANGUAGE)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
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
                    override fun onError(error: Int) = handleSpeechError(error)
                    override fun onResults(results: Bundle?) {
                        val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull().orEmpty()
                        if (text.isBlank()) deliverSpeechError("No speech was recognised. Try again or type instead.")
                        else deliverSpeechResult(speechTarget.orEmpty(), text)
                    }
                })
                startListening(speechIntent())
            }
        } catch (_: Exception) {
            deliverSpeechError("On-device dictation could not start. Please type instead.")
        }
    }

    private fun handleSpeechError(error: Int) {
        val languageMissing = error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ||
            error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED
        if (languageMissing && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // The offline English (India) pack is not on this phone yet; ask Android to fetch it.
            // The download is between Android and Google; no audio is sent.
            try {
                recognizer?.triggerModelDownload(speechIntent())
                deliverSpeechError("The offline English speech pack isn't on this phone yet. Android is downloading it — try the mic again in a minute. Type instead for now.")
            } catch (_: Exception) {
                deliverSpeechError("The offline English speech pack isn't on this phone. Add it in Settings › System › Languages › On-device speech recognition, or type instead.")
            }
            return
        }
        deliverSpeechError(
            when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
                    "Didn't catch that. Tap the mic and speak again, or type instead."
                SpeechRecognizer.ERROR_AUDIO -> "The microphone isn't available right now. Please type instead."
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is off. Please type instead."
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Dictation is busy. Wait a moment and try again."
                else -> if (languageMissing) {
                    "The offline English speech pack isn't on this phone. Please type instead."
                } else {
                    "On-device dictation stopped (code $error). Please type instead."
                }
            }
        )
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (requestCode == AUDIO_REQUEST && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (results.firstOrNull() == PackageManager.PERMISSION_GRANTED) startSpeechRecognition()
            else deliverSpeechError("Microphone permission was not granted. Please type instead.")
        }
    }

    @Deprecated("Deprecated by Android; required for the WebView file chooser callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            FILE_REQUEST -> {
                val uris = if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null
                fileCallback?.onReceiveValue(uris)
                fileCallback = null
            }
            SAVE_REQUEST -> {
                val save = pendingSave
                pendingSave = null
                val uri = data?.data
                if (resultCode != RESULT_OK || uri == null || save == null) {
                    runJs("window.onNativeFileError(${jsString("Export cancelled — nothing was saved.")})")
                    return
                }
                try {
                    contentResolver.openOutputStream(uri)?.use { it.write(save.content.toByteArray(Charsets.UTF_8)) }
                        ?: error("no output stream")
                    runJs("window.onNativeFileSaved(${jsString(save.name)})")
                } catch (_: Exception) {
                    runJs("window.onNativeFileError(${jsString("Could not save ${save.name}. Try another location.")})")
                }
            }
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
        private const val SAVE_REQUEST = 83
        private const val SPEECH_LANGUAGE = "en-IN"
    }
}
