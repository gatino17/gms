import React, { useEffect, useState } from 'react'
import { FlatList, Image, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'

const INSTAGRAM_URL = 'https://www.instagram.com/puertomonttsalsa_oficial/'

export default function CoursesTab({ portal, styles, theme, formatSchedule, formatDate, makeAbsolute, t }) {
  const [notes, setNotes] = useState({})
  const [drafts, setDrafts] = useState({})
  const [editingId, setEditingId] = useState(null)

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
        console.log('[notes] load courses error', e)
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
      console.log('[notes] save courses error', e)
    }
  }

  const openResource = (course) => {
    const url = course?.playlist_url || course?.resource_url || INSTAGRAM_URL
    Linking.openURL(url).catch((err) => console.log('open url error', err))
  }

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
                  <View style={[styles.rowBetween, { marginTop: 8 }]}>
                    <TouchableOpacity
                      style={styles.resourceBtn}
                      onPress={() => openResource(item.course)}
                    >
                      <Ionicons name="musical-notes-outline" size={14} color="#8b5cf6" />
                      <Text style={styles.resourceBtnText}>Recursos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.resourceBtn, styles.noteBtn]}
                      onPress={() => setEditingId(editingId === item.id ? null : item.id)}
                    >
                      <Ionicons name="create-outline" size={14} color="#0f172a" />
                      <Text style={styles.resourceBtnText}>Notas</Text>
                    </TouchableOpacity>
                  </View>
                  {editingId === item.id ? (
                    <View style={{ marginTop: 8 }}>
                      <TextInput
                        style={styles.noteInput}
                        placeholder="Escribe tu nota..."
                        placeholderTextColor={theme.sub}
                        value={drafts[item.id] || ''}
                        onChangeText={(txt) => setDrafts((prev) => ({ ...prev, [item.id]: txt }))}
                        multiline
                      />
                      <TouchableOpacity style={styles.saveNoteBtn} onPress={() => saveNote(item.id)}>
                        <Text style={styles.saveNoteText}>Guardar nota</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {notes[item.id] ? (
                    <Text style={[styles.itemSub, { marginTop: 6 }]}>Nota: {notes[item.id]}</Text>
                  ) : null}
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
