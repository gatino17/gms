import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const BASE_TABS = [
  { key: 'home', label: 'Inicio', icon: 'home-outline', tKey: 'home' },
  { key: 'courses', label: 'Cursos', icon: 'book-outline', tKey: 'courses' },
  { key: 'payments', label: 'Pagos', icon: 'wallet-outline', tKey: 'payments' },
  { key: 'profile', label: 'Perfil', icon: 'person-circle-outline', tKey: 'profile' },
]

export default function NavBar({ activeTab, onChange, styles, theme, t }) {
  return (
    <View style={styles.navBar}>
      {BASE_TABS.map((tab) => {
        const active = activeTab === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.navItem}
            onPress={() => onChange(tab.key)}
          >
            <View style={[styles.navIconWrap, active && styles.navIconActive]}>
              <Ionicons
                name={tab.icon}
                size={20}
                color={active ? '#ec4899' : theme.text}
              />
            </View>
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{t ? t(tab.tKey) : tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
