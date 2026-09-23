// Prepares the generated Capacitor Android project (android/ is not committed):
// - versionName/versionCode from package.json, so every release installs as an in-place update
// - the ApkInstaller plugin + permissions so synced game builds can be installed and launched
// - the mosslight:// deep link used for pairing
// - launcher icons from resources/
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const [major, minor, patch] = pkg.version.split(/[.-]/).map(n => parseInt(n, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;

if (!existsSync('android')) execSync('npx cap add android', { stdio: 'inherit' });
execSync('npx cap sync android', { stdio: 'inherit' });

const gradlePath = 'android/app/build.gradle';
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
writeFileSync(gradlePath, gradle);

// Native code
const javaDir = `android/app/src/main/java/${cap.appId.replace(/\./g, '/')}`;
mkdirSync(javaDir, { recursive: true });
copyFileSync('android-native/ApkInstallerPlugin.java', `${javaDir}/ApkInstallerPlugin.java`);
copyFileSync('android-native/MainActivity.java', `${javaDir}/MainActivity.java`);
mkdirSync('android/app/src/main/res/xml', { recursive: true });
copyFileSync('android-native/file_paths.xml', 'android/app/src/main/res/xml/file_paths.xml');

// Manifest: permissions + pairing deep link
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = readFileSync(manifestPath, 'utf8');
const perms = ['android.permission.REQUEST_INSTALL_PACKAGES', 'android.permission.QUERY_ALL_PACKAGES'];
for (const p of perms) {
  if (!manifest.includes(p)) manifest = manifest.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
}
if (!manifest.includes('android:scheme="mosslight"')) {
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="mosslight" />
            </intent-filter>
        </activity>`;
  manifest = manifest.replace('</activity>', filter);
}
if (!manifest.includes('com.google.mlkit.vision.DEPENDENCIES')) {
  manifest = manifest.replace('</application>', '        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />\n    </application>');
}
if (!manifest.includes('androidx.core.content.FileProvider')) throw new Error('Expected the Capacitor FileProvider in AndroidManifest.xml');
writeFileSync(manifestPath, manifest);

execSync('npx @capacitor/assets generate --android --assetPath resources --iconBackgroundColor "#0d0f0d" --iconBackgroundColorDark "#0d0f0d" --splashBackgroundColor "#0d0f0d" --splashBackgroundColorDark "#0d0f0d"', { stdio: 'inherit' });

console.log(`Android project ready: ${pkg.version} (versionCode ${versionCode})`);
