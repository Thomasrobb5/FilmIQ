import os
import pygame
from pygame.locals import *

# Set the root directory to the folder containing the subfolders
# Replace this with your actual path
ROOT_DIR = r'W:\temp\MediaDatabaseV1'

# Get sorted list of subfolders
subfolders = sorted([d for d in os.listdir(ROOT_DIR) if os.path.isdir(os.path.join(ROOT_DIR, d))])

if not subfolders:
    print("No subfolders found in the specified location.")
    exit()

# Initialize pygame
pygame.init()

# Set up the display (adjust width/height based on your screen resolution and image sizes)
SCREEN_WIDTH = 1920  # Example: full HD width
SCREEN_HEIGHT = 1080  # Example: full HD height
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption('Frame Viewer')

# Fonts for error messages/captions and title
font = pygame.font.SysFont(None, 36)
title_font = pygame.font.SysFont(None, 72)

# List to keep track of marked folders
marked_folders = set()

# Function to load images from a subfolder
def load_images(subfolder):
    path = os.path.join(ROOT_DIR, subfolder)
    images = []
    for i in range(1, 6):
        img_path = os.path.join(path, f'frame_{i}.jpg')
        if os.path.exists(img_path):
            try:
                img = pygame.image.load(img_path)
                # Scale to fit in grid cell, preserve aspect ratio
                grid_cols = 3  # 3 columns
                grid_rows = 2  # 2 rows (for 5 images, last row partial)
                cell_width = SCREEN_WIDTH // grid_cols
                cell_height = (SCREEN_HEIGHT - 100) // grid_rows  # Leave space for title
                # Scale to fit cell, but preserve aspect
                orig_w, orig_h = img.get_size()
                scale_factor = min(cell_width / orig_w, cell_height / orig_h)
                scale_width = int(orig_w * scale_factor)
                scale_height = int(orig_h * scale_factor)
                img = pygame.transform.scale(img, (scale_width, scale_height))
                images.append(img)
            except pygame.error:
                # Handle corrupted or invalid image
                images.append(None)
        else:
            # Missing image
            images.append(None)
    return images

# Start with the first subfolder
current_index = 0
images = load_images(subfolders[current_index])

# Main loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == QUIT:
            running = False
        elif event.type == KEYDOWN:
            if event.key == K_ESCAPE:
                running = False
            elif event.key == K_RIGHT:
                current_index = (current_index + 1) % len(subfolders)
                images = load_images(subfolders[current_index])
            elif event.key == K_LEFT:
                current_index = (current_index - 1) % len(subfolders)
                images = load_images(subfolders[current_index])
            elif event.key == K_m:  # Press 'm' to toggle mark
                current_folder = subfolders[current_index]
                if current_folder in marked_folders:
                    marked_folders.remove(current_folder)
                else:
                    marked_folders.add(current_folder)

    # Clear screen
    screen.fill((0, 0, 0))

    # Display images in a 3x2 grid (5 images: fill first 5 cells)
    grid_cols = 3
    grid_rows = 2
    cell_width = SCREEN_WIDTH // grid_cols
    cell_height = (SCREEN_HEIGHT - 100) // grid_rows  # Leave 100px for title
    for idx, img in enumerate(images):
        if idx >= grid_cols * grid_rows:  # Only 5 images
            break
        row = idx // grid_cols
        col = idx % grid_cols
        x = col * cell_width
        y = 100 + row * cell_height  # Start below title
        if img:
            img_x = x + (cell_width - img.get_width()) // 2
            img_y = y + (cell_height - img.get_height()) // 2
            screen.blit(img, (img_x, img_y))
        else:
            # Display placeholder for missing or errored image, centered
            error_text = font.render(f'Error: frame_{idx+1}.jpg', True, (255, 0, 0))
            text_w, text_h = error_text.get_size()
            screen.blit(error_text, (x + (cell_width - text_w) // 2, y + (cell_height - text_h) // 2))

    # Display subfolder name prominently at the top, with marked status
    marked_status = "[Marked] " if subfolders[current_index] in marked_folders else ""
    subfolder_name = f"{marked_status}{subfolders[current_index]} ({current_index + 1}/{len(subfolders)})"
    title_text = title_font.render(subfolder_name, True, (255, 255, 255))
    title_w, title_h = title_text.get_size()
    screen.blit(title_text, (SCREEN_WIDTH // 2 - title_w // 2, 10))

    # Update caption with current subfolder name (for redundancy)
    pygame.display.set_caption(f'Viewing: {subfolder_name}')

    # Update display
    pygame.display.flip()

# Quit pygame
pygame.quit()

# After quitting, print the list of marked folders
if marked_folders:
    print("Marked folders:")
    for folder in sorted(marked_folders):
        print(folder)
else:
    print("No folders marked.")