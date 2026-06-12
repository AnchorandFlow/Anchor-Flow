# Anchor & Flow — Room Palette Spec
*Official per-pillar atmosphere spec — Lindsey, June 12, 2026*

**Governing principle:** Navy is structure, not background. Pages stay light (cream/mist); navy is reserved for hero cards, headers, and emphasis. The goal is differentiated atmosphere per pillar while keeping the whole house calm. Benchmark screens: Today's hero card and Exhale.

## 🧭 Today — calm, focused, grounded (the morning briefing room)
| Role | Hex | Weight |
|---|---|---|
| Primary Navy | `#0A2240` | 55% |
| Cream | `#F8F5F0` | 30% |
| Gold Accent | `#C9A45B` | 10% |
| Soft Sea Glass | `#DDEBEC` | 5% |

Navy card stays the hero element; surrounding page stays light.

## 🌊 Flow — breathing room, movement (softest, most airy, most sea-glass-forward)
| Role | Hex |
|---|---|
| Primary | `#5E8FA0` |
| Secondary | `#7FB1B5` |
| Tertiary | `#A9C9CC` |
| Mist | `#DDEBEC` |
| Background | `#F8FCFC` |

Calendar, Weekly Rhythm, and Exhale should feel noticeably lighter than Today. Navy ≤ 5%, accent only.

## 🏠 Anchor — stable, organized (paper, wood, and light)
| Role | Hex | Weight |
|---|---|---|
| Warm Cream | `#FAF7F2` | 45% |
| Sandstone | `#CBB79D` | 30% |
| Soft Taupe | `#8B7761` | 15% |
| Navy Accent | `#0A2240` | 10% |

No full-screen navy backgrounds. Inventory/Meals/Home content sits on warm cream with navy as structure.

## 🌀 Ripples — emotional, reflective (the richest room)
| Role | Hex | Weight |
|---|---|---|
| Deep Teal | `#1E5B63` | 45% |
| Soft Teal | `#5F9196` | 20% |
| Light Aqua | `#CFE3E5` | 20% |
| Cream | `#F8F5F0` | 10% |
| Gold Accent | `#C9A45B` | 5% |

May run slightly more saturated than the rest of the app — it represents memories and stories.

## 🌅 Sunset — warm, reflective, restorative (evening light, not alert orange)
| Role | Hex | Weight |
|---|---|---|
| Coral | `#D9886D` | 35% |
| Warm Cream | `#FFF8F4` | 30% |
| Blush | `#E8B4A2` | 25% |
| Gold Accent | `#C9A45B` | 10% |

## Practical UI rules
- **Sidebar:** base stays navy; each pillar's active pill glows with its room accent.
- **Page backgrounds:** cream or mist; dark navy reserved for hero cards/headers/emphasis.
- **Flow screens:** the most sea-glass. Exhale is the reference.
- **Anchor screens:** reduce full-screen navy; warm cream + navy structure reads more premium.
- **Ripples screens:** deepest teal, slightly richer saturation allowed.

## Implementation status
- [x] Content-area room wash + header accent (`__ROOM` map in App.jsx) — June 12, 2026
- [x] Room engine values upgraded to this spec (`roompalette.py`)
- [ ] Shell card de-navy: DinnerCard, NudgeStrip, WeeklyReviewCard, PrepCard → cream/sea-glass surfaces; TodayBriefing stays the navy hero
- [ ] Ripples room (AnchorVault.jsx) — deep teal treatment
- [ ] Sunset (End of Day) — coral/blush evening-light reskin
