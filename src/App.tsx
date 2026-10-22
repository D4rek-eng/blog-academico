import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Rss,
  Search,
  Share2,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { allowedDomain, supabase } from './supabase'

type Comment = { id: string; userId: string; name: string; text: string; date: string }
type Post = {
  id: string
  userId: string
  title: string
  excerpt: string
  content: string
  author: string
  category: string
  tags: string[]
  date: string
  readTime: string
  image: string
  comments: Comment[]
}

const starterCategories = ['Amenazas informáticas', 'Vulnerabilidades', 'Estrategias de protección', 'Prevención y respuesta']
const blogroll = [
  { name: 'INTEF · Recursos educativos', url: 'https://intef.es/' },
  { name: 'UNESCO · Educación', url: 'https://www.unesco.org/en/education' },
  { name: 'OCDE · Educación', url: 'https://www.oecd.org/education/' },
  { name: 'Universidad Politécnica de Madrid', url: 'https://www.upm.es/' },
]
const BUCKET = 'evidencias'
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']

type CommentRow = { id: string; user_id: string; nombre: string; contenido: string; created_at: string }
type PostRow = {
  id: string; user_id: string; titulo: string; extracto: string; contenido: string; autor: string
  categoria: string; etiquetas: string[] | null; portada_url: string | null; created_at: string
  comments: CommentRow[] | null
}

function toPost(row: PostRow): Post {
  const comments = [...(row.comments ?? [])]
    .sort((first, second) => first.created_at.localeCompare(second.created_at))
    .map((comment) => ({ id: comment.id, userId: comment.user_id, name: comment.nombre, text: comment.contenido, date: comment.created_at.slice(0, 10) }))
  return {
    id: row.id, userId: row.user_id, title: row.titulo, excerpt: row.extracto, content: row.contenido, author: row.autor,
    category: row.categoria, tags: row.etiquetas ?? [], date: row.created_at.slice(0, 10),
    readTime: `${Math.max(1, Math.ceil(row.contenido.split(/\s+/).length / 180))} min de lectura`,
    image: row.portada_url ?? '', comments,
  }
}

function authMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.'
  if (/already registered/i.test(message)) return 'Ese correo ya tiene una cuenta. Inicia sesión.'
  if (/password should be at least/i.test(message)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/rate limit/i.test(message)) return 'Demasiados intentos. Espera unos minutos.'
  if (/database error/i.test(message)) return 'Este correo no está autorizado para registrarse.'
  return 'No se pudo completar la acción. Inténtalo de nuevo.'
}

async function removeImage(url: string) {
  const marker = `/${BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(index + marker.length))])
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function App() {
  const [posts, setPosts] = useState<Post[]>([])
  const [activePage, setActivePage] = useState<'inicio' | 'archivo' | 'acerca' | 'admin' | 'acceso'>('inicio')
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [selectedTag, setSelectedTag] = useState('')
  const [query, setQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(() => window.location.hash.replace(/^#post-/, '') || null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [notice, setNotice] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authMode, setAuthMode] = useState<'entrar' | 'registro'>('entrar')
  const [authBusy, setAuthBusy] = useState(false)
  const displayName = String(session?.user.user_metadata?.nombre ?? session?.user.email?.split('@')[0] ?? '')

  const categories = useMemo(() => [...new Set([...starterCategories, ...posts.map((post) => post.category)])], [posts])
  const tags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags))], [posts])
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null
  const visiblePosts = useMemo(() => posts
    .filter((post) => selectedCategory === 'Todas' || post.category === selectedCategory)
    .filter((post) => !selectedTag || post.tags.includes(selectedTag))
    .filter((post) => `${post.title} ${post.excerpt} ${post.content} ${post.author} ${post.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    .sort((first, second) => second.date.localeCompare(first.date)), [posts, query, selectedCategory, selectedTag])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

  async function loadPosts() {
    const { data, error } = await supabase.from('posts').select('*, comments(*)').order('created_at', { ascending: false })
    if (error) flash('No se pudieron cargar las publicaciones.')
    else setPosts(((data ?? []) as PostRow[]).map(toPost))
    setLoadingPosts(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    loadPosts()
    return () => listener.subscription.unsubscribe()
  }, [])

  function goTo(requested: typeof activePage) {
    const page = requested === 'admin' && !session ? 'acceso' : requested
    setActivePage(page)
    setMobileMenuOpen(false)
    setSelectedPostId(null)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openPost(postId: string) {
    setSelectedPostId(postId)
    window.history.replaceState(null, '', `#post-${postId}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function closePost() {
    setSelectedPostId(null)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }

  function downloadFeed() {
    const escapeXml = (value: string) => value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character)
    const items = posts.map((post) => `<item><title>${escapeXml(post.title)}</title><description>${escapeXml(post.excerpt)}</description><author>${escapeXml(post.author)}</author><category>${escapeXml(post.category)}</category><pubDate>${new Date(`${post.date}T12:00:00`).toUTCString()}</pubDate><guid>${window.location.origin}/#post-${post.id}</guid></item>`).join('')
    const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Cuaderno | Ideas que hacen escuela</title><description>Lecturas de educación, investigación y pensamiento.</description><link>${window.location.origin}</link>${items}</channel></rss>`
    const url = URL.createObjectURL(new Blob([feed], { type: 'application/rss+xml;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'cuaderno-feed.xml'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copyPermalink(post: Post) {
    const permalink = `${window.location.origin}${window.location.pathname}#post-${post.id}`
    try {
      await navigator.clipboard.writeText(permalink)
      setNotice('Enlace permanente copiado.')
    } catch {
      setNotice(permalink)
    }
    window.setTimeout(() => setNotice(''), 3200)
  }

  function selectCategory(category: string) {
    setSelectedCategory(category)
    setSelectedTag('')
    setSelectedPostId(null)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setActivePage('archivo')
  }

  function selectTag(tag: string) {
    setSelectedTag(tag)
    setSelectedCategory('Todas')
    setSelectedPostId(null)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setActivePage('archivo')
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPost || !session || !commentText.trim()) return
    const { error } = await supabase.from('comments').insert({ post_id: selectedPost.id, nombre: displayName, contenido: commentText.trim() })
    if (error) return flash('No se pudo publicar el comentario.')
    setCommentText('')
    await loadPosts()
    flash('Tu comentario ya está publicado.')
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) return flash('No se pudo eliminar el comentario.')
    await loadPosts()
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!allowedImageTypes.includes(file.type)) {
      setNotice('Usa una imagen JPG, PNG o WEBP.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setNotice('La imagen debe pesar menos de 4 MB.')
      return
    }
    const reader = new FileReader()
    setImageFile(file)
    reader.onload = () => setImagePreview(String(reader.result))
    reader.readAsDataURL(file)
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || saving) return
    const form = event.currentTarget
    const formData = new FormData(form)
    const title = String(formData.get('title') ?? '').trim()
    const excerpt = String(formData.get('excerpt') ?? '').trim()
    const content = String(formData.get('content') ?? '').trim()
    const author = String(formData.get('author') ?? '').trim()
    const category = String(formData.get('category') ?? starterCategories[0])
    const postTags = String(formData.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)
    if (!title || !excerpt || !content || !author) return
    const existing = posts.find((post) => post.id === editingPostId)
    setSaving(true)
    try {
      let coverUrl: string | null = imagePreview ? existing?.image || null : null
      if (imageFile) {
        const extension = imageFile.type === 'image/png' ? 'png' : imageFile.type === 'image/webp' ? 'webp' : 'jpg'
        const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, imageFile, { contentType: imageFile.type })
        if (uploadError) throw uploadError
        coverUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      }
      const payload = { titulo: title, extracto: excerpt, contenido: content, autor: author, categoria: category, etiquetas: postTags, portada_url: coverUrl }
      const { error } = editingPostId
        ? await supabase.from('posts').update(payload).eq('id', editingPostId)
        : await supabase.from('posts').insert(payload)
      if (error) throw error
      if (existing?.image && existing.image !== coverUrl) await removeImage(existing.image)
      await loadPosts()
      form.reset()
      setImagePreview('')
      setImageFile(null)
      flash(editingPostId ? 'La publicación se ha actualizado.' : 'La publicación ya está en el blog.')
      setEditingPostId(null)
    } catch {
      flash('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function startEditing(post: Post) {
    setEditingPostId(post.id)
    setImagePreview(post.image)
    setImageFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deletePost(post: Post) {
    if (!window.confirm(`¿Eliminar "${post.title}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) return flash('No se pudo eliminar la publicación.')
    if (post.image) await removeImage(post.image)
    if (editingPostId === post.id) { setEditingPostId(null); setImagePreview(''); setImageFile(null) }
    await loadPosts()
    flash('Publicación eliminada.')
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (authBusy) return
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const nombre = String(formData.get('nombre') ?? '').trim()
    if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) return flash(`Usa tu correo institucional (@${allowedDomain}).`)
    setAuthBusy(true)
    try {
      if (authMode === 'registro') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre } } })
        if (error) throw error
        if (!data.session) { flash('Cuenta creada. Revisa tu correo para confirmarla.'); return }
        flash('Cuenta creada. ¡Bienvenido!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        flash('Sesión iniciada.')
      }
      goTo('inicio')
    } catch (error) {
      flash(authMessage(error instanceof Error ? error.message : ''))
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setEditingPostId(null)
    setImagePreview('')
    setImageFile(null)
    goTo('inicio')
    flash('Sesión cerrada.')
  }

  const editingPost = posts.find((post) => post.id === editingPostId)
  const myPosts = posts.filter((post) => post.userId === session?.user.id)

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); goTo('inicio') }} aria-label="Cuaderno, inicio">
          <span className="brand-mark"><BookOpen size={20} strokeWidth={1.7} /></span>
          <span className="brand-copy"><strong>cuaderno</strong><small>IDEAS QUE HACEN ESCUELA</small></span>
        </a>
        <button className="mobile-menu-button icon-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}>
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={`primary-nav ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Navegación principal">
          {(['inicio', 'archivo', 'acerca'] as const).map((page) => (
            <button key={page} className={activePage === page ? 'nav-link active' : 'nav-link'} onClick={() => goTo(page)}>
              {page === 'inicio' ? 'Inicio' : page === 'archivo' ? 'Archivo' : 'El proyecto'}
            </button>
          ))}
          <button className="nav-admin" onClick={() => goTo('admin')}><Plus size={15} /> Publicar</button>
          {session
            ? <button className="nav-link" onClick={signOut}><LogOut size={15} /> Salir</button>
            : <button className={activePage === 'acceso' ? 'nav-link active' : 'nav-link'} onClick={() => goTo('acceso')}><LogIn size={15} /> Entrar</button>}
        </nav>
      </header>

      <main>
        {activePage === 'inicio' && !selectedPost && <>
          <section className="intro-band">
            <div className="intro-copy">
              <span className="eyebrow"><span className="eyebrow-line" /> INVESTIGACIÓN ACADÉMICA · CIBERSEGURIDAD</span>
              <h1>Protección para<br /><em>sistemas digitales.</em></h1>
              <p>Análisis de amenazas y estrategias para fortalecer la ciberseguridad en los sistemas informáticos.</p>
              <button className="text-link" onClick={() => goTo('acerca')}>Conocer la investigación <ArrowRight size={16} /></button>
            </div>
            <div className="intro-art" aria-label="Ilustración abstracta de una libreta abierta">
              <div className="art-sun" />
              <div className="art-paper"><span /><span /><span /><span /><span /><span /></div>
              <div className="art-pencil" />
              <span className="art-note">NOTAS PARA<br />SEGUIR PENSANDO</span>
              <ArrowDownRight className="art-arrow" size={38} strokeWidth={1.2} />
            </div>
          </section>
          <div className="issue-strip"><span>PIURA · 2026</span><span>·</span><span>ODS 9</span><span>·</span><span>AMENAZAS, PREVENCIÓN Y PROTECCIÓN DE SISTEMAS INFORMÁTICOS</span></div>
        </>}

        {activePage === 'acerca' && <section className="about-page">
          <span className="eyebrow"><span className="eyebrow-line" /> QUIÉNES SOMOS</span>
          <h1>Un espacio para<br /><em>pensar en voz alta.</em></h1>
          <p>Este blog acompaña la investigación “Análisis de las amenazas y estrategias de protección de la ciberseguridad en los sistemas informáticos”, realizada en Piura en 2026. Aquí se publicarán análisis sobre amenazas, vulnerabilidades, medidas de protección y seguridad de la información, en relación con el ODS 9.</p>
          <div className="about-values"><div><span>01</span><h3>Amenazas</h3><p>Malware, phishing y accesos no autorizados.</p></div><div><span>02</span><h3>Protección</h3><p>Controles, autenticación y copias de seguridad.</p></div><div><span>03</span><h3>Resiliencia</h3><p>Prevención, detección, respuesta y recuperación.</p></div></div>
        </section>}

        {activePage === 'acceso' && <section className="admin-page">
          <div className="section-heading admin-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> ACCESO</span><h1>{authMode === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}</h1><p>{allowedDomain ? `Usa tu correo institucional (@${allowedDomain}).` : 'Usa tu correo institucional.'} Crea una contraseña propia para este blog; no uses la de la universidad.</p></div></div>
          <form className="comment-form" style={{ maxWidth: 440 }} onSubmit={submitAuth}>
            {authMode === 'registro' && <label>Nombre completo<input name="nombre" required placeholder="Tu nombre y apellido" autoComplete="name" /></label>}
            <label>Correo institucional<input name="email" type="email" required placeholder={allowedDomain ? `usuario@${allowedDomain}` : 'usuario@universidad.edu'} autoComplete="email" /></label>
            <label>Contraseña<input name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" autoComplete={authMode === 'entrar' ? 'current-password' : 'new-password'} /></label>
            <button className="button-primary" type="submit" disabled={authBusy}><LogIn size={15} /> {authBusy ? 'Un momento…' : authMode === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>
            <button className="button-quiet" type="button" onClick={() => setAuthMode(authMode === 'entrar' ? 'registro' : 'entrar')}>{authMode === 'entrar' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</button>
          </form>
        </section>}

        {activePage === 'admin' && session && <section className="admin-page">
          <div className="section-heading admin-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> ESPACIO DE EDICIÓN</span><h1>{editingPost ? 'Editar publicación' : 'Nueva publicación'}</h1><p>Escribe una idea, añade una imagen y compártela con la comunidad.</p></div><span className="admin-stamp"><Sparkles size={15} /> EDITOR</span></div>
          <form className="editor-form" onSubmit={submitPost}>
            <div className="editor-main">
              <label className="field-label">Título<input key={`title-${editingPostId ?? 'new'}`} name="title" required defaultValue={editingPost?.title ?? ''} placeholder="Ej. Medidas de protección frente al phishing" /></label>
              <label className="field-label">Extracto<textarea key={`excerpt-${editingPostId ?? 'new'}`} name="excerpt" required rows={2} defaultValue={editingPost?.excerpt ?? ''} placeholder="Resume el análisis o estrategia de ciberseguridad" /></label>
              <label className="field-label">Contenido<textarea key={`content-${editingPostId ?? 'new'}`} name="content" required rows={11} defaultValue={editingPost?.content ?? ''} placeholder="Desarrolla el tema de investigación. Separa los párrafos con una línea en blanco." /></label>
            </div>
            <aside className="editor-side">
              <label className="field-label">Autor<input key={`author-${editingPostId ?? 'new'}`} name="author" required defaultValue={editingPost?.author ?? displayName} placeholder="Tu nombre" /></label>
              <label className="field-label">Categoría<span className="select-wrap"><select key={`category-${editingPostId ?? 'new'}`} name="category" defaultValue={editingPost?.category ?? starterCategories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={16} /></span></label>
              <label className="field-label">Etiquetas <small>separadas por coma</small><input key={`tags-${editingPostId ?? 'new'}`} name="tags" defaultValue={editingPost?.tags.join(', ') ?? ''} placeholder="phishing, malware, prevención" /></label>
              <div className="field-label">Imagen de portada
                <label className={`image-drop ${imagePreview ? 'has-image' : ''}`}>
                  {imagePreview ? <img src={imagePreview} alt="Vista previa de portada" /> : <><span className="upload-icon"><Plus size={18} /></span><span>Añadir imagen</span><small>JPG, PNG o WEBP · máx. 4 MB</small></>}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} aria-label="Subir imagen de portada" />
                </label>
                {imagePreview && <button type="button" className="remove-image" onClick={() => { setImagePreview(''); setImageFile(null) }}>Quitar imagen</button>}
              </div>
              <div className="editor-actions"><button type="submit" className="button-primary" disabled={saving}><Check size={16} /> {saving ? 'Guardando…' : editingPost ? 'Guardar cambios' : 'Publicar entrada'}</button>{editingPost && <button type="button" className="button-quiet" onClick={() => { setEditingPostId(null); setImagePreview(''); setImageFile(null) }}>Cancelar</button>}</div>
            </aside>
          </form>
          <div className="manage-posts"><div className="manage-heading"><h2>Tus publicaciones</h2><span>{myPosts.length} entradas</span></div>{myPosts.map((post) => <div className="manage-row" key={post.id}><div><span>{post.category} · {formatDate(post.date)}</span><strong>{post.title}</strong></div><div style={{ display: 'flex', gap: 8 }}><button onClick={() => startEditing(post)}>Editar</button><button onClick={() => deletePost(post)}>Eliminar</button></div></div>)}</div>
        </section>}

        {(activePage === 'inicio' || activePage === 'archivo') && !selectedPost && <div className="content-layout">
          <section className="post-feed">
            <div className="section-heading feed-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> {activePage === 'archivo' ? 'INVESTIGACIÓN EN CIBERSEGURIDAD' : 'ANÁLISIS Y PUBLICACIONES'}</span><h2>{activePage === 'archivo' ? 'Archivo de investigación' : 'Publicaciones'}</h2></div><span className="entry-count">{visiblePosts.length.toString().padStart(2, '0')} <small>ENTRADAS</small></span></div>
            {(activePage === 'archivo' || query) && <div className="filter-bar"><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el cuaderno" aria-label="Buscar publicaciones" />{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label>{activePage === 'archivo' && <label className="filter-select"><select value={selectedCategory} onChange={(event) => { setSelectedCategory(event.target.value); setSelectedTag('') }} aria-label="Filtrar por categoría"><option>Todas</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={15} /></label>}</div>}
            {selectedTag && <div className="active-filter">Etiqueta: <strong>{selectedTag}</strong><button onClick={() => setSelectedTag('')} aria-label="Quitar filtro"><X size={14} /></button></div>}
            {visiblePosts.length > 0 ? <div className="post-list">{visiblePosts.map((post, index) => <article className={`post-card ${index === 0 && activePage === 'inicio' ? 'featured-post' : ''}`} key={post.id}>
              <button className={`post-image ${post.image ? '' : 'image-placeholder'}`} onClick={() => openPost(post.id)} aria-label={`Leer ${post.title}`} style={post.image ? { backgroundImage: `url("${post.image}")` } : undefined}><span className="image-index">{String(index + 1).padStart(2, '0')}</span><span className="image-open"><ArrowRight size={19} /></span></button>
              <div className="post-details"><div className="post-meta"><button onClick={() => selectCategory(post.category)}>{post.category}</button><span>·</span><time dateTime={post.date}>{formatDate(post.date)}</time></div><button className="post-title-button" onClick={() => openPost(post.id)}><h3>{post.title}</h3></button><p className="post-excerpt">{post.excerpt}</p><div className="post-footer"><span className="author-name"><span className="author-avatar">{post.author.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span> {post.author}</span><span className="read-time"><Clock3 size={13} /> {post.readTime}</span><button className="comment-count" onClick={() => openPost(post.id)} aria-label={`${post.comments.length} comentarios`}><MessageCircle size={14} /> {post.comments.length}</button></div><div className="post-tags">{post.tags.map((tag) => <button key={tag} onClick={() => selectTag(tag)}>#{tag}</button>)}</div></div>
            </article>)}</div> : loadingPosts ? <div className="empty-state"><BookOpen size={22} /><h3>Cargando publicaciones…</h3></div> : posts.length === 0 ? <div className="empty-state"><BookOpen size={22} /><h3>Aún no hay publicaciones</h3><p>Este espacio está preparado para sus análisis sobre ciberseguridad. Publiquen la primera entrada cuando quieran.</p><button onClick={() => goTo('admin')}>Crear primera publicación</button></div> : <div className="empty-state"><Search size={22} /><h3>No encontramos publicaciones</h3><p>Prueba con otra búsqueda o cambia los filtros.</p><button onClick={() => { setQuery(''); setSelectedCategory('Todas'); setSelectedTag('') }}>Limpiar filtros</button></div>}
            {posts.length > 0 && <button className="load-more" onClick={() => goTo('archivo')}>Ver el archivo completo <ArrowRight size={16} /></button>}
          </section>

          <aside className="sidebar">
            <section className="sidebar-block newsletter-block"><span className="sidebar-kicker">TEMA DE INVESTIGACIÓN</span><h3>Seguridad para<br /><em>el entorno digital.</em></h3><p>Análisis de amenazas y medidas para proteger datos, redes y sistemas informáticos.</p><button className="rss-link" onClick={downloadFeed}><Rss size={13} /> Descargar feed RSS</button></section>
            <section className="sidebar-block"><div className="sidebar-title"><h3>Líneas temáticas</h3><span>01</span></div><div className="category-list"><button className={selectedCategory === 'Todas' ? 'category-link selected' : 'category-link'} onClick={() => selectCategory('Todas')}><span>Todas las publicaciones</span><span>{posts.length}</span></button>{categories.map((category) => <button className={selectedCategory === category ? 'category-link selected' : 'category-link'} key={category} onClick={() => selectCategory(category)}><span>{category}</span><span>{String(posts.filter((post) => post.category === category).length).padStart(2, '0')}</span></button>)}</div></section>
            <section className="sidebar-block tag-block"><div className="sidebar-title"><h3>Etiquetas</h3><span>02</span></div><div className="tag-cloud">{tags.map((tag) => <button key={tag} className={selectedTag === tag ? 'tag-chip active' : 'tag-chip'} onClick={() => selectTag(tag)}>{tag}</button>)}</div></section>
            <section className="sidebar-block blogroll-block"><div className="sidebar-title"><h3>Enlaces recomendados</h3><span>03</span></div>{blogroll.map((link, index) => <a className="blogroll-link" key={link.url} href={link.url} target="_blank" rel="noreferrer"><span><small>0{index + 1}</small>{link.name}</span><ArrowRight size={14} /></a>)}</section>
            <div className="sidebar-quote"><span>“</span><p>La seguridad digital se construye con prevención, revisión y mejora continua.</p><small>— INVESTIGACIÓN · ODS 9</small></div>
          </aside>
        </div>}

        {selectedPost && <article className="article-page">
          <button className="back-link" onClick={closePost}><ArrowRight size={15} /> Volver a las publicaciones</button>
          <div className="article-header"><div className="post-meta"><button onClick={() => selectCategory(selectedPost.category)}>{selectedPost.category}</button><span>·</span><time dateTime={selectedPost.date}>{formatDate(selectedPost.date)}</time></div><h1>{selectedPost.title}</h1><p>{selectedPost.excerpt}</p><div className="post-footer article-byline"><span className="author-name"><span className="author-avatar">{selectedPost.author.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span> Por {selectedPost.author}</span><span className="read-time"><Clock3 size={13} /> {selectedPost.readTime}</span><button className="permalink-button" onClick={() => copyPermalink(selectedPost)} aria-label="Copiar enlace permanente"><Share2 size={14} /> Enlace permanente</button></div></div>
          {selectedPost.image && <img className="article-cover" src={selectedPost.image} alt={`Imagen para ${selectedPost.title}`} />}
          <div className="article-body">{selectedPost.content.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}<div className="article-tags">{selectedPost.tags.map((tag) => <button key={tag} onClick={() => { setSelectedPostId(null); selectTag(tag) }}>#{tag}</button>)}</div></div>
          <section className="comments-section"><div className="comments-title"><div><span className="eyebrow"><span className="eyebrow-line" /> CONVERSACIÓN</span><h2>Comentarios <span>{selectedPost.comments.length.toString().padStart(2, '0')}</span></h2></div><MessageCircle size={22} strokeWidth={1.4} /></div>
            {selectedPost.comments.length ? <div className="comment-list">{selectedPost.comments.map((comment) => <div className="comment" key={comment.id}><span className="comment-avatar">{comment.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><div className="comment-meta"><strong>{comment.name}</strong><span>{formatDate(comment.date)}</span>{comment.userId === session?.user.id && <button className="remove-image" onClick={() => deleteComment(comment.id)} aria-label="Eliminar comentario"><Trash2 size={13} /></button>}</div><p>{comment.text}</p></div></div>)}</div> : <p className="no-comments">Todavía no hay comentarios. Puedes abrir la conversación.</p>}
            {session
              ? <form className="comment-form" onSubmit={submitComment}><label>Tu comentario<textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Comparte una idea o pregunta…" rows={3} maxLength={1000} required /></label><button className="button-primary" type="submit"><Send size={15} /> Publicar comentario</button></form>
              : <div className="comment-form"><p className="no-comments">Inicia sesión con tu correo institucional para comentar.</p><button className="button-primary" type="button" onClick={() => goTo('acceso')}><LogIn size={15} /> Iniciar sesión</button></div>}
          </section>
        </article>}
      </main>

      <footer className="site-footer"><div className="footer-top"><a className="brand footer-brand" href="#inicio" onClick={(event) => { event.preventDefault(); goTo('inicio') }}><span className="brand-mark"><BookOpen size={19} strokeWidth={1.7} /></span><span className="brand-copy"><strong>cuaderno</strong><small>IDEAS QUE HACEN ESCUELA</small></span></a><p>Un espacio colectivo para<br />seguir pensando la educación.</p><button className="footer-publish" onClick={() => goTo('admin')}>Comparte una idea <ArrowRight size={16} /></button></div><div className="footer-bottom"><span>© 2026 CUADERNO ACADÉMICO</span><span>HECHO PARA LEER, PENSAR Y CONVERSAR</span><button onClick={() => goTo('acerca')}>El proyecto</button></div></footer>
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={15} /></button></div>}
    </div>
  )
}

export default App