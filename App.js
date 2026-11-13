import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

const STORAGE_KEY = '@dueday/draft-v1';

function getHelperUrl() {
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0];
  const isLanAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  return isLanAddress ? `http://${host}:3001` : null;
}

export default function App() {
  const [assignment, setAssignment] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reminder, setReminder] = useState('');
  const [error, setError] = useState('');
  const [reported, setReported] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((savedDraft) => {
        if (!savedDraft) return;

        const draft = JSON.parse(savedDraft);
        setAssignment(draft.assignment ?? '');
        setDueDate(draft.dueDate ?? '');
      })
      .catch(() => {})
      .finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady) return;

    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ assignment, dueDate }),
    ).catch(() => {});
  }, [assignment, dueDate, isReady]);

  async function handleReminder() {
    const cleanAssignment = assignment.trim();
    const cleanDueDate = dueDate.trim();

    if (!cleanAssignment || !cleanDueDate) return;

    const helperUrl = getHelperUrl();
    setError('');
    setReminder('');
    setReported(false);

    if (!helperUrl) {
      setError(
        'I can’t reach the DueDay helper. Use Expo LAN on the same Wi-Fi, then check the key and the helper.',
      );
      return;
    }

    setIsThinking(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${helperUrl}/api/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment: cleanAssignment,
          dueDate: cleanDueDate,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.reminder !== 'string') {
        throw new Error('The helper did not return a reminder.');
      }

      setReminder(result.reminder.trim());
    } catch {
      setError(
        'I couldn’t make the reminder. Check your key, make sure the helper is running, and keep your phone and computer on the same Wi-Fi.',
      );
    } finally {
      setIsThinking(false);
    }
  }

  const canSubmit = assignment.trim() && dueDate.trim() && !isThinking;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>D</Text>
            </View>
            <Text style={styles.brand}>DueDay</Text>
            <View style={styles.versionPill}>
              <Text style={styles.versionText}>VERSION 1</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>A SMALL REMINDER FOR A BIG DAY</Text>
          <Text style={styles.title}>Never lose a due date to a busy day.</Text>
          <Text style={styles.subtitle}>
            Add one assignment and its due date. DueDay turns it into a friendly reminder.
          </Text>

          <View style={styles.differenceCard}>
            <Text style={styles.cardEyebrow}>WHY DUEDAY?</Text>
            <Text style={styles.cardText}>
              Works from what you enter, even when a teacher forgets to post it.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>What do you need to remember?</Text>

            <Text style={styles.label}>ASSIGNMENT</Text>
            <TextInput
              value={assignment}
              onChangeText={setAssignment}
              placeholder="Example: Science lab report"
              placeholderTextColor="#9AA1B2"
              style={styles.input}
              autoCapitalize="sentences"
              returnKeyType="next"
            />

            <Text style={styles.label}>DUE DATE</Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="Example: Friday, May 22"
              placeholderTextColor="#9AA1B2"
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={styles.sourceText}>Source: entered by you</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get my reminder"
              disabled={!canSubmit}
              onPress={handleReminder}
              style={({ pressed }) => [
                styles.primaryButton,
                !canSubmit && styles.disabledButton,
                pressed && canSubmit && styles.pressedButton,
              ]}
            >
              {isThinking ? (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.primaryButtonText}>Thinking…</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Get my reminder</Text>
              )}
            </Pressable>

            <Text style={styles.helperText}>
              DueDay asks the AI only when you tap this button.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Not quite yet</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {reminder ? (
            <View style={styles.reminderCard}>
              <View style={styles.reminderHeader}>
                <Text style={styles.cardEyebrow}>YOUR DUEDAY REMINDER</Text>
                <View style={styles.sparkle}>
                  <Text style={styles.sparkleText}>✦</Text>
                </View>
              </View>
              <Text style={styles.reminderText}>{reminder}</Text>
              <Text style={styles.safetyText}>
                Check the date with your teacher or the official school website if anything looks uncertain.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setReported(true)}
                style={styles.reportButton}
              >
                <Text style={styles.reportButtonText}>Report incorrect information</Text>
              </Pressable>
              {reported ? (
                <Text style={styles.reportedText}>
                  Thanks. Please double-check this date with your teacher.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.footerText}>
            Your assignment and due date stay on this phone for now. No accounts or sharing in Version 1.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 32,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 34,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#5A52E8',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  logoMarkText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  brand: {
    color: '#1E2440',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  versionPill: {
    backgroundColor: '#ECEBFF',
    borderRadius: 20,
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  versionText: {
    color: '#5A52E8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  eyebrow: {
    color: '#5A52E8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    color: '#1E2440',
    fontSize: 39,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 43,
    maxWidth: 370,
  },
  subtitle: {
    color: '#626A80',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    maxWidth: 370,
  },
  differenceCard: {
    backgroundColor: '#E9F7F1',
    borderColor: '#C9EBDD',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 24,
    padding: 17,
  },
  cardEyebrow: {
    color: '#16765B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardText: {
    color: '#205B4C',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
    marginTop: 7,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7F0',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 18,
    padding: 20,
    shadowColor: '#26315B',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  sectionTitle: {
    color: '#1E2440',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 20,
  },
  label: {
    color: '#737B91',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
    marginTop: 7,
  },
  input: {
    backgroundColor: '#F7F8FC',
    borderColor: '#E3E5EF',
    borderRadius: 13,
    borderWidth: 1,
    color: '#1E2440',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sourceText: {
    color: '#7A8295',
    fontSize: 12,
    marginTop: 8,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#5A52E8',
    borderRadius: 13,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 54,
  },
  disabledButton: {
    backgroundColor: '#B9B7E9',
  },
  pressedButton: {
    backgroundColor: '#4740C9',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  thinkingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  helperText: {
    color: '#858CA0',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#FFF1F0',
    borderColor: '#FFD4D0',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 18,
    padding: 17,
  },
  errorTitle: {
    color: '#A8403A',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    color: '#814842',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  reminderCard: {
    backgroundColor: '#1E2440',
    borderRadius: 22,
    marginTop: 18,
    padding: 20,
  },
  reminderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sparkle: {
    alignItems: 'center',
    backgroundColor: '#3B4162',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  sparkleText: {
    color: '#B9B7FF',
    fontSize: 18,
  },
  reminderText: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 30,
    marginTop: 17,
  },
  safetyText: {
    color: '#C9CDE1',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 15,
  },
  reportButton: {
    alignSelf: 'flex-start',
    borderBottomColor: '#858BA8',
    borderBottomWidth: 1,
    marginTop: 17,
    paddingBottom: 2,
  },
  reportButtonText: {
    color: '#D6D8E7',
    fontSize: 12,
  },
  reportedText: {
    color: '#AEE1CE',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  footerText: {
    color: '#858CA0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 22,
    textAlign: 'center',
  },
});
