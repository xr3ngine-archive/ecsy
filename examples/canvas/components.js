import { Component } from "../../build/ecsy.module.js";
import { Vector2 } from "./math.js";

export class Movement extends Component {}

Movement.schema = {
  velocity: { type: Vector2 },
  acceleration: { type: Vector2 }
};

export class Circle extends Component {}

Circle.schema = {
  position: { type: Vector2 },
  radius: { type: Number },
  velocity: { type: Vector2 },
  acceleration: { type: Vector2 }
};

export class CanvasContext extends Component {}

CanvasContext.schema = {
  ctx: { type: Object },
  width: { type: Number },
  height: { type: Number }
};

export class DemoSettings extends Component {}

DemoSettings.schema = {
  speedMultiplier: { type: Number, default: 0.001 }
};

export class Intersecting extends Component {}

Intersecting.schema = {
  points: { type: Array }
};
