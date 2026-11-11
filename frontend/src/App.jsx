import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Home from "../pages/home.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Seller from "../pages/Seller.jsx";
import OrdersPage from "../pages/Orders.jsx";
 
function Header() {
  const { user, logout, cartCount } = useAuth();
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          Shop<span>Sphere</span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>Home</NavLink>
          <a href="/#products">Shop</a>
          <a href="/#deals">Deals</a>
          <NavLink to="/dashboard">Dashboard</NavLink>
          {user && <NavLink to="/orders">Orders</NavLink>}
          <NavLink to="/seller">Sell</NavLink>
        </nav>
        <div className="header-actions">
          <Link to="/dashboard" className="cart-pill" aria-label="Cart">
            Cart <b>{cartCount}</b>
          </Link>
          {user ? (
            <button className="btn btn-ghost" onClick={logout}>
              Sign out
            </button>
          ) : (
            <Link to="/dashboard" className="btn btn-primary">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/seller" element={<Seller />} />
          <Route path="/orders" element={<OrdersPage />}/>
          <Route path="*" element={<Home />} />

        </Routes>
      </main>
    </>
  );
}