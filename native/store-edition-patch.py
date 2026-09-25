#!/usr/bin/env python3
"""Compile-time App Store presentation patch for Football Edge.

This patch is deliberately build-time only. It does not modify engine states,
thresholds, ranking, calibration or PRESENT-FIRST logic, and it does not add a
remote switch. It only changes Store-facing wording/presentation in the frozen
native web bundle.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

PATCH_MARKER = "FE_STORE_EDITION_PATCH_V1"
STORE_META = '<meta name="football-edge-store-edition" content="1">'


def replace_exact(text: str, old: str, new: str, *, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(
            f"STORE_PATCH_BASELINE_MISMATCH: expected {expected} occurrence(s), "
            f"found {count}: {old[:120]!r}"
        )
    return text.replace(old, new)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="www/index.html")
    ap.add_argument("--manifest", default="store-edition.manifest.json")
    args = ap.parse_args()

    index_path = Path(args.index)
    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if manifest.get("mode") != "compile_time_store_edition":
        raise SystemExit("STORE_MANIFEST_MODE_INVALID")
    if manifest.get("remote_feature_override_allowed") is not False:
        raise SystemExit("STORE_MANIFEST_REMOTE_OVERRIDE_MUST_BE_FALSE")
    if manifest.get("bundle_id") != "vn.footballedge.app":
        raise SystemExit("STORE_MANIFEST_BUNDLE_ID_MISMATCH")

    s = index_path.read_text(encoding="utf-8")
    if PATCH_MARKER in s:
        raise SystemExit("STORE_PATCH_ALREADY_APPLIED")

    # Build marker: fixed at compile time, never remotely toggled.
    s = replace_exact(
        s,
        "</head>",
        f"{STORE_META}\n<!-- {PATCH_MARKER} -->\n</head>",
        expected=1,
    )

    # Main dashboard public labels. IDs and internal state names remain unchanged.
    s = replace_exact(
        s,
        '<div class="fe-p1-kpi good"><span>ENTRY SUITABLE</span><b id="feP1SuitableCount">0</b></div>',
        '<div class="fe-p1-kpi good"><span>STRONG SIGNAL</span><b id="feP1SuitableCount">0</b></div>',
    )
    s = replace_exact(
        s,
        "`${tops.length} TOP • ${suitable} SUITABLE`",
        "`${tops.length} TOP • ${suitable} STRONG SIGNAL`",
    )
    s = replace_exact(
        s,
        '<span><b>ENTRY SUITABLE</b><strong>${suitableN}</strong></span>',
        '<span><b>STRONG SIGNAL</b><strong>${suitableN}</strong></span>',
    )

    # Explain the same analytical gates without wagering-directed language.
    old_note = (
        '<div class="master-op-note"><b>1 fixture = 1 card.</b> Entry Policy đang chạy trong release '
        '<b>V1.23.2</b>: Signal + Data Reality + Market Behavior + Price Zone + Edge → '
        '<b>SUITABLE / WAIT PRICE / WAIT CONFIRM / CAUTION / PASS</b>. Chỉ là lớp ứng xử/advisory, '
        '<b>không tự vào kèo và chưa thay TOP Ranking/core.</b></div>'
    )
    new_note = (
        '<div class="master-op-note"><b>1 fixture = 1 card.</b> Analysis State đang chạy trong release '
        '<b>V1.23.2</b>: Signal + Data Reality + Market Behavior + Market Range + Model Gap → '
        '<b>STRONG SIGNAL / MARKET CONFIRMATION PENDING / CONFIRMATION PENDING / CAUTION / INSUFFICIENT EVIDENCE</b>. '
        'Đây là lớp phân tích/advisory; <b>không thực hiện giao dịch và không thay TOP Ranking/core.</b></div>'
    )
    s = replace_exact(s, old_note, new_note)

    # Store-only display helpers. Internal enums (SUITABLE / WAIT_PRICE / etc.) are preserved.
    helper_anchor = "  function epPolicyCardHTML(p){"
    helper = r'''  function feStorePolicyLabel(status){
    return ({SUITABLE:'STRONG SIGNAL',WAIT_PRICE:'MARKET CONFIRMATION PENDING',WAIT_CONFIRM:'CONFIRMATION PENDING',CAUTION:'CAUTION',PASS:'INSUFFICIENT EVIDENCE'})[String(status||'')]||String(status||'—');
  }
  function feStorePublicText(value){
    return String(value||'')
      .replace(/ENTRY POLICY/gi,'ANALYSIS STATE')
      .replace(/WAIT PRICE/gi,'MARKET CONFIRMATION PENDING')
      .replace(/WAIT CONFIRM/gi,'CONFIRMATION PENDING')
      .replace(/\bSUITABLE\b/g,'STRONG SIGNAL')
      .replace(/\bPASS\b/g,'INSUFFICIENT EVIDENCE')
      .replace(/PRICE ZONE/gi,'MARKET RANGE')
      .replace(/\bPRICE\b/gi,'MARKET REFERENCE')
      .replace(/\bEDGE\b/gi,'MODEL GAP')
      .replace(/\bentry\b/gi,'analysis')
      .replace(/vào kèo/gi,'xác nhận tín hiệu')
      .replace(/không phù hợp để vào/gi,'chưa đủ điều kiện xác nhận')
      .replace(/giá hiện tại/gi,'market context hiện tại')
      .replace(/giá ngoài vùng/gi,'market context ngoài vùng');
  }
'''
    s = replace_exact(s, helper_anchor, helper + helper_anchor)

    old_policy_card = """    return `<div class=\"entry-policy-card\"><div class=\"top\"><div><b>${esc(title)}</b><div style=\"margin-top:2px;font-size:6.8px;color:var(--muted)\">${esc(market)}</div></div><span class=\"entry-policy-status ${esc(p.cls)}\">${esc(p.status)}</span></div><div class=\"entry-policy-gates\">${epGateHTML(p.signal,'SIGNAL')}${epGateHTML(p.data,'DATA')}${epGateHTML(p.market,'MARKET')}${epGateHTML(p.price,'PRICE')}${epGateHTML(p.edge,'EDGE')}</div><div class=\"entry-policy-reason\">${esc(p.reason)}</div></div>`;"""
    new_policy_card = """    return `<div class=\"entry-policy-card\"><div class=\"top\"><div><b>${esc(title)}</b><div style=\"margin-top:2px;font-size:6.8px;color:var(--muted)\">${esc(market)}</div></div><span class=\"entry-policy-status ${esc(p.cls)}\">${esc(feStorePolicyLabel(p.status))}</span></div><div class=\"entry-policy-gates\">${epGateHTML(p.signal,'SIGNAL')}${epGateHTML(p.data,'DATA')}${epGateHTML(p.market,'MARKET')}${epGateHTML(p.price,'MARKET RANGE')}${epGateHTML(p.edge,'MODEL GAP')}</div><div class=\"entry-policy-reason\">${esc(feStorePublicText(p.reason))}</div></div>`;"""
    s = replace_exact(s, old_policy_card, new_policy_card)

    old_policy_shell = """    return `<div class=\"entry-policy-shell\"><div class=\"entry-policy-head\"><b>◆ ENTRY POLICY • ADVISORY</b><span>${esc(o.status)}</span></div><div class=\"entry-policy-overall ${esc(o.cls)}\"><b>${esc(o.status)}</b><small>${esc(o.reason)}</small></div><div class=\"entry-policy-grid\">${ps.map(epPolicyCardHTML).join('')}</div><div class=\"entry-policy-foot\"><b>Gating:</b> SIGNAL → DATA → MARKET BEHAVIOR → PRICE ZONE → EDGE. <b>SUITABLE</b> chỉ xuất hiện khi cùng một market candidate qua đủ các gate. Không tự đặt cược, không tự đổi TOP Ranking. HC chưa có Fair Cover Probability thì không được gọi SUITABLE chỉ nhờ GAP/market.</div></div>`"""
    new_policy_shell = """    return `<div class=\"entry-policy-shell\"><div class=\"entry-policy-head\"><b>◆ ANALYSIS STATE • ADVISORY</b><span>${esc(feStorePolicyLabel(o.status))}</span></div><div class=\"entry-policy-overall ${esc(o.cls)}\"><b>${esc(feStorePolicyLabel(o.status))}</b><small>${esc(feStorePublicText(o.reason))}</small></div><div class=\"entry-policy-grid\">${ps.map(epPolicyCardHTML).join('')}</div><div class=\"entry-policy-foot\"><b>Gating:</b> SIGNAL → DATA → MARKET BEHAVIOR → MARKET RANGE → MODEL GAP. <b>STRONG SIGNAL</b> chỉ xuất hiện khi cùng một market context qua đủ các gate. Đây là trạng thái phân tích, không thực hiện giao dịch và không tự đổi TOP Ranking. HC chưa có Fair Cover Probability thì chỉ được dùng như context.</div></div>`"""
    s = replace_exact(s, old_policy_shell, new_policy_shell)

    # Market context card: preserve model math, change only Store-facing terminology.
    old_candidate_unsupported = """    if(!c.supported){const dec=Number(c.dec),z=c.zone,zone=z?`<span class=\"entry-edge-zone ${z.cls}\">${esc(z.label)}</span>`:'';return `<div class=\"entry-edge-box ${esc(c.cls||'observer')}\"><div class=\"entry-edge-title\"><b>${esc(title)}</b><span>${c.market?esc(mnMarketLabel(c.market.category,c.market.line)):'OBS'}</span></div><div class=\"entry-edge-verdict\">${esc(c.status||'OBSERVE')}</div>${zone}<div class=\"entry-edge-reason\">${esc(c.reason||'')}</div>${Number.isFinite(dec)?`<div class=\"entry-edge-metrics\"><div><span>PRICE</span><b>${dec.toFixed(2)}</b></div><div><span>NO-VIG MKT</span><b>${eiPct(c.marketProb)}</b></div></div>`:''}</div>`}"""
    new_candidate_unsupported = """    if(!c.supported){const dec=Number(c.dec),z=c.zone,zone=z?`<span class=\"entry-edge-zone ${z.cls}\">${esc(feStorePublicText(z.label))}</span>`:'';return `<div class=\"entry-edge-box ${esc(c.cls||'observer')}\"><div class=\"entry-edge-title\"><b>${esc(title)}</b><span>${c.market?esc(mnMarketLabel(c.market.category,c.market.line)):'OBS'}</span></div><div class=\"entry-edge-verdict\">${esc(feStorePublicText(c.status||'OBSERVE'))}</div>${zone}<div class=\"entry-edge-reason\">${esc(feStorePublicText(c.reason||''))}</div>${Number.isFinite(dec)?`<div class=\"entry-edge-metrics\"><div><span>MARKET DECIMAL</span><b>${dec.toFixed(2)}</b></div><div><span>NO-VIG MARKET</span><b>${eiPct(c.marketProb)}</b></div></div>`:''}</div>`}"""
    s = replace_exact(s, old_candidate_unsupported, new_candidate_unsupported)

    old_candidate_supported = """    return `<div class=\"entry-edge-box ${esc(c.cls)}\"><div class=\"entry-edge-title\"><b>${esc(title)} ${Number.isFinite(c.line)?esc(c.line):''}</b><span>${esc(c.basis)} n=${esc(c.sampleN)}</span></div><div class=\"entry-edge-verdict\">${esc(c.status)}</div><span class=\"entry-edge-zone ${esc(c.zone.cls)}\">${esc(c.zone.label)}</span><div class=\"entry-edge-metrics\"><div><span>MODEL FAIR</span><b>${eiPct(c.modelProb)}</b></div><div><span>BREAK-EVEN</span><b>${eiPct(c.breakEven)}</b></div><div><span>NO-VIG MARKET</span><b>${eiPct(c.marketProb)}</b></div><div><span>PRICE</span><b>${c.dec.toFixed(2)}</b></div><div><span>EDGE</span><b>${eiSignedPct(c.edge)}</b></div><div><span>MODEL EV</span><b>${eiSignedPct(c.ev)}</b></div></div><div class=\"entry-edge-reason\">${esc(c.reason)}</div></div>`"""
    new_candidate_supported = """    return `<div class=\"entry-edge-box ${esc(c.cls)}\"><div class=\"entry-edge-title\"><b>${esc(title)} ${Number.isFinite(c.line)?esc(c.line):''}</b><span>${esc(c.basis)} n=${esc(c.sampleN)}</span></div><div class=\"entry-edge-verdict\">${esc(feStorePublicText(c.status))}</div><span class=\"entry-edge-zone ${esc(c.zone.cls)}\">${esc(feStorePublicText(c.zone.label))}</span><div class=\"entry-edge-metrics\"><div><span>MODEL FAIR</span><b>${eiPct(c.modelProb)}</b></div><div><span>REFERENCE BREAK-EVEN</span><b>${eiPct(c.breakEven)}</b></div><div><span>NO-VIG MARKET</span><b>${eiPct(c.marketProb)}</b></div><div><span>MARKET DECIMAL</span><b>${c.dec.toFixed(2)}</b></div><div><span>MODEL GAP</span><b>${eiSignedPct(c.edge)}</b></div><div><span>MODEL DELTA</span><b>${eiSignedPct(c.ev)}</b></div></div><div class=\"entry-edge-reason\">${esc(feStorePublicText(c.reason))}</div></div>`"""
    s = replace_exact(s, old_candidate_supported, new_candidate_supported)

    old_entry_html = """    return `<div class=\"entry-edge-shell\"><div class=\"entry-edge-head\"><b>◇ FAIR PRICE & EDGE • SHADOW</b><span>${good?`${good} EDGE`:pass?`${pass} PASS`:'OBSERVE'}</span></div><div class=\"entry-edge-grid\">${cs.map(eiCandidateHTML).join('')}</div><div class=\"entry-edge-foot\"><b>Rule:</b> chỉ tìm edge trong DEC ${EI_PRICE_POLICY.min.toFixed(2)}–${EI_PRICE_POLICY.max.toFixed(2)}; SWEET ${EI_PRICE_POLICY.sweetMin.toFixed(2)}–${EI_PRICE_POLICY.sweetMax.toFixed(2)}. Ngoài vùng = PASS. Đây là SHADOW, chưa thay TOP/engine.</div></div>`"""
    new_entry_html = """    return `<div class=\"entry-edge-shell\"><div class=\"entry-edge-head\"><b>◇ MARKET CONTEXT • SHADOW</b><span>${good?`${good} MODEL SUPPORT`:pass?`${pass} INSUFFICIENT`:'OBSERVE'}</span></div><div class=\"entry-edge-grid\">${cs.map(eiCandidateHTML).join('')}</div><div class=\"entry-edge-foot\"><b>Rule:</b> market reference chỉ là context để so với live state và model. Vùng DEC ${EI_PRICE_POLICY.min.toFixed(2)}–${EI_PRICE_POLICY.max.toFixed(2)} được dùng cho calibration; ngoài vùng = insufficient evidence. Đây là SHADOW và không thay TOP/engine.</div></div>`"""
    s = replace_exact(s, old_entry_html, new_entry_html)

    # Final safety assertions for this phase.
    must_have = [
        STORE_META,
        PATCH_MARKER,
        "STRONG SIGNAL",
        "ANALYSIS STATE • ADVISORY",
        "MARKET CONTEXT • SHADOW",
        "feStorePolicyLabel",
        "feStorePublicText",
    ]
    for token in must_have:
        if token not in s:
            raise SystemExit(f"STORE_PATCH_ASSERT_MISSING: {token}")

    # These exact Store-facing labels must no longer exist after patching.
    forbidden_exact = [
        "ENTRY POLICY • ADVISORY",
        "ENTRY SUITABLE</span>",
        "FAIR PRICE & EDGE • SHADOW",
        "${suitable} SUITABLE`",
    ]
    for token in forbidden_exact:
        if token in s:
            raise SystemExit(f"STORE_PATCH_ASSERT_FORBIDDEN_VISIBLE_LABEL: {token}")

    index_path.write_text(s, encoding="utf-8")
    print(f"{PATCH_MARKER}: PASS")
    print("Engine enums and scoring logic preserved; Store-facing wording patched at compile time.")


if __name__ == "__main__":
    main()
