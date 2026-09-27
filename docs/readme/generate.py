"""Generate the README illustrations and icons (plain SVG, light and dark variants).

    python3 docs/readme/generate.py
"""

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).parent
ICONS = OUT / "icons"
ICONS.mkdir(exist_ok=True)

ACCENT = "#FF6A3D"
FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace"

THEMES = {
    "light": dict(bg="#F7F7F5", card="#FFFFFF", line="#DEDED8", text="#17171A", muted="#5C5C66",
                  soft="#FFF1EA", accent="#E5502A", green="#1F8F5B", red="#C9373C", amber="#B7791F",
                  blue="#3B63C8", chip="#F0F0EC"),
    "dark": dict(bg="#111113", card="#1B1B1F", line="#33333A", text="#F2F0EA", muted="#9A9AA3",
                 soft="#2A1711", accent="#FF6A3D", green="#3DD68C", red="#F05D5E", amber="#F5B84A",
                 blue="#7AA2FF", chip="#24242A"),
}

# 24x24 stroke icons drawn for this README (round caps and joins, 1.75 stroke).
ICON_PATHS = {
    "quote": '<path d="M4 6h16v10H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
    "file": '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15h6M9 18h4"/>',
    "scale": '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>',
    "spark": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    "shield": '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    "lens": '<circle cx="10.5" cy="10.5" r="6.5"/><circle cx="10.5" cy="10.5" r="2.2"/><path d="M15.5 15.5L21 21"/>',
    "lock": '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><path d="M12 14.5v2.5"/>',
    "flask": '<path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
    "layers": '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    "terminal": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12.5 15H17"/>',
    "sliders": '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    "route": '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
    "alert": '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    "phone": '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    "monitor": '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    "clock": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "book": '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    "check": '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
    "cpu": '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
    "database": '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    "presentation": '<path d="M3 4h18M4.5 4v11h15V4"/><path d="M12 15v3.5M8.5 21l3.5-2.5 3.5 2.5"/><path d="M8 11l2.5-2.5 2 2L16 7"/>',
}


def icon_svg(body: str, color: str = ACCENT, size: int = 24) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" '
        f'fill="none" stroke="{color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'
        f"{body}</svg>\n"
    )


def inline_icon(name: str, x: float, y: float, size: float, color: str) -> str:
    s = size / 24
    return (
        f'<g transform="translate({x} {y}) scale({s})" fill="none" stroke="{color}" stroke-width="1.75" '
        f'stroke-linecap="round" stroke-linejoin="round">{ICON_PATHS[name]}</g>'
    )


def lines(x: float, y: float, rows: list[str], size: int, fill: str, weight: int = 400,
          lh: float = 1.45, family: str = FONT, anchor: str = "start") -> str:
    out = [f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
           f'fill="{fill}" text-anchor="{anchor}">']
    for i, r in enumerate(rows):
        out.append(f'<tspan x="{x}" dy="{0 if i == 0 else size * lh}">{r}</tspan>')
    out.append("</text>")
    return "".join(out)


def rich(x: float, y: float, rows: list[list[tuple[str, str | None]]], size: int, base: str,
         lh: float = 1.45, weight: int = 400) -> str:
    """rows of (text, color-or-None) runs; colored runs are bold."""
    out = [f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{base}">']
    for i, row in enumerate(rows):
        out.append(f'<tspan x="{x}" dy="{0 if i == 0 else size * lh}">')
        for t, c in row:
            if c:
                out.append(f'<tspan fill="{c}" font-weight="700">{escape(t)}</tspan>')
            else:
                out.append(escape(t))
        out.append("</tspan>")
    out.append("</text>")
    return "".join(out)


def pipeline(t: dict) -> str:
    W, H = 1200, 470
    stages = [
        ("quote", "Claim", ["One plain statement.", "Analysed for strength,", "causation, numbers,", "dates and names."]),
        ("file", "Evidence", ["PDF, TXT, MD or CSV.", "Text extracted per page", "in a sandboxed", "subprocess."]),
        ("scale", "Rule checks", ["Numbers, dates, names,", "negation, causation", "vs association,", "absolute language."]),
        ("spark", "AI reasoning", ["Sees only your", "passages. Must answer", "in a strict JSON", "schema."]),
        ("shield", "Validation", ["Pydantic parsing.", "Unknown refs dropped,", "quotes must be verbatim,", "conflicts override."]),
        ("lens", "Show me why", ["Verdict, explanation,", "and the exact quote,", "document and page,", "highlighted."]),
    ]
    cw, gap, x0, top = 168, 24, 36, 96
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
         f'role="img" aria-label="How ProofLens verifies a claim">',
         f'<rect width="{W}" height="{H}" rx="18" fill="{t["bg"]}"/>',
         lines(36, 50, ["HOW A CLAIM IS VERIFIED"], 13, t["accent"], 700, family=MONO),
         lines(W - 36, 50, ["The backend owns the verdict"], 13, t["muted"], 500, anchor="end")]
    for i, (ic, title, desc) in enumerate(stages):
        x = x0 + i * (cw + gap)
        hi = i in (2, 3, 4)
        s.append(f'<rect x="{x}" y="{top}" width="{cw}" height="250" rx="14" fill="{t["card"]}" '
                 f'stroke="{t["accent"] if hi else t["line"]}" stroke-width="{1.6 if hi else 1.2}"/>')
        s.append(f'<circle cx="{x + 40}" cy="{top + 42}" r="22" fill="{t["soft"]}"/>')
        s.append(inline_icon(ic, x + 28, top + 30, 24, t["accent"]))
        s.append(lines(x + cw - 18, top + 48, [f"0{i + 1}"], 13, t["muted"], 600, family=MONO, anchor="end"))
        s.append(lines(x + 18, top + 102, [title], 18, t["text"], 700))
        s.append(lines(x + 18, top + 134, desc, 13, t["muted"], 400, lh=1.5))
        if i < len(stages) - 1:
            ax = x + cw + 3
            s.append(f'<path d="M{ax} {top + 125}h14" stroke="{t["accent"]}" stroke-width="2" '
                     f'stroke-linecap="round"/><path d="M{ax + 10} {top + 120}l6 5-6 5" fill="none" '
                     f'stroke="{t["accent"]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
    by = top + 280
    s.append(f'<rect x="36" y="{by}" width="{W - 72}" height="62" rx="12" fill="{t["chip"]}"/>')
    s.append(inline_icon("alert", 58, by + 19, 24, t["amber"]))
    s.append(rich(96, by + 37, [[("If every AI model fails: ", t["text"]),
                                 ("the rule result is returned only when it is decisive. Otherwise the API answers 503, "
                                  "stores nothing, and the person can retry.", None)]], 14, t["muted"]))
    s.append("</svg>\n")
    return "".join(s)


def example(t: dict) -> str:
    W, H = 1200, 560
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
         f'role="img" aria-label="Worked example: causation claim against an associative source">',
         f'<rect width="{W}" height="{H}" rx="18" fill="{t["bg"]}"/>',
         lines(36, 50, ["WORKED EXAMPLE"], 13, t["accent"], 700, family=MONO),
         lines(W - 36, 50, ["Condensed from a live run  ·  sample document, fictional data"], 13, t["muted"], 500,
               anchor="end")]
    # claim card
    s.append(f'<rect x="36" y="80" width="340" height="200" rx="14" fill="{t["card"]}" stroke="{t["line"]}"/>')
    s.append(inline_icon("quote", 58, 100, 22, t["accent"]))
    s.append(lines(90, 117, ["YOUR CLAIM"], 12, t["muted"], 700, family=MONO))
    s.append(rich(58, 160, [
        [("“The study ", None), ("proves", t["accent"]), (" that", None)],
        [("drinking coffee every day", None)],
        [("causes", t["accent"]), (" a lower risk of", None)],
        [("heart disease.”", None)],
    ], 19, t["text"], lh=1.4))
    # source card
    s.append(f'<rect x="400" y="80" width="400" height="200" rx="14" fill="{t["card"]}" stroke="{t["line"]}"/>')
    s.append(inline_icon("file", 422, 100, 22, t["blue"]))
    s.append(lines(454, 117, ["THE EVIDENCE  ·  coffee-heart-study-sample.pdf"], 12, t["muted"], 700, family=MONO))
    s.append(lines(422, 152, ["Page 2 · Results"], 12, t["muted"], 600, family=MONO))
    s.append(rich(422, 174, [[("“Daily coffee consumption was ", None), ("associated with", t["green"])],
                             [("a lower risk of heart disease.”", None)]], 15, t["text"], lh=1.4))
    s.append(lines(422, 226, ["Page 3 · Limitations"], 12, t["muted"], 600, family=MONO))
    s.append(rich(422, 248, [[("“…the findings ", None), ("do not establish", t["red"]),
                              (" that coffee causes", None)], [("a lower risk of heart disease.”", None)]], 15,
                  t["text"], lh=1.4))
    # arrow
    s.append(f'<path d="M812 180h24" stroke="{t["accent"]}" stroke-width="2.4" stroke-linecap="round"/>'
             f'<path d="M830 173l8 7-8 7" fill="none" stroke="{t["accent"]}" stroke-width="2.4" '
             f'stroke-linecap="round" stroke-linejoin="round"/>')
    # verdict card
    s.append(f'<rect x="850" y="80" width="314" height="200" rx="14" fill="{t["card"]}" stroke="{t["red"]}" '
             f'stroke-width="1.6"/>')
    s.append(lines(872, 117, ["VERDICT"], 12, t["muted"], 700, family=MONO))
    s.append(f'<rect x="872" y="134" width="150" height="34" rx="17" fill="{t["chip"]}"/>')
    s.append(lines(947, 157, ["Contradicted"], 15, t["red"], 700, anchor="middle"))
    s.append(lines(1040, 158, ["97%"], 22, t["red"], 700))
    s.append(lines(872, 204, ["Rule checks, independent of the model:"], 12.5, t["muted"], 500))
    s.append(lines(872, 228, ["Stronger language than the source", "causation  vs  associated"], 13.5, t["text"], 600,
                   lh=1.5))
    # explanation row
    cols = [
        ("WHAT THE EVIDENCE SAYS", t["blue"], ["Daily coffee is associated with an", "18% lower incidence of heart",
                                               "disease; the study is observational", "and does not establish cause."]),
        ("WHY IT DOES NOT FULLY MATCH", t["amber"], ["The source describes an association;", "the claim asserts proven cause.",
                                                     "Unsupported: that the study", "proves causation."]),
        ("SHOW ME WHY", t["accent"], ["p.3 Limitations  ·  Conflicts", "p.2 Results  ·  Supports (×2)",
                                      "Open the source: page 3 opens", "with the sentence highlighted."]),
    ]
    cw = 364
    for i, (k, c, body) in enumerate(cols):
        x = 36 + i * (cw + 18)
        s.append(f'<rect x="{x}" y="304" width="{cw}" height="170" rx="14" fill="{t["card"]}" stroke="{t["line"]}"/>')
        s.append(f'<rect x="{x}" y="304" width="{cw}" height="4" rx="2" fill="{c}"/>')
        s.append(lines(x + 22, 342, [k], 12, c, 700, family=MONO))
        s.append(lines(x + 22, 374, body, 15, t["text"], 400, lh=1.45))
    s.append(inline_icon("check", 36, 500, 22, t["green"]))
    s.append(rich(68, 517, [[("What you can conclude: ", t["text"]),
                             ("coffee consumption is linked to a lower risk of heart disease, but the study does not "
                              "prove that coffee causes it.", None)]], 15, t["muted"]))
    s.append("</svg>\n")
    return "".join(s)


def verdicts(t: dict) -> str:
    W, H = 1200, 200
    rows = [("Supported", t["green"], ["The evidence directly supports", "the essential proposition."]),
            ("Partially supported", t["amber"], ["Part is supported, or the claim", "asserts more than the evidence."]),
            ("Contradicted", t["red"], ["The evidence materially", "conflicts with the claim."]),
            ("Insufficient evidence", t["muted"], ["Not enough relevant evidence", "to decide either way."])]
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
         f'role="img" aria-label="The four verdicts">', f'<rect width="{W}" height="{H}" rx="18" fill="{t["bg"]}"/>']
    cw = 273
    for i, (name, c, d) in enumerate(rows):
        x = 36 + i * (cw + 12)
        s.append(f'<rect x="{x}" y="30" width="{cw}" height="140" rx="14" fill="{t["card"]}" stroke="{t["line"]}"/>')
        s.append(f'<circle cx="{x + 30}" cy="64" r="7" fill="{c}"/>')
        s.append(lines(x + 48, 70, [name], 17, t["text"], 700))
        s.append(lines(x + 22, 108, d, 14, t["muted"], 400, lh=1.5))
    s.append("</svg>\n")
    return "".join(s)


for name, body in ICON_PATHS.items():
    (ICONS / f"{name}.svg").write_text(icon_svg(body))
for theme, t in THEMES.items():
    (OUT / f"how-it-works-{theme}.svg").write_text(pipeline(t))
    (OUT / f"example-{theme}.svg").write_text(example(t))
    (OUT / f"verdicts-{theme}.svg").write_text(verdicts(t))
print("ok")
