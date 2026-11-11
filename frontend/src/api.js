const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const getToken = () => localStorage.getItem("token");

async function request(path, {method = "GET", body, auth = false } = {}){
    const headers = {"Content-Type": "application/json"};
    if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined, 
    });
    if (!res.ok){
        let detail = "something went wrong";
        try{
            const data = await res.json();
            detail = 
            typeof data.detail === "string"
            ? data.detail
            :data.detail?.[0]?.msg || detail;
        } catch{}
        if (res.status === 401 && auth) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.dispatchEvent(new Event("auth:expired"));    
        }
        const err = new Error(detail);
        err.status = res.status;
        throw err;
    }
    if (res.status === 204) return null;
    return res.json();
}

export const api = {
    products: () => request("/products"),
    login: (email, password) =>
        request("/auth/login", {method: "POST", body:{email, password} }),

    register: (name, email, password, role="buyer") =>
        request("/auth/register", {method: "POST", body:{name, email, password, role}}),

    cart: () => request("/cart", {auth: true}),
    addToCart: (product_id, quantity = 1) => 
        request("/cart", {method:"POST", body: {product_id, quantity}, auth: true}),

    removeFromCart: (id) => request(`/cart/${id}`, {method: "DELETE", auth: true}),
    dashboard: () => request("/dashboard", {auth: true}),

    createOrder: (address) => request("/payments/create-order", {method: "POST", body: { address }, auth: true}),
    verifyPayment: (response) => request("/payments/verify", {method: "POST",body: response, auth: true}),
    myOrders: () => request("/orders", {auth: true}),

    sellerProducts: () => request("/seller/products", {auth: true}),
    createProduct: (body) => request("/seller/products", {method: "POST", body, auth: true}),
    updateProduct: (id, body) => request(`/seller/products/${id}`, {method: "PATCH", body, auth: true}),
    deleteProduct: (id) => request(`/seller/products/${id}`, {method: "DELETE", auth: true}),
};  