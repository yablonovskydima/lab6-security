import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../api/client'
import type { AdminUser, Order, OrderStatus, Product } from '../../api/types'
import { Alert } from '../../components/Alert'
import { OrderList } from '../../components/OrderList'

const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'cancelled']

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    Promise.all([api<Order[]>('/orders'), api<Product[]>('/products'), api<AdminUser[]>('/admin/users')])
      .then(([o, p, u]) => {
        setOrders(o)
        setProducts(p)
        setUsers(u)
      })
      .catch((err) => setError(errorMessage(err)))

  useEffect(() => {
    load()
  }, [])

  async function setStatus(id: number, status: OrderStatus) {
    setError(null)
    try {
      await api<Order>(`/orders/${id}/status`, { method: 'PATCH', body: { status } })
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="card">
      <h1>All orders</h1>
      <Alert>{error}</Alert>
      <OrderList
        orders={orders}
        products={products}
        extraColumn={{
          title: 'Customer',
          render: (o) => users.find((u) => u.id === o.user_id)?.email ?? `#${o.user_id}`,
        }}
        actions={(o) =>
          o.status !== 'cancelled' && (
            <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )
        }
      />
    </div>
  )
}
