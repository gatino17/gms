import React from 'react'
import { FlatList, Image, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

export default function CoursesTab({ portal, styles, theme, formatSchedule, formatDate, makeAbsolute, t }) {
  const data = portal.enrollments || []
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{t ? t('courses_title') : 'Cursos'}</Text>
        <View style={[styles.badge, data.length ? styles.badgeOk : styles.badgeAlert]}>
          <Text style={styles.badgeText}>{data.length || 0}</Text>
        </View>
      </View>
      {data.length ? (
        <FlatList
          data={data}
          keyExtractor={(it) => String(it.id)}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const progress = Math.max(
              0,
              Math.min(100, Number(item.progress_percent ?? item.attendance_percent ?? portal.attendance?.percent ?? 0)),
            )
            return (
              <View style={[styles.courseFullCard, { marginBottom: 10 }]}>
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
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.itemSub}>
                      Inicio: {formatDate(item.start_date || '')}  ·  Fin: {formatDate(item.end_date || '')}
                    </Text>
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
        <Text style={styles.itemSub}>Sin cursos</Text>
      )}
    </View>
  )
}
