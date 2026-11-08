# Releasing the Fieldnotes Android app

Debug builds are signed with a different key on every machine (your laptop, GitHub
Actions, anyone else's). Android refuses to update an app with a build signed by a
different key, so testers would have to uninstall and lose their data. A single release
key, kept by the owner, fixes that. **If the key is lost, the app can never be updated
in place again**, so back it up.

## 1. Create the release key (once, on your own computer)

Run this in a folder **outside** the repository, for example `Documents\fieldnotes-keys`.
`keytool` comes with the JDK.

```powershell
keytool -genkeypair -v -keystore fieldnotes-release.jks -alias fieldnotes `
  -keyalg RSA -keysize 4096 -validity 10000
```

It asks for a password and your name or organisation. Choose a strong password.

Back up `fieldnotes-release.jks` **and** the password in two places, such as your password
manager and an offline USB drive. Never commit the file, paste the password in chat, or
email either. `*.jks` and `*.keystore` are already git-ignored.

## 2. Build a signed release

In PowerShell, from the `android` folder:

```powershell
$env:FIELDNOTES_KEYSTORE = "C:\Users\<you>\Documents\fieldnotes-keys\fieldnotes-release.jks"
$env:FIELDNOTES_KEYSTORE_PASSWORD = Read-Host -Prompt "Keystore password"
.\gradlew.bat assembleRelease   # signed APK for direct sharing
.\gradlew.bat bundleRelease     # signed AAB for Google Play
```

`Read-Host` keeps the password out of your shell history. The outputs are:

- `app/build/outputs/apk/release/app-release.apk`
- `app/build/outputs/bundle/release/app-release.aab`

Optional variables: `FIELDNOTES_KEY_ALIAS` (default `fieldnotes`) and
`FIELDNOTES_KEY_PASSWORD` (defaults to the keystore password).

If `FIELDNOTES_KEYSTORE` is not set, the release build is unsigned and cannot be installed.
That is deliberate: it can never be signed with a wrong or temporary key.

## 3. Before each release

- Increase `versionCode` (by 1) and `versionName` in `app/build.gradle.kts`.
- Check that the store listing, README and tester messages describe only what ships.
  Whisper transcription and the local summary model are **planned**, not included.
- First release after debug testing: testers must uninstall the debug build once,
  because it was signed with a different key. Every later release updates in place.

## 4. Sharing options

| Channel | Setup | Notes |
|---|---|---|
| Direct APK link | Host `app-release.apk` | Fastest; testers allow "install unknown apps"; no automatic updates |
| Play Console internal testing | Google Play developer account (one-time USD 25), upload the AAB | Up to 100 testers; Play handles updates; needs a privacy policy and data-safety form |
| Firebase App Distribution | Firebase project | Good for frequent builds to tester groups |
