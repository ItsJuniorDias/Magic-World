#!/usr/bin/env python3
"""
Repack GLB files with sanely-sized textures.

Why this exists
---------------
`assets/models/` currently holds 97 MB across two files:

    asteroid_low_poly.glb   47.9 MB    434 triangles
    planet_of_phoenix.glb   49.2 MB  6,912 triangles

The geometry is genuinely tiny. All of the weight is eight embedded PNGs at
4096x4096. Decoded on device with mipmaps that is roughly 85 MB of VRAM per
texture, so those two models alone ask for about 680 MB of GPU memory to draw
objects that occupy a few hundred pixels on a phone screen. That is a hard
out-of-memory crash on older hardware, a long load, and a download size the
App Store will hold against you.

What it does
------------
Rewrites each GLB with its images downscaled and re-encoded. Geometry,
materials, animations, node hierarchy and accessor data are untouched — only
the image bufferViews change, and every offset downstream is corrected.

Images that carry alpha stay PNG. Everything else becomes JPEG, which is what
actually collapses the file size: a 512x512 albedo is ~40 KB as JPEG against
~700 KB as PNG.

Usage
-----
    pip install Pillow
    python3 scripts/optimize_glb.py assets/models --out assets/models-optimized
    python3 scripts/optimize_glb.py assets/models --in-place --size 512

Check the result in the app before deleting the originals. 512 is a good
default for anything that isn't a hero asset the camera lingers on; 256 is
plenty for the asteroid.
"""

from __future__ import annotations

import argparse
import io
import json
import struct
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

GLB_MAGIC = b"glTF"
CHUNK_JSON = b"JSON"
CHUNK_BIN = b"BIN\x00"


def _pad4(n: int) -> int:
    """glTF requires 4-byte alignment for chunks and bufferViews."""
    return (4 - (n % 4)) % 4


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, _length = struct.unpack_from("<4sII", data, 0)
    if magic != GLB_MAGIC:
        raise ValueError(f"{path.name} is not a GLB (magic was {magic!r})")
    if version != 2:
        raise ValueError(f"{path.name} is glTF version {version}; only 2 is supported")

    offset = 12
    gltf: dict | None = None
    binary = b""

    while offset < len(data):
        chunk_len, chunk_type = struct.unpack_from("<I4s", data, offset)
        offset += 8
        payload = data[offset : offset + chunk_len]
        offset += chunk_len + _pad4(chunk_len)

        if chunk_type == CHUNK_JSON:
            gltf = json.loads(payload)
        elif chunk_type == CHUNK_BIN:
            binary = payload

    if gltf is None:
        raise ValueError(f"{path.name} has no JSON chunk")
    return gltf, binary


def write_glb(path: Path, gltf: dict, binary: bytes) -> None:
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * _pad4(len(json_bytes))
    binary += b"\x00" * _pad4(len(binary))

    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    with path.open("wb") as fh:
        fh.write(struct.pack("<4sII", GLB_MAGIC, 2, total))
        fh.write(struct.pack("<I4s", len(json_bytes), CHUNK_JSON))
        fh.write(json_bytes)
        fh.write(struct.pack("<I4s", len(binary), CHUNK_BIN))
        fh.write(binary)


def shrink_image(raw: bytes, max_size: int, jpeg_quality: int) -> tuple[bytes, str]:
    """Returns (encoded bytes, mime type)."""
    img = Image.open(io.BytesIO(raw))
    img.load()

    # Keeping alpha means keeping PNG. Most PBR maps have none.
    has_alpha = img.mode in ("RGBA", "LA") or (
        img.mode == "P" and "transparency" in img.info
    )

    if max(img.size) > max_size:
        scale = max_size / max(img.size)
        new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
        # LANCZOS is the right filter here: these are being reduced by 8x, and
        # a cheaper filter would alias hard on any high-frequency detail.
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    out = io.BytesIO()
    if has_alpha:
        img.convert("RGBA").save(out, format="PNG", optimize=True)
        return out.getvalue(), "image/png"

    img.convert("RGB").save(out, format="JPEG", quality=jpeg_quality, optimize=True)
    return out.getvalue(), "image/jpeg"


def optimize(path: Path, dest: Path, max_size: int, jpeg_quality: int) -> None:
    gltf, binary = read_glb(path)
    before = path.stat().st_size

    images = gltf.get("images", [])
    buffer_views = gltf.get("bufferViews", [])

    if not images:
        dest.write_bytes(path.read_bytes())
        print(f"  {path.name:<28} no embedded images, copied as-is")
        return

    # Map bufferView index -> replacement payload, for image views only.
    replacements: dict[int, bytes] = {}
    report: list[str] = []

    for idx, image in enumerate(images):
        view_index = image.get("bufferView")
        if view_index is None:
            continue  # external URI; nothing embedded to shrink

        view = buffer_views[view_index]
        start = view.get("byteOffset", 0)
        raw = binary[start : start + view["byteLength"]]

        original_dims = Image.open(io.BytesIO(raw)).size
        encoded, mime = shrink_image(raw, max_size, jpeg_quality)
        replacements[view_index] = encoded
        image["mimeType"] = mime

        new_dims = Image.open(io.BytesIO(encoded)).size
        report.append(
            f"    image {idx}: {original_dims[0]}x{original_dims[1]} "
            f"{len(raw) / 1048576:6.2f} MB  ->  "
            f"{new_dims[0]}x{new_dims[1]} {len(encoded) / 1048576:5.2f} MB  {mime}"
        )

    # Rebuild the binary chunk.
    #
    # Every bufferView is relocated, because changing one image's size shifts
    # everything after it. Views are emitted in their original order so that
    # any tooling relying on locality still behaves, and each is padded to a
    # 4-byte boundary as the spec requires.
    order = sorted(
        range(len(buffer_views)),
        key=lambda i: buffer_views[i].get("byteOffset", 0),
    )

    rebuilt = bytearray()
    for view_index in order:
        view = buffer_views[view_index]
        if view_index in replacements:
            payload = replacements[view_index]
        else:
            start = view.get("byteOffset", 0)
            payload = binary[start : start + view["byteLength"]]

        rebuilt.extend(b"\x00" * _pad4(len(rebuilt)))
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(payload)
        rebuilt.extend(payload)

    if gltf.get("buffers"):
        gltf["buffers"][0]["byteLength"] = len(rebuilt)

    dest.parent.mkdir(parents=True, exist_ok=True)
    write_glb(dest, gltf, bytes(rebuilt))

    after = dest.stat().st_size
    saved = (1 - after / before) * 100 if before else 0
    print(f"  {path.name}")
    for line in report:
        print(line)
    print(
        f"    {before / 1048576:6.1f} MB  ->  {after / 1048576:5.2f} MB   "
        f"({saved:.1f}% smaller)\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path, help="a .glb file or a directory of them")
    parser.add_argument("--out", type=Path, help="output directory")
    parser.add_argument("--in-place", action="store_true", help="overwrite the originals")
    parser.add_argument("--size", type=int, default=512, help="max texture edge (default 512)")
    parser.add_argument("--quality", type=int, default=88, help="JPEG quality (default 88)")
    args = parser.parse_args()

    if not args.out and not args.in_place:
        return parser.error("pass --out DIR or --in-place")

    files = (
        sorted(args.source.glob("*.glb"))
        if args.source.is_dir()
        else [args.source]
    )
    if not files:
        print(f"No .glb files found in {args.source}")
        return 1

    print(f"\nRepacking {len(files)} file(s) at max {args.size}px\n")

    total_before = 0
    total_after = 0
    for path in files:
        dest = path if args.in_place else args.out / path.name
        total_before += path.stat().st_size
        try:
            optimize(path, dest, args.size, args.quality)
        except Exception as err:  # noqa: BLE001 - report and keep going
            print(f"  {path.name}: FAILED — {err}\n")
            continue
        total_after += dest.stat().st_size

    if total_before:
        print(
            f"Total  {total_before / 1048576:.1f} MB  ->  "
            f"{total_after / 1048576:.2f} MB   "
            f"({(1 - total_after / total_before) * 100:.1f}% smaller)\n"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
