import math
import os

import bpy


bpy.ops.wm.read_factory_settings(use_empty=True)


def create_material(name, base_color, roughness, metallic=0.0, emission_color=None, emission_strength=0.0):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = base_color
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if emission_color and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission_color
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


building_material = create_material("ink_city_blocks", (0.006, 0.006, 0.014, 1.0), 0.72)
roof_material = create_material("blue_roof_edges", (0.02, 0.05, 0.12, 1.0), 0.44, emission_color=(0.0, 0.1, 0.35, 1.0), emission_strength=0.2)
window_material = create_material("electric_window_marks", (0.05, 0.25, 0.55, 1.0), 0.3, emission_color=(0.0, 0.45, 1.0, 1.0), emission_strength=0.9)
horizon_material = create_material("storm_horizon_strip", (0.02, 0.08, 0.22, 1.0), 0.35, emission_color=(0.0, 0.25, 0.8, 1.0), emission_strength=0.55)


def add_cube(name, location, scale, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


add_cube("horizon_glow", (0, 0.06, 0.08), (8.6, 0.04, 0.08), horizon_material)
add_cube("foreground_roofline", (0, 0.02, 0.15), (8.8, 0.18, 0.16), building_material)

building_count = 38
for index in range(building_count):
    x = -4.1 + index * (8.2 / (building_count - 1))
    width = 0.12 + (index % 5) * 0.028
    depth = 0.28 + ((index * 7) % 5) * 0.035
    height = 0.75 + ((index * 17) % 41) / 41 * 1.55
    if index in {7, 16, 25, 31}:
        height += 0.65
        width *= 1.35
    y = 0.18 + math.sin(index * 0.9) * 0.06
    building = add_cube(f"building_{index:02d}", (x, y, height / 2 + 0.18), (width, depth, height), building_material)

    if index % 3 == 0:
        add_cube(f"roof_edge_{index:02d}", (x, y - depth * 0.52, height + 0.205), (width * 1.25, 0.018, 0.035), roof_material)

    if index % 4 != 1:
        rows = max(2, min(6, int(height / 0.32)))
        for row in range(rows):
            if (row + index) % 3 == 1:
                continue
            z = 0.44 + row * 0.26
            add_cube(
                f"window_{index:02d}_{row:02d}",
                (x, y - depth * 0.53, z),
                (width * 0.32, 0.012, 0.035),
                window_material,
            )

    if index in {5, 12, 19, 28, 34}:
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.012, depth=0.55, location=(x, y, height + 0.46))
        antenna = bpy.context.object
        antenna.name = f"antenna_{index:02d}"
        antenna.data.materials.append(roof_material)


bpy.ops.object.light_add(type="POINT", location=(0.0, -2.4, 3.6))
storm_light = bpy.context.object
storm_light.name = "storm_blue_light"
storm_light.data.energy = 220
storm_light.data.color = (0.35, 0.55, 1.0)

bpy.ops.object.camera_add(location=(0.0, -6.4, 1.55), rotation=(math.radians(78), 0, 0))
bpy.context.scene.camera = bpy.context.object

output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "anime_lightning_city.glb"))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_apply=True,
    export_materials="EXPORT",
    export_animations=False,
)
print(f"Exported {output_path}")
