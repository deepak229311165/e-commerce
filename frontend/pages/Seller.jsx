import { useEffect, useMemo, useState } from "react";
import { api } from "../src/api.js";
import { useAuth } from "../src/AuthContext.jsx";
import { moneyExact } from "../money.js";

const CATEGORIES = ["Electronics", "Fashion", "Home"];
const EMPTY = {
  name: "",
  category: "Electronics",
  price: "",
  old_price: "",
  stock: "",
  image: "",
  badge: "",
  description: "",
};

/* ---------- sign in / register as a seller ---------- */
function SellerAuth() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password, "seller");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Seller Center</p>
        <h2>{mode === "login" ? "Sign in to your shop" : "Start selling on ShopSphere"}</h2>
        <p className="muted">
          {mode === "login"
            ? "Manage your listings and inventory."
            : "Create a seller account and list your first product in minutes."}
        </p>
        {mode === "register" && (
          <label>
            Shop / your name
            <input required value={form.name} onChange={set("name")} />
          </label>
        )}
        <label>
          Email
          <input type="email" required value={form.email} onChange={set("email")} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            maxLength={72}
            value={form.password}
            onChange={set("password")}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create seller account"}
        </button>
        <p className="switch">
          {mode === "login" ? "New seller?" : "Already selling?"}{" "}
          <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}

/* ---------- the seller page ---------- */
export default function Seller() {
  const { user, logout } = useAuth();
  const isSeller = user?.role === "seller";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isSeller) return;
    setLoading(true);
    api
      .sellerProducts()
      .then(setItems)
      .catch((e) => {
        if (e.status === 401) logout();
        else setError(e.message);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSeller]);

  const stats = useMemo(
    () => ({
      listings: items.length,
      units: items.reduce((n, p) => n + p.stock, 0),
      value: items.reduce((n, p) => n + p.price * p.stock, 0),
    }),
    [items]
  );

  if (!user) return <SellerAuth />;

  if (!isSeller) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h2>This is a buyer account</h2>
          <p className="muted">
            You're signed in as {user.email}. Sign out, then create a seller account to list
            products.
          </p>
          <button className="btn btn-primary btn-block" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2500);
  };

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price),
      old_price: form.old_price === "" ? null : Number(form.old_price),
      stock: Number(form.stock || 0),
      image: form.image.trim(),
      badge: form.badge.trim() || null,
      description: form.description.trim(),
    };
    setBusy(true);
    try {
      if (editingId) {
        const saved = await api.updateProduct(editingId, payload);
        setItems((list) => list.map((p) => (p.id === editingId ? saved : p)));
        flash("Product updated");
      } else {
        const saved = await api.createProduct(payload);
        setItems((list) => [saved, ...list]);
        flash("Product listed");
      }
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setError("");
    setForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      old_price: p.old_price ?? "",
      stock: String(p.stock),
      image: p.image,
      badge: p.badge ?? "",
      description: p.description ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try {
      await api.deleteProduct(p.id);
      setItems((list) => list.filter((x) => x.id !== p.id));
      if (editingId === p.id) reset();
      flash("Product deleted");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container dash">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Seller Center</p>
          <h1 className="dash-title">Hello, {user.name.split(" ")[0]}</h1>
          <p className="muted">List new products and keep your inventory up to date.</p>
        </div>
      </div>

      <div className="stat-grid three">
        <div className="stat">
          <span className="muted small">Active listings</span>
          <b>{stats.listings}</b>
        </div>
        <div className="stat">
          <span className="muted small">Units in stock</span>
          <b>{stats.units}</b>
        </div>
        <div className="stat">
          <span className="muted small">Inventory value</span>
          <b>{moneyExact(stats.value)}</b>
        </div>
      </div>

      <div className="seller-grid">
        {/* ----- add / edit form ----- */}
        <form className="panel seller-form" onSubmit={submit}>
          <h3>{editingId ? "Edit product" : "Add a product"}</h3>

          <label className="field">
            Product name
            <input required minLength={2} maxLength={120} value={form.name} onChange={set("name")} />
          </label>

          <label className="field">
            Category
            <select value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <div className="field-row">
            <label className="field">
              Price (₹)
              <input required type="number" min="0.01" step="0.01" value={form.price} onChange={set("price")} />
            </label>
            <label className="field">
              Old price (₹)
              <input type="number" min="0.01" step="0.01" placeholder="optional" value={form.old_price} onChange={set("old_price")} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              Stock
              <input required type="number" min="0" step="1" value={form.stock} onChange={set("stock")} />
            </label>
            <label className="field">
              Badge
              <input maxLength={20} placeholder="e.g. New" value={form.badge} onChange={set("badge")} />
            </label>
          </div>

          <label className="field">
            Image URL
            <input type="url" placeholder="https://…" value={form.image} onChange={set("image")} />
          </label>

          <label className="field">
            Description
            <textarea rows={3} maxLength={2000} value={form.description} onChange={set("description")} />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : editingId ? "Save changes" : "List product"}
            </button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* ----- inventory ----- */}
        <section className="panel">
          <h3>Your inventory</h3>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="muted">You haven't listed anything yet. Add your first product on the left.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="right">Price</th>
                    <th className="right">Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="prod-cell">
                          <img className="thumb" src={p.image} alt="" />
                          <div>
                            <b>{p.name}</b>
                            <span className="muted small">{p.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="right">{moneyExact(p.price)}</td>
                      <td className="right">
                        {p.stock === 0 ? (
                          <span className="status out">Out of stock</span>
                        ) : p.stock <= 5 ? (
                          <span className="status processing">{p.stock} left</span>
                        ) : (
                          p.stock
                        )}
                      </td>
                      <td className="right nowrap">
                        <button className="link dark" onClick={() => startEdit(p)}>Edit</button>
                        {" · "}
                        <button className="link" onClick={() => remove(p)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}