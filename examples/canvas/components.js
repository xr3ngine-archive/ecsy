import { Component, PropTypes } from "../../build/ecsy.module.js";
import { Vector2Type } from "./math.js";

export class Movement extends Component {}

Movement.schema = {
  velocity: { type: Vector2Type },
  acceleration: { type: Vector2Type }
};

export class Circle extends Component {}

Circle.schema = {
  position: { type: Vector2Type },
  radius: { type: PropTypes.Number },
  velocity: { type: Vector2Type },
  acceleration: { type: Vector2Type }
};

export class CanvasContext extends Component {}

CanvasContext.schema = {
  ctx: { type: PropTypes.Object },
  width: { type: PropTypes.Number },
  height: { type: PropTypes.Number }
};

export class DemoSettings extends Component {}

DemoSettings.schema = {
  speedMultiplier: { type: PropTypes.Number, default: 0.001 }
};

export class Intersecting extends Component {}

Intersecting.schema = {
  points: { type: PropTypes.Array }
};
