import { useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

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
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `No se pudo enviar código (${res.status})`)
  }
  return res.json()
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

async function fetchPortal(token, tenantId) {
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

const makeAbsolute = (pathOrUrl) => {
  if (!pathOrUrl) return null
  try {
    const u = new URL(pathOrUrl)
    return u.toString()
  } catch {
    const left = BASE_URL.replace(/\/+$/, '')
    const right = String(pathOrUrl).replace(/^\/+/, '')
    return `${left}/${right}`
  }
}

const initials = (s1 = '', s2 = '') =>
  `${(s1[0] || '').toUpperCase()}${(s2[0] || '').toUpperCase()}` || 'A'

const formatDate = (iso) => {
  if (!iso || typeof iso !== 'string') return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const parts = iso.split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    return iso
  }
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const day = days[d.getDay()]
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${day} ${dd}/${mm}/${yyyy}`
}

export default function App() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [tenantId, setTenantId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [portal, setPortal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)

  const colorScheme = useColorScheme()
  const theme = useMemo(() => {
    const dark = colorScheme !== 'light'
    return {
      isDark: dark,
      bg: dark ? '#0f172a' : '#f8fafc',
      card: dark ? '#0b1224' : '#ffffff',
      text: dark ? '#e2e8f0' : '#0f172a',
      sub: dark ? '#94a3b8' : '#475569',
      border: dark ? '#1f2937' : '#e2e8f0',
      primary: dark ? '#7c3aed' : '#8b5cf6',
      secondary: dark ? '#111827' : '#eef2ff',
      badgeOkBg: dark ? '#052e16' : '#ecfdf3',
      badgeOkBorder: dark ? '#16a34a' : '#bbf7d0',
      badgeAlertBg: dark ? '#3f1d2e' : '#fef2f2',
      badgeAlertBorder: dark ? '#fca5a5' : '#fecdd3',
    }
  }, [colorScheme])
  const styles = useMemo(() => makeStyles(theme), [theme])

  const loggedIn = token && portal
  const activeCount = portal?.classes_active || 0
  const completedCount = 0
  const totalHours = (portal?.attendance?.recent?.length || 0) * 1
  const firstEnrollment = portal?.enrollments?.[0]
  const nextClassName = firstEnrollment?.course?.name || 'Sin curso asignado'
  const nextClassDate = formatDate(firstEnrollment?.start_date || '')
  const nextClassTeacher = firstEnrollment?.course?.teacher_name || 'Profesor'
  const nextClassTime = firstEnrollment?.course?.start_time
    ? String(firstEnrollment.course.start_time).slice(0, 5)
    : null
  const nextClassImg = makeAbsolute(firstEnrollment?.course?.image_url)

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
      await handleLoadPortal(data.access_token, data.student?.tenant_id ?? null)
      Alert.alert('OK', 'Sesión iniciada')
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadPortal = async (tokenOverride, tenantOverride) => {
    const tok = tokenOverride || token
    const tid = tenantOverride ?? tenantId
    if (!tok) {
      Alert.alert('Login requerido', 'Inicia sesión primero')
      return
    }
    try {
      setLoadingPortal(true)
      const data = await fetchPortal(tok, tid)
      setPortal(data)
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo cargar portal')
      console.log('[portal] error', e)
      setPortal(null)
    } finally {
      setLoadingPortal(false)
    }
  }

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
              placeholderTextColor={theme.sub}
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
              placeholderTextColor={theme.sub}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            {token ? <Text style={styles.hint}>Sesión de {userEmail}</Text> : null}
          </View>

          {loading && (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={[styles.card, styles.rowBetween, { alignItems: 'center' }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initials(portal.student?.first_name, portal.student?.last_name)}
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
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{activeCount}</Text>
              <Text style={styles.statLabel}>Cursos activos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{completedCount}</Text>
              <Text style={styles.statLabel}>Completados</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalHours}h</Text>
              <Text style={styles.statLabel}>Horas de baile</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Próxima clase</Text>
            <LinearGradient
              colors={['#ec4899', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextClass}
            >
              <View style={[styles.row, { alignItems: 'center' }]}>
                <Ionicons name="sparkles-outline" size={16} color="#fff" />
                <Text style={[styles.nextLabel, { marginLeft: 6 }]}>Próxima clase</Text>
              </View>
              <Text style={styles.nextTitle}>{nextClassName}</Text>
              <Text style={styles.nextSub}>
                Inicio: <Text style={styles.nextStrong}>{nextClassDate}{nextClassTime ? ` · ${nextClassTime}` : ''}</Text>
              </Text>
              <Text style={styles.nextSub}>{nextClassTeacher}</Text>
            </LinearGradient>
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
                {nextClassImg ? (
                  <Image source={{ uri: nextClassImg }} style={styles.courseImage} />
                ) : (
                  <View style={styles.courseImagePlaceholder}>
                    <Text style={styles.courseImageText}>
                      {(portal.enrollments[0]?.course?.name || 'C')[0]}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemTitle}>{portal.enrollments[0]?.course?.name || '-'}</Text>
                  <Text style={styles.itemSub}>Fin: {formatDate(portal.enrollments[0]?.end_date || '')}</Text>
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
            {loadingPortal && (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            )}
            {!loadingPortal && (portal.enrollments?.length ? (
              <FlatList
                data={portal.enrollments}
                keyExtractor={(it) => String(it.id)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={[styles.listItem, { paddingVertical: 8 }]}>
                    {makeAbsolute(item.course?.image_url) ? (
                      <Image source={{ uri: makeAbsolute(item.course?.image_url) }} style={styles.courseThumb} />
                    ) : (
                      <View style={styles.courseThumbPlaceholder}>
                        <Text style={styles.courseImageText}>{(item.course?.name || 'C')[0]}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.itemTitle}>{item.course?.name}</Text>
                      <Text style={styles.itemSub}>
                        {formatDate(item.start_date ?? '')} · {formatDate(item.end_date ?? '')}
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
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Asistencia reciente</Text>
            <Text style={styles.itemSub}>Progreso: {portal.attendance?.percent ?? 0}%</Text>
            {portal.attendance?.recent?.length ? (
              <FlatList
                data={portal.attendance.recent}
                keyExtractor={(it, idx) => `${it.course}-${idx}`}
                scrollEnabled={false}
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
                scrollEnabled={false}
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

const makeStyles = (t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    header: { marginBottom: 12 },
    title: { fontSize: 26, fontWeight: '800', color: t.text },
    subtitle: { fontSize: 14, color: t.sub },
    card: {
      backgroundColor: t.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: t.text, marginBottom: 8 },
    input: {
      backgroundColor: t.secondary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
      color: t.text,
    },
    primaryButton: {
      backgroundColor: t.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      shadowColor: t.primary,
      shadowOpacity: 0.4,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 3,
    },
    primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    secondaryButton: {
      backgroundColor: t.secondary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    secondaryButtonText: { color: t.text, fontWeight: '700', fontSize: 15 },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemTitle: { fontSize: 15, fontWeight: '600', color: t.text },
    itemSub: { fontSize: 12, color: t.sub },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeOk: { backgroundColor: t.badgeOkBg, borderColor: t.badgeOkBorder },
    badgeAlert: { backgroundColor: t.badgeAlertBg, borderColor: t.badgeAlertBorder },
    badgeText: { fontSize: 12, fontWeight: '700', color: t.text },
    separator: { height: 10 },
    itemAmount: { fontSize: 14, fontWeight: '700', color: t.text, textAlign: 'right' },
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
      borderColor: t.border,
    },
    bannerImg: { width: '100%', height: '100%' },
    bannerLabel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 8,
      backgroundColor: t.isDark ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.55)',
    },
    bannerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    row: { flexDirection: 'row', gap: 8 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    flex1: { flex: 1 },
    hint: { marginTop: 6, fontSize: 12, color: t.sub },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: t.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    avatarText: { color: t.text, fontWeight: '800', fontSize: 18 },
    courseCard: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    courseImage: {
      width: 60,
      height: 60,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      resizeMode: 'cover',
    },
    courseImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 14,
      backgroundColor: t.secondary,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    courseImageText: { color: t.text, fontWeight: '800', fontSize: 18 },
    courseThumb: {
      width: 46,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      resizeMode: 'cover',
    },
    courseThumbPlaceholder: {
      width: 46,
      height: 46,
      borderRadius: 12,
      backgroundColor: t.secondary,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statCard: {
      flex: 1,
      backgroundColor: t.secondary,
      paddingVertical: 12,
      marginRight: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    statNumber: { color: t.text, fontWeight: '800', fontSize: 18 },
    statLabel: { color: t.sub, fontSize: 12, marginTop: 4 },
    nextClass: {
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
    },
    nextLabel: { color: '#f8fafc', fontWeight: '700', fontSize: 12 },
    nextTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
    nextSub: { color: '#e9d5ff', fontSize: 12, marginTop: 2 },
    nextStrong: { fontWeight: '800' },
  })
