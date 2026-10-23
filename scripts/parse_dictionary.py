# /// script
# dependencies = ["pymupdf"]
# ///
"""Parse the Cambridge Essential English Dictionary PDF into data/dictionary.raw.json.

Usage: uv run scripts/parse_dictionary.py <pdf> [out.json]

Every span is classified by its font (headword, IPA, part of speech, sense number,
CEFR level, definition, example, cross-reference), then a small state machine
builds entries. Dictionary body is pages 23..486 (0-based); the rest is front
matter, picture pages and appendices.
"""

import json
import re
import sys

import pymupdf

FIRST_PAGE, LAST_PAGE = 23, 486
LIGATURES = str.maketrans({"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"})


def kind(span):
    f, size = span["font"], span["size"]
    if "c94bdc09.B" in f:
        if size >= 10:
            return "HW"
        return "HOM" if size < 7.6 and span["flags"] & 1 else "BOLD"
    if "e692faf0" in f:
        return "IPA"
    if "5188aaaf" in f:
        return "POS"
    if "P80738" in f:
        return "NUM"
    if "Frutiger" in f:
        return "LEVEL"
    if "P8E16" in f:
        return "LABEL"
    if f.endswith(".I") or ".I+" in f or ".BI" in f:
        return "EX"
    if "edce0ee0" in f:
        return "XREF"
    if span["text"].strip() == "•":
        return "BULLET"
    if span["text"].strip() == "◦":
        return "SEP"
    return "TEXT"


def in_box(spans):
    """'Common mistake' and similar note boxes: small body font, or a header line opening with the POS font."""
    return (
        any("b4b87a6a" in s["font"] for s in spans)
        or (kind(spans[0]) == "POS" and spans[0]["size"] < 7.9)
        or max(s["size"] for s in spans) < 7.4
    )


def lines(doc):
    """Yield (page, [(kind, text)]) per text line in reading order (column, then y)."""
    for pno in range(FIRST_PAGE, LAST_PAGE + 1):
        page = doc[pno]
        rows = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["size"] > 5.5 and "81a3ca9e" not in s["font"] and s["text"].strip()]
                x, y = line["bbox"][0], line["bbox"][1]
                if not spans or y < 45 or y > 555 or in_box(spans):
                    continue
                spans = [s for s in line["spans"] if s["size"] > 5.5 and "81a3ca9e" not in s["font"]]
                rows.append((x >= 200, round(y), x, [(kind(s), s["text"].translate(LIGATURES)) for s in spans]))
        for _, _, _, toks in sorted(rows, key=lambda r: r[:3]):
            yield pno, toks


def brk(s):
    # ponytail: always joins "word-\nword", so real hyphens at line ends ("re-|election") lose the hyphen; the review pass fixes those
    return s[:-1] if s.endswith("-") and not s.endswith(" -") else s + " "


def clean(s):
    return re.sub(r"\s+", " ", s).strip()


def new_sense():
    return {"level": None, "phrase": "", "labels": "", "def": "", "examples": []}


def parse(doc):
    entries, entry, node, sense, mode = [], None, None, None, None
    pv = None  # (phrase, labels) of the phrasal verb whose numbered senses follow

    def open_sense():
        nonlocal sense
        if sense is None:
            sense = new_sense()
            node["senses"].append(sense)
        return sense

    def append_text(s):
        # Route plain text to wherever we currently are.
        if mode == "xref":
            entry["see"][-1] += s
        elif mode == "ex":
            sense["examples"][-1] += s
        elif sense is None and not node["senses"] and not s.strip(":").strip():
            pass
        else:
            open_sense()["def"] += s

    for pno, toks in lines(doc):
        first = toks[0][0]
        if first == "HW" and entry and node is entry and mode == "head" and not (entry["ipa"] or entry["pos"] or entry["gram"]):
            entry["word"] += " "  # headword wrapped onto a second line
        elif first == "HW":
            entry = {"word": "", "hom": None, "ipa": "", "pos": "", "gram": "", "senses": [], "derived": [], "see": [], "page": pno}
            entries.append(entry)
            node, sense, mode, pv = entry, None, "head", None
        elif entry is None:
            continue
        elif first == "BOLD" and mode not in ("head", "dhead") and any(k == "POS" for k, _ in toks):
            # phrasal verb sub-entry: "add *something* up phrasal verb ..."
            sense = new_sense()
            node["senses"].append(sense)
            mode = "pv"
        for k, t in toks:
            if k == "HW":
                entry["word"] += t
            elif k == "HOM":
                entry["hom"] = int(t) if t.strip().isdigit() else entry["hom"]
            elif k == "BULLET":
                node = {"word": "", "ipa": "", "pos": "", "gram": "", "senses": []}
                entry["derived"].append(node)
                sense, mode = None, "dhead"
            elif k == "XREF":
                entry["see"].append("")
                mode = "xref"
            elif mode == "xref" and k not in ("NUM",):
                entry["see"][-1] += t
            elif mode == "pv" and k in ("BOLD", "EX", "TEXT"):
                sense["phrase"] += t
            elif mode == "pv" and k == "POS":
                sense["labels"] += t
                pv, mode = sense, "sense"
            elif k == "NUM":
                header = pv is not None and sense is pv and not sense["def"].strip() and not sense["examples"]
                if not header:
                    sense = new_sense()
                    node["senses"].append(sense)
                    if pv is not None:
                        sense["phrase"], sense["labels"] = pv["phrase"], pv["labels"]
                mode = "sense"
            elif k == "LEVEL":
                open_sense()["level"] = t.strip()
                mode = "sense"
            elif mode == "dhead" and k == "BOLD":
                node["word"] += t
            elif mode in ("head", "dhead") and k == "IPA":
                node["ipa"] += t
            elif mode in ("head", "dhead") and k == "POS":
                node["pos"] += t
            elif mode in ("head", "dhead") and k == "TEXT" and t.strip() == "," and node["pos"]:
                node["pos"] += ", "  # "adv, preposition"
            elif mode in ("head", "dhead") and k in ("LABEL", "BOLD") or (mode in ("head", "dhead") and k == "TEXT" and t.strip() in ("/", "")):
                if k != "TEXT":
                    node["gram"] += t
            elif k == "EX" and sense is not None and sense["phrase"] and not sense["def"].strip() and not sense["examples"]:
                sense["phrase"] += t  # italic tail of a phrase, e.g. "make the best of *something*"
            elif k == "EX" or k == "SEP":
                s = open_sense()
                if k == "SEP" or mode != "ex":
                    s["examples"].append("")
                if k == "EX":
                    s["examples"][-1] += t
                mode = "ex"
            elif k == "BOLD" and sense is not None and not sense["def"].strip() and not sense["examples"]:
                sense["phrase"] += t
                mode = "sense"
            elif k == "BOLD" and sense is None and not node["senses"] and mode in ("head", "dhead"):
                node["gram"] += t
            elif k == "LABEL" and (sense is None or not sense["def"].strip()) and not (sense and sense["examples"]):
                open_sense()["labels"] += t
                mode = "sense"
            else:
                if mode in ("head", "dhead") and k == "TEXT":
                    mode = "sense"
                if mode == "ex" and k != "EX":
                    mode = "sense"
                append_text(t)
        # line break: join hyphenated words, otherwise a space
        if mode == "xref" and entry["see"]:
            entry["see"][-1] = brk(entry["see"][-1])
        elif sense is not None:
            if mode == "ex" and sense["examples"]:
                sense["examples"][-1] = brk(sense["examples"][-1])
            else:
                sense["def"] = brk(sense["def"])
                sense["phrase"] = brk(sense["phrase"]) if sense["phrase"] else ""
                sense["labels"] = brk(sense["labels"]) if sense["labels"] else ""
        if mode in ("head", "dhead"):
            node["gram"] = brk(node["gram"]) if node["gram"] else ""
            node["pos"] = brk(node["pos"]) if node["pos"] else ""
    return entries


def tidy(node):
    for key in ("word", "ipa", "pos", "gram"):
        if key in node:
            node[key] = clean(node[key])
    node["ipa"] = node["ipa"].strip("/ ")
    for s in node["senses"]:
        s["phrase"], s["labels"] = clean(s["phrase"]), clean(s["labels"])
        s["def"] = clean(s["def"]).rstrip(":").strip()
        s["examples"] = [e for e in (clean(x) for x in s["examples"]) if e]
        m = re.match(r"phrasal( verb)?\b\s*", s["def"])
        if m:
            s["def"], s["labels"] = s["def"][m.end():], clean(s["labels"] + " phrasal verb")
        # an italic "something"/"someone" at the end of a phrase line lands as the first example
        while s["examples"] and re.fullmatch(r"(some(one|thing|body|where)[/ ]?)+", s["examples"][0]):
            s["phrase"] = clean(s["phrase"] + " " + s["examples"].pop(0))
    node["senses"] = [s for s in node["senses"] if s["def"] or s["examples"]]


LEVELS = ["A1", "A2", "B1"]

if __name__ == "__main__":
    doc = pymupdf.open(sys.argv[1])
    out = sys.argv[2] if len(sys.argv) > 2 else "data/dictionary.raw.json"
    entries = parse(doc)
    for i, e in enumerate(entries):
        e["id"] = i + 1
        tidy(e)
        for d in e["derived"]:
            tidy(d)
        e["see"] = [clean(x) for x in e["see"] if clean(x)]
        found = [s["level"] for s in e["senses"] if s["level"] in LEVELS]
        e["level"] = min(found, key=LEVELS.index) if found else None
    with open(out, "w") as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)
    by = {lv: sum(e["level"] == lv for e in entries) for lv in LEVELS + [None]}
    print(f"{len(entries)} entries -> {out}; by level {by}")
