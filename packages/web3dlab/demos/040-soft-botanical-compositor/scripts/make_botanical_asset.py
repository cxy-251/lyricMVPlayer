import math
import os

import bpy
from mathutils import Vector


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


branch_material = create_material(
    "soft_ivory_branch",
    (0.92, 0.9, 0.84, 1.0),
    roughness=0.42,
    metallic=0.02,
    emission_color=(0.9, 0.86, 0.78, 1.0),
    emission_strength=0.02,
)
fruit_material = create_material(
    "soft_pink_fruit",
    (1.0, 0.46, 0.66, 1.0),
    roughness=0.38,
    metallic=0.04,
    emission_color=(1.0, 0.22, 0.48, 1.0),
    emission_strength=0.18,
)
bud_material = create_material(
    "warm_pearl_buds",
    (1.0, 0.84, 0.72, 1.0),
    roughness=0.5,
    metallic=0.0,
    emission_color=(1.0, 0.62, 0.42, 1.0),
    emission_strength=0.08,
)


def branch_points(index, branch_count):
    spread = (index / max(1, branch_count - 1) - 0.5) * 4.0
    direction = -1 if index % 2 else 1
    points = []
    for point_index in range(7):
        t = point_index / 6
        x = spread * (0.2 + t * 0.76) + math.sin(t * math.pi * 1.8 + index * 0.62) * 0.22
        y = math.sin(index * 0.5 + t * 2.7) * 0.28
        z = -1.72 + t * 3.54
        if point_index > 2:
            x += direction * math.sin((t - 0.3) * math.pi) * 0.28
        points.append(Vector((x, y, z)))
    return points


def add_curve_branch(name, points, radius):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 10
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(branch_material)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    bpy.context.object.name = name
    bpy.context.object.data.name = f"{name}_mesh"
    bpy.ops.object.shade_smooth()
    return bpy.context.object


collection = bpy.context.collection

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=(0, 0, 0))
fruit_proto = bpy.context.object
fruit_proto.name = "fruit_proto"
fruit_proto.data.name = "fruit_proto_mesh"
fruit_proto.data.materials.append(fruit_material)
bpy.ops.object.shade_smooth()

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(0, 0, 0))
bud_proto = bpy.context.object
bud_proto.name = "bud_proto"
bud_proto.data.name = "bud_proto_mesh"
bud_proto.data.materials.append(bud_material)
bpy.ops.object.shade_smooth()

branch_count = 12
for branch_index in range(branch_count):
    points = branch_points(branch_index, branch_count)
    add_curve_branch(f"branch_{branch_index:02d}", points, 0.014 + (branch_index % 3) * 0.002)

    for fruit_index in range(5):
        t = (fruit_index + 1.15) / 6.25
        base = points[min(5, int(t * 6))]
        next_point = points[min(6, int(t * 6) + 1)]
        p = base.lerp(next_point, (t * 6) % 1)
        p.x += math.sin(branch_index * 1.4 + fruit_index * 0.9) * 0.13
        p.y += math.cos(branch_index * 0.7 + fruit_index) * 0.1
        p.z += math.sin(fruit_index * 1.1 + branch_index) * 0.05
        radius = 0.075 + ((branch_index + fruit_index) % 4) * 0.012
        fruit = fruit_proto.copy()
        fruit.name = f"fruit_{branch_index:02d}_{fruit_index:02d}"
        fruit.location = p
        fruit.scale = (radius, radius, radius)
        collection.objects.link(fruit)

    for bud_index in range(2):
        t = 0.78 + bud_index * 0.12
        p = points[0].lerp(points[-1], t)
        p.x += math.sin(branch_index + bud_index) * 0.16
        p.y += math.cos(branch_index * 0.8) * 0.08
        bud = bud_proto.copy()
        bud.name = f"bud_{branch_index:02d}_{bud_index:02d}"
        bud.location = p
        bud.scale = (0.042, 0.042, 0.042)
        collection.objects.link(bud)


bpy.data.objects.remove(fruit_proto, do_unlink=True)
bpy.data.objects.remove(bud_proto, do_unlink=True)


bpy.ops.object.light_add(type="AREA", location=(0.0, -3.2, 4.5))
key_light = bpy.context.object
key_light.name = "softbox_key"
key_light.data.energy = 450
key_light.data.size = 4.8

bpy.ops.object.camera_add(location=(0.0, -7.0, 0.45), rotation=(math.radians(86), 0, 0))
bpy.context.scene.camera = bpy.context.object

output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "soft_botanical.glb"))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_apply=True,
    export_materials="EXPORT",
    export_animations=False,
)
print(f"Exported {output_path}")
