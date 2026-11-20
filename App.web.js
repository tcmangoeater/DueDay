import { StyleSheet, View } from 'react-native';
import App from './AppContent';

export default function WebApp() {
  return (
    <View style={styles.stage}>
      <View style={styles.phone}>
        <App />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    backgroundColor: '#E8EBF2',
    flex: 1,
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
  },
  phone: {
    backgroundColor: '#F8FAFF',
    borderLeftColor: '#D8DDE8',
    borderLeftWidth: 1,
    borderRightColor: '#D8DDE8',
    borderRightWidth: 1,
    height: '100vh',
    maxWidth: '100%',
    overflow: 'hidden',
    width: 400,
  },
});
