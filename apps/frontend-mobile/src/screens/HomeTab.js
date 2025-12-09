import React from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

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
  banners,
  isOffline,
  lastSync,
  t,
  feedback,
  setFeedback,
}) {
  const nextClassDateTime = getNextClassDateTime(portal.enrollments?.[0])
  const countdown = nextClassDateTime ? formatCountdown(nextClassDateTime) : null
  const streak = computeStreak(portal.attendance?.recent || [])
  const attendancePercent = portal.attendance?.percent ?? 0

  return (
    <>
      <View style={[styles.card, styles.rowBetween, { alignItems: 'center' }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {initials(portal.student?.first_name, portal.student?.last_name)}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.itemTitle}>{portal.student?.first_name} {portal.student?.last_name}</Text>
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
        <Text style={styles.cardTitle}>Proxima clase</Text>
        <LinearGradient
          colors={['#ec4899', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nextClass}
        >
          <View style={[styles.row, { alignItems: 'center' }]}>
            <Ionicons name="sparkles-outline" size={16} color="#fff" />
            <Text style={[styles.nextLabel, { marginLeft: 6 }]}>Proxima clase</Text>
          </View>
          <Text style={styles.nextTitle}>{nextClassName}</Text>
          <Text style={styles.nextSub}>
            Inicio: <Text style={styles.nextStrong}>{nextClassDate}{nextClassTime ? ` a las ${nextClassTime}` : ''}</Text>
          </Text>
        </LinearGradient>
        {countdown ? (
          <View style={styles.countdownRow}>
            <View style={styles.countdownBadge}>
              <Ionicons name="time-outline" size={16} color="#f59e0b" />
              <Text style={styles.countdownText}>Comienza en {countdown}</Text>
            </View>
            <View style={styles.confirmBtn}>
              <Text style={styles.confirmBtnText}>Confirmar asistencia</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Racha de asistencia</Text>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.itemTitle}>{streak} dias seguidos</Text>
            <Text style={styles.itemSub}>Asistencia acumulada: {attendancePercent}%</Text>
          </View>
          <View style={[styles.badge, streak > 0 ? styles.badgeOk : styles.badgeAlert]}>
            <Text style={styles.badgeText}>{streak > 0 ? 'En racha' : 'Sin racha'}</Text>
          </View>
        </View>
        <View style={styles.courseProgressTrack}>
          <View style={[styles.courseProgressBar, { width: `${Math.min(100, attendancePercent)}%` }]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('quick_feedback')}</Text>
        <View style={styles.rowBetween}>
          {['👍', '😐', '👎'].map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[styles.feedbackBtn, feedback === emoji && styles.feedbackBtnActive]}
              onPress={() => setFeedback(emoji)}
            >
              <Text style={styles.feedbackEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {feedback ? <Text style={[styles.itemSub, { marginTop: 8 }]}>Guardado: {feedback}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Novedades</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          {banners.map((b) => (
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
                      <Text style={[styles.itemSub, { marginLeft: 6 }]}>{item.course?.teacher_name || 'Profesor'}</Text>
                    </View>
                    <View style={[styles.row, { alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }]}>
                      {item.course?.level ? (
                        <View style={styles.levelPill}>
                          <Text style={styles.levelText}>{item.course.level}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.row, { alignItems: 'center', marginLeft: item.course?.level ? 8 : 0 }]}>
                        <Ionicons name="time-outline" size={14} color={theme.sub} />
                        <Text style={[styles.itemSub, { marginLeft: 4 }]}>{formatSchedule(item.course)}</Text>
                      </View>
                    </View>
                    <View style={[styles.rowBetween, { alignItems: 'center', marginBottom: 6 }]}>
                      <Text style={styles.itemSub}>Progreso del curso</Text>
                      <Text style={styles.itemSub}>{progress ? `${progress}%` : '--%'}</Text>
                    </View>
                    <View style={styles.courseProgressTrack}>
                      <View style={[styles.courseProgressBar, { width: `${progress || 0}%` }]} />
                    </View>
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
    </>
  )
}
