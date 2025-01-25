class Box {
  constructor(x, y, box, parent = null) {
    const options = {
      isSleeping: true,
      angle: (box.angleDeg * PI) / 180,
      chamfer: { radius: 10 },
    };
    this.x = x;
    this.y = y;
    this.w = 20;
    this.h = 100;
    this.parent = parent;
    this.isRoot = !parent;
    this.endCoords = [
      x + Math.sin((box.angleDeg * PI) / 180) * 50,
      y - Math.cos((box.angleDeg * PI) / 180) * 50,
    ];
    this.children = [];
    this.color = box.color;
    this.body = Bodies.rectangle(this.x, this.y, this.w, this.h, options);
    World.add(world, this.body);
  }

  show() {
    let pos = this.body.position;
    let angle = this.body.angle;
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    angleMode(RADIANS);
    rectMode(CENTER);
    noStroke();
    if (this.body.isSleeping) {
      fill(this.color === "red" ? "#a02f1f" : "#275d71");
    } else {
      fill(this.color === "red" ? "#361811" : "#091114");
    }
    rect(0, 0, this.w, this.h, 10);
    pop();
  }

  isUnderMouse(mx, my) {
    const pos = this.body.position;
    const dx = mx - pos.x;
    const dy = my - pos.y;
    return dx * dx + dy * dy < 20 * 20;
  }
}
