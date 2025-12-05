import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const TABS = [
  { key: 'home', label: 'Inicio', icon: 'home-outline' },
  { key: 'courses', label: 'Cursos', icon: 'book-outline' },
  { key: 'payments', label: 'Pagos', icon: 'wallet-outline' },
  { key: 'profile', label: 'Perfil', icon: 'person-circle-outline' },
]

export default function NavBar({ activeTab, onChange, styles, theme }) {
  return (
    <View style={styles.navBar}>
      {TABS.map((tab) => {
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
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
