// Prepares the generated Capacitor Android project (android/ is not committed):
// sets versionName/versionCode from package.json so every release installs as an
// in-place update, and generates launcher icons from resources/.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split(/[.-]/).map(n => parseInt(n, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;

if (!existsSync('android')) execSync('npx cap add android', { stdio: 'inherit' });
execSync('npx cap sync android', { stdio: 'inherit' });

const gradlePath = 'android/app/build.gradle';
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
writeFileSync(gradlePath, gradle);

execSync('npx @capacitor/assets generate --android --assetPath resources --iconBackgroundColor "#0d0f0d" --iconBackgroundColorDark "#0d0f0d" --splashBackgroundColor "#0d0f0d" --splashBackgroundColorDark "#0d0f0d"', { stdio: 'inherit' });

console.log(`Android project ready: ${pkg.version} (versionCode ${versionCode})`);
