import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const methodLabel = (method) => {
  if (!method) return 'Pago'
  const m = String(method).toLowerCase()
  if (m.includes('cash') || m.includes('efect')) return 'Efectivo'
  if (m.includes('card') || m.includes('tarjeta')) return 'Tarjeta'
  if (m.includes('transfer')) return 'Transferencia'
  if (m.includes('monthly') || m.includes('mensu')) return 'Mensualidad'
  return method
}

export default function PaymentsTab({ portal, styles, formatDate, t }) {
  const payments = portal.payments?.recent || []
  const pending = portal.payments?.pending || []
  const pendingTotal = pending.reduce((s, p) => s + Number(p.amount || 0), 0)
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const defaultPeriodFrom = portal.enrollments?.[0]?.start_date || null
  const defaultPeriodTo = portal.enrollments?.[0]?.end_date || null

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t ? t('pay_title') : 'Mis Pagos'}</Text>

      <View style={styles.rowBetween}>
        <SummaryPill
          label="Pendiente"
          amount={pendingTotal}
          icon="alert-circle-outline"
          styles={styles}
          variant="pending"
        />
        <SummaryPill
          label="Pagado"
          amount={paidTotal}
          icon="trending-up-outline"
          styles={styles}
          variant="paid"
        />
      </View>

      <Text style={styles.sectionLabel}>Pendientes</Text>
      {pending.length ? (
        pending.map((p, idx) => (
          <PaymentCard
            key={idx}
            title={p.label || 'Pendiente'}
            amount={p.amount}
            date={p.due_date || p.payment_date}
            status="Pendiente"
            statusVariant="pending"
            period={p.period || null}
            periodFrom={p.period_from || defaultPeriodFrom}
            periodTo={p.period_to || defaultPeriodTo}
            styles={styles}
            formatDate={formatDate}
          />
        ))
      ) : (
        <Text style={styles.itemSub}>Sin pendientes</Text>
      )}

      <Text style={styles.sectionLabel}>Historial de pagos</Text>
      {payments.length ? (
        <FlatList
          data={payments}
          keyExtractor={(it) => String(it.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <PaymentCard
              title={item.label || item.type || 'Pago'}
              amount={item.amount}
              date={item.payment_date}
              status="Pagado"
              statusVariant="paid"
              method={item.method}
              reference={item.reference}
              period={item.period || item.type || null}
              periodFrom={item.period_from || defaultPeriodFrom}
              periodTo={item.period_to || defaultPeriodTo}
              styles={styles}
              formatDate={formatDate}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <Text style={styles.itemSub}>Sin pagos registrados</Text>
      )}
    </View>
  )
}

function SummaryPill({ label, amount, icon, styles, variant }) {
  const isPending = variant === 'pending'
  const pillStyle = isPending ? styles.payPillPending : styles.payPillPaid
  const iconColor = isPending ? '#f59e0b' : '#16a34a'
  return (
    <View style={[styles.payPill, pillStyle]}>
      <View style={styles.row}>
        <Ionicons name={icon} size={16} color={iconColor} />
        <Text style={[styles.itemTitle, { color: '#0f172a' }]}>{label}</Text>
      </View>
      <Text style={styles.payAmount}>${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</Text>
    </View>
  )
}

const periodLabel = (period, periodFrom, periodTo, formatDate) => {
  if (period) return period
  if (periodFrom || periodTo) {
    const fromTxt = periodFrom ? formatDate(periodFrom) : ''
    const toTxt = periodTo ? formatDate(periodTo) : ''
    if (fromTxt && toTxt) return `Inicio: ${fromTxt} · Fin: ${toTxt}`
    if (fromTxt) return `Desde: ${fromTxt}`
    if (toTxt) return `Hasta: ${toTxt}`
  }
  return null
}

function PaymentCard({ title, amount, date, status, statusVariant, method, reference, period, periodFrom, periodTo, styles, formatDate }) {
  const isPending = statusVariant === 'pending'
  const periodText = periodLabel(period, periodFrom, periodTo, formatDate)
  return (
    <View style={styles.payCard}>
      <View style={[styles.rowBetween, { alignItems: 'center' }]}>
        <View style={[styles.payIcon, isPending ? styles.payIconPending : styles.payIconPaid]}>
          <Ionicons name="card-outline" size={18} color={isPending ? '#f59e0b' : '#16a34a'} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.itemTitle}>{title}</Text>
          {date ? (
            <View style={[styles.row, { alignItems: 'center', marginTop: 4 }]}>
              <Ionicons name="calendar-outline" size={14} color={styles.itemSub.color} />
              <Text style={[styles.itemSub, { marginLeft: 4 }]}>{formatDate(date || '')}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.itemTitle, { color: isPending ? '#f59e0b' : '#16a34a' }]}>${amount}</Text>
          <View style={[styles.payStatus, isPending ? styles.payStatusPending : styles.payStatusPaid]}>
            <View style={[styles.payStatusDot, isPending ? styles.payStatusDotPending : styles.payStatusDotPaid]} />
            <Text style={styles.payStatusText}>{status}</Text>
          </View>
        </View>
      </View>
      {periodText ? (
        <Text style={[styles.itemSub, { marginTop: 6 }]}>
          Periodo: {periodText}
        </Text>
      ) : null}
      {method || reference ? (
        <Text style={[styles.itemSub, { marginTop: 4 }]}>
          Pagado con: {methodLabel(method)}{reference ? ` · Ref: ${reference}` : ''}
        </Text>
      ) : null}
    </View>
  )
}
