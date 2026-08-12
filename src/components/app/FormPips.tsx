export function FormPips({ form }: { form: ("W" | "D" | "L")[] }) {
  if (!form.length) return <span className="text-xs text-muted-foreground">No data</span>;
  return (
    <div className="flex gap-1">
      {form.slice(0, 5).map((r, i) => (
        <span
          key={i}
          title={r === "W" ? "Win" : r === "D" ? "Draw" : "Loss"}
          className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${
            r === "W"
              ? "bg-primary/20 text-primary"
              : r === "D"
                ? "bg-secondary text-muted-foreground"
                : "bg-destructive/20 text-destructive"
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}