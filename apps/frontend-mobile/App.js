import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList } from 'react-native'

// TODO: reusar la API del backend (login, asistencia, pagos). Esto es un cascar�n offline para probar UX.

const MOCK_CLASSES = [
  { id: 'c1', name: 'Salsa Intermedio', day: 'Lunes', time: '19:00 - 20:00', nextDate: '2025-12-08', attendance: '3/4' },
  { id: 'c2', name: 'Bachata Coreo', day: 'Miércoles', time: '20:00 - 21:00', nextDate: '2025-12-10', attendance: '5/4' },
]

const MOCK_PAYMENTS = [
  { id: 'p1', concept: 'Mensualidad Salsa', amount: '$25.000', date: '2025-12-02', status: 'Pagado' },
  { id: 'p2', concept: 'Clase suelta Bachata', amount: '$7.000', date: '2025-12-03', status: 'Pendiente' },
]

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  const handleLogin = () => {
    // TODO: llamar a /login/access-token y guardar token/tenantId
    setLoggedIn(true)
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Mi Estudio</Text>
        <Text style={styles.subtitle}>Portal alumno · versión móvil</Text>
      </View>

      {!loggedIn ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar sesión</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Entrar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Próximas clases</Text>
            <FlatList
              data={MOCK_CLASSES}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <View>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemSub}>{item.day} · {item.time}</Text>
                    <Text style={styles.itemSub}>Próxima: {item.nextDate}</Text>
                  </View>
                  <View style={[styles.badge, item.attendance.includes('5/4') ? styles.badgeAlert : styles.badgeOk]}>
                    <Text style={styles.badgeText}>{item.attendance}</Text>
                  </View>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pagos</Text>
            <FlatList
              data={MOCK_PAYMENTS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.listItem}>
                  <View>
                    <Text style={styles.itemTitle}>{item.concept}</Text>
                    <Text style={styles.itemSub}>Fecha: {item.date}</Text>
                  </View>
                  <View>
                    <Text style={styles.itemAmount}>{item.amount}</Text>
                    <Text style={[styles.itemStatus, item.status === 'Pagado' ? styles.statusOk : styles.statusPending]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7fb',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  primaryButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemSub: { fontSize: 12, color: '#6b7280' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: '#ecfdf3', borderColor: '#bbf7d0' },
  badgeAlert: { backgroundColor: '#fef2f2', borderColor: '#fecdd3' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#991b1b' },
  separator: { height: 10 },
  itemAmount: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'right' },
  itemStatus: { fontSize: 12, textAlign: 'right' },
  statusOk: { color: '#065f46' },
  statusPending: { color: '#b91c1c' },
})
