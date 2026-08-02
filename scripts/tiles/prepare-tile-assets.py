#!/usr/bin/env python3
"""Build one self-contained SVG per mahjong tile from the FluffyStuff art.

Source: https://github.com/FluffyStuff/riichi-mahjong-tiles (CC0, public domain).

Three things have to happen for the upstream art to be usable here:

1. Each face is a transparent overlay meant to sit on `Front.svg`, so the front
   and the face are merged into a single document per tile.
2. The files are Inkscape exports carrying editor metadata that is dead weight in
   a bundle, so namespaced cruft is dropped.
3. Gradient ids repeat across files. Several tiles render on one page, and SVG
   ids share a document-wide namespace on web, so every id is prefixed per tile
   or one tile's gradient silently repaints another's.
"""

from __future__ import annotations

import argparse
import re
import xml.etree.ElementTree as ElementTree
from pathlib import Path

SVG_NS = "http://www.w3.org/2000/svg"
DROP_NS = ("sodipodi", "inkscape", "rdf", "cc", "dc", "osb")

TILES = {
    **{f"{rank}m": f"Man{rank}" for rank in range(1, 10)},
    **{f"{rank}p": f"Pin{rank}" for rank in range(1, 10)},
    **{f"{rank}s": f"Sou{rank}" for rank in range(1, 10)},
    "0m": "Man5-Dora",
    "0p": "Pin5-Dora",
    "0s": "Sou5-Dora",
    "east": "Ton",
    "south": "Nan",
    "west": "Shaa",
    "north": "Pei",
    "white": "Haku",
    "green": "Hatsu",
    "red": "Chun",
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def namespace_of(tag: str) -> str:
    return tag[1:].split("}", 1)[0] if tag.startswith("{") else ""


def clean(element: ElementTree.Element, prefix: str) -> None:
    """Drop editor metadata and make every id unique to this tile."""
    for child in list(element):
        namespace = namespace_of(child.tag)
        if namespace and namespace != SVG_NS:
            element.remove(child)
            continue
        if local_name(child.tag) in {"metadata", "namedview"}:
            element.remove(child)
            continue
        clean(child, prefix)

    for name in list(element.attrib):
        if any(f"{{{marker}" in name or name.startswith(f"{marker}:") for marker in DROP_NS):
            del element.attrib[name]
            continue
        if "}" in name and namespace_of(name) not in {"", SVG_NS, "http://www.w3.org/1999/xlink"}:
            del element.attrib[name]

    # xlink:href serialises with a generated prefix that JSX rejects; SVG2's
    # plain href means the same thing and react-native-svg understands it.
    for name in list(element.attrib):
        if name.endswith("href") and name != "href":
            element.attrib["href"] = element.attrib.pop(name)

    if "id" in element.attrib:
        element.attrib["id"] = f"{prefix}-{element.attrib['id']}"

    for name, value in element.attrib.items():
        if "url(#" in value:
            element.attrib[name] = re.sub(r"url\(#([^)]+)\)", rf"url(#{prefix}-\1)", value)
        elif name.endswith("href") and value.startswith("#"):
            element.attrib[name] = f"#{prefix}-{value[1:]}"


def content_of(path: Path, prefix: str) -> tuple[ElementTree.Element, list[ElementTree.Element]]:
    root = ElementTree.parse(path).getroot()
    clean(root, prefix)
    return root, list(root)


def referenced_ids(element: ElementTree.Element, found: set[str]) -> set[str]:
    for value in element.attrib.values():
        for match in re.findall(r"url\(#([^)]+)\)", value):
            found.add(match)
    for name, value in element.attrib.items():
        if name.endswith("href") and value.startswith("#"):
            found.add(value[1:])
    for child in element:
        referenced_ids(child, found)
    return found


def prune_unused_defs(root: ElementTree.Element) -> None:
    """Inkscape leaves behind gradients and markers nothing draws with.

    They are most of the file. Pruning repeats until nothing else drops, because
    a kept gradient can reference another one.
    """
    while True:
        used = referenced_ids(root, set())
        removed = False
        for defs in root.iter(f"{{{SVG_NS}}}defs"):
            for child in list(defs):
                if child.attrib.get("id") not in used:
                    defs.remove(child)
                    removed = True
        if not removed:
            return


def strip_unreferenced_ids(root: ElementTree.Element) -> int:
    """Drop every id nothing points at.

    Inkscape names each shape it ever touched, so most ids are on drawn elements
    that no `url(#…)` or `href` refers to. They are dead weight, and they are
    also the bulk of the duplicate ids that appear when one tile renders twice —
    the same tile inlines the same document, ids and all. Removing them leaves
    only the handful the art genuinely cross-references.
    """
    used = referenced_ids(root, set())
    removed = 0
    for element in root.iter():
        if "id" in element.attrib and element.attrib["id"] not in used:
            del element.attrib["id"]
            removed += 1
    return removed


NUMBER = re.compile(r"-?\d+\.\d+")


def round_numbers(element: ElementTree.Element) -> None:
    """Inkscape writes coordinates to ten-plus decimals, which is most of the
    remaining bytes and none of the pixels at tile size."""

    def shorten(match: re.Match[str]) -> str:
        value = round(float(match.group()), 2)
        text = f"{value:.2f}".rstrip("0").rstrip(".")
        return text if text not in {"", "-"} else "0"

    for child in element.iter():
        for name, value in child.attrib.items():
            if name in {"id"} or not NUMBER.search(value):
                continue
            child.attrib[name] = NUMBER.sub(shorten, value)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path, help="Regular SVG directory")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    ElementTree.register_namespace("", SVG_NS)
    args.output.mkdir(parents=True, exist_ok=True)
    total = 0
    stripped = 0

    for tile_id, asset in sorted(TILES.items()):
        prefix = f"t{tile_id}"
        front_root, front_children = content_of(args.source / "Front.svg", f"{prefix}f")
        _, face_children = content_of(args.source / f"{asset}.svg", f"{prefix}a")

        merged = ElementTree.Element(f"{{{SVG_NS}}}svg")
        for attribute in ("viewBox", "width", "height"):
            if attribute in front_root.attrib:
                merged.attrib[attribute] = front_root.attrib[attribute]
        for child in [*front_children, *face_children]:
            merged.append(child)

        prune_unused_defs(merged)
        stripped += strip_unreferenced_ids(merged)
        round_numbers(merged)

        path = args.output / f"{tile_id}.svg"
        ElementTree.ElementTree(merged).write(path, encoding="unicode", xml_declaration=False)
        total += path.stat().st_size

    print(
        f"wrote {len(TILES)} tiles to {args.output} ({total // 1024}KB total; "
        f"{stripped} unreferenced ids dropped)"
    )


if __name__ == "__main__":
    main()
