import cv2
import numpy as np
import json
import os
import matplotlib.pyplot as plt

# Resolve paths
CWD = os.getcwd()
INPUT_IMAGE = os.path.join(CWD, 'src', 'assets', 'images', 'layout.png')
OUTPUT_JSON = os.path.join(CWD, 'src', 'assets', 'data', 'projector-positions.json')

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

# Find contours
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
print(f"🔍 Found {len(contours)} contours")

# Process valid contours
results = []
id_counter = 1
for cnt in contours:
    area = cv2.contourArea(cnt)
    if 5000 < area < 20000:
        x, y, w, h = cv2.boundingRect(cnt)
        cx = x + w / 2
        cy = y + h / 2
        results.append({
            "x": round(cx / width, 6),
            "y": round(cy / height, 6),
            "submission": None,
            "age": 0,
            "id": id_counter
        })
        id_counter += 1

# Sort top-to-bottom then left-to-right
results.sort(key=lambda pt: (round(pt["y"], 3), pt["x"]))

# Reassign IDs in sorted order
for i, pt in enumerate(results, start=1):
    pt["id"] = i

# Save to file
with open(OUTPUT_JSON, 'w') as f:
    json.dump(results, f, indent=2)

print(f"✅ Wrote {len(results)} positions to {OUTPUT_JSON}")

# ======================
# VISUALIZATION SECTION
# ======================

# Convert BGR (OpenCV) to RGB (matplotlib expects RGB)
rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

plt.figure(figsize=(16, 9))
plt.imshow(rgb_image)
plt.axis('off')

# Draw red '+' signs for each detected center
for pt in results:
    cx = pt["x"] * width
    cy = pt["y"] * height
    plt.plot(cx, cy, color='red', marker='+', markersize=15, mew=2)

plt.title(f"Detected {len(results)} positions", fontsize=14)
plt.tight_layout()
plt.show()
