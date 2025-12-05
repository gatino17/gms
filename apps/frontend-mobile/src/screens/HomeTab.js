import React from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

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
}) {
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
          <LinearGradient
            colors={['#8b5cf6', '#ec4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emailPill}
          >
            <Ionicons name="mail-outline" size={14} color="#fff" />
            <Text style={styles.emailText}>{portal.student?.email || 'Sin correo'}</Text>
          </LinearGradient>
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
              const progress = Math.max(0, Math.min(100, Number(item.progress_percent ?? item.attendance_percent ?? 0)))
              return (
                <View style={styles.activeCard}>
                  <View style={styles.activeRow}>
                    {makeAbsolute(item.course?.image_url) ? (
                      <Image source={{ uri: makeAbsolute(item.course?.image_url) }} style={styles.courseThumb} />
                    ) : (
                      <View style={styles.courseThumbPlaceholder}>
                        <Text style={styles.courseImageText}>{(item.course?.name || 'C')[0]}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.itemTitle}>{item.course?.name}</Text>
                        <View style={[styles.badge, item.is_active ? styles.badgeOk : styles.badgeAlert]}>
                          <Text style={styles.badgeText}>{item.is_active ? 'Activo' : 'Inactivo'}</Text>
                        </View>
                      </View>
                      <View style={[styles.row, { alignItems: 'center', marginTop: 4 }]}>
                        <Ionicons name="person-outline" size={14} color={theme.sub} />
                        <Text style={[styles.itemSub, { marginLeft: 6 }]}>{item.course?.teacher_name || 'Profesor'}</Text>
                      </View>
                      <View style={[styles.row, { alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }]}>
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
                    </View>
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 10, alignItems: 'center' }]}>
                    <Text style={styles.itemSub}>Progreso</Text>
                    <Text style={styles.itemSub}>{progress ? `${progress}%` : '--%'}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${progress || 0}%` }]} />
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
            ))}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <Text style={styles.itemSub}>Sin pagos</Text>
        )}
      </View>
    </>
  )
}
