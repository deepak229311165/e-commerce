import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken } from "./api.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    } 
  }); 
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      logout();
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);

  }, []);
  
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    if (!getToken()) return setCartCount(0);
    try {
      const cart = await api.cart();
      setCartCount(cart.count);
    } catch (e) {
      if (e.status === 401) logout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSession = (data) => {
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const login = async (email, password) => saveSession(await api.login(email, password));
  const register = async (name, email, password, role="buyer") =>
    saveSession(await api.register(name, email, password, role));

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setCartCount(0);
  }

  useEffect(() => {
    if (user) refreshCart();
  }, [user, refreshCart]);

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout, cartCount, setCartCount, refreshCart }}
    >
      {children}
    </AuthContext.Provider>
  );
}