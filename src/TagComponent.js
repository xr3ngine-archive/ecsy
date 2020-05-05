import { Component } from "./Component"

export class TagComponent extends Component {
  constructor() {
    super();
    this.isTagComponent = true;
  }
}

TagComponent.isTagComponent = true;
