export type RegionPreset = {
  country: string
  prefix: string
  currency: string
  label: string
}

export const REGION_PRESETS: RegionPreset[] = [
  { country: 'Chile', prefix: '+56', currency: 'CLP', label: 'Chile' },
  { country: 'Argentina', prefix: '+54', currency: 'ARS', label: 'Argentina' },
  { country: 'Peru', prefix: '+51', currency: 'PEN', label: 'Peru' },
  { country: 'Colombia', prefix: '+57', currency: 'COP', label: 'Colombia' },
  { country: 'Mexico', prefix: '+52', currency: 'MXN', label: 'Mexico' },
  { country: 'Estados Unidos', prefix: '+1', currency: 'USD', label: 'Estados Unidos' },
  { country: 'Espana', prefix: '+34', currency: 'EUR', label: 'Espana' },
]

export function sanitizePhoneInput(value: string) {
  return value.replace(/[^0-9+\s()-]/g, '')
}

export function sanitizePhonePrefix(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? `+${digits}` : '+56'
}

export function findRegionPreset(country?: string | null, currency?: string | null, prefix?: string | null) {
  const normalizedCountry = String(country || '').trim().toLowerCase()
  const normalizedCurrency = String(currency || '').trim().toUpperCase()
  const normalizedPrefix = sanitizePhonePrefix(prefix)

  return (
    REGION_PRESETS.find((item) => item.country.toLowerCase() === normalizedCountry) ||
    REGION_PRESETS.find((item) => item.prefix === normalizedPrefix) ||
    REGION_PRESETS.find((item) => item.currency === normalizedCurrency) ||
    REGION_PRESETS[0]
  )
}

export function phonePlaceholder(prefix?: string | null) {
  return `${sanitizePhonePrefix(prefix)} 9 1234 5678`
}

export function stripPhonePrefix(value: string, prefix?: string | null) {
  const cleaned = sanitizePhoneInput(value).trim()
  if (!cleaned) return ''

  const digits = cleaned.replace(/\D/g, '')
  const prefixDigits = sanitizePhonePrefix(prefix).replace(/\D/g, '')

  if (digits.startsWith(prefixDigits)) {
    const localDigits = digits.slice(prefixDigits.length)
    return localDigits.startsWith('0') ? localDigits.slice(1) : localDigits
  }

  return cleaned.startsWith('+') ? cleaned : cleaned.replace(/^\+/, '')
}

export function composePhoneWithPrefix(value: string, prefix?: string | null) {
  const cleaned = sanitizePhoneInput(value).trim()
  if (!cleaned) return ''

  if (cleaned.startsWith('+')) {
    return cleaned
  }

  let digits = cleaned.replace(/\D/g, '')
  const normalizedPrefix = sanitizePhonePrefix(prefix)
  const prefixDigits = normalizedPrefix.replace(/\D/g, '')

  if (digits.startsWith(prefixDigits)) {
    return `+${digits}`
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  return `${normalizedPrefix}${digits}`
}
