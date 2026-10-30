import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Button, Dialog, ErrorText } from '../components/ui';
import { colors, radius, shadow } from '../theme';

/** Рис. 1 — страница авторизации. До входа меню навигации отсутствует. */
export default function LoginScreen() {
  const { login, server, changeServer } = useAuth();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverDraft, setServerDraft] = useState(server);

  const submit = async () => {
    if (!user.trim() || !pass) {
      setError('Введите логин и пароль');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(user, pass);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logo}>
            <Ionicons name="shield-checkmark" size={46} color="#fff" />
          </View>
          <Text style={s.brand}>АвтоДозор</Text>
          <Text style={s.caption}>Вход в систему оперативного розыска транспортных средств</Text>

          <View style={s.card}>
            <Text style={s.label}>Логин</Text>
            <View style={s.field}>
              <Ionicons name="person-outline" size={19} color={colors.muted} />
              <TextInput
                style={s.input}
                value={user}
                onChangeText={setUser}
                placeholder="Введите логин"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <Text style={[s.label, { marginTop: 14 }]}>Пароль</Text>
            <View style={s.field}>
              <Ionicons name="lock-closed-outline" size={19} color={colors.muted} />
              <TextInput
                style={s.input}
                value={pass}
                onChangeText={setPass}
                placeholder="Введите пароль"
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submit}
                returnKeyType="go"
              />
              <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={10}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
              </Pressable>
            </View>

            <ErrorText>{error}</ErrorText>
            <Button title="Войти" onPress={submit} loading={busy} style={{ marginTop: 18 }} />
          </View>

          <Pressable
            onPress={() => {
              setServerDraft(server);
              setServerOpen(true);
            }}
            style={s.serverLink}
          >
            <Ionicons name="server-outline" size={15} color={colors.muted} />
            <Text style={s.serverText}>Сервер: {server}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Dialog visible={serverOpen} title="Адрес сервера" onRequestClose={() => setServerOpen(false)}>
        <Text style={s.hint}>
          Эмулятор Android: http://10.0.2.2:8000{'\n'}Телефон: http://IP-компьютера:8000
        </Text>
        <View style={[s.field, { marginTop: 10 }]}>
          <TextInput
            style={s.input}
            value={serverDraft}
            onChangeText={setServerDraft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Button
            title="Сохранить"
            style={{ flex: 1, marginRight: 6 }}
            onPress={async () => {
              await changeServer(serverDraft);
              setServerOpen(false);
            }}
          />
          <Button title="Отмена" variant="ghost" style={{ flex: 1, marginLeft: 6 }} onPress={() => setServerOpen(false)} />
        </View>
      </Dialog>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryDark },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { alignSelf: 'center', width: 84, height: 84, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  caption: { color: '#B9CCEE', fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 26, paddingHorizontal: 16 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 20, ...shadow },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.m, paddingHorizontal: 12, minHeight: 48, backgroundColor: '#fff' },
  input: { flex: 1, fontSize: 16, color: colors.text, marginLeft: 8, paddingVertical: 8 },
  serverLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  serverText: { color: '#9FB6DE', marginLeft: 6, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
