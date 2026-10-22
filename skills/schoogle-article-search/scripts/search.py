#!/usr/bin/env python3
"""Vyhledávání v databázi artiklů Schoogle (SAP artikly závodů Ústí a Effretikon).

Data jsou master CSV ze statického webu Schoogle (Windows-1250, oddělovač `;`).
Skript je stáhne, uloží do cache (platí 6 h) a hledá v nich.

    python3 search.py "3RV2011-1CA10"
    python3 search.py "UT 2,5" --manufacturer phoenix --limit 5
    python3 search.py "jistic C16" --json
    python3 search.py "2002-1201" --csv master-data.csv   # vlastní soubor, bez sítě

⚠️ Tentýž algoritmus má nástroj `find_article` v DZL Konfigurátoru
(`packages/api/src/articles/articleSearch.ts`). Změna normalizace nebo
skórování patří do obou, jinak najdou na tentýž dotaz jiné artikly.

Pravidla:
- všechna slova dotazu musí sedět (AND), každé v kterémkoli poli;
- velikost písmen, diakritika a oddělovače (mezera - _ . / ,) nerozhodují;
- slovo do 3 znaků musí ležet na začátku slova pole (`ut` nenajde `dutinka`);
- slovo s oddělovačem ho vyžaduje i v poli (`2,5` nenajde `M25`, ale `2.5` ano);
- čistě písmenné slovo od 5 znaků zkusí i kmen (`svorka` najde `svorky`);
- kód rozepsaný do více slov (`UT 2,5`) vyhraje nad delším kódem (`UTTB 2,5`).
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import tempfile
import time
import unicodedata
import urllib.request
from pathlib import Path

DEFAULT_URLS = {
    "usti": "https://raw.githubusercontent.com/ondreu/robo-filler/main/public/master-data.csv",
    "effi": "https://raw.githubusercontent.com/ondreu/robo-filler/main/public/master-data-effi.csv",
}
TTL_S = 6 * 60 * 60
APP_URL = "https://ondreu.github.io/robo-filler/"

FIELDS = ["typoveOznaceni", "artikl", "cisloDiluVyrobce", "vyrobce", "nazev"]
CODE_FIELDS = ["typoveOznaceni", "artikl", "cisloDiluVyrobce"]
FIELD_WEIGHT = {"typoveOznaceni": 1, "artikl": 1, "cisloDiluVyrobce": 1, "vyrobce": 0.9, "nazev": 0.8}
COLUMNS = ["typoveOznaceni", "artikl", "vyrobce", "nazev", "cisloDiluVyrobce", "vybehovyDil", "status"]

SEP_CHARS = " \t\r\n\f\v-_./,"
SEPARATORS = re.compile(r"[\s\-_./,]+")
SEP_CLASS = r"[\s\-_./,]"


# ── data ─────────────────────────────────────────────────────────────────────

def cache_dir() -> Path:
    d = Path(os.environ.get("SCHOOGLE_CACHE") or Path(tempfile.gettempdir()) / "schoogle-cache")
    d.mkdir(parents=True, exist_ok=True)
    return d


def fetch(url: str, target: Path, refresh: bool) -> Path:
    if not refresh and target.exists() and time.time() - target.stat().st_mtime < TTL_S:
        return target
    try:
        with urllib.request.urlopen(url, timeout=60) as res:
            data = res.read()
    except Exception as err:  # síť nebo blokovaná doména
        if target.exists():
            print(f"[varování] obnova dat selhala ({err}); používám uložená z cache", file=sys.stderr)
            return target
        raise SystemExit(
            f"Databázi se nepodařilo stáhnout: {url}\n  ({err})\n"
            "Když sandbox na tuhle adresu nesmí, nahrajte soubor master-data.csv a spusťte "
            "skript s --csv <soubor>, nebo povolte doménu raw.githubusercontent.com."
        )
    tmp = target.with_suffix(".tmp")
    tmp.write_bytes(data)
    tmp.replace(target)
    return target


def parse_csv(path: Path, db: str) -> list[dict]:
    text = path.read_bytes().decode("cp1250", errors="replace")
    out = []
    for line in re.split(r"\r?\n", text)[1:]:
        if not line.strip():
            continue
        parts = line.split(";")
        if len(parts) < 5:
            continue
        row = {c: (parts[i].strip() if i < len(parts) else "") for i, c in enumerate(COLUMNS)}
        row["db"] = db
        out.append(row)
    return out


# ── normalizace ──────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if not 0x300 <= ord(ch) <= 0x36F).lower()


def compact(s: str) -> str:
    return SEPARATORS.sub("", s)


def word_starts(norm: str) -> set[int]:
    starts, pos, prev, after_sep = {0}, 0, "", False
    for ch in norm:
        if ch in SEP_CHARS or ch.isspace():
            after_sep = True
            continue
        kind = "d" if ch.isdigit() and ch.isascii() else "a"
        if after_sep or (prev and prev != kind):
            starts.add(pos)
        prev, after_sep = kind, False
        pos += 1
    return starts


def prepare_field(value: str) -> dict:
    norm = normalize(value)
    return {"norm": norm, "compact": compact(norm), "starts": word_starts(norm)}


def prepare(rows: list[dict]) -> list[dict]:
    """Normalizace jednou předem; řádek z obou závodů je jednou (`dbs`)."""
    by_key: dict[str, dict] = {}
    for a in rows:
        key = "|".join(compact(normalize(a[f])) for f in ("artikl", "typoveOznaceni", "vyrobce", "nazev", "cisloDiluVyrobce"))
        known = by_key.get(key)
        if known:
            if a["db"] not in known["dbs"]:
                known["dbs"].append(a["db"])
            if not known["article"]["status"] and a["status"]:
                known["article"]["status"] = a["status"]
            if not known["article"]["vybehovyDil"] and a["vybehovyDil"]:
                known["article"]["vybehovyDil"] = a["vybehovyDil"]
            continue
        by_key[key] = {"article": dict(a), "dbs": [a["db"]], "fields": {f: prepare_field(a[f]) for f in FIELDS}}
    return list(by_key.values())


# ── hledání ──────────────────────────────────────────────────────────────────

def query_tokens(query: str) -> list[dict]:
    tokens = []
    for raw in normalize(query).split():
        raw = re.sub(r"^[-_./,]+|[-_./,]+$", "", raw)
        c = compact(raw)
        if not c:
            continue
        runs = [r for r in SEPARATORS.split(raw) if r]
        tokens.append({
            "compact": c,
            "separated": re.compile((SEP_CLASS + "+").join(re.escape(r) for r in runs)) if len(runs) > 1 else None,
            "stem": c[:-1] if re.fullmatch(r"[a-z]{5,}", c) else None,
        })
    return tokens


def match_score(token: str, f: dict) -> float:
    c = f["compact"]
    if not c:
        return 0
    if c == token:
        return 100
    if c.startswith(token):
        return 85
    best = 0
    idx = c.find(token)
    while idx != -1:
        if idx in f["starts"]:
            return 65
        if len(token) > 3:
            best = 40
        idx = c.find(token, idx + 1)
    return best


def token_score(tok: dict, f: dict) -> float:
    if tok["separated"] and not tok["separated"].search(f["norm"]):
        return 0
    s = match_score(tok["compact"], f)
    if s > 0 or not tok["stem"]:
        return s
    return match_score(tok["stem"], f) * 0.9


def search(prepared: list[dict], query: str, field: str | None = None, manufacturer: str | None = None,
           db: str = "both", limit: int = 20) -> tuple[int, list[dict]]:
    tokens = query_tokens(query)
    if not tokens:
        return 0, []
    fields = [field] if field else FIELDS
    code_fields = [f for f in CODE_FIELDS if f in fields]
    mfr = compact(normalize(manufacturer)) if manufacturer else ""
    limit = max(1, min(limit, 100))
    parts = [t["compact"] for t in tokens]
    runs = []
    for i in range(len(parts)):
        joined = parts[i]
        for j in range(i + 1, len(parts)):
            joined += parts[j]
            runs.append((joined, (j - i + 1) / len(parts)))

    hits = []
    for p in prepared:
        if db != "both" and db not in p["dbs"]:
            continue
        if mfr and mfr not in p["fields"]["vyrobce"]["compact"]:
            continue
        total, ok = 0.0, True
        for t in tokens:
            best = max(token_score(t, p["fields"][f]) * FIELD_WEIGHT[f] for f in fields)
            if best == 0:
                ok = False
                break
            total += best
        if not ok:
            continue
        score = total / len(tokens)
        for joined, share in runs:
            for f in code_fields:
                if p["fields"][f]["compact"] == joined:
                    score = max(score, 90 + 10 * share)
        if p["article"]["status"] == "U":
            score -= 1
        hits.append({"article": p["article"], "dbs": p["dbs"], "score": math.floor(score * 10 + 0.5) / 10})  # = Math.round v DZL
    hits.sort(key=lambda h: (-h["score"], len(h["article"]["typoveOznaceni"]), h["article"]["artikl"]))
    return len(hits), hits[:limit]


# ── výstup ───────────────────────────────────────────────────────────────────

ZAVOD = {"usti": "Ústí", "effi": "Effretikon"}


def as_json(total: int, hits: list[dict]) -> dict:
    out = {"total": total, "shown": len(hits), "articles": []}
    if total > len(hits):
        out["truncated"] = f"Zobrazeno {len(hits)} z {total} — upřesněte dotaz."
    for h in hits:
        a = h["article"]
        item = {
            "artikl": a["artikl"], "typoveOznaceni": a["typoveOznaceni"], "vyrobce": a["vyrobce"],
            "nazev": a["nazev"], "cisloDiluVyrobce": a["cisloDiluVyrobce"] or None,
            "zavod": " + ".join(ZAVOD[d] for d in h["dbs"]), "status": a["status"] or None, "score": h["score"],
        }
        if a["status"] == "U":
            item["neaktivni"] = "Materiál není aktivní — nepoužívat."
        if a["vybehovyDil"]:
            item["nahrada"] = a["vybehovyDil"]
            item["vybehovy"] = "Výběhový díl — použijte náhradu."
        out["articles"].append({k: v for k, v in item.items() if v is not None})
    return out


def as_text(total: int, hits: list[dict]) -> str:
    if not hits:
        return "Nic nenalezeno."
    lines = [f"Nalezeno {total}" + (f", zobrazeno {len(hits)}" if total > len(hits) else "") + ":"]
    for h in hits:
        a = h["article"]
        flags = []
        if a["status"] == "U":
            flags.append("NEAKTIVNÍ")
        if a["vybehovyDil"]:
            flags.append(f"VÝBĚHOVÝ → náhrada {a['vybehovyDil']}")
        lines.append(
            f"- {a['artikl']} | {a['typoveOznaceni'] or '—'} | {a['vyrobce'] or '—'} | {a['nazev']}"
            + (f" | č. dílu {a['cisloDiluVyrobce']}" if a["cisloDiluVyrobce"] else "")
            + f" | {' + '.join(ZAVOD[d] for d in h['dbs'])} | shoda {h['score']}"
            + (f" | {'; '.join(flags)}" if flags else "")
        )
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description="Vyhledávání artiklů v databázi Schoogle")
    ap.add_argument("query", help="typové označení, artikl, název nebo jejich části")
    ap.add_argument("--field", choices=FIELDS, help="hledat jen v jednom poli")
    ap.add_argument("--manufacturer", help="jen tento výrobce (podřetězec)")
    ap.add_argument("--db", choices=["usti", "effi", "both"], default="both")
    ap.add_argument("--limit", type=int, default=15)
    ap.add_argument("--json", action="store_true", help="výstup jako JSON")
    ap.add_argument("--csv", action="append", help="vlastní master CSV místo stažení (lze opakovat)")
    ap.add_argument("--refresh", action="store_true", help="stáhnout data znovu i z platné cache")
    args = ap.parse_args()

    if args.csv:
        rows = [r for path in args.csv for r in parse_csv(Path(path), "effi" if "effi" in Path(path).name else "usti")]
    else:
        rows = []
        for db, url in DEFAULT_URLS.items():
            url = os.environ.get(f"SCHOOGLE_{db.upper()}_URL") or url
            rows += parse_csv(fetch(url, cache_dir() / f"{db}.csv", args.refresh), db)

    total, hits = search(prepare(rows), args.query, args.field, args.manufacturer, args.db, args.limit)
    if args.json:
        print(json.dumps(as_json(total, hits), ensure_ascii=False, indent=2))
    else:
        print(as_text(total, hits))


if __name__ == "__main__":
    main()
