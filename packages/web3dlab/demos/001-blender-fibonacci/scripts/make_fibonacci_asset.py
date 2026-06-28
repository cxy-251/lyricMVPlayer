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

mat_gold = create_material("gold_emissive", (1.0, 0.8, 0.2, 1.0), 0.5, 0.3, (1.0, 0.8, 0.2, 1.0), 1.5)
mat_core = create_material("core_emissive", (1.0, 0.95, 0.8, 1.0), 0.1, 0.4, (1.0, 0.95, 0.8, 1.0), 3.0)
mat_dark = create_material("dark_metal", (0.1, 0.1, 0.1, 1.0), 0.9, 0.3, (0, 0, 0, 1), 0.0)

# 3. Fibonacci Spheres
count = 800
scale = 0.3
golden_angle = math.pi * (3.0 - math.sqrt(5.0))

# Create a base sphere to copy for performance
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1)
base_sphere = bpy.context.active_object
base_sphere.data.materials.append(mat_gold)
bpy.ops.object.shade_smooth()

collection = bpy.context.collection

# Generate 800 orbs
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 180

for i in range(count):
    r = math.sqrt(i) * scale
    theta = i * golden_angle
    x = r * math.cos(theta)
    y = r * math.sin(theta)
    z = 0.05 * math.sin(i * 0.12)
    
    orb = base_sphere.copy()
    orb.data = base_sphere.data.copy()
    orb.name = f"fib_orb_{i:04d}"
    
    orb.location = (x, y, z)
    # slight size variation
    target_radius = 0.05 + 0.02 * math.sin(i * 0.5)
    
    collection.objects.link(orb)
    
    # Animate scale for dynamic growth effect
    start_frame = int(1 + (i / count) * 120)
    
    # Initial state (invisible)
    orb.scale = (0, 0, 0)
    orb.keyframe_insert(data_path="scale", frame=1)
    
    if start_frame > 1:
        orb.keyframe_insert(data_path="scale", frame=start_frame - 1)
        
    # Overshoot effect
    overshoot_radius = target_radius * 1.3
    orb.scale = (overshoot_radius, overshoot_radius, overshoot_radius)
    orb.keyframe_insert(data_path="scale", frame=start_frame + 12)
    
    # Settle to final size
    orb.scale = (target_radius, target_radius, target_radius)
    orb.keyframe_insert(data_path="scale", frame=start_frame + 25)

# Remove base sphere
bpy.data.objects.remove(base_sphere, do_unlink=True)

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
