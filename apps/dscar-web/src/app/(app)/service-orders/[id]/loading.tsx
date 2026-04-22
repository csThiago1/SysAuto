export default function ServiceOrderLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b bg-white/5 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-7 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="h-9 w-20 animate-pulse rounded bg-white/10" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 border-b bg-white/5 px-6 py-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded bg-white/10" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex-1 bg-white/[0.03] p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-white/5 p-4 shadow-sm space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-9 animate-pulse rounded bg-white/10" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
