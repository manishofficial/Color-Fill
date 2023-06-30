// Global variables to store filled regions and their colors
let shapeRegions = {};
let filledColors = {};

// Handle image file selection
const imageFileInput = document.getElementById('imageFile');
imageFileInput.addEventListener('change', handleImageUpload);

// Handle canvas click event
const canvas = document.getElementById('canvas');
canvas.addEventListener('click', handleCanvasClick);
// canvas.addEventListener('mousemove', handleCanvasMouseMove);

// Handle canvas click event
function handleCanvasClick(event) {
    const x = event.offsetX;
    const y = event.offsetY;

    // Find the shape containing the clicked region
    const shapeKey = findShape(x, y);

    // Fill the clicked region in the shape with the selected color
    if (shapeKey) {
        const colorInput = document.getElementById(shapeKey);
        const selectedColor = colorInput.value;
        fillRegion(shapeKey, selectedColor);
    }
}

// Handle canvas mousemove event
function handleCanvasMouseMove(event) {
    const x = event.offsetX;
    const y = event.offsetY;

    // Find the shape containing the region under the mouse
    const shapeKey = findShape(x, y);

    // Show region fill effect if the mouse is moved without clicking
    if (shapeKey) {
        showRegionFillEffect(shapeKey);
    } else {
        clearCanvas();
    }
}

// Handle image file upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            // Create a temporary canvas to process the image
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');

            // Set the temporary canvas dimensions
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;

            // Draw the image on the temporary canvas
            tempCtx.drawImage(img, 0, 0);

            // Get the image data from the temporary canvas
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const pixels = imageData.data;

            // Apply image thresholding to convert the image to pure black and white
            const threshold = 128; // Set your desired threshold value here

            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];

                // Calculate grayscale value using the formula: (0.299 * R + 0.587 * G + 0.114 * B)
                const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;

                // Convert each pixel to black or white based on the threshold
                const newColor = grayscale >= threshold ? 255 : 0;

                pixels[i] = newColor; // Set red channel
                pixels[i + 1] = newColor; // Set green channel
                pixels[i + 2] = newColor; // Set blue channel
            }

            // Update the temporary canvas with the modified image data
            tempCtx.putImageData(imageData, 0, 0);

            // Clear the main canvas
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw the modified image on the main canvas
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

            // Clear shape regions and filled colors when a new image is uploaded
            shapeRegions = {};
            filledColors = {};

            // Detect shapes and render color options
            detectShapes();
            renderColorOptions();
        };
        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}

// Calculate the Otsu's threshold value for the image data
function calculateOtsuThreshold(pixels) {
    const histogram = Array.from({ length: 256 }, () => 0);

    // Calculate the histogram of pixel intensities
    for (let i = 0; i < pixels.length; i += 4) {
        const grayscale = pixels[i];
        histogram[grayscale]++;
    }

    const totalPixels = pixels.length / 4;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 0;

    for (let i = 0; i < 256; i++) {
        wB += histogram[i];
        if (wB === 0) continue;
        wF = totalPixels - wB;

        if (wF === 0) break;

        sumB += i * histogram[i];

        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;

        const betweenVariance =
            wB * wF * (mB - mF) * (mB - mF);

        if (betweenVariance > maxVariance) {
            maxVariance = betweenVariance;
            threshold = i;
        }
    }

    return threshold;
}

// Fill the regions in the specified shape with the selected color
function fillRegion(shapeKey, color) {
    const ctx = canvas.getContext('2d');
    const regions = shapeRegions[shapeKey];

    regions.forEach(region => {
        const { x, y } = region;

        // Fill the region with the selected color
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);

        // Update the filled color for the region
        filledColors[shapeKey] = color;
    });
}

// Show region fill effect when moving the mouse without clicking
function showRegionFillEffect(shapeKey) {
    clearCanvas();

    const regions = shapeRegions[shapeKey];

    regions.forEach(region => {
        const { x, y } = region;

        // Get the color for the region
        const color = filledColors[shapeKey] || '#ffffff';

        // Show the region fill effect with the color
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
    });
}

// Clear the canvas by redrawing the original image
function clearCanvas() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = function () {
        ctx.drawImage(img, 0, 0);
    };
    img.src = canvas.toDataURL();
}

// Find the shape containing the specified coordinates
function findShape(x, y) {
    for (const shapeKey in shapeRegions) {
        const regions = shapeRegions[shapeKey];
        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];
            if (region.x === x && region.y === y) {
                return shapeKey;
            }
        }
    }
    return null;
}

// Detect shapes on the canvas
function detectShapes() {
    const visited = new Array(canvas.width * canvas.height * 4).fill(false);

    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const pixelIndex = (y * canvas.width + x) * 4;

            if (!visited[pixelIndex]) {
                const shapeKey = `shape${Object.keys(shapeRegions).length + 1}`;
                const regions = [];

                floodFill(x, y, visited, shapeKey, regions);

                if (regions.length > 0) {
                    shapeRegions[shapeKey] = regions;
                }
            }
        }
    }
}

// Group the regions into shapes based on proximity
function groupRegionsByShape(regions) {
    const shapes = {};
    let shapeIndex = 1;

    regions.forEach(region => {
        const { x, y } = region;
        let foundShape = false;

        for (const shapeKey in shapes) {
            const shapeRegions = shapes[shapeKey];
            for (let i = 0; i < shapeRegions.length; i++) {
                const shapeRegion = shapeRegions[i];
                const { x: sx, y: sy } = shapeRegion;

                // Check if the region is within the proximity of the shape
                if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) {
                    shapeRegions.push(region);
                    foundShape = true;
                    break;
                }
            }
            if (foundShape) {
                break;
            }
        }

        // Create a new shape if the region doesn't belong to any existing shape
        if (!foundShape) {
            const shapeKey = 'shape' + shapeIndex++;
            shapes[shapeKey] = [region];
        }
    });

    return shapes;
}

// Render color options for each shape
function renderColorOptions() {
    const colorOptionsContainer = document.getElementById('colorOptions');

    for (const shapeKey in shapeRegions) {
        const shapeColor = filledColors[shapeKey] || '#ffffff';

        // Create a color input element for the shape
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = shapeKey;
        colorInput.className = 'color-input';
        colorInput.value = shapeColor;
        colorInput.addEventListener('change', handleColorChange);

        // Append the color input element to the color options container
        colorOptionsContainer.appendChild(colorInput);
    }
}

// Handle color change event
function handleColorChange(event) {
    const shapeKey = event.target.id;
    const selectedColor = event.target.value;
    fillRegion(shapeKey, selectedColor);
}

// Flood fill algorithm to detect shapes
function floodFill(x, y, visited, shapeKey, regions) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const queue = [];
    const initialPixelIndex = (y * canvas.width + x) * 4;

    if (visited[initialPixelIndex]) {
        return;
    }

    const targetColor = [255, 255, 255, 255]; // White color
    const replacementColor = [0, 0, 0, 255]; // Black color

    // Check if the initial pixel color matches the target color
    if (!colorsMatch(pixels, initialPixelIndex, targetColor)) {
        return;
    }

    // Add initial pixel to the queue and mark it as visited
    queue.push([x, y]);
    visited[initialPixelIndex] = true;

    while (queue.length > 0) {
        const [currentX, currentY] = queue.shift();
        const currentPixelIndex = (currentY * canvas.width + currentX) * 4;

        // Check if the current pixel color matches the target color
        if (colorsMatch(pixels, currentPixelIndex, targetColor)) {
            // Fill the current pixel with the replacement color
            pixels[currentPixelIndex] = replacementColor[0];
            pixels[currentPixelIndex + 1] = replacementColor[1];
            pixels[currentPixelIndex + 2] = replacementColor[2];
            pixels[currentPixelIndex + 3] = replacementColor[3];

            // Add the current pixel to the regions array
            regions.push({ x: currentX, y: currentY });

            // Check the neighboring pixels
            const neighbors = getNeighbors(currentX, currentY);
            for (const neighbor of neighbors) {
                const [nx, ny] = neighbor;
                const neighborPixelIndex = (ny * canvas.width + nx) * 4;

                if (!visited[neighborPixelIndex] && colorsMatch(pixels, neighborPixelIndex, targetColor)) {
                    // Add neighboring pixel to the queue and mark it as visited
                    queue.push([nx, ny]);
                    visited[neighborPixelIndex] = true;
                }
            }
        }
    }
}

// Check if two colors match
function colorsMatch(pixels, pixelIndex, targetColor) {
    const tolerance = 10; // Adjust the tolerance value as needed

    for (let i = 0; i < 3; i++) {
        if (Math.abs(pixels[pixelIndex + i] - targetColor[i]) > tolerance) {
            return false;
        }
    }

    return true;
}

// Get neighboring pixels of a given pixel
function getNeighbors(x, y) {
    const neighbors = [];

    if (x > 0) {
        neighbors.push([x - 1, y]);
    }
    if (x < canvas.width - 1) {
        neighbors.push([x + 1, y]);
    }
    if (y > 0) {
        neighbors.push([x, y - 1]);
    }
    if (y < canvas.height - 1) {
        neighbors.push([x, y + 1]);
    }

    return neighbors;
}