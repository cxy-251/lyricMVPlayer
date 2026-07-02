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

# 3. Fibonacci Spheres (VORTEX)
count = 1000
scale = 0.5
golden_angle = math.pi * (3.0 - math.sqrt(5.0))

# Create a base sphere
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1)
base_sphere = bpy.context.active_object
base_sphere.data.materials.append(mat_gold)
bpy.ops.object.shade_smooth()

collection = bpy.context.collection
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 200
total_frames = 200

for i in range(count):
    orb = base_sphere.copy()
    orb.data = base_sphere.data.copy()
    orb.name = f"fib_orb_{i:04d}"
    collection.objects.link(orb)
    
    # We animate the orb's "index" along the Fibonacci spiral over time.
    # This creates a continuous flowing vortex!
    # Each orb is offset in time
    time_offset = i / count
    
    for frame in range(1, total_frames + 1, 10):
        # Calculate a virtual index `v_i` that moves outwards over time
        progress = (frame / total_frames + time_offset) % 1.0
        v_i = progress * count
        
        # Vortex Math
        target_r = math.sqrt(v_i) * scale
        theta = v_i * golden_angle
        
        target_x = target_r * math.cos(theta)
        target_y = target_r * math.sin(theta)
        
        # Z axis forms a deep funnel (Vortex)
        # Deep in the center, curving outwards and upwards
        target_z = (target_r * 0.4)**2 - 8.0
        
        # Scale: smaller in the center, bigger in the middle, then shrinks at the edge to fade out
        if progress < 0.05:
            target_scale = progress / 0.05 * 0.15
        elif progress > 0.9:
            target_scale = (1.0 - progress) / 0.1 * 0.15
        else:
            target_scale = 0.15
            
        orb.scale = (target_scale, target_scale, target_scale)
        orb.location = (target_x, target_y, target_z)
        
        orb.keyframe_insert(data_path="scale", frame=frame)
        orb.keyframe_insert(data_path="location", frame=frame)
        
    # (Animation interpolation defaults to BEZIER, which is smooth)

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
