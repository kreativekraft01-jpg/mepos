import Modal from './Modal'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onCancel,
  onConfirm
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-soft)', fontSize: 13.5 }}>{message}</p>
    </Modal>
  )
}
