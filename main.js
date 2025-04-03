/*
Voronoi portrait

Renders a portrait using a voronoi diagram.

Controls:
  - Press space, mouse click or touch to change to the next image.
  - Press any other key to toggle the hotspots.
  - Click and drag hotspots to move or scale them.

Origin:
  Author: Jason Labbe
  Site: Sjasonlabbe3d.com
  Sketch: https://openprocessing.org/sketch/479353
*/

var data = null;
var imgs = [];
var messages = [];
var names = [];
var index = 0;

var spawnCount = 1000;
var falloff = 0.6; // 0-1.0
var voronoi;
var boundingBox;
var diagram;

var hotspots = [];
var staticPoints = [];

var debug = true;
var activeHotspot = null;
var manipMode = 0;
var ringThickness = 20;

var tooltip = "".concat("Press space to change to the next image.\n", 
                        "Press any other key to toggle the hotspots.\n", 
                        "Click and drag hotspots to move or scale them.");


// In p5.js, functions like loadJSON() and loadImage() are designed to load
// external files asynchronously to prevent blocking the main execution thread.
// To handle this asynchronous behavior within the preload() function, you
// should ensure that all assets are fully loaded before proceeding to the
// setup() function.
function preload() {
  // Load the JSON file and then pre-load all images.
  data = loadJSON("tribute_data.json", preloadData);
}


// Pre-load all images of filenames from the loaded JSON.
//
// Because the loadJSON() function in p5.js operates asynchronously. This means
// that when you attempt to access data.images immediately after calling
// loadJSON(), the JSON data may not have finished loading, resulting in data
// being undefined.
function preloadData(data) {
  let contributors = data.contributors;
  for (let i = 0; i < contributors.length; i++) {
    let name = contributors[i].name;
    let photo = contributors[i].photo;
    let message = contributors[i].message;

    names.push(name);
    messages.push(message);

    let newImg = loadImage(`images/${photo}`);
    newImg.loadPixels();
    imgs.push(newImg);
  }
  
  print("Json loading complete, data ready.");
}


function setup() {
  createCanvas(windowWidth, windowHeight);
  
  textAlign(CENTER);
  
  let img = imgs[index]; 
  
  // Create hotspots.
  for (let i = 0; i < 4; i++) {
    hotspots.push(new Hotspot());
  }
  
  initHotspots();
  
  // Scatter random points. It seems to look better for the voronoi.
  for (let i = 0; i < spawnCount; i++) {
    staticPoints.push(new p5.Vector(int(random(img.width)), int(random(img.height))));
  }
}


function draw() {
  background(0);
	  
  let img = imgs[index];
  img.loadPixels();
  
  // Align image to the scene's center.
  push();
  translate(width/2-img.width/2, height/2-img.height/2);
  
  // Combine static points and hotspot points.
  let currentPoints = staticPoints.slice();
  for (let i = 0; i < hotspots.length; i++) {
    currentPoints = currentPoints.concat(hotspots[i].points);
  }
  
  let transform = [];
  
  for (let i = 0; i < currentPoints.length; i++) {
    let x = currentPoints[i].x;
    let y = currentPoints[i].y;
    
    // Don't compute point if it's beyond the scene.
    if (x < 0 || x > img.width || y < 0 || y > img.height) {
      continue;
    }

    // Convert coordinates to its index.
    let index = (y*img.width+x)*4;

    // Get the pixel's color values.
    let r = img.pixels[index];
    let g = img.pixels[index+1];
    let b = img.pixels[index+2];
    let a = img.pixels[index+3];
    
    // Figure out the point's nearest hotspot to associate with.
    let closestData = getClosestHotspot(x, y);
    if (closestData[0] == null) {
      continue;
    }
    
    transform.push({x:x, y:y, r:r, g:g, b:b, a:a, closestHotspot:closestData[0], closestDist:closestData[1]});
  }
  
  // Compute new voronoi.
  boundingBox = {xl:1, xr:img.width-1, yt:1, yb:img.height-1};
  
  voronoi = new Voronoi();
  voronoi.recycle(diagram);
  
  diagram = voronoi.compute(transform, boundingBox);
  
  for (let i = 0; i < diagram.cells.length; i++) {
    // Skip invalid cells.
    if (!diagram.cells[i].halfedges.length) {
      continue;
    }
    
    // Collect the cell's data.
    let closestHotspot = diagram.cells[i].site.closestHotspot;
    let closestDist = diagram.cells[i].site.closestDist;
    let siteColor = color(diagram.cells[i].site.r, diagram.cells[i].site.g, diagram.cells[i].site.b, diagram.cells[i].site.a);

    if (closestDist < closestHotspot.r*falloff) {
      // It's near a hotspot's center so draw it with voronoi.
      fill(siteColor);
      stroke(0, 25);
      strokeWeight(0.5);
      
      beginShape();
      for (let j = 0; j < diagram.cells[i].halfedges.length; j++) {
        let v = diagram.cells[i].halfedges[j].getStartpoint();
				vertex(v.x, v.y);
      }
      endShape(CLOSE);
    } else if (closestDist < closestHotspot.r) {
      // It's near a hotspot's edges so draw it with points.
      noFill();
      stroke(siteColor);
      strokeWeight(map(closestDist-closestHotspot.r*falloff, 0, closestHotspot.r-closestHotspot.r*falloff, 10, 0));
      point(diagram.cells[i].site.x, diagram.cells[i].site.y);
    } else {
      // It's not near a hotspot so skip it.
      continue;
    }
  }
  
  // Figure out closest hotspot to manipulate.
  if (!mouseIsPressed) {
    activeHotspot = null;
    manipMode = -1;
    
    let closestData = getClosestHotspot(mouseX+img.width/2-width/2, mouseY+img.height/2-height/2);
    let closestHotspot = closestData[0];
    let closestDist = closestData[1];
    
    if (closestHotspot != null) {
      if (closestDist < closestHotspot.r-ringThickness*0.5) {
        // Mark it to be moved.
        manipMode = 0;
        activeHotspot = closestHotspot;
      } else if (closestDist < closestHotspot.r+ringThickness*0.5) {
        // Mark it to be scaled.
        manipMode = 1;
        activeHotspot = closestHotspot;
      }
    }
  }
  
  // Display hotspots.
  if (debug) {
    drawHotspot();
  }
  
  pop();
  
  // Display tooltip.
  //text(tooltip, width / 2, 100);

  // Display message.
  drawMessage();
}


function drawHotspot() {
  let img = imgs[index];

  push();
  for (let i = 0; i < hotspots.length; i++) {
    noFill();
    stroke(255);
    strokeWeight(1);
    ellipse(hotspots[i].x, hotspots[i].y, hotspots[i].r * 2);
  }

  // Display hotspot highlights.
  if (activeHotspot != null) {
    let d = dist(mouseX + img.width / 2 - width / 2, mouseY + img.height / 2 - height / 2, activeHotspot.x, activeHotspot.y);

    if (d < activeHotspot.r + ringThickness * 0.5) {
      stroke(0, 255, 0, 30);

      if (d < activeHotspot.r - ringThickness * 0.5) {
        // Display inner highlight.
        strokeWeight(activeHotspot.r * 2 - ringThickness);
        point(activeHotspot.x, activeHotspot.y)
      } else {
        // Display outer ring highlight.
        noFill();
        strokeWeight(ringThickness);
        ellipse(activeHotspot.x, activeHotspot.y, activeHotspot.r * 2)
      }
    }
  }
  pop();
}


function drawMessage() {
  let name = names[index];
  let message = messages[index];
  let maxWidth = width * 0.8;
  let fullText = `#${index+1} ${message}\n-- ${name}`;
  let wrappedText = fullText.split("\n");
  //let wrappedText = wrapText(fullText, maxWidth);
  //let wrappedText = wrapText(fullText, maxWidth);

  push();
  noStroke();
  fill(255);
  textAlign(CENTER, BOTTOM);
  textSize(24);
  let lineHeight = textSize() * 1.4;
  let yOffset = height - lineHeight * wrappedText.length - 20;
  for (let i = 0; i < wrappedText.length; i++) {
    text(wrappedText[i], width / 2, yOffset + i * lineHeight);
  }
  pop();
}


function mousePressed() {
  let img = imgs[index];
  let closestData = getClosestHotspot(mouseX + img.width / 2 - width / 2, mouseY + img.height / 2 - height / 2);
  let closestHotspot = closestData[0];

  if (closestHotspot == null) {
    if (mouseX > windowWidth / 2) {
      // Clicked on the right side of the screen.
      nextOne();
    }
    else {
      // Clicked on the left side of the screen.
      prevOne();
    }
  }
}


function mouseDragged() {
  // Exit if no hotspot was clicked.
  if (activeHotspot == null) {
    return;
  }
  
  let img = imgs[index];
  
  if (manipMode == 0) {
    // Move the hotspot.
    activeHotspot.x = mouseX+img.width/2-width/2;
    activeHotspot.y = mouseY+img.height/2-height/2;
  } else {
    // Scale the hotspot.
    activeHotspot.r = dist(mouseX+img.width/2-width/2, mouseY+img.height/2-height/2, activeHotspot.x, activeHotspot.y);
  }
  
  // Re-collect its new points.
  activeHotspot.getPoints();
}


function keyPressed() {
  if (key === ' ') {
    nextOne();
  } else if (keyCode === UP_ARROW) {
    print('Hotspots:');
    for (let i = 0; i < hotspots.length; i++) {
      print(`[${hotspots[i].x}, ${hotspots[i].y}, ${hotspots[i].r}]`);
    }
  } else if (keyCode === DOWN_ARROW) {
    print('Static points:');
    for (let i = 0; i < staticPoints.length; i++) {
      print(`[${staticPoints[i].x}, ${staticPoints[i].y}]`);
    }
  } else if (keyCode === LEFT_ARROW) {
    prevOne();
  } else if (keyCode === RIGHT_ARROW) {
    nextOne();
  } else {
    // Toggle hotspots.
    debug = !debug;
  }
}


function initHotspots() {
  let presetValues;
  
  if (data.contributors[index].hotspots != null) {
    // Use the preset values from the JSON.
    let jsonHotspots = data.contributors[index].hotspots;
    for (let i = 0; i < hotspots.length; i++) {
      hotspots[i].x = jsonHotspots[i][0];
      hotspots[i].y = jsonHotspots[i][1];
      hotspots[i].r = jsonHotspots[i][2];

      // Re-collect new points.
      hotspots[i].getPoints();
    }
  }
  else {
    // Otherwise, use the hardcoded values.
    // These values are not random, but rather a set of values that I thought
    // looked best for each image.
    if (index % 3 == 0) {
      presetValues = [[365, 230, 210], [300, 130, 150], [175, 315, 200], [500, 340, 170]];
    } else if (index % 3 == 1) {
      presetValues = [[440, 230, 220], [280, 215, 150], [315, 340, 150], [115, 170, 120]];
    } else if (index % 3 == 2) {
      presetValues = [[660, 240, 240], [360, 120, 150], [230, 65, 200], [485, 250, 185]];
    }

    for (let i = 0; i < hotspots.length; i++) {
      // Reset hotspot to its preset.
      if (presetValues != null) {
        hotspots[i].x = presetValues[i][0];
        hotspots[i].y = presetValues[i][1];
        hotspots[i].r = presetValues[i][2];
      }

      // Re-collect new points.
      hotspots[i].getPoints();
    }
  }
}


// Gets and returns the closest hotspot and distance with the supplied coordinates.
function getClosestHotspot(x, y) {
  let closestHotspot = null;
  let closestDist = null;
  
  for (let i = 0; i < hotspots.length; i++) {
    let d = dist(x, y, hotspots[i].x, hotspots[i].y);
    
    if (d < hotspots[i].r) {
      if (closestDist == null || d < closestDist) {
        closestHotspot = hotspots[i];
        closestDist = d;
      }
    }
  }
  
  return [closestHotspot, closestDist];
}


// Change to the next one.
function nextOne() {
  index++;
  if (index >= imgs.length) {
    index = 0;
  }
  initHotspots();
}


// Change to the previous one.
function prevOne() {
  index--;
  if (index < 0) {
    index = imgs.length - 1;
  }
  initHotspots();
}


// Function to wrap text based on maxWidth
function wrapText(txt, maxWidth) {
  let words = txt.split(" ");
  let lines = [];
  let currentLine = "";

  for (let word of words) {
    let testLine = currentLine + (currentLine.length > 0 ? " " : "") + word;
    if (textWidth(testLine) < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}


// Function to wrap CJK text properly
function wrapCJKText(txt, maxWidth) {
  let lines = [];
  let currentLine = "";
  let currentWidth = 0;

  for (let i = 0; i < txt.length; i++) {
    let char = txt[i];
    let charWidth = textWidth(char);

    // Handle English words properly
    if (char === " " && currentWidth > 0) {
      lines.push(currentLine);
      currentLine = "";
      currentWidth = 0;
      continue;
    }

    if (currentWidth + charWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = char;
      currentWidth = charWidth;
    } else {
      currentLine += char;
      currentWidth += charWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}


// Function to get dynamic text size
function getDynamicTextSize() {
  return constrain(min(width, height) * 0.04, 14, 32); // Scale text, min 14px, max 32px
}


// Handle window resizing
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  textSize(getDynamicTextSize());
}
