import ObjectPool from "./ObjectPool.js";

export class ComponentManager {
  constructor() {
    this.Components = {};
    this._componentPool = {};
    this.numComponents = {};
  }

  registerComponent(Component, objectPool) {
    if (this.Components[Component.name]) {
      console.warn(`Component type: '${Component.name}' already registered.`);
      return;
    }

    this.Components[Component.name] = Component;
    this.numComponents[Component.name] = 0;

    if (objectPool === false) {
      objectPool = null;
    } else if (objectPool === undefined) {
      objectPool = new ObjectPool(new Component());
    }

    this._componentPool[Component.name] = objectPool;
  }

  createComponent(Component) {
    const componentPool = this._componentPool[Component.name];
    return componentPool.acquire();
  }

  componentAddedToEntity(Component) {
    if (!this.Components[Component.name]) {
      console.warn(`Component ${Component.name} not registered.`);
    }

    this.numComponents[Component.name]++;
  }

  componentRemovedFromEntity(Component) {
    this.numComponents[Component.name]--;
  }

  getComponentsPool(Component) {
    return this._componentPool[Component.name];
  }
}
