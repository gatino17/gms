import { FormEvent, useEffect, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
import { HiOutlinePlus, HiOutlineEye, HiOutlineEyeOff, HiOutlineCurrencyDollar, HiOutlineUserGroup, HiOutlinePencilAlt, HiOutlinePhone } from 'react-icons/hi'

type StudioForm = {
  name: string
  email: string
  password: string
  address: string
  country: string
  city: string
  phone: string
  instagram_url: string
  tiktok_url: string
  facebook_url: string
  website_url: string
  is_superuser: boolean
  currency: string
  plan_id: string
  billing_cycle: 'monthly' | 'annual'
  price_locked: string
  max_sessions: string
  plan_start_date: string
  plan_renewal_date: string
  mobile_enabled: boolean
  teacher_portal_enabled: boolean
  student_portal_enabled: boolean
  online_payments_enabled: boolean
}

type StudioUpdateForm = {
  name: string
  slug: string
  email: string
  password: string
  address: string
  country: string
  city: string
  phone: string
  logo_url: string
  instagram_url: string
  tiktok_url: string
  facebook_url: string
  website_url: string
  is_superuser: boolean
  currency: string
  plan_id: string
  billing_cycle: 'monthly' | 'annual'
  price_locked: string
  plan_start_date: string
  plan_renewal_date: string
  max_sessions: string
  mobile_enabled: boolean
  teacher_portal_enabled: boolean
  student_portal_enabled: boolean
  online_payments_enabled: boolean
}

type TenantPlan = {
  id: number
  name: string
  max_active_students: number
  monthly_price: string | number
  annual_price: string | number
  is_active: boolean
  is_custom: boolean
}
type PlanForm = {
  name: string
  max_active_students: string
  monthly_price: string
  annual_price: string
  is_active: boolean
  is_custom: boolean
}

type TwilioAdminConfig = {
  account_sid: string
  auth_token_configured: boolean
  auth_token_masked?: string | null
  api_key_sid?: string | null
  api_key_configured?: boolean
  api_key_masked?: string | null
  auth_mode?: 'api_key' | 'auth_token' | 'unknown'
  whatsapp_from: string
  template_sid?: string | null
  enabled: boolean
  source: string
}
type TwilioBalance = {
  balance_usd: number
  currency: string
  budget_usd: number
  threshold_usd: number
  remaining_usd: number
  remaining_percent: number
  level: 'ok' | 'warning' | 'critical'
  checked_at: string
}

type Studio = {
  id: number
  name: string
  slug: string
  contact_email?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  phone?: string | null
  logo_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  facebook_url?: string | null
  website_url?: string | null
  created_at: string
  admin_is_superuser?: boolean | null
  currency?: string | null
  plan_id?: number | null
  plan_name?: string | null
  max_active_students?: number | null
  billing_cycle?: string | null
  price_locked?: string | number | null
  plan_label_snapshot?: string | null
  plan_start_date?: string | null
  plan_renewal_date?: string | null
  active_sessions?: number | null
  max_sessions?: number | null
  whatsapp_consumption_usd?: number | null
  whatsapp_budget_usd?: number | null
  mobile_enabled?: boolean
  teacher_portal_enabled?: boolean
  student_portal_enabled?: boolean
  online_payments_enabled?: boolean
}

const defaultForm: StudioForm = {
  name: '',
  email: '',
  password: '',
  address: '',
  country: '',
  city: '',
  phone: '',
  instagram_url: '',
  tiktok_url: '',
  facebook_url: '',
  website_url: '',
  is_superuser: false,
  currency: 'CLP',
  plan_id: '',
  billing_cycle: 'monthly',
  price_locked: '',
  max_sessions: '3',
  plan_start_date: '',
  plan_renewal_date: '',
  mobile_enabled: false,
  teacher_portal_enabled: false,
  student_portal_enabled: false,
  online_payments_enabled: false,
}

const defaultEditForm: StudioUpdateForm = {
  name: '',
  slug: '',
  email: '',
  password: '',
  address: '',
  country: '',
  city: '',
  phone: '',
  logo_url: '',
  instagram_url: '',
  tiktok_url: '',
  facebook_url: '',
  website_url: '',
  is_superuser: false,
  currency: 'CLP',
  plan_id: '',
  billing_cycle: 'monthly',
  price_locked: '',
  plan_start_date: '',
  plan_renewal_date: '',
  max_sessions: '3',
  mobile_enabled: false,
  teacher_portal_enabled: false,
  student_portal_enabled: false,
  online_payments_enabled: false,
}

const normalizeOptional = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}
const normalizeDateInput = (value?: string | null) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}
const toInputDate = (value: Date) => value.toISOString().slice(0, 10)
const normalizeSlugInput = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
const computeRenewalFromStart = (startDate: string, cycle: 'monthly' | 'annual') => {
  if (!startDate) return ''
  const base = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(base.getTime())) return ''
  const next = new Date(base)
  next.setDate(next.getDate() + (cycle === 'annual' ? 365 : 30))
  return toInputDate(next)
}

export default function StudiosPage() {
  const whatsappTemplateOptions = [
    {
      sid: 'HXc48c3cc85e952f4801808ddaff9a809e',
      name: 'payment_reminder_es',
      label: 'Opcion 1',
      status: 'Utility / Approved',
      preview:
        'Hola [Nombre Alumno], te recordamos que tienes un pago pendiente del curso [Nombre Curso] de los dias [Dia y Hora] en [Nombre Estudio]. Si ya realizaste el pago, puedes ignorar este mensaje.',
    },
    {
      sid: 'HXd52821f338d579d0463bcb380207db70',
      name: 'copy_payment_reminder_option2_es',
      label: 'Opcion 2',
      status: 'Utility / Approved',
      preview:
        'Hola [Nombre Alumno] ✨ Desde [Nombre Estudio] queremos recordarte de forma cordial que tienes un pago pendiente del curso [Nombre Curso] de los dias [Dia y Hora]. Si ya realizaste el pago, puedes ignorar este mensaje.',
    },
  ] as const

  const [form, setForm] = useState<StudioForm>(defaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [studios, setStudios] = useState<Studio[]>([])
  const [isLoadingStudios, setIsLoadingStudios] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Studio | null>(null)
  const [editForm, setEditForm] = useState<StudioUpdateForm>(defaultEditForm)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editMessage, setEditMessage] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [revokingSessionsId, setRevokingSessionsId] = useState<number | null>(null)
  const [renewingId, setRenewingId] = useState<number | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null)
  const [createLogoPreview, setCreateLogoPreview] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [renewTarget, setRenewTarget] = useState<Studio | null>(null)
  const [plans, setPlans] = useState<TenantPlan[]>([])
  const [planForm, setPlanForm] = useState<PlanForm>({
    name: '',
    max_active_students: '',
    monthly_price: '',
    annual_price: '',
    is_active: true,
    is_custom: true,
  })
  const [planEditingId, setPlanEditingId] = useState<number | null>(null)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [planMessage, setPlanMessage] = useState<string | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null)
  const [planDeleteTarget, setPlanDeleteTarget] = useState<TenantPlan | null>(null)
  const [twilioForm, setTwilioForm] = useState({
    account_sid: '',
    auth_token: '',
    api_key_sid: '',
    api_key_secret: '',
    whatsapp_from: 'whatsapp:+14155238886',
    template_sid: 'HXc48c3cc85e952f4801808ddaff9a809e',
    enabled: true,
  })
  const [twilioConfig, setTwilioConfig] = useState<TwilioAdminConfig | null>(null)
  const [twilioTestPhone, setTwilioTestPhone] = useState('')
  const [twilioTestBody, setTwilioTestBody] = useState('Prueba de WhatsApp desde configuracion de Studios.')
  const [twilioSaving, setTwilioSaving] = useState(false)
  const [twilioTesting, setTwilioTesting] = useState(false)
  const [showTwilioToken, setShowTwilioToken] = useState(false)
  const [twilioMessage, setTwilioMessage] = useState<string | null>(null)
  const [twilioError, setTwilioError] = useState<string | null>(null)
  const [twilioBalance, setTwilioBalance] = useState<TwilioBalance | null>(null)
  const [twilioBalanceError, setTwilioBalanceError] = useState<string | null>(null)
  const [twilioAdminForbidden, setTwilioAdminForbidden] = useState(false)

  const currencyFormatter = new Intl.NumberFormat('es-CL')
  const formatMoney = (value?: string | number | null) => {
    if (value == null || value === '') return '-'
    const num = Number(value)
    if (Number.isNaN(num)) return '-'
    return `$${currencyFormatter.format(Math.round(num))}`
  }
  const formatUsd = (value?: number | null) => {
    if (value == null || Number.isNaN(Number(value))) return '-'
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 4,
    }).format(Number(value))
  }
  const formatUsdUsage = (value?: number | null) => {
    if (value == null || Number.isNaN(Number(value))) return '$0.000'
    return `$${Number(value).toFixed(3)}`
  }
  const activeTemplate =
    whatsappTemplateOptions.find((option) => option.sid === twilioForm.template_sid) || whatsappTemplateOptions[0]

  const planAccent = (max: number) => {
    if (max <= 20) return 'from-emerald-500/25 to-emerald-400/10 border-emerald-300/40 text-emerald-100'
    if (max <= 80) return 'from-sky-500/25 to-sky-400/10 border-sky-300/40 text-sky-100'
    if (max <= 160) return 'from-violet-500/25 to-violet-400/10 border-violet-300/40 text-violet-100'
    return 'from-amber-500/25 to-amber-400/10 border-amber-300/40 text-amber-100'
  }

  const planDaysLeft = (studio: Studio) => {
    if (!studio.plan_id || !studio.plan_renewal_date) return null
    const end = new Date(studio.plan_renewal_date)
    if (Number.isNaN(end.getTime())) return null
    const now = new Date()
    const diffMs = end.getTime() - now.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }

  const formatShortDate = (value?: string | null) => {
    if (!value) return '--'
    const raw = String(value)
    const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch
      return `${day}-${month}-${year}`
    }
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return '--'
    const day = `${d.getDate()}`.padStart(2, '0')
    const month = `${d.getMonth() + 1}`.padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }

  const fetchStudios = async (silent = false) => {
    if (!silent) {
      setIsLoadingStudios(true)
      setListError(null)
    }
    try {
      const { data } = await api.get<Studio[]>('/api/pms/tenants')
      setStudios(data)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (!silent) {
        if (detail) {
          setListError(typeof detail === 'string' ? detail : JSON.stringify(detail))
        } else {
          setListError(err?.message || 'No se pudieron cargar los estudios.')
        }
      }
    } finally {
      if (!silent) {
        setIsLoadingStudios(false)
      }
    }
  }

  const fetchPlans = async () => {
    try {
      const { data } = await api.get<TenantPlan[]>('/api/pms/tenants/plans')
      setPlans(data)
    } catch {
      setPlans([])
    }
  }

  const fetchTwilioConfig = async () => {
    try {
      const { data } = await api.get<TwilioAdminConfig>('/api/pms/whatsapp/admin-config')
      setTwilioAdminForbidden(false)
      setTwilioConfig(data)
      setTwilioForm((prev) => ({
        ...prev,
        account_sid: data.account_sid || '',
        auth_token: '',
        api_key_sid: data.api_key_sid || '',
        api_key_secret: '',
        whatsapp_from: data.whatsapp_from || prev.whatsapp_from,
        template_sid: data.template_sid || prev.template_sid,
        enabled: !!data.enabled,
      }))
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      if (status === 400 || status === 403) {
        setTwilioAdminForbidden(true)
        setTwilioError(typeof detail === 'string' ? detail : 'Sin permisos para administrar Twilio.')
      }
      setTwilioConfig(null)
    }
  }
  const fetchTwilioBalance = async () => {
    setTwilioBalanceError(null)
    try {
      const { data } = await api.get<TwilioBalance>('/api/pms/whatsapp/admin-balance')
      setTwilioAdminForbidden(false)
      setTwilioBalance(data)
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      setTwilioBalance(null)
      if (status === 400 || status === 403) {
        setTwilioAdminForbidden(true)
        setTwilioBalanceError(typeof detail === 'string' ? detail : 'Sin permisos para consultar saldo Twilio.')
      } else {
        setTwilioBalanceError(err?.response?.data?.detail || err?.message || null)
      }
    }
  }

  const resetPlanForm = () => {
    setPlanForm({
      name: '',
      max_active_students: '',
      monthly_price: '',
      annual_price: '',
      is_active: true,
      is_custom: true,
    })
    setPlanEditingId(null)
    setShowPlanForm(false)
  }

  const handleEditPlan = (plan: TenantPlan) => {
    setPlanEditingId(plan.id)
    setPlanForm({
      name: plan.name,
      max_active_students: String(plan.max_active_students),
      monthly_price: String(plan.monthly_price),
      annual_price: String(plan.annual_price),
      is_active: !!plan.is_active,
      is_custom: !!plan.is_custom,
    })
    setPlanMessage(null)
    setPlanError(null)
    setShowPlanForm(true)
  }

  const handleSavePlan = async (event: FormEvent) => {
    event.preventDefault()
    setIsSavingPlan(true)
    setPlanMessage(null)
    setPlanError(null)
    try {
      const payload = {
        name: planForm.name.trim(),
        max_active_students: Number(planForm.max_active_students || 0),
        monthly_price: Number(planForm.monthly_price || 0),
        annual_price: Number(planForm.annual_price || 0),
        is_active: !!planForm.is_active,
        is_custom: !!planForm.is_custom,
      }
      if (planEditingId) {
        await api.put(`/api/pms/tenants/plans/${planEditingId}`, payload)
        setPlanMessage('Plan actualizado correctamente.')
      } else {
        await api.post('/api/pms/tenants/plans', payload)
        setPlanMessage('Plan creado correctamente.')
      }
      resetPlanForm()
      await fetchPlans()
    } catch (err: any) {
      setPlanError(err?.message || 'No se pudo guardar el plan.')
    } finally {
      setIsSavingPlan(false)
    }
  }

  const confirmDeletePlan = async () => {
    if (!planDeleteTarget) return
    setDeletingPlanId(planDeleteTarget.id)
    setPlanMessage(null)
    setPlanError(null)
    try {
      await api.delete(`/api/pms/tenants/plans/${planDeleteTarget.id}`)
      if (planEditingId === planDeleteTarget.id) {
        resetPlanForm()
      }
      setPlanMessage('Plan eliminado correctamente.')
      setPlanDeleteTarget(null)
      await fetchPlans()
    } catch (err: any) {
      setPlanError(err?.message || 'No se pudo eliminar el plan.')
    } finally {
      setDeletingPlanId(null)
    }
  }

  useEffect(() => {
    fetchStudios()
    fetchPlans()
    fetchTwilioConfig()
    fetchTwilioBalance()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      fetchStudios(true)
    }, 15000)
    const twilioTimer = twilioAdminForbidden
      ? null
      : setInterval(() => {
          fetchTwilioBalance()
        }, 30000)
    const onVisible = () => {
      if (!document.hidden) {
        fetchStudios(true)
        if (!twilioAdminForbidden) {
          fetchTwilioBalance()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      if (twilioTimer) clearInterval(twilioTimer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [twilioAdminForbidden])

  const handleSaveTwilioConfig = async (event: FormEvent) => {
    event.preventDefault()
    setTwilioSaving(true)
    setTwilioMessage(null)
    setTwilioError(null)
    try {
      await api.put('/api/pms/whatsapp/admin-config', {
        account_sid: twilioForm.account_sid.trim(),
        auth_token: twilioForm.auth_token.trim(),
        api_key_sid: twilioForm.api_key_sid.trim(),
        api_key_secret: twilioForm.api_key_secret.trim(),
        whatsapp_from: twilioForm.whatsapp_from.trim(),
        template_sid: twilioForm.template_sid,
        enabled: twilioForm.enabled,
      })
      setTwilioMessage('Configuracion Twilio guardada correctamente.')
      setTwilioForm((prev) => ({ ...prev, auth_token: '', api_key_secret: '' }))
      await fetchTwilioConfig()
      await fetchTwilioBalance()
    } catch (err: any) {
      setTwilioError(err?.response?.data?.detail || err?.message || 'No se pudo guardar la configuracion Twilio.')
    } finally {
      setTwilioSaving(false)
    }
  }

  const handleTwilioTest = async () => {
    if (!twilioTestPhone.trim()) {
      setTwilioError('Debes ingresar un numero para la prueba.')
      return
    }
    setTwilioTesting(true)
    setTwilioMessage(null)
    setTwilioError(null)
    try {
      const { data } = await api.post('/api/pms/whatsapp/admin-test', {
        to_phone: twilioTestPhone.trim(),
        body: twilioTestBody.trim() || undefined,
      })
      setTwilioMessage(data?.message || `Prueba enviada. SID: ${data?.sid || '-'}`)
    } catch (err: any) {
      setTwilioError(err?.response?.data?.detail || err?.message || 'No se pudo enviar la prueba.')
    } finally {
      setTwilioTesting(false)
    }
  }

  useEffect(() => {
    if (editTarget) {
      const resolvedStartDate = normalizeDateInput(editTarget.plan_start_date || editTarget.created_at)
      const resolvedCycle = editTarget.billing_cycle === 'annual' ? 'annual' : 'monthly'
      const resolvedRenewalDate =
        normalizeDateInput(editTarget.plan_renewal_date) || computeRenewalFromStart(resolvedStartDate, resolvedCycle)
      setEditForm({
        name: editTarget.name,
        slug: editTarget.slug,
        email: editTarget.contact_email ?? '',
        password: '',
        address: editTarget.address ?? '',
        country: editTarget.country ?? '',
        city: editTarget.city ?? '',
        phone: editTarget.phone ?? '',
        logo_url: editTarget.logo_url ?? '',
        instagram_url: editTarget.instagram_url ?? '',
        tiktok_url: editTarget.tiktok_url ?? '',
        facebook_url: editTarget.facebook_url ?? '',
        website_url: editTarget.website_url ?? '',
        is_superuser: !!editTarget.admin_is_superuser,
        currency: editTarget.currency ?? 'CLP',
        plan_id: editTarget.plan_id ? String(editTarget.plan_id) : '',
        billing_cycle: resolvedCycle,
        price_locked: editTarget.price_locked != null ? String(editTarget.price_locked) : '',
        plan_start_date: resolvedStartDate,
        plan_renewal_date: resolvedRenewalDate,
        max_sessions: String(editTarget.max_sessions ?? 3),
        mobile_enabled: !!editTarget.mobile_enabled,
        teacher_portal_enabled: !!editTarget.teacher_portal_enabled,
        student_portal_enabled: !!editTarget.student_portal_enabled,
        online_payments_enabled: !!editTarget.online_payments_enabled,
      })
      setEditMessage(null)
      setEditError(null)
      setShowNewPassword(false)
    } else {
      setEditForm(defaultEditForm)
    }
  }, [editTarget])

  useEffect(() => {
    if (!form.plan_id) return
    const selected = plans.find((p) => p.id === Number(form.plan_id))
    if (!selected) return
    const defaultPrice = form.billing_cycle === 'annual' ? selected.annual_price : selected.monthly_price
    setForm((prev) => ({ ...prev, price_locked: String(defaultPrice) }))
  }, [form.plan_id, form.billing_cycle, plans])

  useEffect(() => {
    if (!editForm.plan_id) return
    const selected = plans.find((p) => p.id === Number(editForm.plan_id))
    if (!selected) return
    const defaultPrice = editForm.billing_cycle === 'annual' ? selected.annual_price : selected.monthly_price
    setEditForm((prev) => ({ ...prev, price_locked: String(defaultPrice) }))
  }, [editForm.plan_id, editForm.billing_cycle, plans])

  useEffect(() => {
    if (!editForm.plan_start_date) return
    const base = new Date(`${editForm.plan_start_date}T00:00:00`)
    if (Number.isNaN(base.getTime())) return
    const next = new Date(base)
    next.setDate(next.getDate() + (editForm.billing_cycle === 'annual' ? 365 : 30))
    const computed = toInputDate(next)
    if (computed !== editForm.plan_renewal_date) {
      setEditForm((prev) => ({ ...prev, plan_renewal_date: computed }))
    }
  }, [editForm.plan_start_date, editForm.billing_cycle])

  const handleChange = (field: keyof StudioForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value as any }))
  }

  const mobileModuleOptions = [
    { key: 'mobile_enabled', label: 'Portal Mobile', desc: 'Habilita la experiencia mobile/PWA del tenant.' },
    { key: 'teacher_portal_enabled', label: 'Portal Profesores', desc: 'Permite crear accesos mobile para profesores.' },
    { key: 'student_portal_enabled', label: 'Portal Alumnos', desc: 'Permite acceso de alumnos a progreso, pagos y anuncios.' },
    { key: 'online_payments_enabled', label: 'Pagos Online', desc: 'Prepara el tenant para cobros desde mobile.' },
  ] as const

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSuccess(null)
    setError(null)

    try {
      const { data } = await api.post<Studio>('/api/pms/tenants', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        address: normalizeOptional(form.address),
        country: normalizeOptional(form.country),
        city: normalizeOptional(form.city),
        phone: normalizeOptional(form.phone),
        instagram_url: normalizeOptional(form.instagram_url),
        tiktok_url: normalizeOptional(form.tiktok_url),
        facebook_url: normalizeOptional(form.facebook_url),
        website_url: normalizeOptional(form.website_url),
        is_superuser: !!form.is_superuser,
        currency: form.currency,
        plan_id: form.plan_id ? Number(form.plan_id) : undefined,
        billing_cycle: form.billing_cycle,
        price_locked: form.price_locked ? Number(form.price_locked) : undefined,
        max_sessions: form.max_sessions ? Number(form.max_sessions) : 3,
        plan_start_date: normalizeDateInput(form.plan_start_date) || null,
        plan_renewal_date: normalizeDateInput(form.plan_renewal_date) || null,
        mobile_enabled: !!form.mobile_enabled,
        teacher_portal_enabled: !!form.teacher_portal_enabled,
        student_portal_enabled: !!form.student_portal_enabled,
        online_payments_enabled: !!form.online_payments_enabled,
      })
      if (createLogoFile) {
        try {
          await uploadLogoForTenant(data.id, createLogoFile)
          setSuccess(`Estudio creado correctamente. Tenant asignado: ${data.slug} (logo subido)`)
        } catch (e: any) {
          setSuccess(`Estudio creado correctamente. Tenant asignado: ${data.slug} (logo no se pudo subir)`)
        }
      } else {
        setSuccess(`Estudio creado correctamente. Tenant asignado: ${data.slug}`)
      }
      setForm(defaultForm)
      setCreateLogoFile(null)
      setCreateLogoPreview('')
      await fetchStudios()
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear el estudio.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!editTarget) return
    setIsUpdating(true)
    setEditMessage(null)
    setEditError(null)

    try {
      const { data } = await api.put<Studio>(`/api/pms/tenants/${editTarget.id}`, {
        name: editForm.name.trim(),
        slug: normalizeSlugInput(editForm.slug),
        email: editForm.email.trim(),
        ...(editForm.password.trim() ? { password: editForm.password.trim() } : {}),
        address: normalizeOptional(editForm.address),
        country: normalizeOptional(editForm.country),
        city: normalizeOptional(editForm.city),
        phone: normalizeOptional(editForm.phone),
        logo_url: normalizeOptional(editForm.logo_url),
        instagram_url: normalizeOptional(editForm.instagram_url),
        tiktok_url: normalizeOptional(editForm.tiktok_url),
        facebook_url: normalizeOptional(editForm.facebook_url),
        website_url: normalizeOptional(editForm.website_url),
        is_superuser: !!editForm.is_superuser,
        currency: editForm.currency,
        plan_id: editForm.plan_id ? Number(editForm.plan_id) : null,
        billing_cycle: editForm.billing_cycle,
        price_locked: editForm.price_locked ? Number(editForm.price_locked) : undefined,
        max_sessions: editForm.max_sessions ? Number(editForm.max_sessions) : 3,
        plan_start_date: normalizeDateInput(editForm.plan_start_date) || null,
        plan_renewal_date: normalizeDateInput(editForm.plan_renewal_date) || null,
        mobile_enabled: !!editForm.mobile_enabled,
        teacher_portal_enabled: !!editForm.teacher_portal_enabled,
        student_portal_enabled: !!editForm.student_portal_enabled,
        online_payments_enabled: !!editForm.online_payments_enabled,
      })
      setEditMessage('Estudio actualizado correctamente.')
      setSuccess('Estudio actualizado correctamente.')
      setEditTarget(null)
      await fetchStudios()
    } catch (err: any) {
      setEditError(err?.message || 'No se pudo actualizar el estudio.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (tenantId: number) => {
    const target = studios.find((s) => s.id === tenantId)
    if (!target) return
    if (!window.confirm(`Eliminar el estudio ${target.name}? Esta accion no se puede deshacer.`)) return

    setDeletingId(tenantId)
    setError(null)
    setSuccess(null)
    try {
      await api.delete(`/api/pms/tenants/${tenantId}`)
      if (editTarget?.id === tenantId) {
        setEditTarget(null)
      }
      setSuccess('Estudio eliminado correctamente.')
      await fetchStudios()
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el estudio.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleRevokeAllSessions = async (tenantId: number) => {
    const target = studios.find((s) => s.id === tenantId)
    if (!target) return
    if (!window.confirm(`Cerrar todas las sesiones activas de ${target.name}?`)) return
    setRevokingSessionsId(tenantId)
    setError(null)
    setSuccess(null)
    try {
      await api.post(`/api/pms/tenants/${tenantId}/sessions/revoke-all`)
      setSuccess('Sesiones cerradas correctamente.')
      await fetchStudios()
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cerrar las sesiones.')
    } finally {
      setRevokingSessionsId(null)
    }
  }

  const toIsoDate = (d: Date) => {
    const y = d.getFullYear()
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const handleRenewPlan = async (studio: Studio) => {
    if (!studio.plan_id) {
      setError('Este estudio no tiene plan asignado.')
      return
    }
    const cycle = studio.billing_cycle === 'annual' ? 'annual' : 'monthly'
    const base = studio.plan_renewal_date ? new Date(studio.plan_renewal_date) : new Date()
    const now = new Date()
    const start = base.getTime() > now.getTime() ? base : now
    const next = new Date(start)
    next.setDate(next.getDate() + (cycle === 'annual' ? 365 : 30))
    setRenewingId(studio.id)
    setError(null)
    setSuccess(null)
    try {
      await api.put(`/api/pms/tenants/${studio.id}`, { plan_renewal_date: toIsoDate(next) })
      setSuccess(`Plan renovado para ${studio.name}.`)
      await fetchStudios()
    } catch (err: any) {
      setError(err?.message || 'No se pudo renovar el plan.')
    } finally {
      setRenewingId(null)
    }
  }

  const confirmRenewPlan = async () => {
    if (!renewTarget) return
    await handleRenewPlan(renewTarget)
    setRenewTarget(null)
  }

  const handleUploadLogo = async (file: File) => {
    if (!editTarget) return
    setEditError(null)
    setEditMessage(null)
    try {
      setUploadingLogo(true)
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<{ url: string }>('/api/pms/tenants/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Tenant-ID': editTarget.id },
      })
      setEditForm((prev) => ({ ...prev, logo_url: data.url }))
      setEditTarget((prev) => (prev ? { ...prev, logo_url: data.url } : prev))
      setEditMessage('Logo actualizado.')
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || err?.message || 'No se pudo subir el logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const uploadLogoForTenant = async (tenantId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    await api.post<{ url: string }>('/api/pms/tenants/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data', 'X-Tenant-ID': tenantId },
    })
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 md:space-y-12 pb-20 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
           <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Administracion Central</span>
           <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">Estudios</h1>
           <p className="text-gray-500 font-medium text-sm md:text-base">Gestion de sedes y configuracion de tenants.</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-fuchsia-400/30 shadow-[0_20px_60px_rgba(217,70,239,0.18)] space-y-8">
        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base md:text-lg font-black text-white">Planes de Suscripcion</h2>
              <p className="text-fuchsia-100/80 text-xs md:text-sm font-medium">Edita precios y cupos por plan.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (showPlanForm && !planEditingId) {
                  setShowPlanForm(false)
                } else {
                  setPlanEditingId(null)
                  setPlanForm({
                    name: '',
                    max_active_students: '',
                    monthly_price: '',
                    annual_price: '',
                    is_active: true,
                    is_custom: true,
                  })
                  setShowPlanForm(true)
                }
              }}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-fuchsia-600 hover:bg-fuchsia-700 shadow-lg shadow-fuchsia-500/30"
            >
              {showPlanForm && !planEditingId ? 'Cerrar formulario' : 'Nuevo plan'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md p-4 text-white">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-black text-white">{plan.name}</h3>
                  <button
                    type="button"
                    onClick={() => handleEditPlan(plan)}
                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-200 hover:text-white"
                  >
                    <HiOutlinePencilAlt className="h-3.5 w-3.5" />
                    Editar
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPlanDeleteTarget(plan)}
                    disabled={deletingPlanId === plan.id}
                    className="text-[10px] font-black uppercase tracking-widest text-rose-200 hover:text-rose-100 disabled:opacity-50"
                  >
                    {deletingPlanId === plan.id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
                <div className={`mt-3 rounded-2xl bg-gradient-to-r border px-3 py-2 ${planAccent(plan.max_active_students)}`}>
                  <p className="inline-flex items-center gap-2">
                    <HiOutlineUserGroup className="h-5 w-5" />
                    <span className="text-3xl leading-none font-black text-white">{plan.max_active_students}</span>
                    <span className="text-[11px] uppercase tracking-widest font-black">alumnos</span>
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="inline-flex items-center gap-1 text-xs font-black text-fuchsia-100"><HiOutlineCurrencyDollar className="h-4 w-4" />Mensual</p>
                  <p className="text-2xl font-black text-white leading-none">{formatMoney(plan.monthly_price)}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="inline-flex items-center gap-1 text-xs font-black text-fuchsia-100"><HiOutlineCurrencyDollar className="h-4 w-4" />Anual</p>
                  <p className="text-xl font-black text-fuchsia-200 leading-none">{formatMoney(plan.annual_price)}</p>
                </div>
              </div>
            ))}
          </div>
          {showPlanForm && (
          <form onSubmit={handleSavePlan} className="mt-5 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input className="md:col-span-2 px-4 py-3 bg-white/95 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-fuchsia-200" placeholder="Nombre plan" value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} required />
            <input type="number" min={1} className="px-4 py-3 bg-white/95 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-fuchsia-200" placeholder="Cupo" value={planForm.max_active_students} onChange={(e) => setPlanForm((p) => ({ ...p, max_active_students: e.target.value }))} required />
            <input type="number" min={0} className="px-4 py-3 bg-white/95 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-fuchsia-200" placeholder="Mensual" value={planForm.monthly_price} onChange={(e) => setPlanForm((p) => ({ ...p, monthly_price: e.target.value }))} required />
            <input type="number" min={0} className="px-4 py-3 bg-white/95 rounded-xl font-bold text-sm outline-none border-2 border-transparent focus:border-fuchsia-200" placeholder="Anual" value={planForm.annual_price} onChange={(e) => setPlanForm((p) => ({ ...p, annual_price: e.target.value }))} required />
            <button type="submit" disabled={isSavingPlan} className="px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 shadow-lg shadow-fuchsia-500/40 disabled:opacity-50">
              {isSavingPlan ? 'Guardando...' : (planEditingId ? 'Actualizar' : 'Crear')}
            </button>
          </form>
          )}
          {planMessage && <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-emerald-300">{planMessage}</div>}
          {planError && <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-rose-300">{planError}</div>}
        </div>
      </div>
      {planDeleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={() => setPlanDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white border border-gray-100 shadow-2xl p-6">
            <h3 className="text-lg font-black text-gray-900">Eliminar plan</h3>
            <p className="mt-2 text-sm font-semibold text-gray-500">
              Vas a eliminar <span className="text-gray-900">{planDeleteTarget.name}</span>. Esta accion no se puede deshacer.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPlanDeleteTarget(null)}
                className="flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeletePlan}
                disabled={deletingPlanId === planDeleteTarget.id}
                className="flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingPlanId === planDeleteTarget.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base md:text-lg font-black text-gray-900">Configuracion Twilio-WhatsApp</h2>
            <p className="text-gray-400 text-xs md:text-sm font-medium">Configura SID, token y numero origen sin editar archivos del servidor.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Origen</div>
            <div className="text-xs font-black text-fuchsia-600">{twilioConfig?.source === 'database' ? 'Studios' : 'ENV'}</div>
            <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Modo activo</div>
            <div className={`text-xs font-black ${
              twilioConfig?.auth_mode === 'api_key'
                ? 'text-emerald-600'
                : twilioConfig?.auth_mode === 'auth_token'
                  ? 'text-amber-600'
                  : 'text-gray-500'
            }`}>
              {twilioConfig?.auth_mode === 'api_key'
                ? 'API Key'
                : twilioConfig?.auth_mode === 'auth_token'
                  ? 'Auth Token'
                  : 'Sin configurar'}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-gradient-to-r from-gray-50 to-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Saldo Twilio</p>
              <p className={`text-sm md:text-base font-black ${twilioBalance?.level === 'critical' ? 'text-rose-600' : twilioBalance?.level === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {twilioBalance ? `Te quedan ${formatUsd(twilioBalance.remaining_usd)} de ${formatUsd(twilioBalance.budget_usd)}` : 'Sin datos de saldo'}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchTwilioBalance}
              className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Actualizar
            </button>
          </div>
          <div className="mt-3 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${twilioBalance?.level === 'critical' ? 'bg-rose-500' : twilioBalance?.level === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.max(0, Math.min(100, twilioBalance?.remaining_percent ?? 0))}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
            <span className="text-gray-500">Umbral alerta: {twilioBalance ? formatUsd(twilioBalance.threshold_usd) : '-'}</span>
            <span className={`${twilioBalance?.level === 'critical' ? 'text-rose-600' : twilioBalance?.level === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`}>
              {twilioBalance?.level === 'critical' ? 'Saldo critico' : twilioBalance?.level === 'warning' ? 'Saldo bajo' : 'Saldo estable'}
            </span>
          </div>
          {twilioBalance && (
            <div className="mt-1 text-[10px] font-bold text-gray-500">
              Saldo real consultado: {formatUsd(twilioBalance.balance_usd)}
            </div>
          )}
          {twilioBalanceError && (
            <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-rose-500">{twilioBalanceError}</div>
          )}
        </div>

        <form onSubmit={handleSaveTwilioConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account SID</label>
            <input
              value={twilioForm.account_sid}
              onChange={(e) => setTwilioForm((p) => ({ ...p, account_sid: e.target.value }))}
              className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 outline-none font-bold text-gray-700"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Auth Token</label>
            <div className="flex items-center gap-2">
              <input
                type={showTwilioToken ? 'text' : 'password'}
                value={twilioForm.auth_token}
                onChange={(e) => setTwilioForm((p) => ({ ...p, auth_token: e.target.value }))}
                className="flex-1 px-5 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 outline-none font-bold text-gray-700"
                placeholder={twilioConfig?.auth_token_configured ? 'Token configurado (ingresa uno nuevo para reemplazar)' : 'Ingresa token'}
              />
              <button
                type="button"
                onClick={() => setShowTwilioToken((v) => !v)}
                className="px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                {showTwilioToken ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {twilioConfig?.auth_token_configured && !twilioForm.auth_token && (
              <p className="text-[10px] font-bold text-gray-500">
                Token ya configurado. Por seguridad no se muestra; ingresa uno nuevo si deseas reemplazarlo.
              </p>
            )}
            {showTwilioToken && !twilioForm.auth_token && twilioConfig?.auth_token_masked && (
              <p className="text-[10px] font-bold text-fuchsia-600">
                Token actual (enmascarado): {twilioConfig.auth_token_masked}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">API Key SID (SK...)</label>
            <input
              value={twilioForm.api_key_sid}
              onChange={(e) => setTwilioForm((p) => ({ ...p, api_key_sid: e.target.value }))}
              className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 outline-none font-bold text-gray-700"
              placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
            {twilioConfig?.api_key_configured && !twilioForm.api_key_sid && (
              <p className="text-[10px] font-bold text-gray-500">API Key SID ya configurado en servidor.</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">API Key Secret</label>
            <input
              type="password"
              value={twilioForm.api_key_secret}
              onChange={(e) => setTwilioForm((p) => ({ ...p, api_key_secret: e.target.value }))}
              className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 outline-none font-bold text-gray-700"
              placeholder={twilioConfig?.api_key_configured ? 'Secret configurado (ingresa uno nuevo para reemplazar)' : 'Ingresa API key secret'}
            />
            {twilioConfig?.api_key_configured && !twilioForm.api_key_secret && twilioConfig?.api_key_masked && (
              <p className="text-[10px] font-bold text-fuchsia-600">Secret actual (enmascarado): {twilioConfig.api_key_masked}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Numero Origen</label>
            <input
              value={twilioForm.whatsapp_from}
              onChange={(e) => setTwilioForm((p) => ({ ...p, whatsapp_from: e.target.value }))}
              className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 outline-none font-bold text-gray-700"
              placeholder="whatsapp:+14155238886"
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plantilla activa de WhatsApp</label>
            <select
              value={twilioForm.template_sid}
              onChange={(e) => setTwilioForm((p) => ({ ...p, template_sid: e.target.value }))}
              className="w-full px-5 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 outline-none font-bold text-gray-700"
            >
              {whatsappTemplateOptions.map((option) => (
                <option key={option.sid} value={option.sid}>
                  {option.label} - {option.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] font-bold text-gray-500">
              El sistema usara esta plantilla aprobada para el boton de WhatsApp individual, el boton Pendientes y la prueba rapida.
            </p>
          </div>
          <label className="md:col-span-2 inline-flex items-center gap-2 text-xs font-black text-gray-600 uppercase tracking-widest">
            <input
              type="checkbox"
              checked={twilioForm.enabled}
              onChange={(e) => setTwilioForm((p) => ({ ...p, enabled: e.target.checked }))}
              className="w-4 h-4"
            />
            Canal activo
          </label>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={twilioSaving}
              className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-lg shadow-fuchsia-200 hover:shadow-xl transition-all disabled:opacity-60"
            >
              {twilioSaving ? 'Guardando...' : 'Guardar Twilio'}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Plantilla activa de WhatsApp</div>
              <div className="text-sm font-black text-gray-800">{activeTemplate.name}</div>
              <div className="text-[10px] font-bold text-gray-500 mt-1">SID: {activeTemplate.sid}</div>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">{activeTemplate.status}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-indigo-100 p-4">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Canal</div>
              <div className="text-sm font-black text-gray-800">Twilio + WhatsApp</div>
            </div>
            <div className="bg-white rounded-xl border border-indigo-100 p-4">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Uso</div>
              <div className="text-sm font-black text-gray-800">Cobro manual por alumno o curso</div>
            </div>
            <div className="bg-white rounded-xl border border-indigo-100 p-4">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Seleccion actual</div>
              <div className="text-sm font-black text-gray-800">{activeTemplate.label}</div>
            </div>
            <div className="bg-white rounded-xl border border-indigo-100 p-4">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Variables</div>
              <div className="text-sm font-black text-gray-800">Alumno, curso, dia/hora y estudio</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-indigo-100 p-4 text-xs text-gray-600 leading-relaxed">
            {activeTemplate.preview}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prueba Rapida</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={twilioTestPhone}
              onChange={(e) => setTwilioTestPhone(e.target.value)}
              className="md:col-span-1 px-4 py-3 rounded-xl bg-white border border-gray-200 outline-none font-bold text-gray-700"
              placeholder="+569XXXXXXXX"
            />
            <input
              value={twilioTestBody}
              onChange={(e) => setTwilioTestBody(e.target.value)}
              className="md:col-span-2 px-4 py-3 rounded-xl bg-white border border-gray-200 outline-none font-bold text-gray-700"
              placeholder="Mensaje de prueba"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleTwilioTest}
              disabled={twilioTesting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-60"
            >
              <HiOutlinePhone className="h-4 w-4" />
              {twilioTesting ? 'Enviando...' : 'Probar envio'}
            </button>
          </div>
        </div>
        {twilioMessage && <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{twilioMessage}</div>}
        {twilioError && <div className="text-[10px] font-black uppercase tracking-widest text-rose-600">{twilioError}</div>}
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-sm space-y-6">
        <div>
          <h2 className="text-base md:text-lg font-black text-gray-900">Registrar Nuevo Estudio</h2>
          <p className="text-gray-400 text-xs md:text-sm font-medium">Usa el boton para abrir el formulario completo en una ventana.</p>
        </div>
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-lg shadow-fuchsia-200 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            + Nuevo Estudio
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-gray-100 flex flex-col">
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl z-20 flex items-center justify-between px-8 py-6 border-b border-gray-50">
              <div>
                <h2 className="text-lg font-black text-gray-900">Registrar Nuevo Estudio</h2>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Configuracion inicial del tenant</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-3 rounded-2xl text-gray-400 hover:bg-gray-100 transition-all"
                aria-label="Cerrar"
              >
                <HiOutlinePlus className="rotate-45" size={24} />
              </button>
            </div>

            <form className="space-y-8 p-8" onSubmit={handleSubmit}>
          <div className="space-y-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Datos Base</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nombre del estudio</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="Estudio Norte"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Correo administrador</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="admin@estudio.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Clave inicial</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="********"
              />
            </div>
            <div className="flex items-center gap-3 px-2">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.is_superuser ? 'bg-fuchsia-600 border-fuchsia-600' : 'border-gray-200'}`}>
                 <input
                    id="is_superuser"
                    type="checkbox"
                    checked={form.is_superuser}
                    onChange={(e) => handleChange('is_superuser', e.target.checked)}
                    className="hidden"
                  />
                  {form.is_superuser && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <label htmlFor="is_superuser" className="text-xs font-black text-gray-500 uppercase tracking-widest cursor-pointer">Admin Superusuario</label>
            </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Ubicacion y Contacto</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Direccion</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="Av. Principal 123"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Pais / Ciudad</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="Chile"
                />
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="Santiago"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Telefono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Moneda</label>
              <select
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
              >
                <option value="CLP">CLP - Peso Chileno ($)</option>
                <option value="ARS">ARS - Peso Argentino ($)</option>
                <option value="USD">USD - Dolar Estadounidense (US$)</option>
              </select>
            </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Plan del Tenant</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Plan contratado</label>
              <select
                value={form.plan_id}
                onChange={(e) => handleChange('plan_id', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
              >
                <option value="">Sin plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.max_active_students} alumnos)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Modalidad</label>
              <select
                value={form.billing_cycle}
                onChange={(e) => handleChange('billing_cycle', e.target.value as 'monthly' | 'annual')}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
              >
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Precio pactado</label>
              <input
                type="number"
                min={0}
                step="1"
                value={form.price_locked}
                onChange={(e) => handleChange('price_locked', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Maximo sesiones</label>
              <select
                value={form.max_sessions}
                onChange={(e) => handleChange('max_sessions', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
              >
                <option value="1">1 sesion</option>
                <option value="2">2 sesiones</option>
                <option value="3">3 sesiones</option>
                <option value="4">4 sesiones</option>
                <option value="5">5 sesiones</option>
              </select>
            </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Modulos Mobile</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {mobileModuleOptions.map((option) => {
                  const checked = !!form[option.key]
                  return (
                    <label key={option.key} className={`cursor-pointer rounded-2xl border p-4 transition-all ${checked ? 'border-fuchsia-200 bg-fuchsia-50 shadow-sm' : 'border-gray-100 bg-gray-50/60 hover:bg-white'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const value = e.target.checked
                            setForm((prev) => ({
                              ...prev,
                              [option.key]: value,
                              mobile_enabled: option.key === 'mobile_enabled' ? value : (value ? true : prev.mobile_enabled),
                            }))
                          }}
                          className="mt-1 h-4 w-4 accent-fuchsia-600"
                        />
                        <div>
                          <div className="text-xs font-black text-gray-900 uppercase tracking-widest">{option.label}</div>
                          <p className="mt-1 text-[10px] font-bold text-gray-500 leading-relaxed">{option.desc}</p>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Redes Sociales</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Redes Sociales (Insta / TikTok)</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={form.instagram_url}
                  onChange={(e) => handleChange('instagram_url', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="@insta"
                />
                <input
                  type="text"
                  value={form.tiktok_url}
                  onChange={(e) => handleChange('tiktok_url', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="@tiktok"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Sitio Web / Facebook</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={form.website_url}
                  onChange={(e) => handleChange('website_url', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="www..."
                />
                <input
                  type="text"
                  value={form.facebook_url}
                  onChange={(e) => handleChange('facebook_url', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="fb..."
                />
              </div>
            </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Logo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Logo</label>
              <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                  {createLogoPreview ? (
                    <img src={createLogoPreview} alt="logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[8px] font-black text-gray-300 uppercase">Logo</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest cursor-pointer hover:text-fuchsia-700 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setCreateLogoFile(file)
                        setCreateLogoPreview(URL.createObjectURL(file))
                      }}
                    />
                    Subir Imagen
                  </label>
                  {createLogoPreview && (
                    <button
                      type="button"
                      className="block text-[8px] font-black text-rose-500 uppercase tracking-widest"
                      onClick={() => {
                        setCreateLogoFile(null)
                        setCreateLogoPreview('')
                      }}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
              </div>
            </div>
          </div>

          {success && <div className="p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-widest text-center">{success}</div>}
          {error && <div className="p-4 rounded-2xl border-2 border-rose-100 bg-rose-50 text-rose-600 text-xs font-black uppercase tracking-widest text-center">{error}</div>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-lg shadow-fuchsia-200 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-all"
            >
              {isSubmitting ? 'Procesando...' : 'Crear Sede / Estudio'}
            </button>
          </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900">Estudios Registrados</h2>
            <p className="text-gray-400 text-xs md:text-sm font-medium">Listado global de sedes activas.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{studios.length} Sedes</span>
          </div>
        </div>
        <div className="p-0 sm:p-4">
          {isLoadingStudios ? (
            <div className="p-10 flex flex-col items-center gap-4">
               <div className="w-10 h-10 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
               <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">Sincronizando...</span>
            </div>
          ) : listError ? (
            <div className="p-10 text-rose-500 text-center font-black uppercase text-xs">{listError}</div>
          ) : studios.length === 0 ? (
            <div className="p-10 text-gray-400 text-center font-black uppercase text-xs">No hay estudios registrados.</div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="min-w-full text-sm">
                <thead className="hidden md:table-header-group bg-gray-50/50">
                  <tr className="text-left border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tenant</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estudio / Admin</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ubicacion</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Plan contratado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mobile</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sesiones</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Consumo WhatsApp</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Logo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 block md:table-row-group">
                  {studios.map((studio) => (
                  <tr key={studio.id} className="block md:table-row hover:bg-fuchsia-50/10 transition-colors">
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Tenant ID</div>
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">#{studio.id}</span>
                        <span className="font-mono text-xs font-black text-fuchsia-600 bg-fuchsia-50 px-3 py-1.5 rounded-lg">{studio.slug}</span>
                      </div>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Estudio / Admin</div>
                      <div className="font-black text-gray-900 text-sm">{studio.name}</div>
                      <div className="text-[10px] font-bold text-gray-400 truncate">{studio.contact_email}</div>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Ubicacion</div>
                      <div className="text-xs font-black text-gray-700">{studio.address || 'Sin direccion'}</div>
                      <div className="text-[10px] font-bold text-gray-400">{studio.city}, {studio.country}</div>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Plan contratado</div>
                      <div className="text-sm font-black text-gray-900">{studio.plan_label_snapshot || studio.plan_name || 'Sin plan'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black text-gray-600">
                          {studio.max_active_students ? `${studio.max_active_students} alumnos` : '-'}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          studio.billing_cycle === 'annual'
                            ? 'text-violet-700 bg-violet-50 border-violet-200'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}>
                          {studio.billing_cycle === 'annual' ? 'Anual' : 'Mensual'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-bold text-gray-500">Contratado: {formatShortDate(studio.plan_start_date || studio.created_at)}</div>
                      <div className="text-xs font-bold text-gray-500">Renueva: {formatShortDate(studio.plan_renewal_date)}</div>
                      <div className="text-xs font-black text-fuchsia-600">{formatMoney(studio.price_locked)}</div>
                      {(() => {
                        const daysLeft = planDaysLeft(studio)
                        if (daysLeft == null) return null
                        if (daysLeft < 0) {
                          return <div className="text-xs font-black text-rose-600">Plan vencido ({Math.abs(daysLeft)} dias)</div>
                        }
                        return <div className="text-xs font-black text-amber-600">Te faltan {daysLeft} dias</div>
                      })()}
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Mobile</div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${studio.mobile_enabled ? 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200' : 'text-gray-400 bg-gray-50 border-gray-100'}`}>
                          {studio.mobile_enabled ? 'Activo' : 'Inactivo'}
                        </span>
                        {studio.teacher_portal_enabled && <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-100">Profe</span>}
                        {studio.student_portal_enabled && <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-sky-700 bg-sky-50 border border-sky-100">Alumno</span>}
                        {studio.online_payments_enabled && <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100">Pagos</span>}
                      </div>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Sesiones</div>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        (studio.active_sessions || 0) >= (studio.max_sessions || 3)
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : (studio.active_sessions || 0) >= Math.max(1, (studio.max_sessions || 3) - 1)
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      }`}>
                        {studio.active_sessions || 0}/{studio.max_sessions || 3}
                      </span>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Consumo WhatsApp</div>
                      <div className="text-xs font-black text-gray-800">
                        {formatUsdUsage(studio.whatsapp_consumption_usd || 0)} / {formatUsd(studio.whatsapp_budget_usd || 20)}
                      </div>
                      <div className={`text-[10px] font-black uppercase tracking-widest ${
                        (studio.whatsapp_consumption_usd || 0) >= ((studio.whatsapp_budget_usd || 20) - 5)
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}>
                        {(studio.whatsapp_consumption_usd || 0) >= ((studio.whatsapp_budget_usd || 20) - 5) ? 'Alerta' : 'OK'}
                      </div>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle text-center">
                        <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1 text-left">Logo</div>
                        <div className="flex justify-center">
                          {studio.logo_url ? (
                            <img
                              src={toAbsoluteUrl(studio.logo_url)}
                              alt={studio.name}
                              className="h-10 w-10 md:h-12 md:w-12 object-cover rounded-xl border border-gray-100 bg-white shadow-sm"
                            />
                          ) : (
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                               <span className="text-[8px] font-black text-gray-300 uppercase">Sin Logo</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                        <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Acciones</div>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            className="p-2.5 rounded-xl border border-gray-100 text-gray-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-100 transition-all disabled:opacity-30"
                            onClick={() => handleRevokeAllSessions(studio.id)}
                            disabled={revokingSessionsId === studio.id}
                            title="Cerrar sesiones activas"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 8H5a2 2 0 01-2-2V6a2 2 0 012-2h8" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="p-2.5 rounded-xl border border-gray-100 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100 transition-all disabled:opacity-30"
                            onClick={() => setRenewTarget(studio)}
                            disabled={renewingId === studio.id}
                            title="Renovar plan"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.5 14A7 7 0 0017 17.5M18.5 10A7 7 0 007 6.5" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="p-2.5 rounded-xl border border-gray-100 text-gray-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 hover:border-fuchsia-100 transition-all"
                            onClick={() => setEditTarget(studio)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.732-6.732a2.5 2.5 0 113.536 3.536L12.536 14.5 9 15.5l1-3.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="p-2.5 rounded-xl border border-gray-100 text-gray-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition-all disabled:opacity-30"
                            onClick={() => handleDelete(studio.id)}
                            disabled={deletingId === studio.id}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto border border-gray-100 flex flex-col">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-20 flex items-center justify-between px-8 py-6 border-b border-gray-50">
              <div>
                <h2 className="text-lg font-black text-gray-900">Editar Estudio</h2>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-2 py-0.5 rounded-lg">Tenant</span>
                   <span className="font-mono text-xs font-bold text-gray-500">{editTarget.slug}</span>
                </div>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-3 rounded-2xl text-gray-400 hover:bg-gray-100 transition-all">
                <HiOutlinePlus className="rotate-45" size={24} />
              </button>
            </div>

            <form className="p-10 lg:p-12 space-y-10" onSubmit={handleUpdate}>
              <div className="grid grid-cols-1 2xl:grid-cols-[1fr_320px] gap-10">
                <div className="space-y-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Datos Base</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nombre del estudio</label>
                        <input type="text" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} required className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Slug Portal Mobile</label>
                        <input
                          type="text"
                          value={editForm.slug}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, slug: normalizeSlugInput(e.target.value) }))}
                          required
                          className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                          placeholder="puerto-montt-salsa"
                        />
                        <p className="px-2 text-[10px] font-bold text-gray-400 break-all">Link: /mobile/{editForm.slug || 'slug-del-estudio'}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Correo administrador</label>
                        <input type="email" value={editForm.email} onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))} required className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nueva Contrasena</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={editForm.password}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                            placeholder="Sin cambios"
                            className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none pr-12 text-sm"
                          />
                          <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                            {showNewPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-2">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editForm.is_superuser ? 'bg-fuchsia-600 border-fuchsia-600' : 'border-gray-200'}`}>
                          <input id="edit_is_superuser" type="checkbox" checked={editForm.is_superuser} onChange={(e) => setEditForm((prev) => ({ ...prev, is_superuser: e.target.checked }))} className="hidden" />
                          {editForm.is_superuser && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <label htmlFor="edit_is_superuser" className="text-xs font-black text-gray-500 uppercase tracking-widest cursor-pointer">Superusuario</label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Ubicacion y Contacto</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Direccion</label>
                        <input type="text" value={editForm.address} onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))} className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Pais / Ciudad</label>
                        <div className="grid grid-cols-2 gap-4">
                          <input type="text" value={editForm.country} onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))} className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="Pais" />
                          <input type="text" value={editForm.city} onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))} className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="Ciudad" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Telefono</label>
                        <input type="text" value={editForm.phone} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Moneda</label>
                        <select
                          value={editForm.currency}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, currency: e.target.value }))}
                          className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
                        >
                          <option value="CLP">CLP - Peso Chileno ($)</option>
                          <option value="ARS">ARS - Peso Argentino ($)</option>
                          <option value="USD">USD - Dolar Estadounidense (US$)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Plan del Tenant</p>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-7">
                        <div className="space-y-2 min-w-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Plan contratado</label>
                        <select
                          value={editForm.plan_id}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, plan_id: e.target.value }))}
                          className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
                        >
                          <option value="">Sin plan</option>
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.max_active_students} alumnos)
                            </option>
                          ))}
                        </select>
                        </div>
                        <div className="space-y-2 min-w-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Modalidad</label>
                        <select
                          value={editForm.billing_cycle}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, billing_cycle: e.target.value as 'monthly' | 'annual' }))}
                          className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
                        >
                          <option value="monthly">Mensual</option>
                          <option value="annual">Anual</option>
                        </select>
                        </div>
                        <div className="space-y-2 min-w-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Precio pactado</label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={editForm.price_locked}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, price_locked: e.target.value }))}
                          className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                        />
                        </div>
                        <div className="space-y-2 min-w-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Maximo sesiones</label>
                        <select
                          value={editForm.max_sessions}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, max_sessions: e.target.value }))}
                          className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
                        >
                          <option value="1">1 sesion</option>
                          <option value="2">2 sesiones</option>
                          <option value="3">3 sesiones</option>
                          <option value="4">4 sesiones</option>
                          <option value="5">5 sesiones</option>
                        </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-7 pt-2">
                        <div className="space-y-2 min-w-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha contratado</label>
                        <input
                          type="date"
                          value={editForm.plan_start_date}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, plan_start_date: e.target.value }))}
                          className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                        />
                        </div>
                        <div className="space-y-2 min-w-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha renueva</label>
                        <input
                          type="date"
                          value={editForm.plan_renewal_date}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, plan_renewal_date: e.target.value }))}
                          className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                        />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Modulos Mobile</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      {mobileModuleOptions.map((option) => {
                        const checked = !!editForm[option.key]
                        return (
                          <label key={option.key} className={`cursor-pointer rounded-2xl border p-4 transition-all ${checked ? 'border-fuchsia-200 bg-fuchsia-50 shadow-sm' : 'border-gray-100 bg-gray-50/60 hover:bg-white'}`}>
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const value = e.target.checked
                                  setEditForm((prev) => ({
                                    ...prev,
                                    [option.key]: value,
                                    mobile_enabled: option.key === 'mobile_enabled' ? value : (value ? true : prev.mobile_enabled),
                                  }))
                                }}
                                className="mt-1 h-4 w-4 accent-fuchsia-600"
                              />
                              <div>
                                <div className="text-xs font-black text-gray-900 uppercase tracking-widest">{option.label}</div>
                                <p className="mt-1 text-[10px] font-bold text-gray-500 leading-relaxed">{option.desc}</p>
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600 mb-3">Redes Sociales</p>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-7">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Insta / TikTok</label>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <input type="text" value={editForm.instagram_url} onChange={(e) => setEditForm((prev) => ({ ...prev, instagram_url: e.target.value }))} className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="@insta" />
                          <input type="text" value={editForm.tiktok_url} onChange={(e) => setEditForm((prev) => ({ ...prev, tiktok_url: e.target.value }))} className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="@tiktok" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Web / FB</label>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <input type="text" value={editForm.website_url} onChange={(e) => setEditForm((prev) => ({ ...prev, website_url: e.target.value }))} className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="Web" />
                          <input type="text" value={editForm.facebook_url} onChange={(e) => setEditForm((prev) => ({ ...prev, facebook_url: e.target.value }))} className="w-full px-5 py-3 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="FB" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600">Logo</p>
                  <div className="p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="h-40 w-full rounded-2xl border bg-white flex items-center justify-center overflow-hidden shadow-sm">
                      {editForm.logo_url ? (
                        <img src={toAbsoluteUrl(editForm.logo_url)} alt="logo" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-black text-gray-300 uppercase">Sin Logo</span>
                      )}
                    </div>
                    <label className="mt-4 block text-center py-3 bg-white border border-gray-100 rounded-xl text-[10px] font-black text-fuchsia-600 uppercase tracking-widest cursor-pointer hover:bg-fuchsia-50 transition-colors shadow-sm">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; handleUploadLogo(file) }} />
                      {uploadingLogo ? 'Subiendo...' : 'Cambiar Imagen'}
                    </label>
                  </div>
                </div>
              </div>

              {editMessage && <div className="p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest text-center">{editMessage}</div>}
              {editError && <div className="p-4 rounded-2xl border-2 border-rose-100 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest text-center">{editError}</div>}

              <div className="flex flex-col-reverse sm:flex-row gap-4 pt-6 border-t border-gray-50">
                 <button type="button" className="flex-1 sm:flex-none px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all" onClick={() => setEditTarget(null)}>
                  Cancelar
                </button>
                <button type="submit" disabled={isUpdating} className="flex-1 sm:flex-none px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-lg shadow-fuchsia-200 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 transition-all">
                  {isUpdating ? 'Procesando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renewTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={() => setRenewTarget(null)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white border border-gray-100 shadow-2xl p-6">
            <h3 className="text-lg font-black text-gray-900">Renovar plan</h3>
            <p className="mt-2 text-sm font-semibold text-gray-500">
              ¿Estas seguro que renovaras este plan por{' '}
              <span className="text-gray-900">
                {renewTarget.billing_cycle === 'annual' ? '365 dias' : '30 dias'}
              </span>{' '}
              mas?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setRenewTarget(null)}
                className="flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRenewPlan}
                disabled={renewingId === renewTarget.id}
                className="flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {renewingId === renewTarget.id ? 'Renovando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

