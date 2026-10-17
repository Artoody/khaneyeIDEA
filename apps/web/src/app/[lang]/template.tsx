/** Re-mounts on every navigation: the new page eases in instead of snapping (opacity only, so fixed layers keep their place). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
