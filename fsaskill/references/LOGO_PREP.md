# FSA Logo Preprocessing

## When You Need This

The bundled `assets/FSA_logo_white.png` is already preprocessed and ready to use. You only need this file if:

- The bundled logo is missing or corrupted
- You're starting from the original `FSA_vector_white.png` which has a black background
- You need to regenerate the navy-composited version

## The Problem

The original FSA logo file (`FSA_vector_white.png`) has white linework on a solid black background. When placed on the navy PDF cover page, the black background is visible as a black square — ReportLab's `mask='auto'` PNG transparency handling is unreliable.

## The Solution

Instead of fighting with alpha transparency, composite the white logo directly onto the exact navy background color (#1B2A4A). The result is a solid RGB image where the logo "background" IS the navy, making it seamless on the cover page. No transparency, no masking, no `mask='auto'`.

## Preprocessing Script

Run this once to convert the original logo:

```python
from PIL import Image
import numpy as np

# Load original logo
img = Image.open('/mnt/user-data/uploads/FSA_vector_white.png').convert('RGBA')
data = np.array(img)

# Create navy background matching exactly #1B2A4A
navy_bg = np.zeros_like(data)
navy_bg[:,:,0] = 0x1B  # R = 27
navy_bg[:,:,1] = 0x2A  # G = 42
navy_bg[:,:,2] = 0x4A  # B = 74
navy_bg[:,:,3] = 255   # fully opaque

# Use pixel brightness as alpha for blending
# Bright pixels (white linework) stay white
# Dark pixels (black background) become navy
r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3.0
alpha = np.clip(brightness / 255.0, 0, 1)

# Blend: logo over navy
result = np.zeros((data.shape[0], data.shape[1], 3), dtype=np.uint8)
for c in range(3):
    result[:,:,c] = (alpha * data[:,:,c] + (1 - alpha) * navy_bg[:,:,c]).astype(np.uint8)

# Save as RGB (no alpha channel needed)
out = Image.fromarray(result, 'RGB')
out.save('FSA_logo_white.png')
```

## Why Compositing Over Transparency

- ReportLab's `mask='auto'` is unreliable with PNG alpha channels
- Compositing onto the known background color guarantees pixel-perfect results
- The output is a simple RGB PNG — no alpha channel, no masking needed
- `drawImage()` works with just `preserveAspectRatio=True` — no `mask` parameter

## Dependencies

- `Pillow` (PIL) — pre-installed in Claude's environment
- `numpy` — pre-installed in Claude's environment

## Output

- Same dimensions as original (~1500x1414)
- RGB mode (no alpha)
- Navy background (#1B2A4A) where original had black
- White linework preserved
- Seamless on the navy PDF cover page
