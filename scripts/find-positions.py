import cv2
import numpy as np
import json
import os

# Resolve paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_IMAGE = os.path.join(SCRIPT_DIR, 'positions.jpg')
OUTPUT_JSON = os.path.join(SCRIPT_DIR, 'oval-positions.json')

# Canvas constants (known original resolution)
TARGET_WIDTH = 3840
TARGET_HEIGHT = 2160

# Load image
image = cv2.imread(INPUT_IMAGE)
if image is None:
    raise FileNotFoundError(f"❌ Could not read image at: {INPUT_IMAGE}")

height, width = image.shape[:2]
print(f"✅ Image loaded: {INPUT_IMAGE}")
print(f"   Dimensions: {width}x{height}")
print(f"   Top-left pixel BGR: {image[0,0]}")

# Convert to HSV
hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
print(f"   Top-left pixel HSV: {hsv[0,0]}")

# Green detection range for #3eff02 in HSV
lower = np.array([50, 240, 240])
upper = np.array([60, 255, 255])
mask = cv2.inRange(hsv, lower, upper)

# Optional debug: save the mask image
# cv2.imwrite(os.path.join(SCRIPT_DIR, 'debug-mask.jpg'), mask)

# Find contours
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
print(f"🔍 Found {len(contours)} contours")

# Process valid contours
results = []
for cnt in contours:
    area = cv2.contourArea(cnt)
    if 20000 < area < 22000:
        x, y, w, h = cv2.boundingRect(cnt)
        cx = x + w / 2
        cy = y + h / 2
        results.append({
            "x": round(cx / width, 6),
            "y": round(cy / height, 6),
            "submission": None
        })

# Sort top-to-bottom then left-to-right
results.sort(key=lambda pt: (round(pt["y"], 3), pt["x"]))

# Save to file
with open(OUTPUT_JSON, 'w') as f:
    json.dump(results, f, indent=2)

print(f"✅ Wrote {len(results)} positions to {OUTPUT_JSON}")
