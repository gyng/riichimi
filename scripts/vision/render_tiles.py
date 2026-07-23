# SPDX-License-Identifier: CC-BY-SA-4.0
"""Headless Blender generator for synthetic-physical tile-face crops.

Renders standing riichi tiles from the pinned CC0 FluffyStuff glyph artwork as
physically based 3D objects (ivory body, engraved glyph, glossy coat) under
randomized camera pose, studio softbox lighting, and surface imperfections,
then writes labeled face crops to ``<output>/train/<label>/*.png``.

Those crops plug into ``train-tile-classifier.py --real-crops <output>`` exactly
like the real physical-photo crops, adding realistic 3D lighting, specular
glare, and geometry that the 2D augmentation in ``train-tile-classifier.py``
cannot express.

Provenance and gate discipline
------------------------------
* Glyph seed: ``FluffyStuff/riichi-mahjong-tiles`` @ ``26e127b`` (CC0), the same
  source the 2D pipeline uses. Renders inherit CC-BY-SA-4.0 like the model.
* These renders are TRAINING-SIDE ONLY. They are written to the ``train``
  partition and must never enter ``eval`` — held-out evaluation stays real,
  source-separated physical photos. Their worth is measured solely by lift on
  the real held-out crops (``evaluate-physical-crops.py``), never as release
  evidence. See ``docs/recognition-model-audit.md``.

Determinism
-----------
Every sample is driven by ``random.Random(seed, class, sample)`` so a given
``--seed`` reproduces the corpus bit-for-bit (modulo the renderer's own
GPU/driver determinism, which the pipeline does not depend on for labels).

Run headless (Blender 5.1+, EEVEE):

    blender -b -P scripts/vision/render_tiles.py -- \
        --glyphs /path/to/FluffyStuff/Export/Regular \
        --output /path/to/render-crops \
        --samples-per-class 8 --seed 1234

Phase 2 (not yet implemented) will add full-hand layouts with per-tile bounding
boxes for a future learned localizer; the scene builder here is factored to be
reused by that path.
"""

from __future__ import annotations

import argparse
import math
import random
import sys
from pathlib import Path, PurePath

import bpy
from mathutils import Euler, Quaternion, Vector

# Label -> FluffyStuff glyph filename. Mirrors ASSET_NAMES in
# train-tile-classifier.py so labels match the classifier's class set.
GLYPH_FILES: dict[str, str] = {
    **{f"{rank}m": f"Man{rank}.png" for rank in range(1, 10)},
    **{f"{rank}p": f"Pin{rank}.png" for rank in range(1, 10)},
    **{f"{rank}s": f"Sou{rank}.png" for rank in range(1, 10)},
    "east": "Ton.png",
    "south": "Nan.png",
    "west": "Shaa.png",
    "north": "Pei.png",
    "white": "Haku.png",
    "green": "Hatsu.png",
    "red": "Chun.png",
    "0m": "Man5-Dora.png",
    "0p": "Pin5-Dora.png",
    "0s": "Sou5-Dora.png",
}

IVORY = (0.93, 0.90, 0.82, 1.0)
IVORY_DARK = (0.85, 0.81, 0.71, 1.0)
# Real riichi tiles are two-tone: a bone-white glyph face bonded to a warm
# yellow/amber back and sides. The body material carries that backing colour.
BACKING = (0.87, 0.70, 0.30, 1.0)
BACKING_DARK = (0.80, 0.62, 0.24, 1.0)
# Tile proportions in metres: face 19x25 mm, 15 mm thick (matches glyph 3:4).
TILE_W, TILE_H, TILE_T = 0.19, 0.25, 0.15


def _coat(bsdf: bpy.types.ShaderNode, weight: float = 0.45) -> None:
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = weight
    if "Coat Roughness" in bsdf.inputs:
        bsdf.inputs["Coat Roughness"].default_value = 0.06


def _reset(name: str, kind: str) -> object:
    """Remove and recreate a datablock so the build is idempotent per run."""
    if kind == "material":
        existing = bpy.data.materials.get(name)
        if existing:
            bpy.data.materials.remove(existing)
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        return material
    if kind == "object":
        existing = bpy.data.objects.get(name)
        if existing:
            bpy.data.objects.remove(existing, do_unlink=True)
    return None


def build_body_material() -> bpy.types.Material:
    material = _reset("TileBody", "material")
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    coord = tree.nodes.new("ShaderNodeTexCoord")
    tint = tree.nodes.new("ShaderNodeTexNoise")
    tint.inputs["Scale"].default_value = 3.0
    tree.links.new(coord.outputs["Object"], tint.inputs["Vector"])
    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.inputs["Fac"].default_value = 0.12
    mix.inputs["Color1"].default_value = BACKING
    mix.inputs["Color2"].default_value = BACKING_DARK
    tree.links.new(tint.outputs["Fac"], mix.inputs["Fac"])
    tree.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.30
    _coat(bsdf)
    return material


def build_face_material() -> bpy.types.Material:
    """Ivory face with a glyph image (swapped per class), engraved via bump."""
    material = _reset("TileFace", "material")
    tree = material.node_tree
    nodes, links = tree.nodes, tree.links
    bsdf = nodes["Principled BSDF"]
    coord = nodes.new("ShaderNodeTexCoord")

    glyph = nodes.new("ShaderNodeTexImage")
    glyph.name = "Glyph"
    glyph.interpolation = "Cubic"
    glyph.extension = "CLIP"
    links.new(coord.outputs["UV"], glyph.inputs["Vector"])

    tint = nodes.new("ShaderNodeTexNoise")
    tint.inputs["Scale"].default_value = 3.5
    tint.inputs["Detail"].default_value = 2.0
    links.new(coord.outputs["Object"], tint.inputs["Vector"])
    tint_mix = nodes.new("ShaderNodeMixRGB")
    tint_mix.inputs["Fac"].default_value = 0.10
    tint_mix.inputs["Color1"].default_value = IVORY
    tint_mix.inputs["Color2"].default_value = IVORY_DARK
    links.new(tint.outputs["Fac"], tint_mix.inputs["Fac"])

    glyph_mix = nodes.new("ShaderNodeMixRGB")
    links.new(tint_mix.outputs["Color"], glyph_mix.inputs["Color1"])
    links.new(glyph.outputs["Color"], glyph_mix.inputs["Color2"])
    links.new(glyph.outputs["Alpha"], glyph_mix.inputs["Fac"])
    links.new(glyph_mix.outputs["Color"], bsdf.inputs["Base Color"])

    # Micro-scratch / wear roughness.
    scratch = nodes.new("ShaderNodeTexNoise")
    scratch.inputs["Scale"].default_value = 280.0
    scratch.inputs["Detail"].default_value = 2.0
    links.new(coord.outputs["Object"], scratch.inputs["Vector"])
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.12
    rough.inputs["To Max"].default_value = 0.28
    links.new(scratch.outputs["Fac"], rough.inputs["Value"])
    links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])

    # Engraved glyph: recess the painted strokes for an edge shadow.
    bump = nodes.new("ShaderNodeBump")
    bump.invert = True
    bump.inputs["Strength"].default_value = 0.42
    bump.inputs["Distance"].default_value = 0.0022
    links.new(glyph.outputs["Alpha"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    _coat(bsdf)
    return material


def make_tile(name: str, body: bpy.types.Material, face: bpy.types.Material) -> bpy.types.Object:
    """Build one standing tile object; ``face`` carries the glyph for this tile."""
    import bmesh  # local import: only needed while authoring geometry

    _reset(name, "object")
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for vert in bm.verts:
        vert.co.x *= TILE_W
        vert.co.y *= TILE_T
        vert.co.z *= TILE_H
    bm.faces.ensure_lookup_table()
    bm.normal_update()
    uv = bm.loops.layers.uv.new("UVMap")
    front = min(bm.faces, key=lambda f: f.normal.y)  # -Y faces the camera
    margin = 0.72  # glyph occupies this fraction; CLIP leaves an ivory border
    for loop in front.loops:
        co = loop.vert.co
        u = (co.x / TILE_W + 0.5 - 0.5) / margin + 0.5
        v = (co.z / TILE_H + 0.5 - 0.5) / margin + 0.5
        loop[uv].uv = (u, v)
    bm.to_mesh(mesh)
    bm.free()

    tile = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(tile)
    tile.location = (0.0, 0.0, TILE_H / 2)  # rest on the table plane
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    # Front face gets the glyph material; assign after the mesh exists so the
    # index survives (materials.clear() would orphan it).
    tile.data.materials.append(body)
    tile.data.materials.append(face)
    front_polygon = min(mesh.polygons, key=lambda p: p.normal.y)
    front_polygon.material_index = 1
    bevel = tile.modifiers.new("Bevel", "BEVEL")
    bevel.width = 0.010
    bevel.segments = 4
    bevel.harden_normals = True
    return tile


def face_material_for(label: str, glyph_root: str, cache: dict) -> bpy.types.Material:
    """A per-label MATTE face material for hand mode (cached by label).

    Hand tiles are viewed near head-on across a row, so any specular reflects the
    front light into the camera and washes the face-on glyph. This is a simple
    matte ivory + glyph material (no coat, no specular, no engraving), which reads
    evenly from every angle — verified against a live 5-tile row. Crop mode is
    unaffected; it uses the glossier build_face_material directly.
    """
    if label in cache:
        return cache[label]
    material = bpy.data.materials.new(f"Face_{label}")
    material.use_nodes = True
    tree = material.node_tree
    nodes, links = tree.nodes, tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.55
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    coord = nodes.new("ShaderNodeTexCoord")
    glyph = nodes.new("ShaderNodeTexImage")
    glyph.image = bpy.data.images.load(f"{glyph_root}/{GLYPH_FILES[label]}", check_existing=True)
    glyph.extension = "CLIP"
    glyph.interpolation = "Cubic"
    links.new(coord.outputs["UV"], glyph.inputs["Vector"])
    mix = nodes.new("ShaderNodeMixRGB")
    mix.inputs["Color1"].default_value = IVORY
    links.new(glyph.outputs["Color"], mix.inputs["Color2"])
    links.new(glyph.outputs["Alpha"], mix.inputs["Fac"])
    links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    cache[label] = material
    return material


def build_environment() -> tuple[bpy.types.Object, bpy.types.Object, list[bpy.types.Object]]:
    _reset("Light", "object")  # drop the factory 1000 W point light; we light explicitly
    _reset("Cube", "object")   # drop the factory cube; it dwarfs and occludes the tiles
    _reset("Table", "object")
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, 0, 0.0))
    table = bpy.context.active_object
    table.name = "Table"
    table_mat = _reset("TableMat", "material")
    tree = table_mat.node_tree
    tb = tree.nodes["Principled BSDF"]
    tb.inputs["Base Color"].default_value = (0.045, 0.06, 0.05, 1.0)
    tb.inputs["Roughness"].default_value = 0.92
    felt = tree.nodes.new("ShaderNodeTexNoise")
    felt.inputs["Scale"].default_value = 400.0
    felt_bump = tree.nodes.new("ShaderNodeBump")
    felt_bump.inputs["Strength"].default_value = 0.15
    felt_bump.inputs["Distance"].default_value = 0.002
    tree.links.new(felt.outputs["Fac"], felt_bump.inputs["Height"])
    tree.links.new(felt_bump.outputs["Normal"], tb.inputs["Normal"])
    table.data.materials.append(table_mat)

    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera

    # Dedicated front key light so the -Y face is lit like a photographed hand;
    # the factory point light only rakes the sides. Named for jitter lookup.
    _reset("Key", "object")
    key_data = bpy.data.lights.new("Key", "AREA")
    key_data.size = 0.5
    key_data.energy = 22.0
    key = bpy.data.objects.new("Key", key_data)
    bpy.context.collection.objects.link(key)
    key.location = (-0.15, -0.50, 0.46)
    key.rotation_euler = (
        Vector((0, 0, TILE_H * 0.5)) - key.location
    ).to_track_quat("-Z", "Y").to_euler()

    softboxes = []
    for name, loc, rot, energy, size in (
        ("Softbox_key", (-0.35, -0.45, 0.75), (55, 0, -25), 9.0, 0.9),
        ("Softbox_fill", (0.45, -0.35, 0.55), (60, 0, 35), 3.5, 0.7),
    ):
        _reset(name, "object")
        bpy.ops.mesh.primitive_plane_add(
            size=size, location=loc, rotation=[math.radians(a) for a in rot]
        )
        box = bpy.context.active_object
        box.name = name
        box_mat = _reset(name + "Mat", "material")
        emission = box_mat.node_tree.nodes.new("ShaderNodeEmission")
        emission.inputs["Strength"].default_value = energy
        output = box_mat.node_tree.nodes["Material Output"]
        box_mat.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
        box.data.materials.append(box_mat)
        box["base_energy"] = energy  # stable reference so jitter never compounds
        box.visible_camera = False  # contributes to reflections/light only
        softboxes.append(box)
    return table, camera, softboxes


def configure_render(width: int, height: int, samples: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    eevee = scene.eevee
    for attr, val in (("use_raytracing", True), ("use_shadows", True), ("taa_render_samples", samples)):
        if hasattr(eevee, attr):
            try:
                setattr(eevee, attr, val)
            except Exception:  # noqa: BLE001 — optional across EEVEE versions
                pass
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.05, 0.055, 0.07, 1.0)


def place_camera(camera: bpy.types.Object, rng: random.Random) -> None:
    # Azimuth kept moderate so the glyph face dominates the crop; a wide swing
    # exposes the ivory side, which the light/low-chroma face locator confuses.
    azimuth = math.radians(rng.uniform(-25, 25))
    elevation = math.radians(rng.uniform(6, 40))
    distance = rng.uniform(0.62, 0.92)
    target = Vector((0.0, 0.0, TILE_H * rng.uniform(0.45, 0.55)))
    offset = Vector((
        distance * math.sin(azimuth) * math.cos(elevation),
        -distance * math.cos(azimuth) * math.cos(elevation),
        distance * math.sin(elevation) + TILE_H * 0.5,
    ))
    camera.location = target + offset
    look = (target - camera.location).to_track_quat("-Z", "Y")
    # Small handheld roll about the view axis.
    view_axis = look @ Vector((0.0, 0.0, -1.0))
    roll = Quaternion(view_axis, math.radians(rng.uniform(-5, 5)))
    camera.rotation_euler = (roll @ look).to_euler()
    camera.data.lens = rng.uniform(38, 85)
    # Depth of field: tile sharp, table/background falls off like a phone macro.
    dof = camera.data.dof
    dof.use_dof = True
    dof.focus_distance = (target - camera.location).length
    dof.aperture_fstop = rng.uniform(4.0, 11.0)


def jitter_scene(tile: bpy.types.Object, softboxes: list[bpy.types.Object], rng: random.Random) -> None:
    # In-plane tile lean and a tiny yaw, as a hand tile is rarely dead straight.
    tile.rotation_euler = Euler((
        math.radians(rng.uniform(-3, 3)),
        math.radians(rng.uniform(-4, 4)),
        math.radians(rng.uniform(-6, 6)),
    ))
    for box in softboxes:
        emission = box.data.materials[0].node_tree.nodes["Emission"]
        emission.inputs["Strength"].default_value = box["base_energy"] * rng.uniform(0.85, 1.3)
    key = bpy.data.objects.get("Key")
    if key:
        key.data.energy = 22.0 * rng.uniform(0.8, 1.25)
        # White-balance drift: warm tungsten <-> cool daylight, as phones vary.
        warmth = rng.uniform(-1.0, 1.0)
        key.data.color = (
            1.0, 0.86 + 0.11 * (warmth * 0.5 + 0.5), 0.72 + 0.26 * (warmth * 0.5 + 0.5),
        ) if warmth >= 0 else (
            0.80 + 0.19 * (warmth + 1.0), 0.90 + 0.09 * (warmth + 1.0), 1.0,
        )
    background = bpy.context.scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Strength"].default_value = rng.uniform(0.28, 0.5)
    table = bpy.data.objects["Table"].data.materials[0].node_tree.nodes["Principled BSDF"]
    warm = rng.uniform(-0.015, 0.02)
    table.inputs["Base Color"].default_value = (
        max(0.0, 0.045 + warm), max(0.0, 0.06 + warm * 0.5), max(0.0, 0.05 + warm * 0.4), 1.0,
    )


def render_crops(args: argparse.Namespace) -> None:
    """Phase 1: labeled single-tile face crops -> <output>/train/<label>/*.png."""
    glyph_root = args.glyphs.rstrip("/\\")
    labels = args.only if args.only else list(GLYPH_FILES)
    body = build_body_material()
    face = build_face_material()
    tile = make_tile("Tile", body, face)
    _, camera, softboxes = build_environment()
    configure_render(args.width, args.height, args.render_samples)
    glyph_node = face.node_tree.nodes["Glyph"]

    scene = bpy.context.scene
    total = 0
    for class_index, label in enumerate(labels):
        glyph_node.image = bpy.data.images.load(
            f"{glyph_root}/{GLYPH_FILES[label]}", check_existing=True
        )
        for sample_index in range(args.samples_per_class):
            rng = random.Random(args.seed + class_index * 1_000_003 + sample_index * 7_919)
            place_camera(camera, rng)
            jitter_scene(tile, softboxes, rng)
            scene.render.filepath = f"{args.output}/train/{label}/{label}-{sample_index:03d}.png"
            bpy.ops.render.render(write_still=True)
            total += 1
    print(f"RENDERED {total} crops for {len(labels)} labels -> {PurePath(args.output) / 'train'}", flush=True)


def draw_hand(rng: random.Random) -> tuple[list[str], str]:
    """14 hand labels (max four physical copies each) plus one dora indicator."""
    remaining = {label: 4 for label in GLYPH_FILES}
    hand: list[str] = []
    while len(hand) < 14:
        label = rng.choice([lbl for lbl, n in remaining.items() if n > 0])
        remaining[label] -= 1
        hand.append(label)
    dora = rng.choice(list(GLYPH_FILES))
    return hand, dora


def image_bbox(scene, camera, obj, width: int, height: int) -> list[int]:
    import bpy_extras

    xs, ys = [], []
    for corner in obj.bound_box:
        ndc = bpy_extras.object_utils.world_to_camera_view(
            scene, camera, obj.matrix_world @ Vector(corner)
        )
        xs.append(min(max(ndc.x, 0.0), 1.0))
        ys.append(min(max(ndc.y, 0.0), 1.0))
    left = round(min(xs) * width)
    right = round(max(xs) * width)
    top = round((1.0 - max(ys)) * height)  # camera-view y is bottom-up
    bottom = round((1.0 - min(ys)) * height)
    return [left, top, right - left, bottom - top]


def render_hands(args: argparse.Namespace) -> None:
    """Phase 2: full 14+dora hand layouts -> <output>/hands/hand-###.png + .json.

    The layout follows the capture guide: 14 upright separated hand tiles with a
    larger gap before the winning (14th) tile and one dora indicator below. Each
    hand ships per-tile bounding boxes for a future learned localizer; the shipped
    recognizer still uses the deterministic connected-component locator.
    """
    import json

    glyph_root = args.glyphs.rstrip("/\\")
    body = build_body_material()
    cache: dict = {}
    # Fifteen reusable tile objects; face material + transform swap per hand.
    slots = [make_tile(f"Tile_{i:02d}", body, face_material_for("1m", glyph_root, cache)) for i in range(15)]
    _, camera, _ = build_environment()  # crop-mode softboxes are removed below
    # Widen the table for the ~2.9-unit row.
    bpy.data.objects["Table"].scale = (2.5, 2.5, 1.0)
    # Lighting for a row of standing tiles (verified against a live 5-tile row):
    # the faces are matte (see face_material_for), so a single WIDE front area
    # light spanning the whole row gives even, specular-free illumination on every
    # face — a point/sun light either falls off across the row or reflects into the
    # camera and washes the face-on middle tiles. The crop-mode Key and softboxes
    # are disabled here.
    # Remove (not just hide) the crop-mode Key and softboxes: an emissive mesh can
    # still contribute light in EEVEE when only hide_render is set, and the
    # softboxes sit right in front of the centre tiles and flood them.
    for name in ("Key", "Softbox_key", "Softbox_fill"):
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    _reset("FrontLight", "object")
    fl_data = bpy.data.lights.new("FrontLight", "AREA")
    fl_data.shape = "RECTANGLE"
    fl_data.size = 6.0          # far wider than the ~2.8 row so coverage is even
    fl_data.size_y = 1.8
    fl_data.energy = 45.0
    front = bpy.data.objects.new("FrontLight", fl_data)
    bpy.context.collection.objects.link(front)
    front.location = (0.0, -2.2, 0.9)  # farther back: even irradiance, no hot centre
    front.rotation_euler = (
        Vector((0, 0, TILE_H * 0.45)) - front.location
    ).to_track_quat("-Z", "Y").to_euler()
    front["base_energy"] = fl_data.energy
    configure_render(args.width_hand, args.height_hand, args.render_samples)
    scene = bpy.context.scene
    # Matte tiles need no raytraced reflections, and EEVEE's raytraced GI bounces
    # the bright faces and front light across the scene into a pale wash that
    # swallows the glyphs. Disable it for hand mode (crop mode keeps it).
    if hasattr(scene.eevee, "use_raytracing"):
        scene.eevee.use_raytracing = False
    background = scene.world.node_tree.nodes.get("Background")
    if background:  # hand mode never calls jitter_scene, so set world level here
        background.inputs["Strength"].default_value = 0.30

    pitch = TILE_W + 0.02
    win_gap = 0.10
    xs = [i * pitch + (win_gap if i == 13 else 0.0) for i in range(14)]
    centre = sum(xs) / len(xs)
    total = 0
    for hand_index in range(args.hands):
        rng = random.Random(args.seed + hand_index * 2_654_435_761)
        labels, dora = draw_hand(rng)
        records = []
        for i in range(14):
            tile = slots[i]
            tile.data.materials[1] = face_material_for(labels[i], glyph_root, cache)
            tile.location = (
                xs[i] - centre + rng.uniform(-0.004, 0.004),
                rng.uniform(-0.004, 0.004),
                TILE_H / 2,
            )
            tile.rotation_euler = Euler((
                math.radians(rng.uniform(-2, 2)), 0.0, math.radians(rng.uniform(-3, 3)),
            ))
            records.append((tile, labels[i], "winning" if i == 13 else "concealed"))
        dora_tile = slots[14]
        dora_tile.data.materials[1] = face_material_for(dora, glyph_root, cache)
        # Negative Y is toward the camera, so the dora sits below/in front of the row.
        dora_tile.location = (rng.uniform(-0.05, 0.05), -0.40, TILE_H / 2)
        dora_tile.rotation_euler = Euler((0.0, 0.0, math.radians(rng.uniform(-3, 3))))
        records.append((dora_tile, dora, "dora"))

        # Near-top-down front camera (~26° elevation) framing the full row with
        # margin, so tiles read as separated faces rather than one merged wall.
        target = Vector((0.0, 0.0, TILE_H * 0.42))
        camera.location = (rng.uniform(-0.05, 0.05), -2.9 + rng.uniform(-0.12, 0.12), 1.45 + rng.uniform(-0.08, 0.12))
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        camera.data.lens = rng.uniform(33, 39)
        camera.data.dof.use_dof = False  # flat row; DoF only muddies the far tiles
        front.data.energy = front["base_energy"] * rng.uniform(0.9, 1.15)  # mild exposure variation
        bpy.context.view_layer.update()
        scene.render.filepath = f"{args.output}/hands/hand-{hand_index:03d}.png"
        bpy.ops.render.render(write_still=True)
        boxes = [
            {"label": lbl, "role": role, "bbox": image_bbox(scene, camera, t, args.width_hand, args.height_hand)}
            for t, lbl, role in records
        ]
        meta = {"image": f"hand-{hand_index:03d}.png", "width": args.width_hand,
                "height": args.height_hand, "tiles": boxes, "schemaVersion": 1}
        Path(f"{args.output}/hands/hand-{hand_index:03d}.json").write_text(
            json.dumps(meta, indent=2) + "\n", encoding="utf-8"
        )
        total += 1
    print(f"RENDERED {total} hands (image + boxes) -> {PurePath(args.output) / 'hands'}", flush=True)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Render synthetic-physical tiles.")
    parser.add_argument("--mode", choices=("crops", "hand"), default="crops")
    parser.add_argument("--glyphs", required=True, help="FluffyStuff Export/Regular directory")
    parser.add_argument("--output", required=True, help="output root")
    parser.add_argument("--samples-per-class", type=int, default=8)
    parser.add_argument("--hands", type=int, default=8, help="hand-mode scene count")
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--width", type=int, default=320)
    parser.add_argument("--height", type=int, default=400)
    parser.add_argument("--width-hand", type=int, default=960)
    parser.add_argument("--height-hand", type=int, default=360)
    parser.add_argument("--render-samples", type=int, default=32)
    parser.add_argument("--only", nargs="*", default=None, help="crops: limit to these labels")
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    if args.mode == "hand":
        render_hands(args)
    else:
        render_crops(args)


if __name__ == "__main__":
    main()
