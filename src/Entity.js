export default class Entity {
  constructor(entityManager) {
    this._entityManager = entityManager || null;

    // Unique ID for this entity
    this.id = undefined;

    this.alive = false;

    // List of components types the entity has
    this._ComponentTypes = [];

    // Instance of the components
    this._components = {};

    this._componentsToRemove = {};

    // Used for deferred removal
    this._ComponentTypesToRemove = [];

    //if there are state components on a entity, it can't be removed completely
    this._numStateComponents = 0;
  }

  // COMPONENTS

  getComponent(Component, includeRemoved) {
    return this._entityManager.entityGetComponent(Component, includeRemoved);
  }

  getRemovedComponent(Component) {
    return this._entityManager.getRemovedComponent(this, Component);
  }

  getComponents() {
    return this._entityManager.getComponents(this);
  }

  getComponentsToRemove() {
    return this._entityManager.entityGetComponentsToRemove(this);
  }

  getComponentTypes() {
    return this._entityManager.entityGetComponentTypes(this);
  }

  getMutableComponent(Component) {
    return this._entityManager.entityGetMutableComponent(this, Component);
  }

  addComponent(Component, values) {
    return this._entityManager.entityAddComponent(this, Component, values);
  }

  removeComponent(Component, forceImmediate) {
    return this._entityManager.entityRemoveComponent(this, Component, forceImmediate);
  }

  hasComponent(Component, includeRemoved) {
    return this._entityManager.entityHasComponent(this, Component, includeRemoved);
  }

  hasRemovedComponent(Component) {
    return this._entityManager.entityHasRemovedComponent(this, Component);
  }

  hasAllComponents(Components) {
    return this._entityManager.entityHasAllComponents(Components);
  }

  hasAnyComponents(Components) {
    return this._entityManager.entityHasAnyComponents(this, Components);
  }

  removeAllComponents(forceImmediate) {
    this._entityManager.entityRemoveAllComponents(this, forceImmediate);
  }

  // EXTRAS

  // Initialize the entity. To be used when returning an entity to the pool
  reset() {
    this.entityId = -1;
  }

  dispose(forceImmediate) {
    this._entityManager.disposeEntity(this, forceImmediate);
  }
}
