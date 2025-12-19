import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  TextInput,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'

const INSTAGRAM_URL = 'https://www.instagram.com/puertomonttsalsa_oficial/'
const TIKTOK_URL = 'https://www.tiktok.com/@puertomonttsalsa'
const FACEBOOK_URL = 'https://www.facebook.com/puertomonttsalsa'

const jsDayFromCourse = (dow) => {
  if (dow === undefined || dow === null) return null
  const num = Number(dow)
  if (Number.isNaN(num)) return null
  // app usa 0=Lun...6=Dom, JS usa 0=Dom
  return (num + 1) % 7
}

const getNextClassDateTime = (enrollment) => {
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
  if (next <= now) {
    next.setDate(next.getDate() + 7)
  }
  return next
}

const formatCountdown = (date) => {
  const now = new Date()
  const diff = date - now
  if (diff <= 0) return 'en breve'
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours === 0) return `${remMins} min`
  return `${hours}h ${remMins}m`
}

const computeStreak = (recent = []) => {
  if (!recent.length) return 0
  const dates = [...new Set(recent.map((r) => r.attended_at?.slice(0, 10)).filter(Boolean))].sort().reverse()
  if (!dates.length) return 0
  let streak = 1
  let prev = new Date(dates[0])
  for (let i = 1; i < dates.length; i++) {
    const cur = new Date(dates[i])
    const diffDays = Math.round((prev - cur) / 86400000)
    if (diffDays === 1) {
      streak += 1
      prev = cur
    } else {
      break
    }
  }
  return streak
}

export default function HomeTab({
  portal,
  styles,
  theme,
  activeCount,
  completedCount,
  totalHours,
  nextClassName,
  nextClassDate,
  nextClassTime,
  nextClassImg,
  loadingPortal,
  makeAbsolute,
  formatSchedule,
  formatDate,
  initials,
  isOffline,
  lastSync,
  t,
  announcements,
}) {
  const [notes, setNotes] = useState({})
  const [drafts, setDrafts] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [openBanner, setOpenBanner] = useState(null) // guarda { img, title, subtitle }
  const showAnnouncements = (announcements || []).slice(0, 4)
  const tenantLogo = makeAbsolute?.(portal?.tenant?.logo_url)
  const tenantName = portal?.tenant?.name || 'Mi estudio'

  useEffect(() => {
    const loadNotes = async () => {
      try {
        if (!portal.enrollments?.length) return
        const entries = await Promise.all(
          portal.enrollments.map(async (e) => {
            const val = await AsyncStorage.getItem(`course_note_${e.id}`)
            return [e.id, val || '']
          })
        )
        setNotes(Object.fromEntries(entries))
        setDrafts(Object.fromEntries(entries))
      } catch (e) {
        console.log('[notes] load error', e)
      }
    }
    loadNotes()
  }, [portal.enrollments])

  const saveNote = async (courseId) => {
    try {
      const txt = drafts[courseId] || ''
      await AsyncStorage.setItem(`course_note_${courseId}`, txt)
      setNotes((prev) => ({ ...prev, [courseId]: txt }))
      setEditingId(null)
    } catch (e) {
      console.log('[notes] save error', e)
    }
  }

  const openResource = (course) => {
    const url = course?.playlist_url || course?.resource_url || INSTAGRAM_URL
    Linking.openURL(url).catch((err) => console.log('open url error', err))
  }

  const nextClassDateTime = getNextClassDateTime(portal.enrollments?.[0])
  const countdown = nextClassDateTime ? formatCountdown(nextClassDateTime) : null
  const streak = computeStreak(portal.attendance?.recent || [])
  const attendancePercent = portal.attendance?.percent ?? 0
  const streakRecord = Math.max(streak, portal.attendance?.record ?? streak)
  const progress30 = Math.min(100, Math.round((streak / 30) * 100))
  const monthClasses = portal.attendance?.recent?.length ?? 0
  const totalClasses = portal.attendance?.total ?? monthClasses
  const nextClassLabel = nextClassDate ? `${nextClassDate}${nextClassTime ? ` · ${nextClassTime}` : ''}` : null

  return (
    <>
      <View style={{ position: 'relative', marginBottom: 12, paddingTop: 12 }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 14,
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.22,
            shadowOffset: { width: 0, height: 5 },
            shadowRadius: 10,
            elevation: 10,
            zIndex: 2,
          }}
        >
          {tenantLogo ? (
            <Image source={{ uri: tenantLogo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : (
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 20 }}>
              {(tenantName?.[0] || 'E').toUpperCase()}
            </Text>
          )}
        </View>

        <LinearGradient
          colors={['#fb7185', '#ef4444']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 14 }}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: 'transparent',
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingLeft: 92,
                paddingVertical: 10,
                paddingRight: 14,
                borderColor: 'transparent',
                shadowColor: 'transparent',
              },
            ]}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.itemTitle, { color: '#fff', fontSize: 18, textAlign: 'right' }]}>{portal.student?.first_name} {portal.student?.last_name}</Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderColor: 'rgba(255,255,255,0.35)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    alignSelf: 'flex-end',
                  },
                ]}
              >
                <Ionicons
                  name={portal.classes_active > 0 ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={portal.classes_active > 0 ? '#bbf7d0' : '#fecdd3'}
                />
                <Text style={[styles.badgeText, { color: '#fff' }]}>{portal.classes_active > 0 ? 'Activo' : 'Inactivo'}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      <LinearGradient
        colors={['#f472b6', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: 14, padding: 12, marginBottom: 12 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          {[
            { icon: 'play-circle-outline', value: activeCount, label: 'Cursos activos' },
            { icon: 'checkmark-done-outline', value: completedCount, label: 'Completados' },
            { icon: 'time-outline', value: `${totalHours}h`, label: 'Horas de baile' },
          ].map((item, idx) => (
            <View
              key={idx}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 8,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={item.icon} size={18} color="#fff" />
              </View>
              <Text style={[styles.statNumber, { color: '#fff', fontSize: 18 }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: '#f1f5f9', textAlign: 'center' }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {isOffline ? (
        <View style={styles.offlineRow}>
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline-outline" size={16} color="#b45309" />
            <Text style={styles.offlineText}>{t('offline')}</Text>
          </View>
          {lastSync ? <Text style={styles.itemSub}>{t('last_sync')}: {formatDate(lastSync)}</Text> : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Novedades</Text>
        {showAnnouncements.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {showAnnouncements.map((b) => {
              const img = makeAbsolute?.(b.image_url)
              return (
                <TouchableOpacity
                  key={b.id}
                  style={styles.banner}
                  activeOpacity={0.9}
                  onPress={() => img && setOpenBanner({ img, title: b.title, subtitle: b.subtitle })}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={styles.bannerImg} />
                  ) : (
                    <View style={[styles.bannerImg, { backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: '800' }}>{b.title?.[0] || 'N'}</Text>
                    </View>
                  )}
                  <View style={styles.bannerLabel}>
                    <Text style={styles.bannerText}>{b.title}</Text>
                    {b.subtitle ? <Text style={[styles.bannerText, { fontSize: 12 }]}>{b.subtitle}</Text> : null}
                  </View>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        ) : (
          <Text style={styles.itemSub}>Sin novedades</Text>
        )}
      </View>

      <View style={styles.streakCard}>
        <View style={styles.rowBetween}>
          <View style={styles.streakBadge}>
            <Ionicons name="flame-outline" size={18} color="#ea580c" />
            <Text style={styles.streakBadgeText}>Racha actual</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.itemSub}>Record</Text>
            <Text style={[styles.itemTitle, { color: '#ef4444' }]}>{streakRecord} dias</Text>
          </View>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.streakNumber}>{streak} dias</Text>
          <Text style={styles.itemSub}>{attendancePercent}% asistencia</Text>
        </View>
        <View style={styles.streakProgressTrack}>
          <View style={[styles.streakProgressBar, { width: `${progress30}%` }]} />
        </View>
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={styles.itemSub}>Este mes</Text>
            <Text style={styles.streakStat}>{monthClasses} clases</Text>
          </View>
          <View style={{ width: 1, height: 32, backgroundColor: '#e5e7eb' }} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.itemSub}>Total</Text>
            <Text style={styles.streakStat}>{totalClasses} clases</Text>
          </View>
        </View>
        {nextClassLabel ? (
          <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: '#ecfdf3', borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="calendar-outline" size={16} color="#047857" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemSub, { color: '#065f46', fontWeight: '700' }]}>Próxima clase de la semana</Text>
              <Text style={[styles.itemSub, { color: '#065f46' }]}>{nextClassLabel}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.tipCard}>
        <View style={styles.tipHeader}>
          <Ionicons name="bulb-outline" size={18} color="#f43f5e" />
          <Text style={styles.tipTitle}>Tip del dia</Text>
        </View>
        <Text style={styles.tipText}>
          "La conexion con tu pareja comienza con la escucha. El baile es una conversacion sin palabras."
        </Text>
        <Text style={styles.tipAuthor}>Equipo GMS</Text>
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
              <Text style={styles.itemSub}>Próximo a vencer: {formatDate(portal.enrollments[0]?.end_date || '')}</Text>
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
            renderItem={({ item }) => {
              const progress = Math.max(
                0,
                Math.min(100, Number(item.progress_percent ?? item.attendance_percent ?? portal.attendance?.percent ?? 0)),
              )
              return (
                <View style={styles.courseFullCard}>
                  <View style={styles.courseHero}>
                    {makeAbsolute(item.course?.image_url) ? (
                      <Image source={{ uri: makeAbsolute(item.course?.image_url) }} style={styles.courseHeroImg} />
                    ) : (
                      <View style={[styles.courseHeroImg, styles.courseHeroPlaceholder]}>
                        <Text style={styles.courseImageText}>{(item.course?.name || 'C')[0]}</Text>
                      </View>
                    )}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
                      style={styles.courseHeroOverlay}
                    />
                    <View style={styles.courseHeroTop}>
                      <Text style={styles.courseTitle}>{item.course?.name}</Text>
                      <View style={[styles.badge, item.is_active ? styles.badgeOk : styles.badgeAlert]}>
                        <Text style={styles.badgeText}>{item.is_active ? 'Activo' : 'Inactivo'}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                    <View style={[styles.row, { alignItems: 'center', marginBottom: 6 }]}>
                      <Ionicons name="person-outline" size={14} color={theme.sub} />
                    <Text style={[styles.itemSub, { marginLeft: 6 }]}>{item.course?.teacher_name ? `${item.course.teacher_name} (Instructor)` : 'Instructor'}</Text>
                    </View>
                    <View style={[styles.row, { alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }]}>
                    {item.course?.level ? (
                      <View style={styles.levelPill}>
                        <Text style={styles.levelText}>{item.course.level}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.row, { alignItems: 'center', marginLeft: item.course?.level ? 8 : 0, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 10 }]}>
                      <Ionicons name="time-outline" size={14} color="#059669" />
                      <Text style={[styles.itemSub, { marginLeft: 6, color: '#065f46', fontWeight: '700' }]}>{formatSchedule(item.course)}</Text>
                    </View>
                    </View>
                    <View style={[styles.rowBetween, { alignItems: 'center', marginBottom: 6 }]}>
                      <Text style={styles.itemSub}>Progreso del curso</Text>
                      <Text style={styles.itemSub}>{progress ? `${progress}%` : '--%'}</Text>
                    </View>
                    <View style={styles.courseProgressTrack}>
                      <View style={[styles.courseProgressBar, { width: `${progress || 0}%` }]} />
                    </View>
                    {false && editingId === item.id ? null : null}
                  </View>
                </View>
              )
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <Text style={styles.itemSub}>Sin inscripciones</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Redes</Text>
        <View style={[styles.row, { justifyContent: 'space-between', marginTop: 6 }]}>
          <TouchableOpacity style={[styles.socialPill, { backgroundColor: '#fdf2f8' }]} onPress={() => Linking.openURL(INSTAGRAM_URL)}>
            <Ionicons name="logo-instagram" size={18} color="#ec4899" />
            <Text style={styles.socialPillText}>Instagram</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.socialPill, { backgroundColor: '#f0f9ff' }]} onPress={() => Linking.openURL(TIKTOK_URL)}>
            <Ionicons name="logo-tiktok" size={18} color="#0ea5e9" />
            <Text style={styles.socialPillText}>TikTok</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.socialPill, { backgroundColor: '#eff6ff' }]} onPress={() => Linking.openURL(FACEBOOK_URL)}>
            <Ionicons name="logo-facebook" size={18} color="#2563eb" />
            <Text style={styles.socialPillText}>Facebook</Text>
          </TouchableOpacity>
        </View>
      </View>

      {openBanner ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setOpenBanner(null)}
        >
          <TouchableWithoutFeedback onPress={() => setOpenBanner(null)}>
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.8)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 16,
              }}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <View
                  style={{
                    width: '88%',
                    maxWidth: 520,
                    maxHeight: '85%',
                    borderRadius: 20,
                    overflow: 'hidden',
                    backgroundColor: 'transparent',
                    padding: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 0,
                  }}
                >
                    <View style={{ width: '93%', height: '90%', position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                      <Image
                        source={{ uri: openBanner.img }}
                        style={{
                          width: '100%',
                          height: '100%',
                        resizeMode: 'contain',
                        backgroundColor: 'transparent',
                        borderRadius: 20,
                        borderWidth: 2,
                        borderColor: 'rgba(143, 35, 35, 0.65)',
                      }}
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.65)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 20,
                      }}
                    />
                    <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, gap: 6 }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{openBanner.title}</Text>
                      {openBanner.subtitle ? (
                        <Text style={{ color: '#e2e8f0', fontSize: 13 }}>{openBanner.subtitle}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}
    </>
  )
}
