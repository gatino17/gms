import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

const BASE_TABS = [
  { key: 'home', label: 'Inicio', icon: 'home-outline', tKey: 'home' },
  { key: 'courses', label: 'Cursos', icon: 'book-outline', tKey: 'courses' },
  { key: 'payments', label: 'Pagos', icon: 'wallet-outline', tKey: 'payments' },
  { key: 'profile', label: 'Perfil', icon: 'person-outline', tKey: 'profile' },
]

export default function NavBar({ activeTab, onChange, styles, theme, t }) {
  const [barWidth, setBarWidth] = useState(0)
  const activeIndex = BASE_TABS.findIndex((tab) => tab.key === activeTab)
  const itemW = barWidth > 0 ? barWidth / BASE_TABS.length : 0
  const cutoutW = 92
  const cutoutLeft = itemW && activeIndex >= 0 ? (itemW * activeIndex) + (itemW - cutoutW) / 2 : 0

  return (
    <View style={styles.navBar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
      {barWidth ? <View style={[styles.navCutout, { width: cutoutW, left: cutoutLeft }]} /> : null}
      <View style={styles.navItems}>
      {BASE_TABS.map((tab) => {
        const active = activeTab === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.navItem}
            onPress={() => onChange(tab.key)}
          >
            {active ? (
              <View style={styles.navActiveBubble}>
                <View style={styles.navIconWrapActive}>
                  <LinearGradient
                    colors={['#ff2d55', '#ff7a18', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.centerBadge}
                  >
                    <Ionicons name={tab.icon} size={20} color="#fff" />
                  </LinearGradient>
                </View>
              </View>
            ) : (
              <View style={styles.navIconWrapInactive}>
                <Ionicons name={tab.icon} size={20} color="#B0B0B0" />
              </View>
            )}
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{t ? t(tab.tKey) : tab.label}</Text>
          </TouchableOpacity>
        )
      })}
      </View>
    </View>
  )
}
