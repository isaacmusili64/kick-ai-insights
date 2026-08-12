export function Crest({
  src,
  name,
  size = 28,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-md bg-secondary text-[10px] font-bold text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          className="h-full w-full object-contain p-0.5"
        />
      ) : (
        initials
      )}
    </span>
  );
}