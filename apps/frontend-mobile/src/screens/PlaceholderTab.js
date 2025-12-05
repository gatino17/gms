import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function PlaceholderTab({ title, description, styles }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
        <Ionicons name="construct-outline" size={28} color="#9ca3af" />
        <Text style={styles.itemTitle}>{description}</Text>
        <Text style={styles.itemSub}>Estamos trabajando en esta seccion.</Text>
      </View>
    </View>
  )
}
