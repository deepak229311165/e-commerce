import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../src/api.js";
import { useAuth } from "../src/AuthContext.jsx";
import { money } from "../money.js";

const CATEGORIES = [
  { name: "Electronics", blurb: "Audio, wearables & desk gear", color: "#dbe7ff" },
  { name: "Fashion", blurb: "Everyday staples, made to last", color: "#ffe3d6" },
  { name: "Home", blurb: "Warm, simple, well-made objects", color: "#e2f2e4" },
];

const FEATURES = [
  { title: "Free shipping", text: "On every order over ₹999, delivered in 2–4 days." },
  { title: "30-day returns", text: "Changed your mind? Send it back, no questions." },
  { title: "Secure checkout", text: "Encrypted payments and buyer protection." },
  { title: "Real support", text: "Talk to a person, seven days a week." },
];

const TESTIMONIALS = [
  { name: "Ananya R.", text: "Arrived in three days and the quality is far better than the photos suggested.", item: "Linen Overshirt" },
  { name: "Marcus L.", text: "The headphones replaced a pair twice the price. Checkout was painless.", item: "Aero Headphones" },
  { name: "Priya S.", text: "Support sorted a wrong-size mix-up within the hour. Will shop again.", item: "Trail Runners" },
];

const FAQ = [
  { q: "How long does delivery take?", a: "Most orders arrive within 2–4 business days. You'll get tracking as soon as it ships." },
  { q: "Can I return an item?", a: "Yes. Unused items can be returned within 30 days for a full refund." },
  { q: "Which payment methods do you accept?", a: "Cards, UPI, net banking and popular wallets." },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const { user, setCartCount } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .products()
      .then(setProducts)
      .catch(() => setError("Couldn't load products. Is the API running?"))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => (filter === "All" ? products : products.filter((p) => p.category === filter)),
    [products, filter]
  );

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const addToCart = async (p) => {
    if (!user) return navigate("/dashboard");
    try {
      const cart = await api.addToCart(p.id);
      setCartCount(cart.count);
      flash(`${p.name} added to cart`);
    } catch (e) {
      flash(e.message);
    }
  };

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Autumn collection 2026</p>
            <h1>Well-made things for the way you actually live.</h1>
            <p className="lead">
              Considered electronics, fashion and home goods — fairly priced,
              shipped fast, and easy to return.
            </p>
            <div className="hero-cta">
              <a href="#products" className="btn btn-primary btn-lg">Shop the collection</a>
              <a href="#deals" className="btn btn-ghost btn-lg">See today's deals</a>
            </div>
            <ul className="hero-stats">
              <li><b>40k+</b> happy customers</li>
              <li><b>4.7★</b> average rating</li>
              <li><b>2–4 days</b> delivery</li>
            </ul>
          </div>
          <div className="hero-art" aria-hidden="true">
            <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=70" alt="" />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="strip">
        <div className="container strip-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="strip-item">
              <h4>{f.title}</h4>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section" id="categories">
        <div className="container">
          <h2>Shop by category</h2>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c.name}
                className="cat-card"
                style={{ background: c.color }}
                onClick={() => {
                  setFilter(c.name);
                  document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <h3>{c.name}</h3>
                <p>{c.blurb}</p>
                <span>Browse →</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="section section-alt" id="products">
        <div className="container">
          <div className="section-head">
            <h2>Featured products</h2>
            <div className="chips">
              {["All", ...CATEGORIES.map((c) => c.name)].map((c) => (
                <button
                  key={c}
                  className={`chip ${filter === c ? "active" : ""}`}
                  onClick={() => setFilter(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {loading && <p className="muted">Loading products…</p>}
          {error && <p className="error">{error}</p>}

          <div className="product-grid">
            {visible.map((p) => (
              <article key={p.id} className="product">
                <div className="product-img">
                  <img src={p.image} alt={p.name} loading="lazy" />
                  {p.badge && <span className="badge">{p.badge}</span>}
                </div>
                <div className="product-body">
                  <p className="muted small">{p.category}</p>
                  <h3>{p.name}</h3>
                  <p className="rating">★ {p.rating.toFixed(1)}</p>
                  <div className="price-row">
                    <span className="price">{money(p.price)}</span>
                    {p.old_price && <s className="old">{money(p.old_price)}</s>}
                  </div>
                  <button className="btn btn-primary btn-block" onClick={() => addToCart(p)}>
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* DEALS */}
      <section className="section" id="deals">
        <div className="container">
          <div className="deal">
            <div>
              <p className="eyebrow light">This week only</p>
              <h2>Up to 25% off outerwear and everyday bags</h2>
              <p>Prices drop automatically in your cart. No codes needed.</p>
              <a href="#products" className="btn btn-light btn-lg">Shop the sale</a>
            </div>
            <div className="deal-count">
              <b>25%</b>
              <span>off selected</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section section-alt">
        <div className="container">
          <h2>How it works</h2>
          <ol className="steps">
            <li><span>1</span><h4>Pick what you love</h4><p>Browse curated products with honest photos and ratings.</p></li>
            <li><span>2</span><h4>Check out in a minute</h4><p>Sign in once, save your cart, and pay securely.</p></li>
            <li><span>3</span><h4>Get it fast</h4><p>Track your parcel from warehouse to doorstep.</p></li>
          </ol>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section">
        <div className="container">
          <h2>What customers say</h2>
          <div className="quote-grid">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="quote">
                <blockquote>“{t.text}”</blockquote>
                <figcaption>
                  <b>{t.name}</b>
                  <span className="muted small"> · bought {t.item}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section section-alt">
        <div className="container narrow">
          <h2>Frequently asked questions</h2>
          {FAQ.map((f, i) => (
            <div key={f.q} className="faq">
              <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                {f.q}
                <span>{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="section">
        <div className="container narrow news">
          <h2>Get 10% off your first order</h2>
          <p className="muted">Join the list for new arrivals and members-only offers.</p>
          {subscribed ? (
            <p className="success">Thanks — check your inbox soon.</p>
          ) : (
            <form
              className="news-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (email) setSubscribed(true);
              }}
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn btn-primary">Subscribe</button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <div className="logo">Shop<span>Sphere</span></div>
            <p className="muted small">Well-made things, fairly priced.</p>
          </div>
          <div><h5>Shop</h5><a href="#products">All products</a><a href="#deals">Deals</a><a href="#categories">Categories</a></div>
          <div><h5>Help</h5><a href="#">Shipping</a><a href="#">Returns</a><a href="#">Contact</a></div>
          <div><h5>Company</h5><a href="#">About</a><a href="#">Careers</a><a href="#">Privacy</a></div>
        </div>
        <p className="copyright">© 2026 ShopSphere. All rights reserved.</p>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}