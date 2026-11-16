#!/usr/bin/env python3
"""
Sync Climb Media Images to Imgur
Uploads OpenBeta media images in climb_media to Imgur using IMGUR_CLIENT_ID,
updating the database with the Imgur direct link while preserving the original URL.

Usage:
  python3 scripts/sync-media-to-imgur.py [--limit N] [--delay SECONDS] [--status]
"""

import sys
import os
import time
import json
import sqlite3
import argparse
import urllib.request
import urllib.parse
from pathlib import Path

DB_PATH = Path("pb_data/data.db")
ENV_PATH = Path(".env")
IMGUR_UPLOAD_ENDPOINT = "https://api.imgur.com/3/image"


def get_imgur_client_id():
    client_id = os.environ.get("IMGUR_CLIENT_ID", "").strip()
    if client_id:
        return client_id
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("IMGUR_CLIENT_ID="):
                return line.split("=", 1)[1].strip().strip("\"'")
    return ""


def upload_image(image_url, client_id, retries=3):
    data = urllib.parse.urlencode({"image": image_url, "type": "url"}).encode("utf-8")
    req = urllib.request.Request(
        IMGUR_UPLOAD_ENDPOINT,
        data=data,
        headers={
            "Authorization": f"Client-ID {client_id}",
            "User-Agent": "WikiBloc/1.0"
        }
    )

    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                res_body = json.loads(res.read().decode("utf-8"))
                link = res_body.get("data", {}).get("link", "")
                if link:
                    # Enforce https://i.imgur.com/
                    if link.startswith("http://"):
                        link = "https://" + link[7:]
                    return {"ok": True, "link": link}
                return {"ok": False, "error": "No link in response"}
        except urllib.error.HTTPError as e:
            headers = dict(e.headers)
            reset_sec = int(headers.get("x-post-rate-limit-reset") or headers.get("x-ratelimit-userreset") or 60)
            if e.code == 429:
                if attempt < retries and reset_sec <= 180:
                    print(f"    [Imgur 429] Rate limit hit. Waiting {reset_sec + 2}s before retry (attempt {attempt}/{retries})...")
                    time.sleep(reset_sec + 2)
                    continue
                return {"ok": False, "error": "rate_limit", "reset": reset_sec}
            elif attempt < retries:
                time.sleep(2 * attempt)
                continue
            return {"ok": False, "error": f"HTTP {e.code}"}
        except Exception as err:
            if attempt < retries:
                time.sleep(2 * attempt)
                continue
            return {"ok": False, "error": str(err)}

    return {"ok": False, "error": "Max retries exceeded"}


def main():
    parser = argparse.ArgumentParser(description="Sync OpenBeta media images to Imgur")
    parser.add_argument("--limit", type=int, default=0, help="Max number of images to upload (0 for all remaining)")
    parser.add_argument("--delay", type=float, default=1.5, help="Seconds to delay between requests (default: 1.5s)")
    parser.add_argument("--status", action="store_true", help="Print sync status and exit")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM climb_media WHERE isDeleted = 0")
    total_media = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM climb_media WHERE mediaUrl LIKE 'https://i.imgur.com/%' AND isDeleted = 0")
    imgur_count = cur.fetchone()[0]

    pending_count = total_media - imgur_count

    print(f"=== Climb Media Imgur Status ===")
    print(f"Total photos:    {total_media}")
    print(f"On Imgur:        {imgur_count} ({(imgur_count/total_media*100) if total_media else 0:.1f}%)")
    print(f"Pending/OpenBeta: {pending_count}")

    if args.status:
        conn.close()
        return

    if pending_count == 0:
        print("\nAll climb photos are already synced to Imgur!")
        conn.close()
        return

    client_id = get_imgur_client_id()
    if not client_id:
        print("\nError: IMGUR_CLIENT_ID is not configured in .env or environment.")
        conn.close()
        sys.exit(1)

    query = "SELECT id, climb, mediaUrl, originalUrl FROM climb_media WHERE mediaUrl NOT LIKE 'https://i.imgur.com/%' AND isDeleted = 0"
    if args.limit > 0:
        query += f" LIMIT {args.limit}"

    cur.execute(query)
    rows = cur.fetchall()
    print(f"\nStarting sync for {len(rows)} images (delay={args.delay}s)...")

    uploaded = 0
    failed = 0

    for i, row in enumerate(rows, start=1):
        rec_id = row["id"]
        source_url = row["originalUrl"] or row["mediaUrl"]
        
        # Ensure full URL
        if not source_url.startswith("http"):
            source_url = "https://media.openbeta.io" + ("/" if not source_url.startswith("/") else "") + source_url

        print(f"[{i}/{len(rows)}] Uploading {rec_id}...", end=" ", flush=True)
        res = upload_image(source_url, client_id)

        if res["ok"]:
            link = res["link"]
            cur.execute("""
                UPDATE climb_media 
                SET mediaUrl = ?, originalUrl = ? 
                WHERE id = ?
            """, (link, source_url, rec_id))
            conn.commit()
            uploaded += 1
            print(f"-> {link}")
        else:
            failed += 1
            err = res.get("error", "Unknown error")
            print(f"FAILED ({err})")
            if err == "rate_limit":
                print("\n[Imgur Rate Limit] Imgur API quota reached. Pausing sync.")
                break

        if i < len(rows):
            time.sleep(args.delay)

    conn.close()
    print(f"\nFinished: {uploaded} uploaded to Imgur, {failed} remaining/failed.")


if __name__ == "__main__":
    main()

