import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'

const hostFromExpo = Constants.expoConfig?.hostUri?.split(':')?.[0]
const fallbackBase = hostFromExpo ? `http://${hostFromExpo}:8002` : 'http://127.0.0.1:8002'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || fallbackBase

async function requestCode(email, tenantId) {
  const res = await fetch(`${BASE_URL}/api/pms/students/portal/request_code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, tenant_id: tenantId }),
  })
  let text = ''
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `No se pudo enviar código (${res.status})`)
  }
  try {
    const data = await res.json()
    console.log('[request_code] response', data)
    return data
  } catch {
    text = await res.text()
    console.log('[request_code] raw', text)
    return { ok: true, raw: text }
  }
}

async function loginWithCode(email, code, tenantId) {
  const res = await fetch(`${BASE_URL}/api/pms/students/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, tenant_id: tenantId }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Login falló (${res.status})`)
  }
  return res.json()
}

async function fetchPortal(studentId, token, tenantId) {
  const res = await fetch(`${BASE_URL}/api/pms/students/portal/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': String(tenantId ?? ''),
    },
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Error portal (${res.status})`)
  }
  return res.json()
}

export default function App() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [tenantId, setTenantId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [studentId, setStudentId] = useState(null)
  const [portal, setPortal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)

  const handleRequestCode = async () => {
    if (!email.trim()) {
      Alert.alert('Dato requerido', 'Ingresa el correo')
      return
    }
    try {
      setLoading(true)
      const resp = await requestCode(email.trim(), tenantId)
      if (resp?.code) {
        setCode(resp.code)
        Alert.alert('Código generado', `Código: ${resp.code}`)
      } else {
        Alert.alert('Código enviado', 'Revisa tu correo')
      }
      setCodeSent(true)
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo enviar código')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !code.trim()) {
      Alert.alert('Datos requeridos', 'Ingresa correo y código')
      return
    }
    try {
      setLoading(true)
      const data = await loginWithCode(email.trim(), code.trim(), tenantId)
      setToken(data.access_token)
      setUserEmail(data.student?.email || email)
      setTenantId(data.student?.tenant_id ?? null)
      setStudentId(data.student?.id || null)
      Alert.alert('OK', 'Sesión iniciada')
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadPortal = async () => {
    if (!token) {
      Alert.alert('Login requerido', 'Inicia sesión primero')
      return
    }
    try {
      setLoading(true)
      const data = await fetchPortal(studentId, token, tenantId)
      setPortal(data)
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo cargar portal')
      console.log('[portal] error', e)
      setPortal(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Mi Estudio</Text>
          <Text style={styles.subtitle}>Portal alumno · versión móvil</Text>
        </View>

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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={handleRequestCode} disabled={loading}>
              <Text style={styles.secondaryButtonText}>{loading ? '...' : 'Enviar código'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, { flex: 1 }]} onPress={handleLogin} disabled={loading || !codeSent}>
              <Text style={styles.primaryButtonText}>{loading ? '...' : 'Entrar'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Código recibido"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
          />
          {token ? <Text style={styles.hint}>Sesión de {userEmail}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cargar portal alumno</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleLoadPortal} disabled={loading || !token}>
            <Text style={styles.secondaryButtonText}>{loading ? 'Cargando...' : 'Ver información'}</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator size="small" color="#8b5cf6" />
          </View>
        )}

        {portal && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Perfil</Text>
              <Text style={styles.itemTitle}>{portal.student?.first_name} {portal.student?.last_name}</Text>
              <Text style={styles.itemSub}>{portal.student?.email || 'Sin correo'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Clases activas: {portal.classes_active ?? 0}</Text>
              {portal.enrollments?.length ? (
                <FlatList
                  data={portal.enrollments}
                  keyExtractor={(it) => String(it.id)}
                  renderItem={({ item }) => (
                    <View style={styles.listItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{item.course?.name}</Text>
                        <Text style={styles.itemSub}>
                          Inicio: {item.start_date ?? '-'} · Fin: {item.end_date ?? '-'}
                        </Text>
                      </View>
                      <View style={[styles.badge, item.is_active ? styles.badgeOk : styles.badgeAlert]}>
                        <Text style={styles.badgeText}>{item.is_active ? 'Activa' : 'Inactiva'}</Text>
                      </View>
                    </View>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              ) : (
                <Text style={styles.itemSub}>Sin inscripciones</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Asistencia reciente</Text>
              <Text style={styles.itemSub}>Progreso: {portal.attendance?.percent ?? 0}%</Text>
              {portal.attendance?.recent?.length ? (
                <FlatList
                  data={portal.attendance.recent}
                  keyExtractor={(it, idx) => `${it.course}-${idx}`}
                  renderItem={({ item }) => (
                    <View style={styles.listItem}>
                      <Text style={styles.itemTitle}>{item.course}</Text>
                      <Text style={styles.itemSub}>{item.attended_at}</Text>
                    </View>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              ) : (
                <Text style={styles.itemSub}>Sin registros</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pagos recientes</Text>
              {portal.payments?.recent?.length ? (
                <FlatList
                  data={portal.payments.recent}
                  keyExtractor={(it) => String(it.id)}
                  renderItem={({ item }) => (
                    <View style={styles.listItem}>
                      <View>
                        <Text style={styles.itemTitle}>${item.amount}</Text>
                        <Text style={styles.itemSub}>{item.payment_date}</Text>
                      </View>
                      <Text style={styles.itemSub}>{item.method}</Text>
                    </View>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              ) : (
                <Text style={styles.itemSub}>Sin pagos</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
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
  secondaryButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  secondaryButtonText: { color: '#4f46e5', fontWeight: '700', fontSize: 15 },
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
