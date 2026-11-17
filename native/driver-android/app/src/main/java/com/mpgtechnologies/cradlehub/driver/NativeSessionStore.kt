package com.mpgtechnologies.cradlehub.driver

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

/** App-private encrypted session/cookies. No passwords, role authority or booking cache. */
internal class NativeSessionStore(context: Context, namespace: String = "native-driver-session") {
    private val prefs = context.getSharedPreferences(namespace, Context.MODE_PRIVATE)

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey("cradle-driver-native", null) as? SecretKey)?.let {
            return it
        }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            .apply {
                init(
                    KeyGenParameterSpec.Builder(
                            "cradle-driver-native",
                            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                        )
                        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                        .build()
                )
            }
            .generateKey()
    }

    @Synchronized
    fun read(): JSONObject? = runCatching {
        val raw = prefs.getString("sealed", null) ?: return null
        val parts = raw.split(":")
        require(parts.size == 2)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            key(),
            GCMParameterSpec(128, Base64.getDecoder().decode(parts[0])),
        )
        JSONObject(String(cipher.doFinal(Base64.getDecoder().decode(parts[1])), Charsets.UTF_8))
    }
        .getOrElse {
            clear()
            null
        }

    @Synchronized
    fun write(value: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val enc = Base64.getEncoder()
        prefs
            .edit()
            .putString(
                "sealed",
                enc.encodeToString(cipher.iv) +
                    ":" +
                    enc.encodeToString(
                        cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8))
                    ),
            )
            .apply()
    }

    @Synchronized
    fun clear() {
        prefs.edit().clear().apply()
    }
}

/**
 * Matches the installed @supabase/ssr 0.10.3 cookie wire format (3180-byte chunks). The server
 * still verifies the signed session with getUser; cookie content is not authority.
 */
internal object NativeSsrSession {
    fun cookies(storageKey: String, session: String): String {
        require(storageKey.matches(Regex("sb-[A-Za-z0-9_-]+-auth-token")))
        val encoded =
            "base64-" +
                Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(session.toByteArray(Charsets.UTF_8))
        val chunks = encoded.chunked(3180)
        return chunks
            .mapIndexed { index, value ->
                "$storageKey${if(chunks.size==1) "" else ".$index"}=$value"
            }
            .joinToString("; ")
    }
}
