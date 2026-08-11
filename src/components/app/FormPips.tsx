export function FormPips({ form }: { form: ("W" | "D" | "L")[] }) {
  if (!form.length) return <span className="text-xs text-muted-foreground">No recent data</span>;
  return (
    <div className="flex gap-1">
      {[...form].reverse().map((r, i) => (
        <span
          key={`${r}-${i}`}
          className={`flex h-5 w-5 items-center justify-center rounded-[4px] text-[10px] font-bold ${
            r === "W"
              ? "bg-primary text-primary-foreground"
              : r === "D"
                ? "bg-gold text-gold-foreground"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}