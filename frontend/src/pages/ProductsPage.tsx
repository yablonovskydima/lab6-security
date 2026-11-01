import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { Order, Product } from '../api/types'
import { Alert } from '../components/Alert'
import { formatMoney } from '../components/format'

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    api<Product[]>('/products')
      .then(setProducts)
      .catch((err) => setError(errorMessage(err)))

  useEffect(() => {
    load()
  }, [])

  function setQty(id: number, qty: number) {
    setCart((c) => {
      const next = { ...c }
      if (qty > 0) next[id] = qty
      else delete next[id]
      return next
    })
  }

  const lines = products.filter((p) => cart[p.id])
  const total = lines.reduce((sum, p) => sum + Number(p.price) * cart[p.id], 0)

  async function placeOrder() {
    setBusy(true)
    setError(null)
    try {
      const order = await api<Order>('/orders', {
        method: 'POST',
        body: { items: lines.map((p) => ({ product_id: p.id, quantity: cart[p.id] })) },
      })
      setPlaced(order)
      setCart({})
      load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h1>Products</h1>
        <Alert>{error}</Alert>
        {placed && (
          <Alert kind="success">
            Order #{placed.id} placed, total {formatMoney(placed.total)}. <Link to="/orders">View my orders</Link>
          </Alert>
        )}
        {products.length === 0 ? (
          <p className="muted">No products yet.</p>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <div key={p.id} className="product">
                <div className="product-name">{p.name}</div>
                {p.description && <div className="muted small">{p.description}</div>}
                <div className="product-meta">
                  <strong>{formatMoney(p.price)}</strong>
                  <span className={p.stock > 0 ? 'muted small' : 'text-error small'}>
                    {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                  </span>
                </div>
                <div className="qty">
                  <button className="btn btn-sm" onClick={() => setQty(p.id, (cart[p.id] ?? 0) - 1)} disabled={!cart[p.id]}>
                    −
                  </button>
                  <span>{cart[p.id] ?? 0}</span>
                  <button
                    className="btn btn-sm"
                    onClick={() => setQty(p.id, (cart[p.id] ?? 0) + 1)}
                    disabled={(cart[p.id] ?? 0) >= p.stock}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <div className="card">
          <h2>Cart</h2>
          <table className="table">
            <tbody>
              {lines.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>× {cart[p.id]}</td>
                  <td className="num">{formatMoney(Number(p.price) * cart[p.id])}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td className="num">
                  <strong>{formatMoney(total)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <button className="btn btn-primary" onClick={placeOrder} disabled={busy}>
            {busy ? 'Placing…' : 'Place order'}
          </button>
        </div>
      )}
    </div>
  )
}
