import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Menu,
  MessageCircle,
  Plus,
  Rss,
  Search,
  Share2,
  Send,
  Sparkles,
  X,
} from 'lucide-react'

type Comment = { id: string; name: string; text: string; date: string }
type Post = {
  id: string
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
const legacySampleIds = new Set(['aprender-preguntas', 'notas-campo', 'tecnologia-pausa'])
const blogroll = [
  { name: 'INTEF · Recursos educativos', url: 'https://intef.es/' },
  { name: 'UNESCO · Educación', url: 'https://www.unesco.org/en/education' },
  { name: 'OCDE · Educación', url: 'https://www.oecd.org/education/' },
  { name: 'Universidad Politécnica de Madrid', url: 'https://www.upm.es/' },
]
const storageKey = 'cuaderno-blog-posts-v1'

function readPosts(): Post[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return []
    const storedPosts: unknown = JSON.parse(saved)
    return Array.isArray(storedPosts) ? (storedPosts as Post[]).filter((post) => !legacySampleIds.has(post.id)) : []
  } catch {
    return []
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function App() {
  const [posts, setPosts] = useState<Post[]>(readPosts)
  const [activePage, setActivePage] = useState<'inicio' | 'archivo' | 'acerca' | 'admin'>('inicio')
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [selectedTag, setSelectedTag] = useState('')
  const [query, setQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(() => window.location.hash.replace(/^#post-/, '') || null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [commentName, setCommentName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [notice, setNotice] = useState('')
  const [imagePreview, setImagePreview] = useState('')

  const categories = useMemo(() => [...new Set([...starterCategories, ...posts.map((post) => post.category)])], [posts])
  const tags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags))], [posts])
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null
  const visiblePosts = useMemo(() => posts
    .filter((post) => selectedCategory === 'Todas' || post.category === selectedCategory)
    .filter((post) => !selectedTag || post.tags.includes(selectedTag))
    .filter((post) => `${post.title} ${post.excerpt} ${post.content} ${post.author} ${post.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    .sort((first, second) => second.date.localeCompare(first.date)), [posts, query, selectedCategory, selectedTag])

  function savePosts(nextPosts: Post[]) {
    setPosts(nextPosts)
    localStorage.setItem(storageKey, JSON.stringify(nextPosts))
  }

  function goTo(page: typeof activePage) {
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

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPost || !commentName.trim() || !commentText.trim()) return
    const comment: Comment = { id: crypto.randomUUID(), name: commentName.trim(), text: commentText.trim(), date: 'ahora' }
    savePosts(posts.map((post) => post.id === selectedPost.id ? { ...post, comments: [...post.comments, comment] } : post))
    setCommentName('')
    setCommentText('')
    setNotice('Tu comentario ya está publicado.')
    window.setTimeout(() => setNotice(''), 3200)
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice('Selecciona un archivo de imagen válido.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setNotice('La imagen debe pesar menos de 4 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImagePreview(String(reader.result))
    reader.readAsDataURL(file)
  }

  function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const title = String(formData.get('title') ?? '').trim()
    const excerpt = String(formData.get('excerpt') ?? '').trim()
    const content = String(formData.get('content') ?? '').trim()
    const author = String(formData.get('author') ?? '').trim()
    const category = String(formData.get('category') ?? 'Pedagogía')
    const postTags = String(formData.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)
    if (!title || !excerpt || !content || !author) return
    const existing = posts.find((post) => post.id === editingPostId)
    const post: Post = {
      id: editingPostId ?? crypto.randomUUID(), title, excerpt, content, author, category, tags: postTags,
      date: existing?.date ?? new Date().toISOString().slice(0, 10),
      readTime: `${Math.max(1, Math.ceil(content.split(/\s+/).length / 180))} min de lectura`,
      image: imagePreview || existing?.image || '', comments: existing?.comments ?? [],
    }
    savePosts(editingPostId ? posts.map((item) => item.id === post.id ? post : item) : [post, ...posts])
    setEditingPostId(null)
    setImagePreview('')
    event.currentTarget.reset()
    setNotice(editingPostId ? 'La publicación se ha actualizado.' : 'La publicación ya está en el blog.')
    window.setTimeout(() => setNotice(''), 3200)
  }

  function startEditing(post: Post) {
    setEditingPostId(post.id)
    setImagePreview(post.image)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const editingPost = posts.find((post) => post.id === editingPostId)

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

        {activePage === 'admin' && <section className="admin-page">
          <div className="section-heading admin-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> ESPACIO DE EDICIÓN</span><h1>{editingPost ? 'Editar publicación' : 'Nueva publicación'}</h1><p>Escribe una idea, añade una imagen y compártela con la comunidad.</p></div><span className="admin-stamp"><Sparkles size={15} /> EDITOR</span></div>
          <form className="editor-form" onSubmit={submitPost}>
            <div className="editor-main">
              <label className="field-label">Título<input key={`title-${editingPostId ?? 'new'}`} name="title" required defaultValue={editingPost?.title ?? ''} placeholder="Ej. Medidas de protección frente al phishing" /></label>
              <label className="field-label">Extracto<textarea key={`excerpt-${editingPostId ?? 'new'}`} name="excerpt" required rows={2} defaultValue={editingPost?.excerpt ?? ''} placeholder="Resume el análisis o estrategia de ciberseguridad" /></label>
              <label className="field-label">Contenido<textarea key={`content-${editingPostId ?? 'new'}`} name="content" required rows={11} defaultValue={editingPost?.content ?? ''} placeholder="Desarrolla el tema de investigación. Separa los párrafos con una línea en blanco." /></label>
            </div>
            <aside className="editor-side">
              <label className="field-label">Autor<input key={`author-${editingPostId ?? 'new'}`} name="author" required defaultValue={editingPost?.author ?? ''} placeholder="Tu nombre" /></label>
              <label className="field-label">Categoría<span className="select-wrap"><select key={`category-${editingPostId ?? 'new'}`} name="category" defaultValue={editingPost?.category ?? starterCategories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={16} /></span></label>
              <label className="field-label">Etiquetas <small>separadas por coma</small><input key={`tags-${editingPostId ?? 'new'}`} name="tags" defaultValue={editingPost?.tags.join(', ') ?? ''} placeholder="phishing, malware, prevención" /></label>
              <div className="field-label">Imagen de portada
                <label className={`image-drop ${imagePreview ? 'has-image' : ''}`}>
                  {imagePreview ? <img src={imagePreview} alt="Vista previa de portada" /> : <><span className="upload-icon"><Plus size={18} /></span><span>Añadir imagen</span><small>JPG, PNG o WEBP · máx. 4 MB</small></>}
                  <input type="file" accept="image/*" onChange={handleImage} aria-label="Subir imagen de portada" />
                </label>
                {imagePreview && <button type="button" className="remove-image" onClick={() => setImagePreview('')}>Quitar imagen</button>}
              </div>
              <div className="editor-actions"><button type="submit" className="button-primary"><Check size={16} /> {editingPost ? 'Guardar cambios' : 'Publicar entrada'}</button>{editingPost && <button type="button" className="button-quiet" onClick={() => { setEditingPostId(null); setImagePreview('') }}>Cancelar</button>}</div>
            </aside>
          </form>
          <div className="manage-posts"><div className="manage-heading"><h2>Tus publicaciones</h2><span>{posts.length} entradas</span></div>{posts.map((post) => <div className="manage-row" key={post.id}><div><span>{post.category} · {formatDate(post.date)}</span><strong>{post.title}</strong></div><button onClick={() => startEditing(post)}>Editar</button></div>)}</div>
        </section>}

        {(activePage === 'inicio' || activePage === 'archivo') && !selectedPost && <div className="content-layout">
          <section className="post-feed">
            <div className="section-heading feed-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> {activePage === 'archivo' ? 'INVESTIGACIÓN EN CIBERSEGURIDAD' : 'ANÁLISIS Y PUBLICACIONES'}</span><h2>{activePage === 'archivo' ? 'Archivo de investigación' : 'Publicaciones'}</h2></div><span className="entry-count">{visiblePosts.length.toString().padStart(2, '0')} <small>ENTRADAS</small></span></div>
            {(activePage === 'archivo' || query) && <div className="filter-bar"><label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el cuaderno" aria-label="Buscar publicaciones" />{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label>{activePage === 'archivo' && <label className="filter-select"><select value={selectedCategory} onChange={(event) => { setSelectedCategory(event.target.value); setSelectedTag('') }} aria-label="Filtrar por categoría"><option>Todas</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={15} /></label>}</div>}
            {selectedTag && <div className="active-filter">Etiqueta: <strong>{selectedTag}</strong><button onClick={() => setSelectedTag('')} aria-label="Quitar filtro"><X size={14} /></button></div>}
            {visiblePosts.length > 0 ? <div className="post-list">{visiblePosts.map((post, index) => <article className={`post-card ${index === 0 && activePage === 'inicio' ? 'featured-post' : ''}`} key={post.id}>
              <button className={`post-image ${post.image ? '' : 'image-placeholder'}`} onClick={() => openPost(post.id)} aria-label={`Leer ${post.title}`} style={post.image ? { backgroundImage: `url("${post.image}")` } : undefined}><span className="image-index">{String(index + 1).padStart(2, '0')}</span><span className="image-open"><ArrowRight size={19} /></span></button>
              <div className="post-details"><div className="post-meta"><button onClick={() => selectCategory(post.category)}>{post.category}</button><span>·</span><time dateTime={post.date}>{formatDate(post.date)}</time></div><button className="post-title-button" onClick={() => openPost(post.id)}><h3>{post.title}</h3></button><p className="post-excerpt">{post.excerpt}</p><div className="post-footer"><span className="author-name"><span className="author-avatar">{post.author.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span> {post.author}</span><span className="read-time"><Clock3 size={13} /> {post.readTime}</span><button className="comment-count" onClick={() => openPost(post.id)} aria-label={`${post.comments.length} comentarios`}><MessageCircle size={14} /> {post.comments.length}</button></div><div className="post-tags">{post.tags.map((tag) => <button key={tag} onClick={() => selectTag(tag)}>#{tag}</button>)}</div></div>
            </article>)}</div> : posts.length === 0 ? <div className="empty-state"><BookOpen size={22} /><h3>Aún no hay publicaciones</h3><p>Este espacio está preparado para sus análisis sobre ciberseguridad. Publiquen la primera entrada cuando quieran.</p><button onClick={() => goTo('admin')}>Crear primera publicación</button></div> : <div className="empty-state"><Search size={22} /><h3>No encontramos publicaciones</h3><p>Prueba con otra búsqueda o cambia los filtros.</p><button onClick={() => { setQuery(''); setSelectedCategory('Todas'); setSelectedTag('') }}>Limpiar filtros</button></div>}
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
            {selectedPost.comments.length ? <div className="comment-list">{selectedPost.comments.map((comment) => <div className="comment" key={comment.id}><span className="comment-avatar">{comment.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><div className="comment-meta"><strong>{comment.name}</strong><span>{comment.date}</span></div><p>{comment.text}</p></div></div>)}</div> : <p className="no-comments">Todavía no hay comentarios. Puedes abrir la conversación.</p>}
            <form className="comment-form" onSubmit={submitComment}><label>Tu nombre<input value={commentName} onChange={(event) => setCommentName(event.target.value)} placeholder="¿Cómo te llamas?" required /></label><label>Tu comentario<textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Comparte una idea o pregunta…" rows={3} required /></label><button className="button-primary" type="submit"><Send size={15} /> Publicar comentario</button></form>
          </section>
        </article>}
      </main>

      <footer className="site-footer"><div className="footer-top"><a className="brand footer-brand" href="#inicio" onClick={(event) => { event.preventDefault(); goTo('inicio') }}><span className="brand-mark"><BookOpen size={19} strokeWidth={1.7} /></span><span className="brand-copy"><strong>cuaderno</strong><small>IDEAS QUE HACEN ESCUELA</small></span></a><p>Un espacio colectivo para<br />seguir pensando la educación.</p><button className="footer-publish" onClick={() => goTo('admin')}>Comparte una idea <ArrowRight size={16} /></button></div><div className="footer-bottom"><span>© 2026 CUADERNO ACADÉMICO</span><span>HECHO PARA LEER, PENSAR Y CONVERSAR</span><button onClick={() => goTo('acerca')}>El proyecto</button></div></footer>
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={15} /></button></div>}
    </div>
  )
}

export default App