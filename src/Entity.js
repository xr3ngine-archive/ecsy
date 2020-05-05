import Query from "./Query.js";
import wrapImmutableComponent from "./WrapImmutableComponent.js";
import { generateUUID } from "./Utils";

// @todo Take this out from there or use ENV
const DEBUG = false;

/**
 * Entity Lifecycle
 * - detached: alive = false, not in deferred entity removal array,
 *    not in an object pool free list, and not included in query results.
 * - alive: alive = true, not in deferred entity removal array,
 *    not in an object pool free list, and can be included in query results.
 * - removed: alive = false, in the deferred entity removal array,
 *    not in an object pool free list, and only included in removed event query results.
 * - dead: alive = false, not in the deferred entity removal array,
 *    and in an object pool free list, and not included in any query results.
 */

 export const EntityState = {
   detached: "detached",
   alive: "alive",
   removed: "removed",
   dead: "dead"
 };

export class Entity {
  constructor(world) {
    this.world = world;

    // Unique ID for this entity
    this.uuid = generateUUID();

    // List of components types the entity has
    this._ComponentTypes = [];

    // Instance of the components
    this._components = {};

    this._componentsToRemove = {};

    // Queries where the entity is added
    this.queries = [];

    // Used for deferred removal
    this._ComponentTypesToRemove = [];

    this.state = EntityState.detached;

    this._numSystemStateComponents = 0;
  }

  // COMPONENTS

  getComponent(Component, includeRemoved) {
    var component = this._components[Component.name];

    if (!component && includeRemoved === true) {
      component = this._componentsToRemove[Component.name];
    }

    return DEBUG ? wrapImmutableComponent(Component, component) : component;
  }

  getRemovedComponent(Component) {
    return this._componentsToRemove[Component.name];
  }

  getComponents() {
    return this._components;
  }

  getComponentsToRemove() {
    return this._componentsToRemove;
  }

  getComponentTypes() {
    return this._ComponentTypes;
  }

  getMutableComponent(Component) {
    var component = this._components[Component.name];

    if (this.state === EntityState.alive) {
      for (var i = 0; i < this.queries.length; i++) {
        var query = this.queries[i];
        // @todo accelerate this check. Maybe having query._Components as an object
        if (query.reactive && query.Components.indexOf(Component) !== -1) {
          query.eventDispatcher.dispatchEvent(
            Query.prototype.COMPONENT_CHANGED,
            this,
            component
          );
        }
      }
    }

    return component;
  }

  addComponent(Component, values) {
    if (~this._ComponentTypes.indexOf(Component)) return;

    this._ComponentTypes.push(Component);

    if (Component.isSystemStateComponent) {
      this._numStateComponents++;
    }

    var componentPool = this.world.componentsManager.getComponentsPool(
      Component
    );

    var component = componentPool.acquire();

    this._components[Component.name] = component;

    if (values) {
      component.copy(values);
    }

    if (this.state === EntityState.alive) {
      this.world.entityManager.onComponentAdded(this, Component, values);
    }

    return this;
  }

  hasComponent(Component, includeRemoved) {
    return (
      !!~this._ComponentTypes.indexOf(Component) ||
      (includeRemoved === true && this.hasRemovedComponent(Component))
    );
  }

  hasRemovedComponent(Component) {
    return !!~this._ComponentTypesToRemove.indexOf(Component);
  }

  hasAllComponents(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (!this.hasComponent(Components[i])) return false;
    }
    return true;
  }

  hasAnyComponents(Components) {
    for (var i = 0; i < Components.length; i++) {
      if (this.hasComponent(Components[i])) return true;
    }
    return false;
  }

  removeComponent(Component, immediately) {
    const componentName = Component.name;
    const component = this._components[componentName];

    if (!component) {
      return false;
    }

    if (!this._componentsToRemove[componentName]) {
      delete this._components[componentName];

      const index = this._ComponentTypes.findIndex(Component);
      this._ComponentTypes.splice(index, 1);

      this.world.entityManager._queryManager.onEntityComponentRemoved(this, Component);
    }
    

    if (immediately) {
      component.dispose();

      if (this._componentsToRemove[componentName]) {
        delete this._componentsToRemove[componentName];
        const index = this._ComponentTypesToRemove.findIndex(Component);
        this._ComponentTypesToRemove.splice(index, 1);
      }

      this.world.componentsManager.componentRemovedFromEntity(Component);
    } else {
      this._ComponentTypesToRemove.push(Component);
      this._componentsToRemove[componentName] = component;
      this.world.entityManager.queueComponentRemoval(this, Component);
    }

    if (Component.isSystemStateComponent) {
      this._numStateComponents--;

      // Check if the entity was a ghost waiting for the last system state component to be removed
      if (this._numStateComponents === 0 && !entity.alive) {
        this.dispose();
      }
    }

    return true;
  }

  removeAllComponents(immediately) {
    let Components = entity._ComponentTypes;

    for (let j = Components.length - 1; j >= 0; j--) {
      this.removeComponent(Components[j], immediately);
    }
  }

  copy(source) {
    // DISCUSS: Should we reset ComponentTypes and components here or in dispose?
    for (const componentName in source._components) {
      const sourceComponent = source._components[componentName];
      this._components[componentName] = sourceComponent.clone();
      this._ComponentTypes.push(sourceComponent.constructor)
    }

    return this;
  }

  clone() {
    return new this.constructor(this.world).copy(this);
  }

  dispose(immediately) {
    if (immediately) {
      this.uuid = generateUUID();;
      this.state = EntityState.dead;

      for (let i = 0; i < this.queries.length; i++) {
        this.queries[i].removeEntity(this);
      }

      for (const componentName in this._components) {
        this._components[componentName].dispose();
        delete this._components[componentName];
      }

      for (const componentName in this._componentsToRemove) {
        delete this._componentsToRemove[componentName];
      }

      this.queries.length = 0;
      this._ComponentTypes.length = 0;
      this._ComponentTypesToRemove.length = 0;

      if (this._pool) {
        this._pool.release(this);
      }

      this.world.entityManager.onEntityDisposed(this);
    } else {
      this.state = EntityState.removed;
      this.world.entityManager.queueEntityDisposal(this);
    }
  }
}
