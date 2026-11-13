import { useEffect, useMemo, useState } from 'react';
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
// eslint-disable-next-line import/no-named-as-default
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';

const STORAGE_KEY = '@dueday/assignments-v2';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getHelperUrl() {
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0];
  const isLanAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  return isLanAddress ? `http://${host}:3001` : null;
}

function sortAssignments(items) {
  return [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 23, 59, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    year: 'numeric',
  });
}

function getReminderTime(dueDate) {
  const due = parseDate(dueDate);
  if (!due) return null;

  const reminder = new Date(due.getFullYear(), due.getMonth(), due.getDate() - 1, 9, 0, 0, 0);
  const now = new Date();
  if (due <= now) return null;

  // If the day-before time already passed, use a short demo reminder that is still before the due date.
  return reminder > now ? { date: reminder, isDemo: false } : { date: new Date(Date.now() + 60 * 1000), isDemo: true };
}

async function callHelper(path, payload) {
  const helperUrl = getHelperUrl();
  if (!helperUrl) throw new Error('helper-unreachable');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${helperUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'helper-error');
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function friendlyConnectionError() {
  return 'I couldn’t finish that. Check your key, make sure the helper is running, and keep your phone and computer on the same Wi-Fi.';
}

export default function App() {
  const [assignmentText, setAssignmentText] = useState('');
  const [parsedTitle, setParsedTitle] = useState('');
  const [parsedDueDate, setParsedDueDate] = useState('');
  const [parsedConfidence, setParsedConfidence] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportedId, setReportedId] = useState('');
  const [thinking, setThinking] = useState('');
  const [isReady, setIsReady] = useState(false);

  const sortedAssignments = useMemo(() => sortAssignments(assignments), [assignments]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setAssignments(sortAssignments(parsed));
      })
      .catch(() => {})
      .finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(assignments)).catch(() => {});
  }, [assignments, isReady]);

  async function scheduleReminder(dueDate) {
    if (Platform.OS === 'web') return { id: null, isDemo: false, unavailable: true };

    const reminderTime = getReminderTime(dueDate);
    if (!reminderTime) return { id: null, isDemo: false, unavailable: true };

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('dueday-reminders', {
          name: 'DueDay reminders',
          importance: 3,
          vibrationPattern: [0, 250],
        });
      }

      const permission = await Notifications.getPermissionsAsync();
      const finalPermission = permission.status === 'granted'
        ? permission.status
        : (await Notifications.requestPermissionsAsync()).status;
      if (finalPermission !== 'granted') {
        return { id: null, isDemo: reminderTime.isDemo, unavailable: true };
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'DueDay reminder',
          body: 'You have schoolwork due soon.',
          data: { dueDate },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderTime.date,
        },
      });
      return { id, isDemo: reminderTime.isDemo, unavailable: false };
    } catch {
      return { id: null, isDemo: reminderTime.isDemo, unavailable: true };
    }
  }

  async function handleFindDueDate() {
    const cleanText = assignmentText.trim();
    if (!cleanText) {
      setError('Paste an assignment and its due date first.');
      setNotice('');
      return;
    }

    setThinking('extract');
    setError('');
    setNotice('');
    setParsedTitle('');
    setParsedDueDate('');
    try {
      const result = await callHelper('/api/parse-assignment', { assignmentText: cleanText });
      if (!result.dueDate) {
        setError('I could not find a clear due date. Add the date in the assignment text and try again.');
        return;
      }
      setParsedTitle(result.title || cleanText);
      setParsedDueDate(result.dueDate);
      setParsedConfidence(result.confidence || 'low');
      setNotice('Check the date before saving. Confirm uncertain dates with your teacher or school website.');
    } catch {
      setError(friendlyConnectionError());
    } finally {
      setThinking('');
    }
  }

  async function handleSaveAssignment() {
    const title = parsedTitle.trim();
    const dueDate = parsedDueDate.trim();
    const due = parseDate(dueDate);

    if (!title || !due) {
      setError('Please use a real date in YYYY-MM-DD format before saving.');
      return;
    }
    if (due <= new Date()) {
      setError('That due date has already passed. Use a future date so DueDay can remind you.');
      return;
    }

    setThinking('save');
    setError('');
    setNotice('');
    const reminder = await scheduleReminder(dueDate);
    const nextAssignment = {
      id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
      title,
      dueDate,
      source: 'from your pasted assignment text',
      notificationId: reminder.id,
    };
    setAssignments((current) => sortAssignments([...current, nextAssignment]));
    setAssignmentText('');
    setParsedTitle('');
    setParsedDueDate('');
    setParsedConfidence('');
    setNotice(
      reminder.unavailable
        ? 'Saved on this phone. Turn on notifications to receive the reminder.'
        : reminder.isDemo
          ? 'Saved. A safe demo reminder is scheduled for about one minute from now.'
          : `Saved. A general reminder is planned for the day before ${formatDate(dueDate)}.`,
    );
    setThinking('');
  }

  async function handleAskQuestion() {
    if (!question.trim() || !sortedAssignments.length) return;

    setThinking('question');
    setError('');
    setAnswer('');
    try {
      const result = await callHelper('/api/question', {
        question: question.trim(),
        assignments: sortedAssignments,
      });
      setAnswer(result.answer || 'I do not have enough information from your saved assignments yet.');
    } catch {
      setError(friendlyConnectionError());
    } finally {
      setThinking('');
    }
  }

  const canFind = assignmentText.trim() && !thinking;
  const canSave = parsedTitle.trim() && parsedDueDate.trim() && !thinking;
  const canAsk = question.trim() && sortedAssignments.length > 0 && !thinking;

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
            <View style={styles.logoMark}><Text style={styles.logoMarkText}>D</Text></View>
            <Text style={styles.brand}>DueDay</Text>
            <View style={styles.versionPill}><Text style={styles.versionText}>MVP 1</Text></View>
          </View>

          <Text style={styles.eyebrow}>PASTE IT. FIND IT. REMEMBER IT.</Text>
          <Text style={styles.title}>Turn assignment text into a plan.</Text>
          <Text style={styles.subtitle}>
            DueDay finds a clear due date, saves it on your phone, and gives you a reminder before schoolwork is due.
          </Text>

          <View style={styles.differenceCard}>
            <Text style={styles.cardEyebrow}>WHY DUEDAY?</Text>
            <Text style={styles.cardText}>
              It works from what you paste, even when a teacher forgets to post it in a school system.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>1. Paste an assignment</Text>
            <Text style={styles.label}>ASSIGNMENT TEXT</Text>
            <TextInput
              value={assignmentText}
              onChangeText={setAssignmentText}
              placeholder="Example: Science lab report is due Friday, November 20"
              placeholderTextColor="#9AA1B2"
              style={[styles.input, styles.textArea]}
              autoCapitalize="sentences"
              multiline
              textAlignVertical="top"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Find due date with AI"
              disabled={!canFind}
              onPress={handleFindDueDate}
              style={({ pressed }) => [
                styles.primaryButton,
                !canFind && styles.disabledButton,
                pressed && canFind && styles.pressedButton,
              ]}
            >
              {thinking === 'extract' ? (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.primaryButtonText}>Thinking…</Text>
                </View>
              ) : <Text style={styles.primaryButtonText}>Find due date with AI</Text>}
            </Pressable>
            <Text style={styles.helperText}>The AI runs only when you tap the button.</Text>
          </View>

          {parsedDueDate ? (
            <View style={styles.resultCard}>
              <Text style={styles.cardEyebrow}>2. CHECK THE AI RESULT</Text>
              <Text style={styles.resultIntro}>Confirm the details before DueDay saves them.</Text>
              <Text style={styles.label}>ASSIGNMENT</Text>
              <TextInput
                value={parsedTitle}
                onChangeText={setParsedTitle}
                style={styles.input}
                placeholder="Assignment name"
                placeholderTextColor="#9AA1B2"
              />
              <Text style={styles.label}>DUE DATE</Text>
              <TextInput
                value={parsedDueDate}
                onChangeText={setParsedDueDate}
                style={styles.input}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9AA1B2"
              />
              <Text style={styles.sourceText}>
                Source: from your pasted assignment text{parsedConfidence ? ` • ${parsedConfidence} confidence` : ''}.
              </Text>
              <Text style={styles.safetyText}>
                If the date looks uncertain, check with your teacher or the official school website.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save assignment and reminder"
                disabled={!canSave}
                onPress={handleSaveAssignment}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  !canSave && styles.disabledSecondaryButton,
                  pressed && canSave && styles.pressedSecondaryButton,
                ]}
              >
                {thinking === 'save' ? (
                  <View style={styles.thinkingRow}>
                    <ActivityIndicator color="#5A52E8" size="small" />
                    <Text style={styles.secondaryButtonText}>Saving…</Text>
                  </View>
                ) : <Text style={styles.secondaryButtonText}>Save assignment & reminder</Text>}
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Not quite yet</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {notice ? (
            <View style={styles.noticeCard}><Text style={styles.noticeText}>{notice}</Text></View>
          ) : null}

          <View style={styles.listSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>3. Your due dates</Text>
              <Text style={styles.countText}>{sortedAssignments.length}</Text>
            </View>
            {sortedAssignments.length ? sortedAssignments.map((item) => (
              <View key={item.id} style={styles.assignmentCard}>
                <View style={styles.assignmentDatePill}>
                  <Text style={styles.assignmentDateText}>{formatDate(item.dueDate)}</Text>
                </View>
                <Text style={styles.assignmentTitle}>{item.title}</Text>
                <Text style={styles.assignmentSource}>Source: {item.source}</Text>
                <Text style={styles.assignmentReminder}>General phone reminder planned</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setReportedId(item.id)}
                  style={styles.reportButton}
                >
                  <Text style={styles.reportButtonText}>Report an incorrect date</Text>
                </Pressable>
                {reportedId === item.id ? (
                  <Text style={styles.reportedText}>Thanks. Please double-check this date with your teacher.</Text>
                ) : null}
              </View>
            )) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Your saved assignments will appear here.</Text>
                <Text style={styles.emptyText}>Start by pasting an assignment above.</Text>
              </View>
            )}
          </View>

          <View style={styles.questionCard}>
            <Text style={[styles.sectionTitle, styles.questionCardTitle]}>4. Ask about your work</Text>
            <Text style={styles.questionIntro}>DueDay answers from the assignments saved on this phone.</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Example: What is due first?"
              placeholderTextColor="#9AA1B2"
              style={styles.input}
              editable={sortedAssignments.length > 0}
              returnKeyType="done"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ask DueDay"
              disabled={!canAsk}
              onPress={handleAskQuestion}
              style={({ pressed }) => [
                styles.outlineButton,
                !canAsk && styles.disabledOutlineButton,
                pressed && canAsk && styles.pressedOutlineButton,
              ]}
            >
              {thinking === 'question' ? (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator color="#5A52E8" size="small" />
                  <Text style={styles.outlineButtonText}>Thinking…</Text>
                </View>
              ) : <Text style={styles.outlineButtonText}>Ask DueDay</Text>}
            </Pressable>
            {answer ? <Text style={styles.answerText}>{answer}</Text> : null}
          </View>

          <Text style={styles.footerText}>
            Your assignments stay on this phone for now. Notifications use general wording so an assignment name is not shown on a shared lock screen.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FC' },
  keyboardView: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 34 },
  headerRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 30 },
  logoMark: { alignItems: 'center', backgroundColor: '#5A52E8', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  logoMarkText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  brand: { color: '#1E2440', fontSize: 21, fontWeight: '800', letterSpacing: -0.5, marginLeft: 10 },
  versionPill: { backgroundColor: '#ECEBFF', borderRadius: 20, marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 6 },
  versionText: { color: '#5A52E8', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  eyebrow: { color: '#5A52E8', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  title: { color: '#1E2440', fontSize: 38, fontWeight: '800', letterSpacing: -1.4, lineHeight: 43, maxWidth: 370 },
  subtitle: { color: '#626A80', fontSize: 16, lineHeight: 24, marginTop: 14, maxWidth: 380 },
  differenceCard: { backgroundColor: '#E9F7F1', borderColor: '#C9EBDD', borderRadius: 18, borderWidth: 1, marginTop: 24, padding: 17 },
  cardEyebrow: { color: '#16765B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardText: { color: '#205B4C', fontSize: 16, fontWeight: '700', lineHeight: 23, marginTop: 7 },
  formCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7F0', borderRadius: 22, borderWidth: 1, marginTop: 18, padding: 20, shadowColor: '#26315B', shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 3 },
  resultCard: { backgroundColor: '#FFFFFF', borderColor: '#D6D4FF', borderRadius: 22, borderWidth: 1, marginTop: 18, padding: 20 },
  sectionTitle: { color: '#1E2440', fontSize: 19, fontWeight: '800', marginBottom: 16 },
  resultIntro: { color: '#626A80', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  label: { color: '#737B91', fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8, marginTop: 7 },
  input: { backgroundColor: '#F7F8FC', borderColor: '#E3E5EF', borderRadius: 13, borderWidth: 1, color: '#1E2440', fontSize: 16, paddingHorizontal: 14, paddingVertical: 14 },
  textArea: { minHeight: 106, paddingTop: 14 },
  sourceText: { color: '#7A8295', fontSize: 12, lineHeight: 18, marginTop: 8 },
  primaryButton: { alignItems: 'center', backgroundColor: '#5A52E8', borderRadius: 13, justifyContent: 'center', marginTop: 18, minHeight: 54 },
  secondaryButton: { alignItems: 'center', backgroundColor: '#ECEBFF', borderRadius: 13, justifyContent: 'center', marginTop: 18, minHeight: 52 },
  outlineButton: { alignItems: 'center', borderColor: '#5A52E8', borderRadius: 13, borderWidth: 1, justifyContent: 'center', marginTop: 14, minHeight: 50 },
  disabledButton: { backgroundColor: '#B9B7E9' },
  disabledSecondaryButton: { backgroundColor: '#E7E7F0' },
  disabledOutlineButton: { borderColor: '#B7B9C6' },
  pressedButton: { backgroundColor: '#4740C9' },
  pressedSecondaryButton: { backgroundColor: '#DAD8FF' },
  pressedOutlineButton: { backgroundColor: '#F0EFFF' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButtonText: { color: '#4B44C7', fontSize: 15, fontWeight: '800' },
  outlineButtonText: { color: '#5A52E8', fontSize: 15, fontWeight: '800' },
  thinkingRow: { alignItems: 'center', flexDirection: 'row' },
  helperText: { color: '#858CA0', fontSize: 12, marginTop: 12, textAlign: 'center' },
  safetyText: { color: '#626A80', fontSize: 13, lineHeight: 19, marginTop: 13 },
  errorCard: { backgroundColor: '#FFF1F0', borderColor: '#FFD4D0', borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 17 },
  errorTitle: { color: '#A8403A', fontSize: 14, fontWeight: '800' },
  errorText: { color: '#814842', fontSize: 14, lineHeight: 21, marginTop: 5 },
  noticeCard: { backgroundColor: '#E9F7F1', borderColor: '#C9EBDD', borderRadius: 16, borderWidth: 1, marginTop: 18, padding: 15 },
  noticeText: { color: '#205B4C', fontSize: 14, lineHeight: 20 },
  listSection: { marginTop: 28 },
  sectionHeaderRow: { alignItems: 'center', flexDirection: 'row' },
  countText: { backgroundColor: '#ECEBFF', borderRadius: 14, color: '#5A52E8', fontSize: 12, fontWeight: '800', marginLeft: 9, minWidth: 28, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, textAlign: 'center' },
  assignmentCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7F0', borderRadius: 18, borderWidth: 1, marginBottom: 12, padding: 16 },
  assignmentDatePill: { alignSelf: 'flex-start', backgroundColor: '#F4F3FF', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  assignmentDateText: { color: '#5A52E8', fontSize: 12, fontWeight: '800' },
  assignmentTitle: { color: '#1E2440', fontSize: 18, fontWeight: '800', lineHeight: 23, marginTop: 11 },
  assignmentSource: { color: '#7A8295', fontSize: 12, marginTop: 7 },
  assignmentReminder: { color: '#16765B', fontSize: 12, fontWeight: '700', marginTop: 9 },
  emptyCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7F0', borderRadius: 18, borderWidth: 1, padding: 18 },
  emptyTitle: { color: '#1E2440', fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#7A8295', fontSize: 13, marginTop: 5 },
  reportButton: { alignSelf: 'flex-start', borderBottomColor: '#A1A6B8', borderBottomWidth: 1, marginTop: 14, paddingBottom: 2 },
  reportButtonText: { color: '#737B91', fontSize: 12 },
  reportedText: { color: '#16765B', fontSize: 12, lineHeight: 18, marginTop: 8 },
  questionCard: { backgroundColor: '#1E2440', borderRadius: 22, marginTop: 18, padding: 20 },
  questionCardTitle: { color: '#FFFFFF' },
  questionIntro: { color: '#C9CDE1', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  answerText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 24, marginTop: 18 },
  footerText: { color: '#858CA0', fontSize: 12, lineHeight: 18, marginTop: 22, textAlign: 'center' },
});
