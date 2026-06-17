import { View, Text, StyleSheet, Linking } from 'react-native';

const TERMS_URL   = 'https://houman1717.github.io/listend-policys/terms.html';
const PRIVACY_URL = 'https://houman1717.github.io/listend-policys/privacy.html';
const ACCENT = '#D4A017';

/**
 * Inline EULA / terms consent shown on the signup & login screens.
 * Required by App Store guideline 1.2 (user-generated content): users must
 * agree to terms with a no-tolerance policy before registering or logging in.
 */
export function LegalConsent({ verb = 'continuing', color }: { verb?: string; color: string }) {
  return (
    <View style={s.wrap}>
      <Text style={[s.text, { color }]}>
        By {verb}, you agree to our{' '}
        <Text style={s.link} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Use</Text>
        {' '}and{' '}
        <Text style={s.link} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>.
        {' '}Listend has zero tolerance for objectionable content or abusive behavior.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%', marginTop: 16, paddingHorizontal: 4 },
  text: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  link: { color: ACCENT, textDecorationLine: 'underline' },
});
