import bpy
import math
import os

# 1. Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. Materials
def create_material(name, base_color, metallic, roughness, emission_color, emission_strength):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")

    if bsdf:
        if 'Base Color' in bsdf.inputs:
            bsdf.inputs['Base Color'].default_value = base_color
        if 'Metallic' in bsdf.inputs:
            bsdf.inputs['Metallic'].default_value = metallic
        if 'Roughness' in bsdf.inputs:
            bsdf.inputs['Roughness'].default_value = roughness

        # Handle Blender 4.0+ vs older versions
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = emission_color
            bsdf.inputs['Emission Strength'].default_value = emission_strength
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = emission_color
            if 'Emission Strength' in bsdf.inputs:
                bsdf.inputs['Emission Strength'].default_value = emission_strength

    return mat

def hsl_to_rgba(h, s, l, alpha=1.0):
    c = (1.0 - abs(2.0 * l - 1.0)) * s
    hp = h * 6.0
    x = c * (1.0 - abs(hp % 2.0 - 1.0))

    if hp < 1.0:
        r, g, b = c, x, 0.0
    elif hp < 2.0:
        r, g, b = x, c, 0.0
    elif hp < 3.0:
        r, g, b = 0.0, c, x
    elif hp < 4.0:
        r, g, b = 0.0, x, c
    elif hp < 5.0:
        r, g, b = x, 0.0, c
    else:
        r, g, b = c, 0.0, x

    m = l - c / 2.0
    return (r + m, g + m, b + m, alpha)

FIBONACCI_GROUPS = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]
FIBONACCI_TOTAL = sum(FIBONACCI_GROUPS)

band_materials = []
for group_index, group_size in enumerate(FIBONACCI_GROUPS):
    hue = (0.09 + group_index * 0.61803398875) % 1.0
    color = hsl_to_rgba(hue, 0.86, 0.62)
    band_materials.append(
        create_material(
            f"fib_band_{group_size:03d}",
            color,
            0.62,
            0.24,
            color,
            0.82 + group_index * 0.025,
        )
    )

mat_seed = create_material(
    "fibonacci_seed_white",
    (1.0, 0.95, 0.68, 1.0),
    0.7,
    0.16,
    (1.0, 0.95, 0.68, 1.0),
    1.45,
)

# 3. Fibonacci Spheres (VORTEX)
count = FIBONACCI_TOTAL
scale = 0.5
golden_angle = math.pi * (3.0 - math.sqrt(5.0))

def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)

def fibonacci_path(progress):
    path_index = progress * count
    target_r = math.sqrt(path_index) * scale
    theta = path_index * golden_angle

    target_x = target_r * math.cos(theta)
    target_y = target_r * math.sin(theta)

    # A lifted funnel: particles are born deep in the center, spiral upward,
    # then fade out before they jump invisibly back to the source.
    target_z = (target_r * 0.4) ** 2 - 8.0
    return (target_x, target_y, target_z)

def visibility_envelope(progress):
    birth_hidden = 0.035
    birth_visible = 0.105
    fade_start = 0.87
    fade_end = 0.955

    if progress < birth_hidden or progress > fade_end:
        return 0.0
    if progress < birth_visible:
        return smoothstep(birth_hidden, birth_visible, progress)
    if progress > fade_start:
        return 1.0 - smoothstep(fade_start, fade_end, progress)
    return 1.0

def create_sphere_mesh(name, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=7, radius=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj

base_spheres = [create_sphere_mesh(f"base_fib_{i:02d}", mat) for i, mat in enumerate(band_materials)]
base_seed = create_sphere_mesh("base_fib_seed", mat_seed)

collection = bpy.context.collection
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 241
total_frames = 240
keyframes = list(range(1, bpy.context.scene.frame_end + 1, 4))
if bpy.context.scene.frame_end not in keyframes:
    keyframes.append(bpy.context.scene.frame_end)

try:
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
except Exception:
    pass

group_ranges = []
cursor = 0
for group_index, group_size in enumerate(FIBONACCI_GROUPS):
    group_ranges.append((cursor, cursor + group_size, group_index, group_size))
    cursor += group_size

def group_for_index(index):
    for start, end, group_index, group_size in group_ranges:
        if start <= index < end:
            return start, end, group_index, group_size
    return group_ranges[-1]

def animate_orb(orb, index, group_index, group_size, is_boundary):
    time_offset = index / count
    band_scale = 1.0 + min(group_index, 10) * 0.015
    seed_scale = 1.14 if is_boundary else 1.0
    target_scale_base = 0.105 * band_scale * seed_scale

    for frame in keyframes:
        frame_progress = (frame - 1) / total_frames
        progress = (frame_progress + time_offset) % 1.0
        target_x, target_y, target_z = fibonacci_path(progress)
        envelope = visibility_envelope(progress)
        target_scale = target_scale_base * envelope

        orb.scale = (target_scale, target_scale, target_scale)
        orb.location = (target_x, target_y, target_z)

        orb.keyframe_insert(data_path="scale", frame=frame)
        orb.keyframe_insert(data_path="location", frame=frame)

for i in range(count):
    start, _end, group_index, group_size = group_for_index(i)
    is_boundary = i == start
    source = base_seed if is_boundary else base_spheres[group_index]
    orb = source.copy()
    orb.data = source.data
    orb.name = f"fib_{group_size:03d}_orb_{i:04d}"
    collection.objects.link(orb)
    animate_orb(orb, i, group_index, group_size, is_boundary)

# Remove hidden source objects; their mesh data remains shared by the animated orbs.
for source in base_spheres + [base_seed]:
    bpy.data.objects.remove(source, do_unlink=True)

# 8. Export GLB
output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "fibonacci_orb.glb"))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format="GLB",
    export_apply=True,
    export_materials="EXPORT",
    export_animations=True
)
print(f"Exported to {output_path}")
