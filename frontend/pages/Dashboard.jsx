import { useEffect, useState } from "react";
import { api } from "../src/api.js";
import { useAuth } from "../src/AuthContext.jsx";
import { startCheckout } from "../src/checkout.js";
import {money, moneyExact, moneyFromPaise} from "../money.js";

function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, SetError] = useState("");
  const [busy, SetBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    SetError("");
    SetBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      SetError(err.message);
    } finally {
      SetBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="muted">
          {mode === "login" ? "Sign in to see your dashboard." : "It takes less than a minute."}
        </p>
        {mode === "register" && (
          <label htmlFor="name">
            Name
            <input 
              id="name" 
              name="name" 
              required 
              value={form.name} 
              onChange={set("name")} 
            />
          </label>
        )}
        <label htmlFor="email">
          Email
          <input 
            type="email" 
            id="email" 
            name="email" 
            required 
            value={form.email} 
            onChange={set("email")} 
          />
        </label>
        <label htmlFor="password">
          Password
          <input 
            type="password" 
            id="password" 
            name="password" 
            required 
            minLength={6} 
            maxLength={72}
            value={form.password} 
            onChange={set("password")} 
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <p className="switch">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}

function SalesBars({ data }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const max = Math.max(...data, 1);
  return (
    <div className="bars" role="img" aria-label="Sales over the last 7 days">
      {data.map((v, i) => (
        <div key={i} className="bar-col">
          <div className="bar" style={{ height: `${(v / max) * 100}%` }} title={`$${v}`} />
          <span>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

function CartPanel({ onChange }) {
  const [cart, setCart] = useState(null);
  const { setCartCount, user } = useAuth();
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState(null);
  const [address, setAddress] = useState({
    full_name: user?.name || "",
    phone: "",
    address_line: "",
    city: "",
    state: "",
    pincode: "",
  });

  const load = () =>
    api.cart().then((c) => {
      setCart(c);
      setCartCount(c.count);
    })
    .catch((e) => setPayMsg({ ok: false, text: e.message }));
      

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (id) => {
    const c = await api.removeFromCart(id);
    setCart(c);
    setCartCount(c.count);
    onChange?.();
  };

  const checkout = async () => {
  setPayMsg(null);
  setPaying(true);
  try {
    const order = await startCheckout(user, address);

    if (order.status === "paid") {
      setPayMsg({ ok: true, text: `Payment successful (test mode). Order id: ${order.id}` });
    } else if (order.status === "refunded") {
      setPayMsg({ ok: false, text: "An item sold out while you were paying. Your payment has been refunded." });
    } else {
      // "needs_review" (or anything unexpected)
      setPayMsg({ ok: false, text: "An item sold out. We'll review your order and refund you shortly." });
    }

    await load();      // refresh the cart (it is now empty if paid)
    onChange?.();      // refresh the dashboard stats and recent orders
  } catch (e) {
    setPayMsg({ ok: false, text: e.message });   // cancelled, network error, etc.
  } finally {
    setPaying(false);                            // always re-enable the button
  }
};
  const payNote = payMsg && (
    <p className={payMsg.ok ? "success" : "error"}>{payMsg.text}</p>
  );

  if (!cart) return <p className="muted">Loading cart…</p>;
  if (!cart.items.length) {
    return (
      <>
        <p className="muted">Your cart is empty.</p>
        {payNote}
      </>
    );
  }

  return (
    <>
      {payNote}
      <ul className="cart-list">
        {cart.items.map((i) => (
          <li key={i.product_id}>
            <img src={i.image} alt="" />
            <div>
              <b>{i.name}</b>
              <span className="muted small">
                {i.quantity} × {moneyExact(i.price)}
              </span>
            </div>
            <button className="link" onClick={() => remove(i.product_id)}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="cart-total">
        <span>Total</span>
        <b>{moneyExact(cart.total)}</b>
      </div>
      <div>
        <input
          placeholder="Full Name"
          value={address.full_name}
          onChange={(e) =>
            setAddress({ ...address, full_name: e.target.value })
          }
        />

        <input
          placeholder="Phone Number"
          value={address.phone}
          onChange={(e) =>
            setAddress({ ...address, phone: e.target.value })
          }
        />

        <input
          placeholder="Address"
          value={address.address_line}
          onChange={(e) =>
            setAddress({ ...address, address_line: e.target.value })
          }
        />

        <input
          placeholder="City"
          value={address.city}
          onChange={(e) =>
            setAddress({ ...address, city: e.target.value })
          }
        />

        <input
          placeholder="State"
          value={address.state}
          onChange={(e) =>
            setAddress({ ...address, state: e.target.value })
          }
        />

        <input
          placeholder="Pincode"
          value={address.pincode}
          onChange={(e) =>
            setAddress({ ...address, pincode: e.target.value })
          }
        />
      </div>
      <button className="btn btn-primary btn-block" onClick={checkout} disabled={paying}>
        {paying ? "Processing..." : "Checkout"}
      </button>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, SetError] = useState("");

  const load = () =>
    api.dashboard().then(setData).catch((e) => SetError(e.message));

  useEffect(() => {
    if (user) load();
    else {setData(null); SetError("");}
  }, [user]);

  if (!user) return <AuthForm />;
  if (error) return <div className="container section"><p className="error">{error}</p></div>;
  if (!data) return <div className="container section"><p className="muted">Loading dashboard…</p></div>;

  const stats = [
    { label: "Items in cart", value: data.cart_count },
    { label: "Cart value", value: moneyExact(data.cart_total) },
    { label: "Orders placed", value: data.orders_placed },
    { label: "Total spent", value: moneyExact(data.total_spent) },
  ];

  return (
    <div className="container dash">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Hello, {data.user.name.split(" ")[0]}</h1>
          <p className="muted">Here's what's happening with your account.</p>
        </div>
        <a href="/#products" className="btn btn-primary">Continue shopping</a>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <span className="muted small">{s.label}</span>
            <b>{s.value}</b>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <section className="panel">
          <h3>Spending, last 7 days</h3>
          <SalesBars data={data.sales_last_7_days} />
          <p className="muted small">Sample data until orders are connected.</p>
        </section>

        <section className="panel">
          <h3>Your cart</h3>
          <CartPanel onChange={load} />
        </section>

        <section className="panel wide">
          <h3>Recent orders</h3>
          <table>
            <thead>
              <tr><th>Order</th><th>Date</th><th>Status</th><th className="right">Total</th></tr>
            </thead>
            <tbody>
              {data.recent_orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.date}</td>
                  <td><span className={`status ${o.status.toLowerCase()}`}>{o.status}</span></td>
                  <td className="right">{moneyExact(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}