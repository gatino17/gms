import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

export default function ProfileTab({ portal, styles, theme, formatDate, initials }) {
  const student = portal.student || {}
  const joined = student.joined_at ? formatDate(student.joined_at) : '--'
  const birth = student.birthdate ? formatDate(student.birthdate) : '--'
  const emergency = student.emergency_contact || student.emergency_phone || ''

  return (
    <>
      <LinearGradient
        colors={['#f472b6', '#c084fc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileHero}
      >
        <View style={styles.heroAvatar}>
          <Text style={styles.heroAvatarText}>{initials(student.first_name, student.last_name)}</Text>
        </View>
        <Text style={styles.heroName}>{student.first_name} {student.last_name}</Text>
        <View style={[styles.badge, portal.classes_active > 0 ? styles.badgeOk : styles.badgeAlert]}>
          <Text style={[styles.badgeText, { color: portal.classes_active > 0 ? '#166534' : '#b91c1c' }]}>
            {portal.classes_active > 0 ? 'Activo' : 'Inactivo'}
          </Text>
        </View>
        <Text style={styles.heroSince}>Estudiante desde {joined}</Text>
      </LinearGradient>

      <View style={styles.profileCard}>
        <Text style={styles.cardTitle}>Informacion personal</Text>
        <InfoRow
          icon="mail-outline"
          label="Correo electronico"
          value={student.email || 'Sin correo'}
          styles={styles}
        />
        <InfoRow
          icon="call-outline"
          label="Telefono"
          value={student.phone || 'Sin telefono'}
          styles={styles}
        />
        <InfoRow
          icon="calendar-outline"
          label="Fecha de nacimiento"
          value={birth}
          styles={styles}
        />
        <InfoRow
          icon="calendar-number-outline"
          label="Fecha de inscripcion"
          value={joined}
          styles={styles}
        />
        {student.gender ? (
          <InfoRow
            icon="body-outline"
            label="Genero"
            value={student.gender}
            styles={styles}
          />
        ) : null}
        {emergency ? (
          <InfoRow
            icon="alert-circle-outline"
            label="Contacto de emergencia"
            value={emergency}
            styles={styles}
          />
        ) : null}
      </View>

      <View style={styles.profileCard}>
        <Text style={styles.cardTitle}>Cuenta</Text>
        <TouchableOpacity style={styles.accountRow} activeOpacity={0.8}>
          <Ionicons name="mail-outline" size={18} color={theme.sub} />
          <Text style={styles.accountText}>Cambiar correo electronico</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.accountRow} activeOpacity={0.8}>
          <Ionicons name="call-outline" size={18} color={theme.sub} />
          <Text style={styles.accountText}>Actualizar telefono</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.9}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

function InfoRow({ icon, label, value, styles }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={18} color="#ec4899" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  )
}
