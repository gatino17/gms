import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import {
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
import { Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const hostFromExpo = Constants.expoConfig?.hostUri?.split(':')?.[0]
const fallbackBase = hostFromExpo ? `http://${hostFromExpo}:8002` : 'http://127.0.0.1:8002'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || fallbackBase

const BANNERS = [
  { id: 'b1', title: 'Salsa Night', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=60' },
  { id: 'b2', title: 'Bachata Weekend', img: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?auto=format&fit=crop&w=800&q=60' },
  { id: 'b3', title: 'Nuevo Curso Intermedio', img: 'https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=800&q=60' },
]

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
  const [loadingPortal, setLoadingPortal] = useState(false)

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
      await handleLoadPortal(data.access_token, data.student?.tenant_id ?? null, data.student?.id || null)
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadPortal = async (tokenOverride, tenantOverride, studentOverride) => {
    const tok = tokenOverride || token
    const tid = tenantOverride ?? tenantId
    const sid = studentOverride ?? studentId
    if (!tok) {
      Alert.alert('Login requerido', 'Inicia sesión primero')
      return
    }
    try {
      setLoadingPortal(true)
      const data = await fetchPortal(sid, tok, tid)
      setPortal(data)
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo cargar portal')
      console.log('[portal] error', e)
      setPortal(null)
    } finally {
      setLoadingPortal(false)
    }
  }

  const loggedIn = token && portal

  const activeCount = portal?.classes_active || 0
  const completedCount = 0
  const totalHours = (portal?.attendance?.recent?.length || 0) * 1
  const firstEnrollment = portal?.enrollments?.[0]
  const nextClassName = firstEnrollment?.course?.name || 'Sin curso asignado'
  const nextClassDate = firstEnrollment?.start_date || '-'
  const nextClassRoom = firstEnrollment?.course?.room_name || 'Sala'

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {!loggedIn ? (
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
              placeholderTextColor="#6b7280"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.row}>
              <TouchableOpacity style={[styles.secondaryButton, styles.flex1]} onPress={handleRequestCode} disabled={loading}>
                <Text style={styles.secondaryButtonText}>{loading ? '...' : 'Enviar código'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, styles.flex1]} onPress={handleLogin} disabled={loading || !codeSent}>
                <Text style={styles.primaryButtonText}>{loading ? '...' : 'Entrar'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Código recibido"
              placeholderTextColor="#6b7280"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            {token ? <Text style={styles.hint}>Sesión de {userEmail}</Text> : null}
          </View>

          {loading && (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color="#7c3aed" />
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={[styles.card, styles.rowBetween, { alignItems: 'center' }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {((portal.student?.first_name || '')[0] || '').toUpperCase()}
                {((portal.student?.last_name || '')[0] || '').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.itemTitle}>{portal.student?.first_name} {portal.student?.last_name}</Text>
              <Text style={styles.itemSub}>{portal.student?.email || 'Sin correo'}</Text>
            </View>
            <View style={[styles.badge, portal.classes_active > 0 ? styles.badgeOk : styles.badgeAlert]}>
              <Text style={styles.badgeText}>{portal.classes_active > 0 ? 'Activo' : 'Inactivo'}</Text>
            </View>
          </View>

          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <View style={[styles.statCard]}>
              <Text style={styles.statNumber}>{activeCount}</Text>
              <Text style={styles.statLabel}>Cursos activos</Text>
            </View>
            <View style={[styles.statCard]}>
              <Text style={styles.statNumber}>{completedCount}</Text>
              <Text style={styles.statLabel}>Completados</Text>
            </View>
            <View style={[styles.statCard]}>
              <Text style={styles.statNumber}>{totalHours}h</Text>
              <Text style={styles.statLabel}>Horas de baile</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Próxima clase</Text>
            <View style={styles.nextClass}>
              <Text style={styles.nextTitle}>{nextClassName}</Text>
              <Text style={styles.nextSub}>Fecha inicio: {nextClassDate}</Text>
              <Text style={styles.nextSub}>{nextClassRoom}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Novedades</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              {BANNERS.map((b) => (
                <View key={b.id} style={styles.banner}>
                  <Image source={{ uri: b.img }} style={styles.bannerImg} />
                  <View style={styles.bannerLabel}>
                    <Text style={styles.bannerText}>{b.title}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {portal.enrollments?.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Curso actual</Text>
              <View style={styles.courseCard}>
                <View style={styles.courseImage}>
                  <Text style={styles.courseImageText}>
                    {(portal.enrollments[0]?.course?.name || 'C')[0]}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemTitle}>{portal.enrollments[0]?.course?.name || '-'}</Text>
                  <Text style={styles.itemSub}>Fin: {portal.enrollments[0]?.end_date || '-'}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Clases activas</Text>
              <View style={[styles.badge, portal.classes_active > 0 ? styles.badgeOk : styles.badgeAlert]}>
                <Text style={styles.badgeText}>{portal.classes_active || 0}</Text>
              </View>
            </View>
            {portal.enrollments?.length ? (
              <FlatList
                data={portal.enrollments}
                keyExtractor={(it) => String(it.id)}
                renderItem={({ item }) => (
                  <View style={[styles.listItem, { paddingVertical: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.course?.name}</Text>
                      <Text style={styles.itemSub}>
                        {item.start_date ?? '-'} · {item.end_date ?? '-'}
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
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: { marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#e2e8f0' },
  subtitle: { fontSize: 14, color: '#94a3b8' },
  card: {
    backgroundColor: '#0b1224',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#e5e7eb', marginBottom: 8 },
  input: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    color: '#e5e7eb',
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  secondaryButtonText: { color: '#cbd5f5', fontWeight: '700', fontSize: 15 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#e2e8f0' },
  itemSub: { fontSize: 12, color: '#94a3b8' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: '#052e16', borderColor: '#16a34a' },
  badgeAlert: { backgroundColor: '#3f1d2e', borderColor: '#fca5a5' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#f8fafc' },
  separator: { height: 10 },
  itemAmount: { fontSize: 14, fontWeight: '700', color: '#e2e8f0', textAlign: 'right' },
  itemStatus: { fontSize: 12, textAlign: 'right' },
  statusOk: { color: '#4ade80' },
  statusPending: { color: '#f87171' },
  banner: {
    width: 220,
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  bannerImg: { width: '100%', height: '100%' },
  bannerLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flex1: { flex: 1 },
  hint: { marginTop: 6, fontSize: 12, color: '#9ca3af' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarText: { color: '#e2e8f0', fontWeight: '800', fontSize: 18 },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseImage: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#1d1b2f',
    borderWidth: 1,
    borderColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseImageText: { color: '#a5b4fc', fontWeight: '800', fontSize: 18 },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  statNumber: { color: '#e0f2fe', fontWeight: '800', fontSize: 18 },
  statLabel: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  nextClass: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
  },
  nextTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  nextSub: { color: '#e9d5ff', fontSize: 12, marginTop: 2 },
})

