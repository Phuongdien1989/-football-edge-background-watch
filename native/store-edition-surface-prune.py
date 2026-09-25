#!/usr/bin/env python3
"""Compile-time removal of gambling-accounting surfaces from Football Edge Store Edition.

This is intentionally separate from the engine/presentation patch. It removes
user-accessible Bet Tracker / monetary P&L controls and reroutes navigation to
sports-analysis surfaces. Engine scoring, thresholds and live analytics are not
changed.
"""
from __future__ import annotations

import argparse
from pathlib import Path

PATCH_MARKER = "FE_STORE_SURFACE_PRUNE_V1"


def replace_exact(text: str, old: str, new: str, *, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(
            f"STORE_SURFACE_BASELINE_MISMATCH: expected {expected} occurrence(s), "
            f"found {count}: {old[:120]!r}"
        )
    return text.replace(old, new)


def remove_between(text: str, start: str, end: str) -> str:
    if text.count(start) != 1 or text.count(end) != 1:
        raise SystemExit("STORE_SURFACE_SECTION_BOUNDARY_MISMATCH")
    a = text.index(start)
    b = text.index(end, a)
    return text[:a] + end + text[b + len(end):]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="www/index.html")
    args = ap.parse_args()
    p = Path(args.index)
    s = p.read_text(encoding="utf-8")

    if PATCH_MARKER in s:
        raise SystemExit("STORE_SURFACE_PRUNE_ALREADY_APPLIED")
    if 'football-edge-store-edition" content="1' not in s:
        raise SystemExit("STORE_PRESENTATION_PATCH_REQUIRED_FIRST")

    # Remove the full user-facing Bet Tracker / monetary P&L section at compile time.
    s = remove_between(
        s,
        '<section class="card" id="betTrackerCard">',
        '<section class="card" id="connectCard">',
    )

    # Remove direct ticket-recording action from Single Match Analyzer.
    s = replace_exact(
        s,
        '<button id="quickRecordBetBtn" style="margin-top:8px">＋ GHI NHẬN FINAL ĐÃ VÀO</button>\n',
        '',
    )

    # Remove the result-card action that opened monetary tracking.
    s = replace_exact(
        s,
        '          <button id="smaRecordFinalBtn" type="button">✓ GHI NHẬN MODEL CHOICE</button>\n',
        '',
    )
    s = replace_exact(
        s,
        "    if(e.target?.id==='smaRecordFinalBtn'){setBetTab('active');$('betTrackerCard')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>openBetForm({fromFinal:true}),220)}\n",
        '',
    )

    # Re-purpose navigation that previously opened Bet Tracker.
    s = replace_exact(
        s,
        '<a class="light-tab" href="#betTrackerCard"><span>◉</span><b>TRACKER</b></a>',
        '<a class="light-tab" href="#liveWatchCard"><span>◉</span><b>LIVE SIGNALS</b></a>',
    )
    s = replace_exact(
        s,
        '<a class="bottom-item" href="#betTrackerCard"><span class="bottom-icon">◎</span><b>Theo dõi</b></a>',
        '<a class="bottom-item" href="#liveWatchCard"><span class="bottom-icon">◎</span><b>Tín hiệu</b></a>',
    )
    s = replace_exact(
        s,
        '<button class="fe-cc-action track" id="feQuickTrack" type="button"><span class="ico">◎</span><span><b>THEO DÕI KÈO</b><small>Mở Tracker &amp; P/L hiện tại</small></span></button>',
        '<button class="fe-cc-action track" id="feQuickTrack" type="button"><span class="ico">◎</span><span><b>TÍN HIỆU LIVE</b><small>Mở radar và trạng thái LIVE</small></span></button>',
    )
    s = replace_exact(
        s,
        "    byId('feQuickTrack')?.addEventListener('click',()=>go('betTrackerCard'));",
        "    byId('feQuickTrack')?.addEventListener('click',()=>go('liveWatchCard'));",
    )

    # Analysis page secondary action becomes a sports-analysis shortcut.
    s = replace_exact(
        s,
        '<button id="feP4OpenTracker" type="button">◎ MỞ THEO DÕI KÈO</button>',
        '<button id="feP4OpenTracker" type="button">◎ MỞ TÍN HIỆU LIVE</button>',
    )
    s = replace_exact(
        s,
        "byId('feP4OpenTracker')?.addEventListener('click',()=>clickNav('#betTrackerCard'))",
        "byId('feP4OpenTracker')?.addEventListener('click',()=>clickNav('#liveWatchCard'))",
    )

    # Keep market information as reference context only; remove the ticket-entry action.
    s = replace_exact(
        s,
        '<div class="fe-p4-decision-main"><span>MODEL DECISION • KHÔNG PHẢI XÁC SUẤT</span><b>${esc(d.pick)}</b><small>${esc(d.label)} • football state được đọc trước market.</small></div><div class="fe-p4-market"><span>MARKET / PRICE</span><b>${esc(d.market)}</b><small>Good match ≠ good price. Cần xác nhận line và giá thực tế.</small></div>',
        '<div class="fe-p4-decision-main"><span>MODEL DECISION • KHÔNG PHẢI XÁC SUẤT</span><b>${esc(d.pick)}</b><small>${esc(d.label)} • football state được đọc trước market.</small></div><div class="fe-p4-market"><span>MARKET CONTEXT</span><b>${esc(d.market)}</b><small>Dữ liệu market chỉ là tham chiếu để đối chiếu với live state.</small></div>',
    )
    s = replace_exact(
        s,
        '<div class="fe-p4-actions"><button class="primary" id="feP4Analyze" type="button">🧠 PHÂN TÍCH</button><button id="feP4Follow" type="button" ${document.querySelector(\'#smaFollowBtn\')?\'\':\'disabled\'}>◎ THEO DÕI</button><button id="feP4Market" type="button">◉ LINE / GIÁ</button><button id="feP4Gpt" type="button">📦 GÓI GPT</button></div>',
        '<div class="fe-p4-actions"><button class="primary" id="feP4Analyze" type="button">🧠 PHÂN TÍCH</button><button id="feP4Follow" type="button" ${document.querySelector(\'#smaFollowBtn\')?\'\':\'disabled\'}>◎ THEO DÕI</button><button id="feP4Gpt" type="button">📦 GÓI GPT</button></div>',
    )
    s = replace_exact(
        s,
        "    byId('feP4Content')?.addEventListener('click',e=>{const id=e.target.closest('button')?.id;if(id==='feP4Analyze')byId('singleAnalyzeBtn')?.click();if(id==='feP4Follow')byId('smaFollowBtn')?.click();if(id==='feP4Market')byId('quickRecordBetBtn')?.click();if(id==='feP4Gpt')byId('prepareBtn')?.click()});",
        "    byId('feP4Content')?.addEventListener('click',e=>{const id=e.target.closest('button')?.id;if(id==='feP4Analyze')byId('singleAnalyzeBtn')?.click();if(id==='feP4Follow')byId('smaFollowBtn')?.click();if(id==='feP4Gpt')byId('prepareBtn')?.click()});",
    )

    # Compile-time marker.
    s = replace_exact(s, '</head>', f'<!-- {PATCH_MARKER} -->\n</head>')

    # Surface-level release gates: no monetary controls/navigation remain in DOM.
    forbidden = [
        'id="betTrackerCard"',
        'id="betStake"',
        'id="betPrice"',
        'id="newBetBtn"',
        'id="quickRecordBetBtn"',
        'id="smaRecordFinalBtn"',
        'href="#betTrackerCard"',
        'id="feP4Market"',
        'THEO DÕI KÈO',
        'Tracker &amp; P/L',
    ]
    for token in forbidden:
        if token in s:
            raise SystemExit(f"STORE_SURFACE_FORBIDDEN_UI_REMAINS: {token}")

    required = [PATCH_MARKER, 'LIVE SIGNALS', 'TÍN HIỆU LIVE', 'MARKET CONTEXT']
    for token in required:
        if token not in s:
            raise SystemExit(f"STORE_SURFACE_REQUIRED_LABEL_MISSING: {token}")

    p.write_text(s, encoding="utf-8")
    print(f"{PATCH_MARKER}: PASS")
    print("Bet Tracker / monetary P&L surfaces removed from Store UI at compile time.")


if __name__ == '__main__':
    main()
