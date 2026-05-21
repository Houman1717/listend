# Social Auth Setup

## Apple Sign-In

### Apple Developer Console
1. Go to [developer.apple.com](https://developer.apple.com) → Certificates, IDs & Profiles → Identifiers.
2. Select your App ID (`com.houman.listend`).
3. Under Capabilities, enable **Sign In with Apple** and click Save.

### Supabase Dashboard
1. Go to Authentication → Providers → Apple.
2. Enable the provider.
3. Create a **Services ID** in the Apple Developer Console (Identifiers → + → Services IDs).
   - Set the identifier to something like `com.houman.listend.siwa`.
   - Under Sign In with Apple, add your Supabase callback URL as a Return URL:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Generate a **Key** (type: Sign In with Apple) in the Developer Console.
   - Download the `.p8` file — store it securely, it is shown only once.
5. In Supabase, fill in:
   - **Services ID** — the identifier from step 3
   - **Team ID** — your 10-character Apple Team ID
   - **Key ID** — the key ID shown in the Developer Console
   - **Private Key** — paste the full contents of the `.p8` file

---

## Google Sign-In

### Google Cloud Console
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create two OAuth 2.0 Client IDs:

   **Web application client** (used by Supabase and as `webClientId` in the app):
   - Application type: **Web application**
   - Authorised redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret**.

   **iOS client** (used for the native iOS flow):
   - Application type: **iOS**
   - Bundle ID: `com.houman.listend`
   - Copy the **Client ID** — its reversed form (`com.googleusercontent.apps.<suffix>`) is the `iosUrlScheme`.

### Environment variable
Add the web client ID to your `.env` (already gitignored):
```
GOOGLE_WEB_CLIENT_ID=<paste Web Client ID here>
```

### app.json
Replace the placeholder in `app.json`:
```json
"iosUrlScheme": "com.googleusercontent.apps.TODO_PASTE_REVERSED_CLIENT_ID_HERE"
```
with the reversed iOS client ID, e.g. `com.googleusercontent.apps.123456789-abcdefg`.

### Supabase Dashboard
1. Go to Authentication → Providers → Google.
2. Enable the provider.
3. Paste the **Web Client ID** and **Web Client Secret** from the Web application client above.
4. Save.

---

## Usage in your app

```tsx
// In your root layout (_layout.tsx), call once at startup:
import { configureGoogleSignIn } from '../lib/auth/googleAuth';
configureGoogleSignIn();

// Then render the composite component wherever you need it:
import { SocialAuthButtons } from '../components/SocialAuthButtons';
<SocialAuthButtons />

// Or use the individual buttons:
import { AppleAuthButton, GoogleSignInButton } from '../components/SocialAuthButtons';
```

The auth state is managed by Supabase — listen via `supabase.auth.onAuthStateChange` as you would for any other Supabase sign-in method.
