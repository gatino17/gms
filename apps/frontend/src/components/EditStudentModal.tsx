import { api, toAbsoluteUrl } from '../lib/api'

const formatDisplay = (iso?: string | null) => {
  if (!iso) return ''
  if (iso.includes('/')) return iso
  const parts = iso.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return iso
}

const toIso = (dmy?: string | null) => {
  if (!dmy) return ''
  const clean = dmy.trim()
  if (!clean) return ''
  if (clean.includes('-') && clean.length === 10) return clean
  const parts = clean.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    if (y && m && d) {
      return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  return clean
}

type Props = {
  editId: number | null
  setEditId: (v:number|null)=>void
  showEdit: boolean
  setShowEdit: (v:boolean)=>void
  saving: boolean
  setSaving: (v:boolean)=>void
  saveError: string|null
  setSaveError: (v:string|null)=>void

  form: any
  setForm: (updater:any)=>void

  imageFile: File | null
  setImageFile: (f:File|null)=>void
  imageError: string | null
  setImageError: (s:string|null)=>void
  imagePreview: string | null

  load: ()=>Promise<void>
}

export default function EditStudentModal(props: Props){
  const {
    editId, setEditId, showEdit, setShowEdit, saving, setSaving, saveError, setSaveError,
    form, setForm, imageFile, setImageFile, imageError, setImageError, imagePreview,
    load
  } = props

  if (!showEdit) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={()=>{ setShowEdit(false); setEditId(null) }} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] sm:w-[90vw] md:w-auto max-w-4xl my-6 h-[90vh] max-h-[90vh] overflow-hidden overscroll-contain border">
        <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-semibold">Editar alumno</h2>
            <button className="rounded-full hover:bg-white/10 px-2 py-1 text-2xl leading-none" onClick={()=>{ setShowEdit(false); setEditId(null) }}>&times;</button>
          </div>
        </div>

        <div className="bg-white px-4 sm:px-6 py-5 max-h-[75vh] overflow-y-auto">
          {saveError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nombre</label>
              <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200" value={form.first_name} onChange={(e)=>setForm((f:any)=>({...f, first_name:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Apellido</label>
              <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200" value={form.last_name} onChange={(e)=>setForm((f:any)=>({...f, last_name:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input type="email" className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200" value={form.email} onChange={(e)=>setForm((f:any)=>({...f, email:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
              <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200" value={form.phone} onChange={(e)=>setForm((f:any)=>({...f, phone:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Género</label>
              <select className="w-full border rounded px-3 py-2" value={form.gender} onChange={(e)=>setForm((f:any)=>({...f, gender:e.target.value}))}>
                <option value="">No responde</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Fecha de ingreso</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 border rounded px-3 py-2"
                  value={form.joined_at}
                  onChange={(e)=>setForm((f:any)=>({...f, joined_at: e.target.value}))}
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                  onClick={() => setForm((f:any) => ({ ...f, joined_at: new Date().toISOString().slice(0,10) }))}
                >
                  Hoy
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Fecha de nacimiento</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={form.birthdate}
                onChange={(e)=>setForm((f:any)=>({...f, birthdate: e.target.value}))}
              />
            </div>

            <div className="md:order-2">
              <label className="block text-sm text-gray-600 mb-2">Foto del alumno</label>
              <div className="flex gap-4 items-start">
                <div className="w-28 h-28 rounded-full ring-1 ring-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                  {imagePreview ? (
                    <img
                      src={imagePreview.startsWith('blob:') || imagePreview.startsWith('data:') ? imagePreview : toAbsoluteUrl(imagePreview)}
                      alt="Vista previa"
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-xs text-gray-400 px-2 text-center">Sin vista previa</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block">
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-fuchsia-400 hover:bg-fuchsia-50/40 transition">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium text-fuchsia-700">Haz clic para subir</span> o arrastra una imagen
                      </div>
                      <div className="text-xs text-gray-400 mt-1">PNG o JPG, hasta 2MB</div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e)=>{ 
                        const f=e.target.files?.[0] ?? null
                        if (f){
                          if(!f.type.startsWith('image/')) { setImageError('Archivo no es imagen'); return }
                          if (f.size> 2*1024*1024){ setImageError('Máximo 2MB'); return }
                          setImageError(null); setImageFile(f); setForm((x:any)=>({...x, photo_url:''}))
                        } else { setImageFile(null) }
                      }}
                    />
                  </label>
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50" onClick={()=>{ setImageFile(null); setForm((x:any)=>({ ...x, photo_url: '' })); setImageError(null) }}>
                      Quitar foto
                    </button>
                    {imagePreview && (
                      <a href={imagePreview.startsWith('blob:') || imagePreview.startsWith('data:') ? imagePreview : toAbsoluteUrl(imagePreview)} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50">
                        Ver grande
                      </a>
                    )}
                  </div>
                  {imageError && <div className="text-xs text-red-600 mt-2">{imageError}</div>}
                </div>
              </div>
            </div>

            <div className="md:order-1">
              <label className="block text-sm text-gray-600 mb-1">Notas</label>
              <textarea className="w-full border rounded px-3 py-2" rows={5} value={form.notes} onChange={(e)=>setForm((f:any)=>({...f, notes:e.target.value}))} />
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input id="is_active" type="checkbox" checked={form.is_active} onChange={(e)=>setForm((f:any)=>({...f, is_active:e.target.checked}))} />
              <label htmlFor="is_active" className="text-sm text-gray-700">Activo</label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-4 sm:px-6 py-3 sticky bottom-0">
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 rounded border hover:bg-gray-50" onClick={()=>{ setShowEdit(false); setEditId(null) }}>Cancelar</button>
            <button
              className="px-4 py-2 text-white rounded disabled:opacity-50 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
              disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
              onClick={async ()=>{
                if(!editId) return
                setSaving(true); setSaveError(null)
                try{
                  const payload:any = {
                    first_name: form.first_name.trim(),
                    last_name: form.last_name.trim(),
                    email: form.email || undefined,
                    phone: form.phone || undefined,
                    gender: form.gender || undefined,
                    notes: form.notes || undefined,
                    photo_url: form.photo_url || undefined,
                    joined_at: form.joined_at || undefined,
                    birthdate: form.birthdate || undefined,
                    is_active: !!form.is_active,
                  }
                  // Actualizar alumno
                  const res = await api.put(`/api/pms/students/${editId}`, payload)
                  const studentId = res.data?.id ?? editId

                  // Subir foto si corresponde
                  if (studentId && imageFile) {
                    const fd = new FormData()
                    fd.append('file', imageFile)
                    await api.post(`/api/pms/students/${studentId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                  }

                  // Importante: EN EDITAR no se crean inscripciones ni pagos
                  setShowEdit(false)
                  setEditId(null)
                  await load()
                }catch(e:any){
                  setSaveError(e?.response?.data?.detail || e?.message || 'Error al guardar')
                }finally{
                  setSaving(false)
                }
              }}
            >
              {saving? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
