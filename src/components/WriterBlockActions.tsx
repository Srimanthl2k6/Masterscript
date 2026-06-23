interface Props {
  canDelete: boolean
  canInsert: boolean
  canMarkRevision: boolean
  onDelete(): void
  onInsert(): void
  onMarkRevision(): void
}

export default function WriterBlockActions(props: Props) {
  return (
    <details className="block-actions-panel">
      <summary>Block actions</summary>
      <div className="inline-actions">
        <button onClick={props.onMarkRevision} disabled={!props.canMarkRevision}>
          Mark Revision
        </button>
        <button onClick={props.onInsert} disabled={!props.canInsert}>
          Insert Next
        </button>
        <button onClick={props.onDelete} disabled={!props.canDelete}>
          Delete Block
        </button>
      </div>
    </details>
  )
}
