export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export function formatMoney(value: string | number): string {
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}
