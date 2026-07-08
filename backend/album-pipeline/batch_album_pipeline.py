import argparse
import csv
import importlib.util
import json
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Setup simple logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def get_project_root() -> Path:
    # Assuming this script is at backend/album-pipeline/batch_album_pipeline.py
    # So root is two levels up
    return Path(__file__).parent.parent.parent.resolve()


def _yt_dlp_command(args: list[str]) -> list[str]:
    if importlib.util.find_spec("yt_dlp") is None:
        raise RuntimeError("yt-dlp module is not installed in the current Python environment")
    return [sys.executable, "-m", "yt_dlp", *args]


def get_playlist_info(url: str):
    project_root = get_project_root()
    cookies_path = project_root / "artifacts" / "common" / "youtube-cookies.txt"
    
    cmd = _yt_dlp_command([
        "--cookies", str(cookies_path),
        "--dump-json",
        "--flat-playlist",
        "--playlist-items", "1",
        url
    ])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        info = json.loads(result.stdout)
        
        album = info.get("playlist_title") or info.get("playlist") or "Unknown Album"
        # yt-dlp might prefix YouTube Music albums with "Album - "
        if album.startswith("Album - "):
            album = album[8:]
            
        artist = info.get("playlist_uploader") or info.get("playlist_channel")
        
        # If playlist_uploader is null (common on YTM), fetch the first track's uploader
        if not artist and info.get("url"):
            first_track_url = info.get("url")
            track_cmd = _yt_dlp_command([
                "--cookies", str(cookies_path),
                "--dump-json",
                "--no-playlist",
                first_track_url
            ])
            track_result = subprocess.run(track_cmd, capture_output=True, text=True, check=True)
            track_info = json.loads(track_result.stdout)
            artist = track_info.get("artist") or track_info.get("uploader") or track_info.get("channel")
            
        if artist and artist.endswith(" - Topic"):
            artist = artist[:-8]
            
        if not artist:
            artist = "Unknown Artist"
            
        return artist, album
    except Exception as e:
        logging.error(f"Failed to fetch playlist info: {e}")
        return "Unknown Artist", "Unknown Album"

def download_album(url: str) -> bool:
    artist, album = get_playlist_info(url)
    
    project_root = get_project_root()
    album_base = project_root / "artifacts" / "album"
    album_dir = album_base / f"{artist} - {album}"
    album_dir.mkdir(parents=True, exist_ok=True)
    archive_path = album_base / "yt-dlp-archive.txt"
    cookies_path = project_root / "artifacts" / "common" / "youtube-cookies.txt"
    
    cmd = _yt_dlp_command([
        "--cookies", str(cookies_path),
        "--extract-audio",
        "--audio-format", "mp3",
        "--write-thumbnail",
        "--convert-thumbnails", "jpg",
        "--write-info-json",
        "--yes-playlist",
        "--download-archive", str(archive_path),
        "-o", f"{album_dir}/%(playlist_index)s - %(title)s.%(ext)s",
        url
    ])
    
    logging.info(f"Processing album '{album}' by '{artist}' from {url}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Always generate manifest and cleanup, because some tracks might have downloaded
        # even if yt-dlp returned an error for others (e.g. unavailable video in playlist)
        generate_album_manifest(album_dir, artist, album, url)
        
        if result.returncode != 0:
            err_output = result.stderr
            if "Sign in to confirm" in err_output or "cookies" in err_output.lower():
                logging.error("\n[Authentication Error] YouTube is blocking the download (Bot Detection).")
                logging.error("Please run the following command to refresh your cookies:")
                logging.error("  pnpm run refresh:cookies\n")
            else:
                logging.error(f"Failed to fully process album from {url}. Some tracks may be missing. Error:\n{err_output}")
            # We return True anyway if we downloaded something, so library index updates
            has_mp3s = any(album_dir.glob("*.mp3"))
            return has_mp3s
            
        return True
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        # Try to clean up whatever we got
        generate_album_manifest(album_dir, artist, album, url)
        return False

def get_file_hash(filepath: Path) -> str:
    import hashlib
    if not filepath.exists():
        return ""
    hasher = hashlib.md5()
    with open(filepath, "rb") as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def generate_album_manifest(album_dir: Path, artist: str, album: str, playlist_url: str):
    mp3_files = sorted(album_dir.glob("*.mp3"))
    if not mp3_files:
        return
        
    jpg_files = sorted(album_dir.glob("*.jpg"))
    cover_path = "cover.jpg"
    final_cover_path = album_dir / cover_path
    
    if jpg_files:
        # If there's a playlist thumbnail (usually starts with 00 or has album title), prefer it for high-res
        # Otherwise just use the first jpg.
        best_cover = jpg_files[0]
        for j in jpg_files:
            if "00 -" in j.name or album.lower() in j.name.lower():
                best_cover = j
                break
                
        if not final_cover_path.exists():
            shutil.copy(best_cover, final_cover_path)
            
        # Re-list jpgs to include the new cover.jpg (if we just made it)
        jpg_files = sorted(album_dir.glob("*.jpg"))
        
        # Deduplicate by finding the most common hash (the standard track cover)
        from collections import Counter
        hash_counts = Counter()
        file_hashes = {}
        for j in jpg_files:
            if j.name == cover_path:
                continue
            h = get_file_hash(j)
            file_hashes[j.name] = h
            hash_counts[h] += 1
            
        # The standard cover hash is the one that appears most often
        standard_hash = None
        if hash_counts:
            standard_hash = hash_counts.most_common(1)[0][0]
            
        # Delete duplicates
        for j in jpg_files:
            if j.name == cover_path or j.name == best_cover.name:
                continue # Keep the cover.jpg and its original source (we'll delete the original source if it's not needed, but wait)
                
            if file_hashes.get(j.name) == standard_hash:
                try:
                    j.unlink()
                except Exception:
                    pass
                    
        # If best_cover was one of the tracks and we copied it, delete the original best_cover to keep it clean
        if best_cover.name != cover_path:
            try:
                best_cover.unlink()
            except Exception:
                pass
    else:
        cover_path = None
        
    tracks = []
    csv_rows = []
    
    for mp3_file in mp3_files:
        base_name = mp3_file.stem
        info_json = album_dir / f"{base_name}.info.json"
        
        duration = 0
        title = base_name.split(" - ", 1)[-1] if " - " in base_name else base_name
        webpage_url = ""
        
        if info_json.exists():
            try:
                with open(info_json, "r", encoding="utf-8") as f:
                    info = json.load(f)
                    duration = info.get("duration", 0)
                    title = info.get("title", title)
                    webpage_url = info.get("webpage_url", "")
            except Exception as e:
                logging.warning(f"Failed to read info.json for {base_name}: {e}")
                
            try:
                info_json.unlink()
            except Exception:
                pass
                
        for playlist_json in album_dir.glob("*info.json"):
            try:
                playlist_json.unlink()
            except Exception:
                pass
                
        # Check if this specific track still has a unique jpg
        track_cover = None
        jpg_file = album_dir / f"{base_name}.jpg"
        if jpg_file.exists() and jpg_file.name != cover_path:
            track_cover = jpg_file.name
                
        tracks.append({
            "filename": mp3_file.name,
            "title": title,
            "duration": duration,
            "cover": track_cover # If None, UI will fallback to album cover
        })
        
        csv_rows.append({
            "AlbumName": album,
            "Artist": artist,
            "TrackTitle": title,
            "TrackURL": webpage_url,
            "Status": "downloaded"
        })
        
    manifest = {
        "artist": artist,
        "album": album,
        "representativeCover": cover_path,
        "tracks": tracks
    }
    
    manifest_path = album_dir / "album_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        
    logging.info(f"Generated manifest for '{album}' with {len(tracks)} tracks.")
    
    csv_path = album_dir.parent / "downloaded_tracks.csv"
    file_exists = csv_path.exists()
    
    with open(csv_path, "a", encoding="utf-8", newline="") as f:
        fieldnames = ["AlbumName", "Artist", "TrackTitle", "TrackURL", "Status"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        for row in csv_rows:
            writer.writerow(row)
            
    logging.info(f"Appended {len(tracks)} tracks to downloaded_tracks.csv")

def update_library_index(root: Path):
    album_dir = root / "artifacts" / "album"
    if not album_dir.exists():
        return
        
    albums = []
    for d in album_dir.iterdir():
        if d.is_dir():
            manifest_path = d / "album_manifest.json"
            if manifest_path.exists():
                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                    albums.append({
                        "id": d.name,
                        "artist": manifest.get("artist"),
                        "album": manifest.get("album"),
                        "representativeCover": manifest.get("representativeCover"),
                        "trackCount": len(manifest.get("tracks", []))
                    })
                    
    index_path = album_dir / "library_index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({"albums": albums}, f, indent=2, ensure_ascii=False)
    logging.info("Updated library_index.json")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download an album playlist via yt-dlp")
    parser.add_argument("url", type=str, help="YouTube playlist URL for the album")
    
    args = parser.parse_args()
    
    success = download_album(args.url)
    if success:
        root = get_project_root()
        update_library_index(root)
        logging.info("Album downloaded and library index updated successfully.")
    else:
        logging.error("Album download failed.")
