import type { ReactNode } from 'react'
import type { Order, Product } from '../api/types'
import { formatDate, formatMoney } from './format'

export function StatusBadge({ status }: { status: Order['status'] }) {
  const cls = { pending: 'badge-warn', confirmed: 'badge-info', shipped: 'badge-ok', cancelled: 'badge-error' }[status]
  return <span className={`badge ${cls}`}>{status}</span>
}

interface Props {
  orders: Order[]
  products: Product[]
  actions?: (order: Order) => ReactNode
  extraColumn?: { title: string; render: (order: Order) => ReactNode }
}

export function OrderList({ orders, products, actions, extraColumn }: Props) {
  const name = (id: number) => products.find((p) => p.id === id)?.name ?? `Product #${id}`
  if (orders.length === 0) return <p className="muted">No orders yet.</p>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            {extraColumn && <th>{extraColumn.title}</th>}
            <th>Date</th>
            <th>Items</th>
            <th className="num">Total</th>
            <th>Status</th>
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              {extraColumn && <td>{extraColumn.render(o)}</td>}
              <td className="nowrap">{formatDate(o.created_at)}</td>
              <td>
                {o.items.map((i) => (
                  <div key={i.product_id} className="small">
                    {name(i.product_id)} × {i.quantity}
                  </div>
                ))}
              </td>
              <td className="num">{formatMoney(o.total)}</td>
              <td>
                <StatusBadge status={o.status} />
              </td>
              {actions && <td>{actions(o)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
