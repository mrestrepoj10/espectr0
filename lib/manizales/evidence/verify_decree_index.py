#!/usr/bin/env python3
"""Snapshot the public Manizales decree title index and optionally check its lock."""

from __future__ import annotations

import argparse
import hashlib
import http.cookiejar
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


PUBLIC_SHARE_URL = (
    "https://alcaldiamanizales-my.sharepoint.com/:f:/g/personal/"
    "sjpublicaciones_manizales_gov_co/EouBlNQTwMJFshvyWZ3-lwABwKhi6lVzDo0tgaKC7NnS-A?e=Mf9ZYl"
)
SITE_ROOT = "https://alcaldiamanizales-my.sharepoint.com/personal/sjpublicaciones_manizales_gov_co"
FOLDER_ROOT = "/personal/sjpublicaciones_manizales_gov_co/Documents/Publicaciones/DECRETOS"
USER_AGENT = "Mozilla/5.0 (compatible; espectr0-evidence-verifier/1.0)"


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


def api_url(folder: str, collection: str, fields: str) -> str:
    encoded = urllib.parse.quote(folder, safe="")
    query = urllib.parse.urlencode({"$select": fields, "$top": "5000"})
    return f"{SITE_ROOT}/_api/web/GetFolderByServerRelativeUrl('{encoded}')/{collection}?{query}"


def open_with_retry(opener: urllib.request.OpenerDirector, request: urllib.request.Request):
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            return opener.open(request, timeout=60)
        except urllib.error.URLError as error:
            last_error = error
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Unable to reach the public Manizales decree index after 3 attempts: {last_error}") from last_error


def get_json(opener: urllib.request.OpenerDirector, url: str) -> list[dict]:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json;odata=nometadata", "User-Agent": USER_AGENT},
    )
    with open_with_retry(opener, request) as response:
        payload = json.load(response)
    return payload.get("value", payload.get("d", {}).get("results", []))


def snapshot() -> dict:
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    with open_with_retry(opener, urllib.request.Request(PUBLIC_SHARE_URL, headers={"User-Agent": USER_AGENT})) as response:
        final_url = response.geturl()

    if not any(cookie.name == "FedAuth" for cookie in cookies):
        raise RuntimeError("The public SharePoint link did not issue the expected FedAuth session cookie")

    records: list[dict] = []

    def walk(folder: str, bucket: str) -> None:
        for item in get_json(opener, api_url(folder, "Files", "Name,ServerRelativeUrl,Length,TimeLastModified")):
            records.append(
                {
                    "bucket": bucket,
                    "name": item["Name"],
                    "serverRelativeUrl": item["ServerRelativeUrl"],
                    "length": int(item["Length"]),
                    "timeLastModified": item["TimeLastModified"],
                }
            )
        for child in get_json(opener, api_url(folder, "Folders", "Name,ServerRelativeUrl")):
            if child["Name"] != "Forms":
                walk(child["ServerRelativeUrl"], bucket)

    top_folders = get_json(opener, api_url(FOLDER_ROOT, "Folders", "Name,ServerRelativeUrl"))
    for top_folder in top_folders:
        walk(top_folder["ServerRelativeUrl"], top_folder["Name"])

    for item in get_json(opener, api_url(FOLDER_ROOT, "Files", "Name,ServerRelativeUrl,Length,TimeLastModified")):
        records.append(
            {
                "bucket": "(root)",
                "name": item["Name"],
                "serverRelativeUrl": item["ServerRelativeUrl"],
                "length": int(item["Length"]),
                "timeLastModified": item["TimeLastModified"],
            }
        )

    records.sort(key=lambda item: item["serverRelativeUrl"])
    canonical = "\n".join(
        f'{item["serverRelativeUrl"]}\t{item["length"]}\t{item["timeLastModified"]}' for item in records
    )
    counts: dict[str, int] = {}
    for item in records:
        counts[item["bucket"]] = counts.get(item["bucket"], 0) + 1

    target_matches = [item["name"] for item in records if re.search(r"microzon|sism", normalize(item["name"]))]
    context_matches = [item["name"] for item in records if re.search(r"armoniz|geotecn", normalize(item["name"]))]

    return {
        "anonymousAccess": True,
        "finalUrl": final_url,
        "totalFiles": len(records),
        "folderFileCounts": dict(sorted(counts.items())),
        "targetTitleQuery": "accent-insensitive filename regex: microzon|sism",
        "targetTitleMatches": target_matches,
        "contextTitleQuery": "accent-insensitive filename regex: armoniz|geotecn",
        "contextTitleMatches": context_matches,
        "snapshotSha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "snapshotCanonicalization": "serverRelativeUrl<TAB>length<TAB>timeLastModified, sorted by serverRelativeUrl, LF joined",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="compare against source-locks.json")
    args = parser.parse_args()

    result = snapshot()
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))

    if args.check:
        lock_path = Path(__file__).with_name("source-locks.json")
        expected = json.loads(lock_path.read_text(encoding="utf-8"))["indexSearches"][0]
        locked_fields = (
            "anonymousAccess",
            "totalFiles",
            "folderFileCounts",
            "targetTitleQuery",
            "targetTitleMatches",
            "contextTitleQuery",
            "contextTitleMatches",
            "snapshotSha256",
            "snapshotCanonicalization",
        )
        drift = {field: {"expected": expected[field], "actual": result[field]} for field in locked_fields if expected[field] != result[field]}
        if drift:
            print(json.dumps({"status": "drift", "differences": drift}, ensure_ascii=False, indent=2, sort_keys=True))
            return 1
        print("checked public Manizales decree index snapshot")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
