// frontend/script.js
const API = "http://localhost:8080/api";
const tokenKey = "sx_token";

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

const movieList = $("#movieList");
const countText = $("#countText");
const genreSelect = $("#genreSelect");
const sortSelect = $("#sortSelect");
const searchInput = $("#searchInput");
const memberLine = $("#memberLine");
const loginBtn = $("#loginBtn");
const registerBtn = $("#registerBtn");
const modal = $("#modal");
const modalBody = $("#modalBody");
const modalClose = $("#modalClose");
const trailerModal = $("#trailerModal");
const trailerFrame = $("#trailerFrame");
const closeTrailer = $("#closeTrailer");
const trailerTitle = $("#trailerTitle");
const trailerMeta = $("#trailerMeta");
const yearSpan = $("#yearSpan");
yearSpan.textContent = new Date().getFullYear();

let state = { movies: [], query: "", genre: "all", sort: "newest", favorites: new Set(), user: null };

// ---- Auth helpers ----
function saveToken(token){ localStorage.setItem(tokenKey, token); }
function getToken(){ return localStorage.getItem(tokenKey); }
function clearToken(){ localStorage.removeItem(tokenKey); }
function setUserFromToken(token){
  if(!token) return;
  try{
    // decode payload quickly (no verification) for UI; backend controls security
    const payload = JSON.parse(atob(token.split(".")[1]));
    state.user = { id: payload.id, role: payload.role, username: payload.username || payload.id };
  }catch(e){ state.user = null; }
}

// ---- Fetch movies from API ----
async function loadMovies(){
  const res = await fetch(`${API}/movies`);
  const data = await res.json();
  state.movies = data;
  populateGenres();
  render();
}

// render cards
function cardHTML(m){
  const favClass = state.favorites.has(m._id) ? "active" : "";
  return `<article class="card" data-id="${m._id}">
    <div class="thumb">${m.emoji||'🎬'}</div>
    <div class="card-body">
      <h3 class="card-title">${escapeHtml(m.title)}</h3>
      <p class="card-desc">${escapeHtml(m.description||'')}</p>
      <div class="tags">${(m.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="card-foot">
        <span class="muted">⏱ ${m.duration || '-'} • ${m.year || '-'}</span>
        <div class="actions">
          <button class="btn-watch" data-trailer="${m.trailerUrl||''}" data-title="${escapeAttr(m.title)}" data-meta="${m.year||''} • ${m.duration||''} • ⭐ ${m.rating||0}">▶ Xem</button>
          <button class="fav ${favClass}" data-fav="${m._id}">❤</button>
        </div>
      </div>
    </div>
  </article>`;
}

function render(){
  const q = (state.query||"").toLowerCase();
  const filtered = state.movies.filter(m=>{
    if(state.genre!=="all" && !(m.tags||[]).includes(state.genre)) return false;
    if(q && !((m.title||'') + ' ' + (m.tags||[]).join(' ')).toLowerCase().includes(q)) return false;
    return true;
  });
  // sort
  if(state.sort==="newest") filtered.sort((a,b)=> (b.year||0)-(a.year||0));
  if(state.sort==="rating") filtered.sort((a,b)=> (b.rating||0)-(a.rating||0));
  if(state.sort==="duration") filtered.sort((a,b)=> (b.duration||0)-(a.duration||0));
  movieList.innerHTML = filtered.map(cardHTML).join("");
  countText.textContent = `${filtered.length} tác phẩm`;
}

// populate genre select
function populateGenres(){
  const tags = new Set();
  state.movies.forEach(m => (m.tags||[]).forEach(t => tags.add(t)));
  genreSelect.innerHTML = `<option value="all">Tất cả thể loại</option>` + Array.from(tags).map(t=>`<option value="${t}">${t}</option>`).join("");
}

// escape helpers
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
function escapeAttr(s){ return (s||'').replace(/"/g,'&quot;'); }

// ---- events ----
searchInput.addEventListener("input", e => { state.query = e.target.value; render(); });
genreSelect.addEventListener("change", e => { state.genre = e.target.value; render(); });
sortSelect.addEventListener("change", e => { state.sort = e.target.value; render(); });

// click on list (watch/fav)
movieList.addEventListener("click", e=>{
  const btn = e.target.closest(".btn-watch");
  const fav = e.target.closest(".fav");
  if(btn){
    const src = btn.dataset.trailer;
    trailerTitle.textContent = btn.dataset.title;
    trailerMeta.textContent = btn.dataset.meta;
    trailerFrame.src = src + (src.includes("?") ? "&" : "?") + "autoplay=1";
    open(trailerModal);
  }
  if(fav){
    const id = fav.dataset.fav;
    if(state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    localStorage.setItem("sx_favs", JSON.stringify([...state.favorites]));
    render();
  }
});

// modals generic
function open(el){ el.classList.add("open"); el.setAttribute("aria-hidden","false"); }
function close(el){ el.classList.remove("open"); el.setAttribute("aria-hidden","true"); }
modalClose.addEventListener("click", ()=> close(modal));
closeTrailer.addEventListener("click", ()=> { trailerFrame.src=''; close(trailerModal); });

// show login form
loginBtn.addEventListener("click", ()=> {
  modalBody.innerHTML = `
    <h3>Đăng nhập</h3>
    <form id="loginForm" class="form">
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Mật khẩu" required />
      <button class="btn" type="submit">Đăng nhập</button>
    </form>`;
  open(modal);
  $("#loginForm").addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = { email: fd.get("email"), password: fd.get("password") };
    try{
      const res = await fetch(`${API}/auth/login`, { method:"POST", headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json();
      if(!res.ok) return alert(j.error || j.message || "Lỗi");
      saveToken(j.token);
      setUserFromToken(j.token);
      alert("Đăng nhập thành công!");
      close(modal);
      updateAuthUI();
    }catch(err){ alert("Lỗi mạng"); }
  });
});

// register
registerBtn.addEventListener("click", ()=>{
  modalBody.innerHTML = `
    <h3>Đăng ký</h3>
    <form id="regForm" class="form">
      <input name="username" placeholder="Tên" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Mật khẩu" required />
      <button class="btn" type="submit">Tạo tài khoản</button>
    </form>`;
  open(modal);
  $("#regForm").addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = { username: fd.get("username"), email: fd.get("email"), password: fd.get("password") };
    try{
      const res = await fetch(`${API}/auth/register`, { method:"POST", headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json();
      if(!res.ok) return alert(j.error || j.message || "Lỗi");
      alert("Đăng ký thành công. Vui lòng đăng nhập.");
      close(modal);
    }catch(err){ alert("Lỗi"); }
  });
});

// update UI after login
function updateAuthUI(){
  const token = getToken();
  if(token){
    setUserFromToken(token);
    loginBtn.textContent = state.user ? `Hi, ${state.user.username||'User'}` : "Tài khoản";
    registerBtn.textContent = "Đăng xuất";
    registerBtn.onclick = ()=> { clearToken(); location.reload(); };
    // show member-only line
    memberLine.classList.remove("hidden");
  } else {
    memberLine.classList.add("hidden");
  }
}

// init favorites + token
(function init(){
  const favs = JSON.parse(localStorage.getItem("sx_favs")||"[]");
  state.favorites = new Set(favs);
  const token = getToken();
  if(token) setUserFromToken(token);
  updateAuthUI();
  // load movies from API
  loadMovies();
})();
