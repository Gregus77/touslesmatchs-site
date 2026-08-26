package com.touslesmatchs.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION = 105;
    private static final String TRUSTED_HOST = "www.touslesmatchs.com";
    private static final String HOME =
        "https://www.touslesmatchs.com/app.html?source=android&app=goal05&native=107";

    private final String bridgeNonce = UUID.randomUUID().toString();
    private WebView webView;
    private String pendingEmail;
    private String pendingSession;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(
            settings.getUserAgentString() + " TousLesMatchsAndroid/1.0.7"
        );

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                WebView view,
                WebResourceRequest request
            ) {
                Uri uri = request.getUrl();

                if (isTrustedUrl(uri)) return false;

                if (uri != null && "https".equalsIgnoreCase(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                }

                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Uri uri = url == null ? null : Uri.parse(url);
                if (!isTrustedUrl(uri)) return;

                String javascript =
                    "window.__TLM_NATIVE_ANDROID=true;" +
                    "window.TLMNative={" +
                    "platform:function(){return 'android';}," +
                    "enableNotifications:function(email,session){" +
                    "window.TLMNativeInternal.enableNotifications(" +
                    JSONObject.quote(bridgeNonce) +
                    ",String(email||''),String(session||''));" +
                    "}};" +
                    "window.dispatchEvent(new Event('tlm-native-ready'));";

                view.evaluateJavascript(javascript, null);
            }
        });

        webView.addJavascriptInterface(
            new NativeBridge(),
            "TLMNativeInternal"
        );

        boolean openPick = getIntent().getBooleanExtra("open_pick", false);
        webView.loadUrl(openPick ? HOME + "&tab=pick" : HOME);
    }

    private boolean isTrustedUrl(Uri uri) {
        return uri != null &&
            "https".equalsIgnoreCase(uri.getScheme()) &&
            TRUSTED_HOST.equalsIgnoreCase(uri.getHost());
    }

    public final class NativeBridge {
        @JavascriptInterface
        public void enableNotifications(
            String nonce,
            String email,
            String session
        ) {
            final String requestedEmail =
                email == null ? "" : email.trim().toLowerCase();
            final String requestedSession =
                session == null ? "" : session.trim();

            runOnUiThread(() -> {
                String activeUrl = webView.getUrl();

                if (
                    !bridgeNonce.equals(nonce) ||
                    activeUrl == null ||
                    !isTrustedUrl(Uri.parse(activeUrl))
                ) {
                    notifyWeb(false, "Origine non autorisée.");
                    return;
                }

                pendingEmail = requestedEmail;
                pendingSession = requestedSession;

                if (pendingEmail.isEmpty() || pendingSession.isEmpty()) {
                    notifyWeb(
                        false,
                        "Connectez-vous avant d'activer les notifications."
                    );
                    return;
                }

                if (
                    Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED
                ) {
                    requestPermissions(
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        NOTIFICATION_PERMISSION
                    );
                    return;
                }

                registerFcmToken();
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] results
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, results);

        if (requestCode != NOTIFICATION_PERMISSION) return;

        if (
            results.length > 0 &&
            results[0] == PackageManager.PERMISSION_GRANTED
        ) {
            registerFcmToken();
        } else {
            notifyWeb(false, "Permission de notification refusée.");
        }
    }

    private void registerFcmToken() {
        final String email = pendingEmail;
        final String session = pendingSession;

        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                notifyWeb(false, "Impossible d'obtenir le jeton Firebase.");
                return;
            }

            String token = task.getResult();

            Executors.newSingleThreadExecutor().execute(() -> {
                HttpURLConnection connection = null;

                try {
                    URL endpoint = new URL(
                        "https://www.touslesmatchs.com/api/fcm/register"
                    );

                    connection = (HttpURLConnection) endpoint.openConnection();
                    connection.setRequestMethod("POST");
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(15000);
                    connection.setDoOutput(true);
                    connection.setRequestProperty(
                        "Content-Type",
                        "application/json; charset=utf-8"
                    );

                    JSONObject body = new JSONObject();
                    body.put("email", email);
                    body.put("session", session);
                    body.put("token", token);

                    byte[] bytes = body.toString()
                        .getBytes(StandardCharsets.UTF_8);

                    try (OutputStream output = connection.getOutputStream()) {
                        output.write(bytes);
                    }

                    int status = connection.getResponseCode();

                    if (status >= 200 && status < 300) {
                        notifyWeb(
                            true,
                            "Notifications activées, même application fermée."
                        );
                    } else {
                        notifyWeb(false, "Session ou abonnement non valide.");
                    }
                } catch (Exception error) {
                    notifyWeb(false, "Connexion Firebase impossible.");
                } finally {
                    if (connection != null) connection.disconnect();
                }
            });
        });
    }

    private void notifyWeb(boolean success, String message) {
        String javascript =
            "window.tlmNativeNotificationResult&&" +
            "window.tlmNativeNotificationResult(" +
            (success ? "true" : "false") + "," +
            JSONObject.quote(message) + ");";

        webView.post(() ->
            webView.evaluateJavascript(javascript, null)
        );
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
