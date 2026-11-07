import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

console.log('\n======================================================');
console.log('   Current News - Android SHA-1 & SHA-256 Generator   ');
console.log('======================================================\n');

const isWindows = os.platform() === 'win32';
const androidDir = path.join(process.cwd(), 'android');

if (!fs.existsSync(androidDir)) {
  console.error('Error: "android" directory not found in project root.');
  process.exit(1);
}

// 1. Locate Java runtime (check environment or Android Studio default bundled JDK)
let javaHome = process.env.JAVA_HOME;

if (!javaHome && isWindows) {
  const possiblePaths = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Android\\Android Studio\\jre',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr'),
    path.join(process.env.PROGRAMFILES || '', 'Java', 'jdk-17'),
    path.join(process.env.PROGRAMFILES || '', 'Eclipse Adoptium', 'jdk-17.0.0-hotspot')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'bin', 'java.exe'))) {
      javaHome = p;
      break;
    }
  }
}

const env = { ...process.env };
if (javaHome) {
  env.JAVA_HOME = javaHome;
  const binPath = path.join(javaHome, 'bin');
  env.PATH = `${binPath}${path.delimiter}${env.PATH || ''}`;
  console.log(`[Info] Using JDK: ${javaHome}\n`);
}

// 2. Run Gradle signingReport command
const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';
console.log(`[Info] Running "${gradlewCmd} signingReport" in ./android...\n`);

try {
  const result = spawnSync(gradlewCmd, ['signingReport'], {
    cwd: androidDir,
    env,
    encoding: 'utf-8',
    shell: true
  });

  const output = (result.stdout || '') + (result.stderr || '');

  // Extract SHA-1 and SHA-256 blocks
  const sha1Matches = [...output.matchAll(/Variant:\s*([a-zA-Z0-9_-]+)[\s\S]*?SHA1:\s*([A-Fa-f0-9:]{59})/g)];
  const sha256Matches = [...output.matchAll(/Variant:\s*([a-zA-Z0-9_-]+)[\s\S]*?SHA-256:\s*([A-Fa-f0-9:]{95})/g)];

  if (sha1Matches.length > 0) {
    console.log('------------------------------------------------------');
    console.log('   Extracted SHA Keys for Firebase Console:           ');
    console.log('------------------------------------------------------\n');

    const seenVariants = new Set();

    sha1Matches.forEach((match, index) => {
      const variant = match[1];
      const sha1 = match[2];
      const sha256 = sha256Matches[index] ? sha256Matches[index][2] : null;

      if (!seenVariants.has(variant)) {
        seenVariants.add(variant);
        console.log(`📌 Variant: ${variant.toUpperCase()}`);
        console.log(`   SHA-1:   ${sha1}`);
        if (sha256) {
          console.log(`   SHA-256: ${sha256}`);
        }
        console.log('');
      }
    });

    console.log('------------------------------------------------------');
    console.log('👉 Next Step:');
    console.log('1. Go to Firebase Console -> Project Settings -> General');
    console.log('2. Scroll down to your Android app (blog.currentnews.app)');
    console.log('3. Click "Add Fingerprint" and paste the SHA-1 and SHA-256 above.');
    console.log('------------------------------------------------------\n');
  } else {
    // If output exists but no keys parsed, show raw output
    if (output.trim()) {
      console.log(output);
    } else {
      showManualInstructions();
    }
  }
} catch (err) {
  console.warn('[Notice] Could not run Gradle directly from terminal:', err.message);
  showManualInstructions();
}

function showManualInstructions() {
  console.log('\n======================================================');
  console.log('   Easy 2-Click Method Inside Android Studio:         ');
  console.log('======================================================\n');
  console.log('You can get the SHA-1 key instantly without any commands:');
  console.log('1. Open your project in Android Studio (npm run cap:open).');
  console.log('2. On the far RIGHT edge of Android Studio, click the "Gradle" tab.');
  console.log('3. Expand: android -> Tasks -> android (or app -> Tasks -> android).');
  console.log('4. Double-click "signingReport".');
  console.log('5. The Run console at the bottom will immediately display your SHA-1 and SHA-256 keys!\n');
}
