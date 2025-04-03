/*
Voronoi portrait

Renders a portrait using a voronoi diagram.

Controls:
  - Press space to change to the next image.
  - Press any other key to toggle the hotspots.
  - Click and drag hotspots to move or scale them.

Author:
  Jason Labbe
 
Site:
  jasonlabbe3d.com
*/

var imgNames = ["walter.jpg", "clint.jpg", "snake.jpg"]; // Add your image's name here.
var imgs = [];
var imgIndex = 0;

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


function preload() {
  // Pre-load all images.
  for (let i = 0; i < imgNames.length; i++) {
    let newImg = loadImage(imgNames[i]);
    newImg.loadPixels();
    imgs.push(newImg);
  }
}


function setup() {
  createCanvas(windowWidth, windowHeight);
  
  textAlign(CENTER);
  
  let img = imgs[imgIndex]; 
  
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
	  
  let img = imgs[imgIndex];
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
    for (let i = 0; i < hotspots.length; i++) {
      noFill();
      stroke(255);
      strokeWeight(1);
      ellipse(hotspots[i].x, hotspots[i].y, hotspots[i].r*2)
    }
    
    // Display hotspot highlights.
    if (activeHotspot != null) {
      let d = dist(mouseX+img.width/2-width/2, mouseY+img.height/2-height/2, activeHotspot.x, activeHotspot.y);
      
      if (d < activeHotspot.r+ringThickness*0.5) {
        stroke(0, 255, 0, 30);
        
        if (d < activeHotspot.r-ringThickness*0.5) {
          // Display inner highlight.
          strokeWeight(activeHotspot.r*2-ringThickness);
          point(activeHotspot.x, activeHotspot.y)
        } else {
          // Display outer ring highlight.
          noFill();
          strokeWeight(ringThickness);
          ellipse(activeHotspot.x, activeHotspot.y, activeHotspot.r*2)
        }
      }
    }
  }
  
  pop();
  
  // Display tooltip.
  noStroke();
  fill(255);
  text(tooltip, width/2, 50);
}


function mouseDragged() {
  // Exit if no hotspot was clicked.
  if (activeHotspot == null) {
    return;
  }
  
  let img = imgs[imgIndex];
  
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
  if (key == " ") {
    // Change to the next image.
    imgIndex++;
    if (imgIndex >= imgs.length) {
      imgIndex = 0;
    }
    initHotspots();
  } else {
    // Toggle hotspots.
  	debug = !debug;
  }
}


function initHotspots() {
  let presetValues;
  
  // Hardcoded values that I thought looked best for each image.
  if (imgIndex == 0) {
    presetValues = [[365, 230, 210], [300, 130, 150], [175, 315, 200], [500, 340, 170]];
  } else if (imgIndex == 1) {
    presetValues = [[440, 230, 220], [280, 215, 150], [315, 340, 150], [115, 170, 120]];
  } else if (imgIndex == 2) {
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