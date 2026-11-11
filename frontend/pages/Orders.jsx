import { useEffect, useState } from "react";
import { api } from "../src/api.js";
import { useAuth } from "../src/AuthContext.jsx";
import {moneyExact} from "../money.js";

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    if (user) {
      api.myOrders()
        .then(setOrders)
        .catch((e) => setError(e.message));
    }
  }, [user]); 

  if (!user) return <div className="container section"><p className="muted">Please sign in to view your orders.</p></div>;
  if (error) return <div className="container section"><p className="error">{error}</p></div>;
  if (!orders) return <div className="container section"><p className="muted">Loading orders…</p></div>;
  if (!orders.length) return <div className="container section"><h2>Your Orders</h2><p className="muted">You haven't placed any orders yet.</p></div>;

  const toggleExpand = (id) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  return (
      <div className="container section">
        <h2>Your Orders</h2>
        <p className="muted">View your order history and statuses.</p>
        
        <div style={{ marginTop: "1.5rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-color, #e5e7eb)" }}>
                <th style={{ padding: "0.75rem", fontSize: "0.9rem" }}>Order ID</th>
                <th style={{ padding: "0.75rem", fontSize: "0.9rem" }}>Date</th>
                <th style={{ padding: "0.75rem", fontSize: "0.9rem" }}>Status</th>
                <th style={{ padding: "0.75rem", fontSize: "0.9rem", textAlign: "right" }}>Total</th>
                <th style={{ padding: "0.75rem", fontSize: "0.9rem", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                return (
                  <>
                    <tr key={o.id} style={{ borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                      <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                        <span className="muted small" style={{ fontFamily: "monospace" }}>{o.id}</span>
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        <span className="muted small">{new Date(o.created_at).toLocaleDateString()}</span>
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                        <span className={`status ${o.status.toLowerCase()}`}>{o.status}</span>
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "middle", textAlign: "right", fontWeight: "600" }}>
                        {moneyExact(o.amount / 100)}
                      </td>
                      <td style={{ padding: "0.75rem", verticalAlign: "middle", textAlign: "center" }}>
                        <button 
                          onClick={() => toggleExpand(o.id)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.85rem", cursor: "pointer" }}
                        >
                          {isExpanded ? "Hide Details" : "View Details"}
                        </button>
                      </td>
                    </tr>
   
                    {/* Expanded Row for Address & Full Item Breakdown */}
                    {isExpanded && (
                      <tr key={`${o.id}-details`} style={{ background: "var(--bg-subtle, #f9fafb)", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                        <td colSpan="5" style={{ padding: "1.25rem" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                            <div>
                              <h4 style={{ marginBottom: "0.5rem" }}>Items Ordered</h4>
                              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                {o.items.map((item, idx) => (
                                  <li key={idx} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                                    <img src={item.image} alt="" style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                                    <span style={{ fontSize: "0.9rem" }}>{item.quantity}× {item.name}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <h4 style={{ marginBottom: "0.5rem" }}>Delivery Address</h4>
                              {o.delivery_address ? (
                                <div className="muted" style={{ fontSize: "0.9rem" }}>
                                  <p><b>{o.delivery_address.full_name}</b></p>
                                  <p>{o.delivery_address.phone}</p>
                                  <p>{o.delivery_address.address_line}</p>
                                  <p>{o.delivery_address.city}, {o.delivery_address.state} - {o.delivery_address.pincode}</p>
                                </div>
                              ) : (
                                <p className="muted">Delivery address not available.</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }