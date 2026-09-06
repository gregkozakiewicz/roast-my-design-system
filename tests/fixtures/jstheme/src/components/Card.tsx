import { colors } from "../theme";
export function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: colors.black, color: colors.text }}>{children}</div>;
}
