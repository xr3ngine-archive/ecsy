import { Component, TagComponent } from "../../../build/ecsy.module.js";

export class Collisionable extends TagComponent {}
export class Collider extends TagComponent {}
export class Recovering extends TagComponent {}
export class Moving extends TagComponent {}

export class PulsatingScale extends Component {}

PulsatingScale.schema = {
  offset: { type: Number, default: 0 }
};

export class Object3D extends Component {}

Object3D.schema = {
  object: { type: Object }
};

export class Timeout extends Component {}

Timeout.schema = {
  timer: { type: Number },
  addComponents: { type: Array },
  removeComponents: { type: Array }
};

export class PulsatingColor extends Component {}

PulsatingColor.schema = {
  offset: { type: Number }
};

export class Colliding extends Component {}

Colliding.schema = {
  value: { type: Boolean }
};

export class Rotating extends Component {}

Rotating.schema = {
  enabled: { type: Boolean },
  rotatingSpeed: { type: Number },
  decreasingSpeed: { type: Number, default: 0.001 }
};
