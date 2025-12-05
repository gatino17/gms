import { useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import HomeTab from './src/screens/HomeTab'
import ProfileTab from './src/screens/ProfileTab'
import PlaceholderTab from './src/screens/PlaceholderTab'
import NavBar from './src/components/NavBar'

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
    throw new Error(msg || `No se pudo enviar codigo (${res.status})`)
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
    throw new Error(msg || `Login fallo (${res.status})`)
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
  const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const day = days[d.getDay()]
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${day} ${dd}/${mm}/${yyyy}`
}

const dayName = (value) => {
  if (value === undefined || value === null) return ''
  const map = {
    0: 'Dom',
    1: 'Lun',
    2: 'Mar',
    3: 'Mie',
    4: 'Jue',
    5: 'Vie',
    6: 'Sab',
    Domingo: 'Dom',
    Lunes: 'Lun',
    Martes: 'Mar',
    Miercoles: 'Mie',
    Jueves: 'Jue',
    Viernes: 'Vie',
    Sabado: 'Sab',
  }
  if (map[value] !== undefined) return map[value]
  const num = Number(value)
  if (!Number.isNaN(num) && map[num] !== undefined) return map[num]
  return String(value)
}

const formatSchedule = (course) => {
  if (!course) return ''
  const day = dayName(course.day_of_week)
  const start = course.start_time ? String(course.start_time).slice(0, 5) : ''
  const end = course.end_time ? String(course.end_time).slice(0, 5) : ''
  if (day && start && end) return `${day} ${start} - ${end}`
  return [day, start, end].filter(Boolean).join(' ')
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
  const [activeTab, setActiveTab] = useState('home')

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
  const nextClassTime = firstEnrollment?.course?.start_time
    ? String(firstEnrollment.course.start_time).slice(0, 5)
    : ''
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
        Alert.alert('Codigo generado', `Codigo: ${resp.code}`)
      } else {
        Alert.alert('Codigo enviado', 'Revisa tu correo')
      }
      setCodeSent(true)
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo enviar codigo')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !code.trim()) {
      Alert.alert('Datos requeridos', 'Ingresa correo y codigo')
      return
    }
    try {
      setLoading(true)
      const data = await loginWithCode(email.trim(), code.trim(), tenantId)
      setToken(data.access_token)
      setUserEmail(data.student?.email || email)
      setTenantId(data.student?.tenant_id ?? null)
      await handleLoadPortal(data.access_token, data.student?.tenant_id ?? null)
      Alert.alert('OK', 'Sesion iniciada')
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo iniciar sesion')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadPortal = async (tokenOverride, tenantOverride) => {
    const tok = tokenOverride || token
    const tid = tenantOverride ?? tenantId
    if (!tok) {
      Alert.alert('Login requerido', 'Inicia sesion primero')
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

  const renderTab = () => {
    if (!portal) return null
    if (activeTab === 'profile') {
      return (
        <ProfileTab
          portal={portal}
          styles={styles}
          theme={theme}
          formatDate={formatDate}
          initials={initials}
        />
      )
    }
    if (activeTab === 'courses') {
      return <PlaceholderTab title="Cursos" description="Pronto veras tus cursos aqui." styles={styles} />
    }
    if (activeTab === 'payments') {
      return <PlaceholderTab title="Pagos" description="Seccion de pagos en construccion." styles={styles} />
    }
    return (
      <HomeTab
        portal={portal}
        styles={styles}
        theme={theme}
        activeCount={activeCount}
        completedCount={completedCount}
        totalHours={totalHours}
        nextClassName={nextClassName}
        nextClassDate={nextClassDate}
        nextClassTime={nextClassTime}
        nextClassImg={nextClassImg}
        loadingPortal={loadingPortal}
        makeAbsolute={makeAbsolute}
        formatSchedule={formatSchedule}
        formatDate={formatDate}
        initials={initials}
        banners={BANNERS}
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {!loggedIn ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={styles.header}>
            <Text style={styles.title}>Mi Estudio</Text>
            <Text style={styles.subtitle}>Portal alumno - version movil</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesion</Text>
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
                <Text style={styles.secondaryButtonText}>{loading ? '...' : 'Enviar codigo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, styles.flex1]} onPress={handleLogin} disabled={loading || !codeSent}>
                <Text style={styles.primaryButtonText}>{loading ? '...' : 'Entrar'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Codigo recibido"
              placeholderTextColor={theme.sub}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            {token ? <Text style={styles.hint}>Sesion de {userEmail}</Text> : null}
          </View>

          {loading && (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            {renderTab()}
          </ScrollView>

          <NavBar activeTab={activeTab} onChange={setActiveTab} styles={styles} theme={theme} />
        </View>
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
    emailPill: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      gap: 6,
    },
    emailText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
    nextTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 4 },
    nextSub: { color: '#e9d5ff', fontSize: 12, marginTop: 2 },
    nextStrong: { fontWeight: '800' },
    activeCard: {
      backgroundColor: t.secondary,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    activeRow: { flexDirection: 'row', alignItems: 'center' },
    levelPill: {
      backgroundColor: '#ffe8b5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    levelText: { color: '#8a5200', fontWeight: '700', fontSize: 12 },
    progressTrack: {
      marginTop: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: t.isDark ? '#1f2937' : '#e5e7eb',
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: '#ec4899',
      borderRadius: 999,
    },
    navBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 12,
      backgroundColor: t.card,
      borderTopWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 12,
    },
    navItem: { alignItems: 'center', flex: 1 },
    navIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIconActive: { backgroundColor: '#fde2f3' },
    navLabel: { fontSize: 11, color: t.sub, marginTop: 2 },
    navLabelActive: { color: '#ec4899', fontWeight: '700' },
    profileHero: {
      borderRadius: 16,
      paddingVertical: 22,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    heroAvatar: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: '#fdf2f8',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 6,
    },
    heroAvatarText: { fontSize: 22, fontWeight: '800', color: '#ec4899' },
    heroName: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 10 },
    heroSince: { color: '#f8fafc', marginTop: 6, fontSize: 13 },
    profileCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: 10,
    },
    infoIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#fee2e2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoLabel: { color: t.sub, fontSize: 12 },
    infoValue: { color: t.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.secondary,
      padding: 12,
      borderRadius: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: t.border,
    },
    accountText: { color: t.text, fontSize: 14, fontWeight: '600' },
    logoutButton: {
      marginTop: 14,
      backgroundColor: '#dc2626',
      paddingVertical: 12,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#dc2626',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    logoutText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  })
