#!/usr/bin/env python3
"""Generate milestone translation keys for en.json / ar.json from milestones_catalog.json."""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "milestones_catalog.json"
EN_JSON = ROOT / "noumow_app" / "assets" / "translations" / "en.json"
AR_JSON = ROOT / "noumow_app" / "assets" / "translations" / "ar.json"

IRREGULAR = {
    "goes": "go",
    "does": "do",
    "has": "have",
    "is": "be",
    "says": "say",
    "runs": "run",
}


def neutralize(text: str) -> str:
    return (
        text.replace(" her ", " their ")
        .replace(" his ", " their ")
        .replace(" him ", " them ")
        .replace(" she ", " they ")
        .replace(" he ", " they ")
    )


def to_base_verb(word: str) -> str:
    if word in IRREGULAR:
        return IRREGULAR[word]
    if word.endswith("ies") and len(word) > 3:
        return word[:-3] + "y"
    if word.endswith("es") and len(word) > 3:
        stem = word[:-2]
        if stem.endswith(("s", "x", "z", "ch", "sh")):
            return stem
    if word.endswith("s") and not word.endswith("ss") and len(word) > 2:
        return word[:-1]
    return word


def format_question(title: str) -> str:
    trimmed = title.strip()
    if not trimmed:
        return "Does your child do this milestone?"
    clause = neutralize(trimmed.lower())
    words = clause.split()
    if words:
        words[0] = to_base_verb(words[0])
    clause = " ".join(words)
    return f"Does your child {clause}?"


def format_question_ar(title_ar: str) -> str:
    trimmed = title_ar.strip().rstrip(".")
    if not trimmed:
        return "هل يحقق طفلك هذا المعلم؟"
    first = trimmed[0]
    # Lowercase first letter for mid-sentence flow in Arabic question.
    if first.isupper():
        trimmed = first.lower() + trimmed[1:]
    return f"هل {trimmed} طفلك؟"


def load_ar_catalog() -> dict:
    ar_path = Path(__file__).with_name("milestone_ar_catalog.json")
    if not ar_path.exists():
        print(f"Missing {ar_path}", file=sys.stderr)
        sys.exit(1)
    return json.loads(ar_path.read_text(encoding="utf-8"))


def merge_into_json(target: Path, new_entries: dict) -> None:
    data = json.loads(target.read_text(encoding="utf-8"))
    data.update(new_entries)
    target.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    ar_catalog = load_ar_catalog()

    en_entries = {
        "milestone_domain_cognitive": "Cognitive",
        "milestone_domain_motor": "Motor",
        "milestone_domain_language": "Language",
        "milestone_domain_social": "Social",
        "milestone_domain_speech": "Speech",
        "milestone_domain_general": "General",
        "milestone_category_cognitive": "Cognitive",
        "milestone_category_motor": "Motor",
        "milestone_category_language": "Language",
        "milestone_category_social": "Social",
        "milestone_category_uncategorized": "Uncategorized",
    }
    ar_entries = {
        "milestone_domain_cognitive": "معرفي",
        "milestone_domain_motor": "حركي",
        "milestone_domain_language": "لغوي",
        "milestone_domain_social": "اجتماعي",
        "milestone_domain_speech": "نطق",
        "milestone_domain_general": "عام",
        "milestone_category_cognitive": "معرفي",
        "milestone_category_motor": "حركي",
        "milestone_category_language": "لغوي",
        "milestone_category_social": "اجتماعي",
        "milestone_category_uncategorized": "غير مصنف",
    }

    for row in catalog:
        mid = row["milestones_id"]
        title = (row.get("title") or "").strip()
        description = (row.get("description") or "").strip()
        ar_row = ar_catalog.get(str(mid), {})
        title_ar = (ar_row.get("title") or title).strip()
        desc_ar = (ar_row.get("description") or description).strip()

        en_entries[f"milestone_{mid}_title"] = title
        en_entries[f"milestone_{mid}_question"] = format_question(title)
        if description:
            en_entries[f"milestone_{mid}_description"] = description

        ar_entries[f"milestone_{mid}_title"] = title_ar
        ar_entries[f"milestone_{mid}_question"] = format_question_ar(title_ar)
        if description or desc_ar:
            ar_entries[f"milestone_{mid}_description"] = desc_ar or description

        normalized = title.lower()
        en_entries[f"milestone_title_{normalized}"] = title
        en_entries[f"milestone_question_{normalized}"] = format_question(title)
        ar_entries[f"milestone_title_{normalized}"] = title_ar
        ar_entries[f"milestone_question_{normalized}"] = format_question_ar(title_ar)

    merge_into_json(EN_JSON, en_entries)
    merge_into_json(AR_JSON, ar_entries)
    print(f"Merged {len(catalog)} milestones into {EN_JSON.name} and {AR_JSON.name}")


if __name__ == "__main__":
    main()
