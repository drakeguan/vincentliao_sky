function Hotspot() {
  
  this.x = 0;
  this.y = 0;
  this.r = 1
  
  this.points = [];
  
  // Clear existing points and collect new samples around its radius.
  this.getPoints = function() {
    this.points.splice(0, this.points.length);
    
    for (let i = 0; i < spawnCount; i++) {
      let rad = random()*TWO_PI;
      x = int(random(this.r)*cos(rad)+this.x);
      y = int(random(this.r)*sin(rad)+this.y);
      this.points.push(new p5.Vector(x, y));
    }
  }
}