package com.mosslightstudios.gamehub;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/** Installs and launches game APKs synced from the desktop (see src/sync/apk.ts). */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    private static long versionOf(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    @PluginMethod
    public void inspect(PluginCall call) {
        PackageInfo info = getContext().getPackageManager().getPackageArchiveInfo(call.getString("path", ""), 0);
        JSObject r = new JSObject();
        if (info != null) {
            r.put("packageName", info.packageName);
            r.put("versionCode", versionOf(info));
        }
        call.resolve(r);
    }

    @PluginMethod
    public void installedVersion(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(call.getString("packageName", ""), 0);
            r.put("installed", true);
            r.put("versionCode", versionOf(info));
        } catch (PackageManager.NameNotFoundException e) {
            r.put("installed", false);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void install(PluginCall call) {
        JSObject r = new JSObject();
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            r.put("started", false);
            r.put("needsPermission", true);
            call.resolve(r);
            return;
        }
        File apk = new File(call.getString("path", ""));
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        r.put("started", true);
        call.resolve(r);
    }

    @PluginMethod
    public void launch(PluginCall call) {
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(call.getString("packageName", ""));
        JSObject r = new JSObject();
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        r.put("launched", intent != null);
        call.resolve(r);
    }
}
