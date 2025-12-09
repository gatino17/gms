import { useEffect, useMemo, useState } from 'react'
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
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { LinearGradient } from 'expo-linear-gradient'

import HomeTab from './src/screens/HomeTab'
import ProfileTab from './src/screens/ProfileTab'
import PlaceholderTab from './src/screens/PlaceholderTab'
import CoursesTab from './src/screens/CoursesTab'
import PaymentsTab from './src/screens/PaymentsTab'
import NavBar from './src/components/NavBar'

const hostFromExpo = Constants.expoConfig?.hostUri?.split(':')?.[0]
const fallbackBase = hostFromExpo ? `http://${hostFromExpo}:8002` : 'http://127.0.0.1:8002'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || fallbackBase

const STRINGS = {
  es: {
    home: 'Inicio',
    courses: 'Cursos',
    payments: 'Pagos',
    profile: 'Perfil',
    home_title: 'Mi Estudio',
    login_title: 'Iniciar sesión',
    send_code: 'Enviar código',
    enter: 'Entrar',
    code_received: 'Código recibido',
    next_class: 'Próxima clase',
    news: 'Novedades',
    current_course: 'Curso actual',
    active_classes: 'Clases activas',
    attendance_recent: 'Asistencia reciente',
    payments_recent: 'Pagos recientes',
    confirm_attendance: 'Confirmar asistencia',
    starts_in: 'Comienza en',
    attendance_streak: 'Racha de asistencia',
    streak_on: 'En racha',
    streak_off: 'Sin racha',
    quick_feedback: 'Tu feedback',
    offline: 'Modo sin conexión',
    last_sync: 'Última sincronización',
    pay_title: 'Mis Pagos',
    courses_title: 'Mis Cursos',
  },
  en: {
    home: 'Home',
    courses: 'Courses',
    payments: 'Payments',
    profile: 'Profile',
    home_title: 'My Studio',
    login_title: 'Sign in',
    send_code: 'Send code',
    enter: 'Enter',
    code_received: 'Code received',
    next_class: 'Next class',
    news: 'News',
    current_course: 'Current course',
    active_classes: 'Active classes',
    attendance_recent: 'Recent attendance',
    payments_recent: 'Recent payments',
    confirm_attendance: 'Confirm attendance',
    starts_in: 'Starts in',
    attendance_streak: 'Attendance streak',
    streak_on: 'On streak',
    streak_off: 'No streak',
    quick_feedback: 'Your feedback',
    offline: 'Offline mode',
    last_sync: 'Last sync',
    pay_title: 'My Payments',
    courses_title: 'My Courses',
  },
}

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

async function fetchAnnouncementsApi(tenantId) {
  const res = await fetch(`${BASE_URL}/api/pms/announcements`, {
    headers: {
      'X-Tenant-ID': String(tenantId ?? ''),
    },
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Error anuncios (${res.status})`)
  }
  return res.json()
}

async function requestNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') {
    const ask = await Notifications.requestPermissionsAsync()
    return ask.status === 'granted'
  }
  return true
}

async function scheduleNextClassNotification(dateTime, courseName) {
  if (!dateTime) return
  try {
    const granted = await requestNotificationPermission()
    if (!granted) return
    await Notifications.cancelAllScheduledNotificationsAsync()
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Próxima clase',
        body: `${courseName || 'Tu clase'} comienza pronto`,
      },
      trigger: { date: dateTime },
    })
  } catch (e) {
    console.log('[notifications] error', e)
  }
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
    0: 'Lun',
    1: 'Mar',
    2: 'Mie',
    3: 'Jue',
    4: 'Vie',
    5: 'Sab',
    6: 'Dom',
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

const jsDayFromCourse = (dow) => {
  if (dow === undefined || dow === null) return null
  const num = Number(dow)
  if (Number.isNaN(num)) return null
  return (num + 1) % 7 // app usa 0=Lun...6=Dom, JS 0=Dom
}

const nextClassDateTimeFromEnrollment = (enrollment) => {
  if (!enrollment?.course?.day_of_week || !enrollment.course.start_time) return null
  const target = jsDayFromCourse(enrollment.course.day_of_week)
  if (target === null) return null
  const now = new Date()
  let d = new Date(now)
  while (d.getDay() !== target) {
    d.setDate(d.getDate() + 1)
  }
  const [h, m] = String(enrollment.course.start_time).slice(0, 5).split(':').map(Number)
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0)
  if (next <= now) next.setDate(next.getDate() + 7)
  return next
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
  const [themeMode, setThemeMode] = useState('auto') // auto | light | dark
  const [lang, setLang] = useState('es')
  const [isOffline, setIsOffline] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [announcements, setAnnouncements] = useState([])
  const [announcements, setAnnouncements] = useState([])

  const colorScheme = useColorScheme()
  const theme = useMemo(() => {
    const dark = themeMode === 'auto' ? colorScheme !== 'light' : themeMode === 'dark'
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
  }, [colorScheme, themeMode])
  const styles = useMemo(() => makeStyles(theme), [theme])
  const t = (key) => STRINGS[lang]?.[key] || STRINGS.es[key] || key

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

  // Cargar cache inicial
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cached = await AsyncStorage.getItem('portal_cache')
        if (cached) {
          const { data, lastSync: cachedSync } = JSON.parse(cached)
          setPortal(data)
          setLastSync(cachedSync || null)
          setIsOffline(true)
        }
      } catch (err) {
        console.log('[cache] read error', err)
      }
    }
    loadCache()
  }, [])

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
      setIsOffline(false)
      const syncNow = new Date().toISOString()
      setLastSync(syncNow)
      await AsyncStorage.setItem('portal_cache', JSON.stringify({ data, lastSync: syncNow }))
      setRetryCount(0)
      try {
        const anns = await fetchAnnouncementsApi(data.student?.tenant_id ?? tid)
        setAnnouncements(Array.isArray(anns) ? anns : [])
      } catch (e) {
        console.log('[announcements] fetch error', e)
      }
      // programar notificación próxima clase
      if (data?.enrollments?.[0]?.course?.day_of_week && data.enrollments[0].course.start_time) {
        const next = nextClassDateTimeFromEnrollment(data.enrollments[0])
        await scheduleNextClassNotification(next, data.enrollments[0]?.course?.name)
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo cargar portal')
      console.log('[portal] error', e)
      setIsOffline(true)
      // reintento simple
      if (retryCount < 2) {
        setRetryCount((c) => c + 1)
        setTimeout(() => handleLoadPortal(tok, tid), 3000 * (retryCount + 1))
      }
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
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          lang={lang}
          setLang={setLang}
          t={t}
        />
      )
    }
    if (activeTab === 'courses') {
      return (
        <CoursesTab
          portal={portal}
          styles={styles}
          theme={theme}
          formatSchedule={formatSchedule}
          formatDate={formatDate}
          makeAbsolute={makeAbsolute}
          t={t}
        />
      )
    }
    if (activeTab === 'payments') {
      return (
        <PaymentsTab
          portal={portal}
          styles={styles}
          formatDate={formatDate}
          t={t}
        />
      )
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
        isOffline={isOffline}
        lastSync={lastSync}
        t={t}
        announcements={announcements}
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {!loggedIn ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <LinearGradient
            colors={['#0f172a', '#111827', '#1e1b4b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loginHero}
          >
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>GMS</Text>
            </View>
            <Text style={styles.title}>{t('home_title')}</Text>
            <Text style={styles.subtitle}>Portal alumno - version movil</Text>
          </LinearGradient>

          <View style={styles.loginCard}>
            <Text style={styles.cardTitle}>{t('login_title')}</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={theme.sub}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder={t('code_received')}
              placeholderTextColor={theme.sub}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            <View style={styles.row}>
              <TouchableOpacity style={[styles.secondaryButton, styles.flex1]} onPress={handleRequestCode} disabled={loading}>
                <Text style={styles.secondaryButtonText}>{loading ? '...' : t('send_code')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, styles.flex1]} onPress={handleLogin} disabled={loading || !codeSent}>
                <Text style={styles.primaryButtonText}>{loading ? '...' : t('enter')}</Text>
              </TouchableOpacity>
            </View>
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

          <NavBar activeTab={activeTab} onChange={setActiveTab} styles={styles} theme={theme} t={t} />
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
    loginHero: {
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 12,
      elevation: 6,
    },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 4,
    },
    logoText: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
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
    loginCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 5,
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
    courseThumbWrap: {
      width: 82,
      height: 82,
      borderRadius: 20,
      padding: 3,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 5,
    },
    courseThumb: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      resizeMode: 'cover',
    },
    courseThumbPlaceholder: {
      flex: 1,
      borderRadius: 16,
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
      backgroundColor: t.card,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 4,
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
    courseFullCard: {
      backgroundColor: t.card,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 5,
    },
    courseHero: {
      height: 150,
      position: 'relative',
      backgroundColor: t.secondary,
    },
    courseHeroImg: {
      width: '100%',
      height: '100%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      resizeMode: 'cover',
    },
    courseHeroPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    courseHeroOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    courseHeroTop: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    courseTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    countdownRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    countdownBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fff7ed',
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: '#fed7aa',
    },
    countdownText: { color: '#b45309', fontWeight: '700', fontSize: 12 },
    confirmBtn: {
      backgroundColor: '#10b981',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      shadowColor: '#10b981',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 6,
      elevation: 3,
    },
    confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    socialPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 6,
      elevation: 2,
    },
    socialPillText: { fontSize: 12, fontWeight: '700', color: t.text },
    courseProgressTrack: {
      marginTop: 2,
      height: 10,
      borderRadius: 999,
      backgroundColor: t.isDark ? '#1f2937' : '#e5e7eb',
      overflow: 'hidden',
    },
    courseProgressBar: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: '#8b5cf6',
    },
    navBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
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
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIconActive: { backgroundColor: '#fde2f3' },
    navLabel: { fontSize: 12, color: t.sub, marginTop: 4 },
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
    payPill: {
      flex: 1,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 6,
      elevation: 3,
      marginRight: 8,
    },
    payPillPending: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
    payPillPaid: { backgroundColor: '#ecfdf3', borderColor: '#bbf7d0' },
    payAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 6 },
    sectionLabel: { color: t.sub, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 },
    payCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 12,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 8,
      elevation: 2,
    },
    payIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payIconPending: { backgroundColor: '#fff7ed' },
    payIconPaid: { backgroundColor: '#ecfdf3' },
    payStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      marginTop: 4,
    },
    payStatusPending: { backgroundColor: '#fef3c7' },
    payStatusPaid: { backgroundColor: '#dcfce7' },
    payStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    payStatusDotPending: { backgroundColor: '#f59e0b' },
    payStatusDotPaid: { backgroundColor: '#22c55e' },
    payStatusText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
    offlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    offlineBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fef3c7',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: '#fcd34d',
    },
    offlineText: { color: '#b45309', fontWeight: '700', fontSize: 12 },
  })
