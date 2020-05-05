import { Component } from "./Component"

export class SystemStateComponent extends Component {
  constructor(...params) {
    super(...params);
    this.isSystemStateComponent = true;
  }
}

SystemStateComponent.isSystemStateComponent = true;
