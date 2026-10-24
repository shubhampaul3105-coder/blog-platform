import { useEffect, useState } from "react";
import { BookOpen, Plus, Search, MessageCircle, Pencil, Trash2, LogIn, LogOut, X, Send, UserRound, Clock } from "lucide-react";
import "./App.css";

const API = "http://localhost:5000/api";

export default function App() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("blogUser") || "null"));
  const [token, setToken] = useState(() => localStorage.getItem("blogToken") || "");
  const [query, setQuery] = useState("");
  const [authMode, setAuthMode] = useState("");
  const [auth, setAuth] = useState({ name: "", email: "", password: "" });
  const [editor, setEditor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Something went wrong");
    return data;
  }

  async function loadPosts() {
    try {
      setPosts(await request("/posts"));
    } catch {
      setNotice("Could not connect to the server. Make sure the backend is running on port 5000.");
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await request(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(auth)
      });
      if (authMode === "login") {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem("blogToken", data.token);
        localStorage.setItem("blogUser", JSON.stringify(data.user));
        setNotice("Welcome back, " + data.user.name + "!");
      } else {
        setNotice("Account created! Please log in.");
      }
      setAuthMode("");
      setAuth({ name: "", email: "", password: "" });
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("blogToken");
    localStorage.removeItem("blogUser");
    setNotice("You have logged out.");
  }

  async function savePost(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (editor.id) {
        await request(`/posts/${editor.id}`, {
          method: "PUT",
          body: JSON.stringify({ title: editor.title, content: editor.content })
        });
        setNotice("Post updated successfully.");
      } else {
        await request("/posts", {
          method: "POST",
          body: JSON.stringify({ title: editor.title, content: editor.content })
        });
        setNotice("Your blog post is published!");
      }
      setEditor(null);
      await loadPosts();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(id) {
    if (!window.confirm("Delete this blog post?")) return;
    try {
      await request(`/posts/${id}`, { method: "DELETE" });
      setSelected(null);
      setNotice("Post deleted.");
      await loadPosts();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function openPost(id) {
    try {
      setSelected(await request(`/posts/${id}`));
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function addComment(event) {
    event.preventDefault();
    try {
      await request(`/posts/${selected.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: comment })
      });
      setComment("");
      await openPost(selected.id);
      await loadPosts();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function deleteComment(id) {
    try {
      await request(`/comments/${id}`, { method: "DELETE" });
      await openPost(selected.id);
      await loadPosts();
    } catch (error) {
      setNotice(error.message);
    }
  }

  const filtered = posts.filter(post =>
    `${post.title} ${post.content} ${post.author}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setSelected(null)}>
          <span className="brand-icon"><BookOpen size={22} /></span>
          <span>Ink<span className="brand-accent">Well</span><small>THE COMMUNITY BLOG</small></span>
        </a>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="welcome"><UserRound size={17} /> {user.name}</span>
              <button className="outline-btn" onClick={logout}><LogOut size={16} /> Logout</button>
            </>
          ) : (
            <>
              <button className="text-btn" onClick={() => setAuthMode("login")}>Log in</button>
              <button className="primary-btn" onClick={() => setAuthMode("register")}>Join the community</button>
            </>
          )}
        </div>
      </header>

      <main>
        {!selected && !editor && (
          <>
            <section className="hero">
              <div className="eyebrow"><span /> IDEAS WORTH SHARING</div>
              <h1>Stories bring us<br /> <em>closer together.</em></h1>
              <p>A little corner of the internet for curious minds.<br />Read, write, and join the conversation.</p>
              <button className="primary-btn hero-btn" onClick={() => user ? setEditor({ title: "", content: "" }) : setAuthMode("login")}>
                <Plus size={18} /> Write a story
              </button>
              <div className="hero-decoration">“</div>
            </section>

            <section className="feed">
              <div className="feed-heading">
                <div><span className="section-label">THE LATEST</span><h2>Fresh from the community</h2></div>
                <label className="search-box"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search stories..." /></label>
              </div>

              {notice && <div className="notice">{notice}<button onClick={() => setNotice("")}><X size={16}/></button></div>}

              {filtered.length ? (
                <div className="post-grid">
                  {filtered.map((post, index) => (
                    <article className="post-card" key={post.id}>
                      <div className={`card-art art-${index % 4}`}><BookOpen size={30}/><span>STORY NO. {String(post.id).padStart(2, "0")}</span></div>
                      <div className="post-body">
                        <div className="post-meta"><span><UserRound size={14}/> {post.author}</span><span><Clock size={14}/> {new Date(post.created_at + " UTC").toLocaleDateString()}</span></div>
                        <h3 onClick={() => openPost(post.id)}>{post.title}</h3>
                        <p className="excerpt">{post.content}</p>
                        <div className="card-footer">
                          <button className="read-link" onClick={() => openPost(post.id)}>Read story <span>↗</span></button>
                          <button className="comment-count" onClick={() => openPost(post.id)}><MessageCircle size={16}/> {post.comment_count} comments</button>
                        </div>
                        {user?.id === post.user_id && <div className="owner-actions"><button onClick={() => setEditor({ id: post.id, title: post.title, content: post.content })}><Pencil size={15}/> Edit</button><button onClick={() => deletePost(post.id)}><Trash2 size={15}/> Delete</button></div>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="empty"><BookOpen size={35}/><h3>No stories yet</h3><p>Be the first to share an idea with the community.</p><button className="primary-btn" onClick={() => user ? setEditor({ title: "", content: "" }) : setAuthMode("register")}>Write the first story</button></div>}
            </section>
          </>
        )}

        {editor && (
          <section className="form-panel">
            <button className="back-link" onClick={() => setEditor(null)}>← Back to stories</button>
            <span className="section-label">YOUR CREATIVE SPACE</span>
            <h1>{editor.id ? "Edit your story" : "Write a new story"}</h1>
            <p className="form-intro">Every great idea starts with a few words.</p>
            <form onSubmit={savePost}>
              <label>Story title<input required maxLength={180} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} placeholder="Give your story a title..." /></label>
              <label>Your story<textarea required rows={12} value={editor.content} onChange={e => setEditor({ ...editor, content: e.target.value })} placeholder="What would you like to share with the world?" /></label>
              <button className="primary-btn publish-btn" disabled={busy}>{busy ? "Saving..." : "Publish story →"}</button>
            </form>
          </section>
        )}

        {selected && (
          <section className="article-view">
            <button className="back-link" onClick={() => setSelected(null)}>← All stories</button>
            <div className="article-heading"><span className="section-label">FROM THE COMMUNITY</span><h1>{selected.title}</h1><div className="post-meta"><span><UserRound size={15}/> {selected.author}</span><span><Clock size={15}/> {new Date(selected.created_at + " UTC").toLocaleDateString()}</span></div></div>
            <div className="article-content">{selected.content}</div>
            <div className="comments-panel"><h2><MessageCircle size={22}/> Conversation <span>({selected.comments.length})</span></h2>
              {selected.comments.map(item => <div className="comment" key={item.id}><div className="avatar">{item.author.charAt(0).toUpperCase()}</div><div className="comment-main"><strong>{item.author}</strong><small>{new Date(item.created_at + " UTC").toLocaleDateString()}</small><p>{item.content}</p></div>{user?.id === item.user_id && <button className="icon-btn" onClick={() => deleteComment(item.id)}><Trash2 size={16}/></button>}</div>)}
              {user ? <form className="comment-form" onSubmit={addComment}><textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add something thoughtful..." required/><button className="primary-btn"><Send size={16}/> Post comment</button></form> : <p className="login-prompt">Please <button className="inline-link" onClick={() => setAuthMode("login")}>log in</button> to join the conversation.</p>}
            </div>
          </section>
        )}
      </main>

      <footer><a className="brand footer-brand" href="#"><span className="brand-icon"><BookOpen size={20}/></span><span>Ink<span className="brand-accent">Well</span></span></a><p>Thoughts become stories. Stories become connections.</p><span>© 2026 InkWell Blog Platform</span></footer>

      {authMode && <div className="modal-backdrop" onClick={() => setAuthMode("")}><section className="auth-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAuthMode("")}><X size={20}/></button><span className="brand-icon modal-brand"><BookOpen size={23}/></span><span className="section-label">JOIN INKWELL</span><h2>{authMode === "login" ? "Welcome back" : "Find your voice."}</h2><p>{authMode === "login" ? "Your next favourite story awaits." : "Create an account and share your stories."}</p><form onSubmit={submitAuth}>{authMode === "register" && <label>Your name<input required value={auth.name} onChange={e => setAuth({ ...auth, name: e.target.value })} placeholder="Your name"/></label>}<label>Email address<input required type="email" value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} placeholder="you@example.com"/></label><label>Password<input required minLength={6} type="password" value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder="At least 6 characters"/></label><button className="primary-btn modal-submit" disabled={busy}>{busy ? "Please wait..." : authMode === "login" ? <><LogIn size={17}/> Log in</> : "Create account →"}</button></form><p className="switch-auth">{authMode === "login" ? "New around here?" : "Already have an account?"} <button className="inline-link" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Sign up" : "Log in"}</button></p></section></div>}
    </div>
  );
}

import './App.css';
