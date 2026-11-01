import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { Order, Product } from '../api/types'
import { Alert } from '../components/Alert'
import { OrderList } from '../components/OrderList'

export function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    Promise.all([api<Order[]>('/orders/my'), api<Product[]>('/products')])
      .then(([o, p]) => {
        setOrders(o)
        setProducts(p)
      })
      .catch((err) => setError(errorMessage(err)))

  useEffect(() => {
    load()
  }, [])

  async function cancel(id: number) {
    setError(null)
    try {
      await api<Order>(`/orders/${id}/cancel`, { method: 'POST' })
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="card">
      <h1>My orders</h1>
      <Alert>{error}</Alert>
      <OrderList
        orders={orders}
        products={products}
        actions={(o) =>
          o.status === 'pending' && (
            <button className="btn btn-sm btn-ghost" onClick={() => cancel(o.id)}>
              Cancel
            </button>
          )
        }
      />
    </div>
  )
}
