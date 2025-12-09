import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function PaymentsTab({ portal, styles, formatDate }) {
  const payments = portal.payments?.recent || []
  const total90 = portal.payments?.total_last_90 ?? 0
  const pending = portal.payments?.pending || []

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>Pagos</Text>
        <View style={[styles.badge, payments.length ? styles.badgeOk : styles.badgeAlert]}>
          <Text style={styles.badgeText}>{payments.length || 0}</Text>
        </View>
      </View>

      <View style={{ marginTop: 8, marginBottom: 6 }}>
        <Text style={styles.itemSub}>Últimos 90 días: ${total90}</Text>
      </View>

      <Text style={[styles.itemTitle, { marginBottom: 6 }]}>Historial</Text>
      {payments.length ? (
        <FlatList
          data={payments}
          keyExtractor={(it) => String(it.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={[styles.listItem, { alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>${item.amount}</Text>
                <Text style={styles.itemSub}>{formatDate(item.payment_date || '')}</Text>
                {item.reference ? <Text style={styles.itemSub}>Ref: {item.reference}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[styles.badge, styles.badgeOk]}>
                  <Text style={styles.badgeText}>{item.method || 'Pago'}</Text>
                </View>
                {item.type ? <Text style={styles.itemSub}>{item.type}</Text> : null}
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <Text style={styles.itemSub}>Sin pagos registrados</Text>
      )}

      <View style={{ marginTop: 14 }}>
        <Text style={[styles.itemTitle, { marginBottom: 6 }]}>Pendientes</Text>
        {pending.length ? (
          pending.map((p, idx) => (
            <View key={idx} style={[styles.listItem, { alignItems: 'center' }]}>
              <Text style={styles.itemTitle}>${p.amount}</Text>
              <Text style={styles.itemSub}>{p.label || 'Pendiente'}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.itemSub}>Sin pendientes</Text>
        )}
      </View>
    </View>
  )
}
