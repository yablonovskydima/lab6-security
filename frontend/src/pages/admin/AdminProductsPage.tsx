import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../../api/client'
import type { Product } from '../../api/types'
import { Alert } from '../../components/Alert'
import { formatMoney } from '../../components/format'

interface Draft {
  name: string
  description: string
  price: string
  stock: string
}

const EMPTY: Draft = { name: '', description: '', price: '', stock: '' }

function toBody(d: Draft) {
  return { name: d.name, description: d.description || null, price: d.price, stock: Number(d.stock) }
}

export function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<{ id: number; draft: Draft } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    api<Product[]>('/products')
      .then(setProducts)
      .catch((err) => setError(errorMessage(err)))

  useEffect(() => {
    load()
  }, [])

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function create(e: FormEvent) {
    e.preventDefault()
    run(async () => {
      await api('/products', { method: 'POST', body: toBody(draft) })
      setDraft(EMPTY)
    })
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    run(async () => {
      await api(`/products/${editing.id}`, { method: 'PATCH', body: toBody(editing.draft) })
      setEditing(null)
    })
  }

  function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return
    run(() => api(`/products/${p.id}`, { method: 'DELETE' }))
  }

  const field = (d: Draft, set: (d: Draft) => void, key: keyof Draft, props: Record<string, unknown> = {}) => (
    <input value={d[key]} onChange={(e) => set({ ...d, [key]: e.target.value })} {...props} />
  )

  return (
    <div className="stack">
      <div className="card">
        <h1>Manage products</h1>
        <Alert>{error}</Alert>
        <form onSubmit={create} className="form inline-form">
          <label>Name {field(draft, setDraft, 'name', { required: true })}</label>
          <label>Description {field(draft, setDraft, 'description')}</label>
          <label>
            Price {field(draft, setDraft, 'price', { type: 'number', step: '0.01', min: '0.01', required: true })}
          </label>
          <label>Stock {field(draft, setDraft, 'stock', { type: 'number', min: '0', required: true })}</label>
          <button className="btn btn-primary">Add product</button>
        </form>
      </div>

      <div className="card">
        <form onSubmit={save}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) =>
                  editing?.id === p.id ? (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>
                        {field(editing.draft, (d) => setEditing({ id: p.id, draft: d }), 'name', { required: true })}
                      </td>
                      <td>{field(editing.draft, (d) => setEditing({ id: p.id, draft: d }), 'description')}</td>
                      <td>
                        {field(editing.draft, (d) => setEditing({ id: p.id, draft: d }), 'price', {
                          type: 'number',
                          step: '0.01',
                          min: '0.01',
                          required: true,
                        })}
                      </td>
                      <td>
                        {field(editing.draft, (d) => setEditing({ id: p.id, draft: d }), 'stock', {
                          type: 'number',
                          min: '0',
                          required: true,
                        })}
                      </td>
                      <td className="actions">
                        <button className="btn btn-sm btn-primary">Save</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.name}</td>
                      <td className="muted small">{p.description}</td>
                      <td className="num">{formatMoney(p.price)}</td>
                      <td className="num">{p.stock}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            setEditing({
                              id: p.id,
                              draft: {
                                name: p.name,
                                description: p.description ?? '',
                                price: p.price,
                                stock: String(p.stock),
                              },
                            })
                          }
                        >
                          Edit
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(p)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </form>
        {products.length === 0 && <p className="muted">No products yet.</p>}
      </div>
    </div>
  )
}
