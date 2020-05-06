import { Component } from "./Component";

export class SystemStateComponent extends Component {
  constructor(props) {
    super(props);
    this.isSystemStateComponent = true;
  }
}

SystemStateComponent.isSystemStateComponent = true;
