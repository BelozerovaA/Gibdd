import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AlertsProvider, useAlerts } from './src/context/AlertsContext';
import BottomNav from './src/components/BottomNav';
import AlertDialogs from './src/components/AlertDialogs';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MyWantedScreen from './src/screens/MyWantedScreen';
import AllWantedScreen from './src/screens/AllWantedScreen';
import MapScreen from './src/screens/MapScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { colors } from './src/theme';

function Shell({ tab, setTab, focus }) {
  const { current } = useAlerts();
  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <View style={{ flex: 1 }}>
        <View style={[StyleSheet.absoluteFill, tab !== 'map' && s.hidden]} pointerEvents={tab === 'map' ? 'auto' : 'none'}>
          <MapScreen focus={focus} active={tab === 'map'} />
        </View>
        {tab === 'profile' && <ProfileScreen />}
        {tab === 'my' && <MyWantedScreen />}
        {tab === 'all' && <AllWantedScreen />}
        {tab === 'history' && <HistoryScreen />}
      </View>
      <BottomNav active={tab} onChange={setTab} badge={!!current} />
      <AlertDialogs />
    </SafeAreaView>
  );
}

function Main() {
  const [tab, setTab] = useState('profile');
  const [focus, setFocus] = useState(null);

  const onFocusCamera = useCallback((p) => {
    setTab('map');
    setFocus({
      camera_number: p.camera_number,
      address: p.address,
      plate: p.plate,
      time: p.time,
      nonce: Date.now(),
    });
  }, []);

  return (
    <AlertsProvider onFocusCamera={onFocusCamera}>
      <Shell tab={tab} setTab={setTab} focus={focus} />
    </AlertsProvider>
  );
}

function Root() {
  const { ready, session } = useAuth();
  if (!ready) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return session ? <Main /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hidden: { opacity: 0 },
});
