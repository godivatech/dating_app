import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder landing screen — Phase 1.
 *
 * This screen exists only to confirm the app boots correctly.
 * It will be replaced by the authentication flow in Phase 2.
 *
 * Do NOT add business logic here during Phase 1.
 */
export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dating App</Text>
      <Text style={styles.subtitle}>Phase 1 — Foundation</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
});
