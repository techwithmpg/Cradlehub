package com.mpgtechnologies.cradlehub.driver

import android.annotation.SuppressLint
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@SuppressLint("UnsafeOptInUsageError")
@Composable
internal fun NativeQrCamera(
    owner: LifecycleOwner,
    onCode: (String) -> Unit,
    onError: (String) -> Unit,
) {
    val context = LocalContext.current
    val preview = remember {
        PreviewView(context).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }
    val decoded by rememberUpdatedState(onCode)
    val failed by rememberUpdatedState(onError)
    AndroidView(factory = { preview }, modifier = Modifier.fillMaxSize())
    DisposableEffect(owner, preview) {
        val active = AtomicBoolean(true)
        val locked = AtomicBoolean(false)
        val analyzing = AtomicBoolean(false)
        val executor = Executors.newSingleThreadExecutor()
        val scanner =
            BarcodeScanning.getClient(
                BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
            )
        val provider = ProcessCameraProvider.getInstance(context)
        var bound: ProcessCameraProvider? = null
        val cameraPreview =
            Preview.Builder().build().also { it.setSurfaceProvider(preview.surfaceProvider) }
        val analysis =
            ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
        DriverPerformance.begin("qr_camera_first_frame")
        analysis.setAnalyzer(executor) { frame ->
            if (
                !active.get() ||
                    locked.get() ||
                    !owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED) ||
                    !analyzing.compareAndSet(false, true)
            ) {
                frame.close()
                return@setAnalyzer
            }
            DriverPerformance.end("qr_camera_first_frame")
            val media = frame.image
            if (media == null) {
                analyzing.set(false)
                frame.close()
                return@setAnalyzer
            }
            try {
                scanner
                    .process(InputImage.fromMediaImage(media, frame.imageInfo.rotationDegrees))
                    .addOnSuccessListener { codes ->
                        if (
                            active.get() &&
                                owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
                        )
                            codes
                                .firstOrNull { it.rawValue != null }
                                ?.rawValue
                                ?.let { raw -> if (locked.compareAndSet(false, true)) decoded(raw) }
                    }
                    .addOnFailureListener {
                        if (active.get()) failed("Camera unavailable. Try again.")
                    }
                    .addOnCompleteListener {
                        analyzing.set(false)
                        frame.close()
                    }
            } catch (error: Exception) {
                analyzing.set(false)
                frame.close()
                ContextCompat.getMainExecutor(context).execute {
                    if (active.get()) failed("Camera unavailable. Try again.")
                }
            }
        }
        provider.addListener(
            {
                if (active.get())
                    try {
                        bound = provider.get()
                        bound!!.bindToLifecycle(
                            owner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            cameraPreview,
                            analysis,
                        )
                    } catch (error: Exception) {
                        failed("Camera unavailable. Try again.")
                    }
            },
            ContextCompat.getMainExecutor(context),
        )
        onDispose {
            active.set(false)
            analysis.clearAnalyzer()
            bound?.unbind(cameraPreview, analysis)
            scanner.close()
            executor.shutdownNow()
        }
    }
}
