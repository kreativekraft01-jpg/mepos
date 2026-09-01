import type { Sale } from '../types'
import { useStore } from '../store/useStore'
import { formatMoney, formatDateTime, taxRatePercent, salePayments, paymentLabel } from '../utils/format'

export default function Receipt({ sale }: { sale: Sale }) {
  const settings = useStore((s) => s.settings)
  const customers = useStore((s) => s.customers)
  const customer = sale.customerId ? customers.find((c) => c.id === sale.customerId) : undefined

  const pays = salePayments(sale)
  const cashLegs = pays.filter((p) => p.method === 'cash')

  return (
    <div className="receipt-sheet">
      <div className="rc-head">
        <div className="rc-store">{settings.storeName}</div>
        <div className="rc-tag">{settings.tagline}</div>
        <div>Receipt #{sale.receiptNo}</div>
        <div>{formatDateTime(sale.createdAt)}</div>
      </div>

      {customer && <div className="rc-row"><span>Customer</span><span>{customer.name}</span></div>}
      <div className="rc-div" />

      {sale.items.map((it) => (
        <div className="rc-item-line" key={it.productId + it.price}>
          <span>{it.name}</span>
          <span>
            <span className="rc-qty">{it.qty} × {formatMoney(it.price, settings.currency)}</span>{' '}
            {formatMoney(it.price * it.qty, settings.currency)}
          </span>
        </div>
      ))}

      <div className="rc-div" />
      <div className="rc-row"><span>Subtotal</span><span>{formatMoney(sale.subtotal, settings.currency)}</span></div>
      {sale.discount > 0 && (
        <div className="rc-row"><span>Discount</span><span>-{formatMoney(sale.discount, settings.currency)}</span></div>
      )}
      <div className="rc-row"><span>Tax ({taxRatePercent(sale.taxRate)}%)</span><span>{formatMoney(sale.taxAmount, settings.currency)}</span></div>
      <div className="rc-div" />
      <div className="rc-row rc-total-line"><span>TOTAL</span><span>{formatMoney(sale.total, settings.currency)}</span></div>
      {pays.length > 1 ? (
        <>
          {pays.map((p) => (
            <div className="rc-row" key={p.method}>
              <span>Paid · {paymentLabel(p.method)}</span>
              <span>{formatMoney(p.amount, settings.currency)}</span>
            </div>
          ))}
        </>
      ) : (
        <div className="rc-row"><span>Payment</span><span>{paymentLabel(sale.paymentMethod)}</span></div>
      )}
      {cashLegs.length > 0 && sale.cashReceived != null && (
        <>
          <div className="rc-row"><span>Cash</span><span>{formatMoney(sale.cashReceived, settings.currency)}</span></div>
          <div className="rc-row"><span>Change</span><span>{formatMoney(sale.changeDue ?? 0, settings.currency)}</span></div>
        </>
      )}

      {sale.paymentMethod === 'voucher' && customer && (
        <div className="rc-row" style={{ marginTop: 6 }}>
          <span>Balance now</span>
          <span>{formatMoney(customer.balance, settings.currency)}</span>
        </div>
      )}

      <div className="rc-footer">{settings.receiptFooter}</div>
    </div>
  )
}
