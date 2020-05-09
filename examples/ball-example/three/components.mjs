import {
  TagComponent,
  Component,
  PropTypes
} from "../../../build/ecsy.module.js";

export class Collidable extends TagComponent {}
export class Collider extends TagComponent {}
export class Recovering extends TagComponent {}
export class Moving extends TagComponent {}

export class PulsatingScale extends Component {}

PulsatingScale.schema = {
  offset: { type: PropTypes.Number, default: 0 }
};

export class Object3D extends Component {}

Object3D.schema = {
  object: { type: PropTypes.Object }
};

export class Timeout extends Component {}

Timeout.schema = {
  timer: { type: PropTypes.Number },
  addComponents: { type: PropTypes.Array },
  removeComponents: { type: PropTypes.Array }
};

export class PulsatingColor extends Component {}

PulsatingColor.schema = {
  offset: { type: PropTypes.Number }
};

export class Colliding extends Component {}

Colliding.schema = {
  value: { type: PropTypes.Boolean }
};

export class Rotating extends Component {}

Rotating.schema = {
  enabled: { type: PropTypes.Boolean },
  rotatingSpeed: { type: PropTypes.Number },
  decreasingSpeed: { type: PropTypes.Number, default: 0.001 }
};
