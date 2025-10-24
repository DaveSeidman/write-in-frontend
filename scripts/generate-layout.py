import cv2
import numpy as np
import os
import sys

"""
Generate a layout image with green rectangles arranged in a staggered grid pattern
within a region defined by a red outline polygon.

Usage:
    python scripts/generate-layout.py <num_rectangles>

Example:
    python scripts/generate-layout.py 45
"""

# Resolve paths
CWD = os.getcwd()
INPUT_IMAGE = os.path.join(CWD, 'src', 'assets', 'images', 'layout_new.png')
OUTPUT_IMAGE = os.path.join(CWD, 'src', 'assets', 'images', 'layout_generated.png')

# Get number of rectangles from command line
if len(sys.argv) < 2:
    print("❌ Error: Please provide the number of rectangles")
    print("Usage: python scripts/generate-layout.py <num_rectangles>")
    sys.exit(1)

try:
    NUM_RECTS = int(sys.argv[1])
    if NUM_RECTS <= 0:
        raise ValueError("Number must be positive")
except ValueError:
    print(f"❌ Error: Invalid number: {sys.argv[1]}")
    sys.exit(1)

print(f"🎯 Generating layout with {NUM_RECTS} rectangles")

# Load image
image = cv2.imread(INPUT_IMAGE)
if image is None:
    raise FileNotFoundError(f"❌ Could not read: {INPUT_IMAGE}")

height, width = image.shape[:2]
print(f"📐 Image: {width}×{height}")

# ============================================
# STEP 1: Detect RED outline polygon
# ============================================
print("🔍 Detecting red outline...")

hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

# Red wraps around in HSV (0-10 and 170-180)
mask1 = cv2.inRange(hsv, np.array([0, 100, 100]), np.array([10, 255, 255]))
mask2 = cv2.inRange(hsv, np.array([170, 100, 100]), np.array([180, 255, 255]))
red_mask = cv2.bitwise_or(mask1, mask2)

# Save red detection
cv2.imwrite(os.path.join(CWD, 'src', 'assets', 'images', 'red_detected.png'), red_mask)

# Find the red outline contour
contours, hierarchy = cv2.findContours(red_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

if not contours:
    print("❌ No red outline found")
    sys.exit(1)

# Get the contour with the largest area (the main outline)
main_contour = max(contours, key=cv2.contourArea)

print(f"✅ Found outline with {len(main_contour)} points")

# ============================================
# STEP 2: Create polygon mask with padding
# ============================================
print("🔍 Creating polygon mask...")

# Create mask from the polygon
region_mask = np.zeros((height, width), dtype=np.uint8)
cv2.fillPoly(region_mask, [main_contour], 255)

# Apply padding by eroding the mask (moves edges inward)
PADDING_PX = 15
kernel = np.ones((PADDING_PX * 2, PADDING_PX * 2), np.uint8)
region_mask = cv2.erode(region_mask, kernel, iterations=1)

print(f"   Applied {PADDING_PX}px padding")

# Save mask
cv2.imwrite(os.path.join(CWD, 'src', 'assets', 'images', 'mask_raw.png'), region_mask)

# Calculate polygon area
poly_area = cv2.contourArea(main_contour)
x, y, w, h = cv2.boundingRect(main_contour)
fill_ratio = poly_area / (w * h) * 100

print(f"   Polygon area: {poly_area:.0f} pixels")
print(f"   Bounding box: {w}×{h}")
print(f"   Fill ratio: {fill_ratio:.1f}%")

# ============================================
# STEP 3: Calculate rectangle size
# ============================================
print("🔍 Calculating rectangle size...")

rect_aspect = 1.8  # Width:height ratio

# Calculate size based on area
usable_area = poly_area * 0.55
rect_area = usable_area / NUM_RECTS
rect_height = int(np.sqrt(rect_area / rect_aspect))
rect_width = int(rect_height * rect_aspect)

# Minimum size
rect_height = max(30, rect_height)
rect_width = max(54, rect_width)  # 30 * 1.8

print(f"   Starting size: {rect_width}×{rect_height}")

# ============================================
# STEP 4: Generate grid and place rectangles
# ============================================
print("🔍 Generating positions...")

best_positions = []
best_w = rect_width
best_h = rect_height

# Try shrinking if needed
for attempt in range(5):
    spacing_x = int(rect_width * 1.15)
    spacing_y = int(rect_height * 1.15)

    positions = []
    row = 0
    py = y + spacing_y // 2

    while py <= y + h:
        offset_x = (spacing_x // 2) if row % 2 == 1 else 0
        px = x + spacing_x // 2 + offset_x

        while px <= x + w:
            # Check if position is inside polygon
            if 0 <= px < width and 0 <= py < height:
                if region_mask[py, px] == 255:
                    # Check rectangle fits by testing corners
                    valid = True
                    test_points = [
                        (px - rect_width//2 + 5, py - rect_height//2 + 5),  # top-left
                        (px + rect_width//2 - 5, py - rect_height//2 + 5),  # top-right
                        (px - rect_width//2 + 5, py + rect_height//2 - 5),  # bottom-left
                        (px + rect_width//2 - 5, py + rect_height//2 - 5),  # bottom-right
                    ]

                    for tx, ty in test_points:
                        if not (0 <= tx < width and 0 <= ty < height):
                            valid = False
                            break
                        if region_mask[ty, tx] != 255:
                            valid = False
                            break

                    if valid:
                        positions.append((px, py))

            px += spacing_x

        py += spacing_y
        row += 1

    print(f"   Attempt {attempt + 1}: {len(positions)} positions ({rect_width}×{rect_height})")

    if len(positions) >= NUM_RECTS:
        best_positions = positions
        best_w = rect_width
        best_h = rect_height
        break

    if len(positions) > len(best_positions):
        best_positions = positions
        best_w = rect_width
        best_h = rect_height

    # Shrink
    rect_width = int(rect_width * 0.9)
    rect_height = int(rect_height * 0.9)

print(f"✅ Placing {min(NUM_RECTS, len(best_positions))} rectangles ({best_w}×{best_h})")

if not best_positions:
    print("❌ No valid positions found")
    sys.exit(1)

# ============================================
# STEP 5: Draw output
# ============================================
print("🔍 Drawing output...")

# Gray background
output = np.full((height, width, 3), (180, 180, 180), dtype=np.uint8)

# Draw green rectangles
green = (2, 255, 62)  # #3eff02 in BGR
count = min(NUM_RECTS, len(best_positions))

for i in range(count):
    px, py = best_positions[i]
    # Calculate top-left corner from center point
    x1 = px - best_w // 2
    y1 = py - best_h // 2
    x2 = px + best_w // 2
    y2 = py + best_h // 2
    cv2.rectangle(output, (x1, y1), (x2, y2), green, -1)

# Save
cv2.imwrite(OUTPUT_IMAGE, output)
print(f"💾 Saved: {OUTPUT_IMAGE}")

# Debug overlay
debug = image.copy()
for i in range(count):
    px, py = best_positions[i]
    cv2.circle(debug, (px, py), 5, (0, 255, 0), -1)
cv2.imwrite(os.path.join(CWD, 'src', 'assets', 'images', 'layout_debug.png'), debug)

if count < NUM_RECTS:
    print(f"⚠️  Only placed {count}/{NUM_RECTS}")
