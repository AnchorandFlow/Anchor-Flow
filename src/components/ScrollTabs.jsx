import React from "react"

export default function ScrollTabs({ children, style={} }) {
  const ref = React.useRef(null)
  const [canLeft,  setCanLeft]  = React.useState(false)
  const [canRight, setCanRight] = React.useState(false)

  function check() {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  React.useEffect(function() {
    check()
    const el = ref.current
    if (!el) return
    el.addEventListener("scroll", check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return function() { el.removeEventListener("scroll", check); ro.disconnect() }
  }, [])

  function scroll(dir) {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * 120, behavior: "smooth" })
  }

  const arrowStyle = function(active) { return {
    flexShrink: 0, background: "none", border: "none", cursor: active ? "pointer" : "default",
    padding: "0 4px", fontSize: "0.8rem", color: active ? "inherit" : "transparent",
    opacity: active ? 1 : 0, transition: "opacity 0.15s", lineHeight: 1,
  }}

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative", ...style }}>
      <button onClick={function(){scroll(-1)}} style={arrowStyle(canLeft)} tabIndex={-1}>‹</button>
      <div ref={ref} onScroll={check} style={{ flex: 1, display: "flex", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
        {children}
      </div>
      <button onClick={function(){scroll(1)}} style={arrowStyle(canRight)} tabIndex={-1}>›</button>
    </div>
  )
}
