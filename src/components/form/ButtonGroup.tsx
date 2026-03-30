interface ButtonGroupItem<T> {
  value: T;
  label: string;
  title?: string;
}

interface Props<T> {
  items: ButtonGroupItem<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

export default function ButtonGroup<T>({ items, selected, onSelect }: Props<T>) {
  return (
    <div className="control-row">
      {items.map((item) => (
        <button
          key={String(item.value)}
          className="btn btn-xs"
          style={
            selected === item.value
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--secondary)' }
          }
          title={item.title}
          onClick={() => onSelect(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
