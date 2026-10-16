type Props = {
  kind: "earth" | "moon" | "mars";
  large?: boolean;
};

export function Globe({ kind, large }: Props) {
  return <div className={`planet ${kind} ${large ? "lg" : ""}`} aria-hidden />;
}
