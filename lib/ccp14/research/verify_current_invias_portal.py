"""Verify fresh CCP-14 downloads from the current official INVÍAS portal."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path

import pypdf

HERE = Path(__file__).resolve().parent
LOCKS = json.loads((HERE / "source-locks.json").read_text(encoding="utf-8"))


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require_locked_bytes(path: Path, lock: dict[str, object]) -> bytes:
    data = path.read_bytes()
    if len(data) != lock["bytes"] or digest(data) != lock["sha256"]:
        raise AssertionError(f"official bytes differ: {lock['id']}")
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--resolution", type=Path, required=True)
    parser.add_argument("--zip", dest="archive", type=Path, required=True)
    args = parser.parse_args()

    by_id = {source["id"]: source for source in LOCKS["sources"]}
    resolution_lock = by_id["invias-resolution-108-2015"]
    archive_lock = by_id["invias-ccp14-official-zip"]
    section_lock = by_id["invias-ccp14-section-3"]
    preface_lock = by_id["invias-ccp14-preface"]

    resolution = require_locked_bytes(args.resolution, resolution_lock)
    if len(pypdf.PdfReader(io.BytesIO(resolution)).pages) != resolution_lock["pageCount"]:
        raise AssertionError("Resolution 108 page count differs")

    archive = require_locked_bytes(args.archive, archive_lock)
    with zipfile.ZipFile(io.BytesIO(archive)) as package:
        entries = package.infolist()
        if len(entries) != archive_lock["centralDirectoryEntryCount"]:
            raise AssertionError("CCP-14 ZIP entry count differs")
        if any(entry.is_dir() or not entry.filename.casefold().endswith(".pdf") for entry in entries):
            raise AssertionError("CCP-14 ZIP contains an unexpected non-PDF entry")

        member_bytes = [(entry, package.read(entry)) for entry in entries]
        section_match = next(
            ((entry, data) for entry, data in member_bytes if digest(data) == section_lock["sha256"]),
            None,
        )
        preface_match = next(
            ((entry, data) for entry, data in member_bytes if digest(data) == preface_lock["sha256"]),
            None,
        )
        if section_match is None or preface_match is None:
            raise AssertionError("CCP-14 ZIP is missing Section 3 or the preface")

        _, section = section_match
        _, preface = preface_match
        if len(section) != section_lock["bytes"] or digest(section) != section_lock["sha256"]:
            raise AssertionError("CCP-14 Section 3 bytes differ")
        if len(preface) != preface_lock["bytes"] or digest(preface) != preface_lock["sha256"]:
            raise AssertionError("CCP-14 preface bytes differ")
        if len(pypdf.PdfReader(io.BytesIO(section)).pages) != section_lock["pageCount"]:
            raise AssertionError("CCP-14 Section 3 page count differs")
        if len(pypdf.PdfReader(io.BytesIO(preface)).pages) != preface_lock["pageCount"]:
            raise AssertionError("CCP-14 preface page count differs")

        total_pages = sum(
            len(pypdf.PdfReader(io.BytesIO(data)).pages) for _, data in member_bytes
        )
        if total_pages != 1503:
            raise AssertionError(f"CCP-14 package page count differs: {total_pages}")

    print("current INVÍAS CCP-14 portal assets: PASS (2 files, 16 PDFs, 1,503 pages)")


if __name__ == "__main__":
    main()
