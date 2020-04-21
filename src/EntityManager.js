import Entity from "./Entity.js";
import ObjectPool from "./ObjectPool.js";
import Query from "./Query.js";
import QueryManager from "./QueryManager.js";
import EventDispatcher from "./EventDispatcher.js";
import { componentPropertyName, getName, generateUUID } from "./Utils.js";
import { SystemStateComponent } from "./SystemStateComponent.js";
import wrapImmutableComponent from "./WrapImmutableComponent.js";

// @todo Take this out from there or use ENV
const DEBUG = false;

/**
 * @private
 * @class EntityManager
 */
export class EntityManager {
  constructor(world) {
    this.world = world;
    this.componentsManager = world.componentsManager;

    // All the entities in this instance
    this._entities = [];
    this._entitiesById = {};

    this._queryManager = new QueryManager(this);
    this.eventDispatcher = new EventDispatcher();
    this._entityPool = new ObjectPool(Entity);

    // Deferred deletion
    this.entitiesWithComponentsToRemove = [];
    this.entitiesToRemove = [];
    this.deferredRemovalEnabled = true;

    this._nextId = 0;
  }

  getEntityById(entityId) {
    return this._entitiesById[entityId];
  }

  /**
   * Create a new entity
   */
  createEntity(id) {
    var entity = this._entityPool.aquire();
    entity.id = id === undefined ? generateUUID() : id;
    return this.addEntity(entity);
  }

  addEntity(entity) {
    if (this._entitiesById[entity.id]) {
      throw new Error(`Entity with id "${entity.id}" already exists.`);
    }

    entity.alive = true;
    entity._entityManager = this;
    
    this._entities.push(entity);
    this._entitiesById[entity.id] = entity;
    this.eventDispatcher.dispatchEvent(ENTITY_CREATED, entity);
    return entity;
  }

  entityGetRemovedComponent(entity) {
    return entity._componentsToRemove[Component.name];
  }

  entityGetComponents(entity) {
    return entity._components;
  }

  entityGetComponentsToRemove(entity) {
    return entity._componentsToRemove;
  }

  entityGetComponentTypes(entity) {
    return entity._ComponentTypes;
  }

  // COMPONENTS

  /**
   * Add a component to an entity
   * @param {Entity} entity Entity where the component will be added
   * @param {Component} Component Component to be added to the entity
   * @param {Object} values Optional values to replace the default attributes
   */
  entityAddComponent(entity, Component, values) {
    if (~entity._ComponentTypes.indexOf(Component)) return;

    entity._ComponentTypes.push(Component);

    if (Component.__proto__ === SystemStateComponent) {
      entity._numStateComponents++;
    }

    var componentPool = this.world.componentsManager.getComponentsPool(
      Component
    );
    var component = componentPool.aquire();

    entity._components[Component.name] = component;

    if (values) {
      if (component.copy) {
        component.copy(values);
      } else {
        for (var name in values) {
          component[name] = values[name];
        }
      }
    }

    this._queryManager.onEntityComponentAdded(entity, Component);
    this.world.componentsManager.componentAddedToEntity(Component);

    this.eventDispatcher.dispatchEvent(COMPONENT_ADDED, entity, Component);

    return entity;
  }

  entityHasComponent(entity, Component, includeRemoved) {
    return (
      !!~entity._ComponentTypes.indexOf(Component) ||
      (includeRemoved === true && this.entityHasRemovedComponent(entity, Component))
    );
  }

  entityHasAnyComponents(entity, Components) {
    for (var i = 0; i < Components.length; i++) {
      if (this.entityHasComponent(entity, Components[i])) return true;
    }
    return false;
  }

  entityHasAllComponents(entity, Components) {
    for (var i = 0; i < Components.length; i++) {
      if (!this.entityHasComponent(entity, Components[i])) return false;
    }
    return true;
  }

  entityHasRemovedComponent(entity, Component) {
    return !!~entity._ComponentTypesToRemove.indexOf(Component);
  }

  entityGetComponent(entity, Component, includeRemoved) {
    var component = entity._components[Component.name];

    if (!component && includeRemoved === true) {
      component = entity._componentsToRemove[Component.name];
    }

    return DEBUG ? wrapImmutableComponent(Component, component) : component;
  }

  entityGetMutableComponent(entity, Component) {
    var component = entity._components[Component.name];
    for (var i = 0; i < entity.queries.length; i++) {
      var query = entity.queries[i];
      // @todo accelerate this check. Maybe having query._Components as an object
      if (query.reactive && query.Components.indexOf(Component) !== -1) {
        query.eventDispatcher.dispatchEvent(
          Query.prototype.COMPONENT_CHANGED,
          entity,
          component
        );
      }
    }
    return component;
  }

  /**
   * Remove a component from an entity
   * @param {Entity} entity Entity which will get removed the component
   * @param {*} Component Component to remove from the entity
   * @param {Bool} immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  entityRemoveComponent(entity, Component, immediately) {
    var index = entity._ComponentTypes.indexOf(Component);
    if (!~index) return;

    this.eventDispatcher.dispatchEvent(COMPONENT_REMOVE, entity, Component);

    if (immediately) {
      this._entityRemoveComponentSync(entity, Component, index);
    } else {
      if (entity._ComponentTypesToRemove.length === 0)
        this.entitiesWithComponentsToRemove.push(entity);

      entity._ComponentTypes.splice(index, 1);
      entity._ComponentTypesToRemove.push(Component);

      var componentName = getName(Component);
      entity._componentsToRemove[componentName] =
        entity._components[componentName];
      delete entity._components[componentName];
    }

    // Check each indexed query to see if we need to remove it
    this._queryManager.onEntityComponentRemoved(entity, Component);

    if (Component.__proto__ === SystemStateComponent) {
      entity._numStateComponents--;

      // Check if the entity was a ghost waiting for the last system state component to be removed
      if (entity._numStateComponents === 0 && !entity.alive) {
        entity.dispose();
      }
    }

    return entity;
  }

  _entityRemoveComponentSync(entity, Component, index) {
    // Remove T listing on entity and property ref, then free the component.
    entity._ComponentTypes.splice(index, 1);
    var propName = componentPropertyName(Component);
    var componentName = getName(Component);
    var component = entity._components[componentName];
    delete entity._components[componentName];
    this.componentsManager._componentPool[propName].release(component);
    this.world.componentsManager.componentRemovedFromEntity(Component);
  }

  /**
   * Remove all the components from an entity
   * @param {Entity} entity Entity from which the components will be removed
   */
  entityRemoveAllComponents(entity, immediately) {
    let Components = entity._ComponentTypes;

    for (let j = Components.length - 1; j >= 0; j--) {
      if (Components[j].__proto__ !== SystemStateComponent)
        this.entityRemoveComponent(entity, Components[j], immediately);
    }
  }

  /**
   * Remove the entity from this manager. It will clear also its components
   * @param {Entity} entity Entity to remove from the manager
   * @param {Bool} immediately If you want to remove the component immediately instead of deferred (Default is false)
   */
  disposeEntity(entity, immediately) {
    var index = this._entities.indexOf(entity);

    if (!~index) throw new Error("Tried to remove entity not in list");

    entity.alive = false;

    if (entity._numStateComponents === 0) {
      // Remove from entity list
      this.eventDispatcher.dispatchEvent(ENTITY_REMOVED, entity);
      this._queryManager.onEntityRemoved(entity);
      if (immediately === true) {
        this._releaseEntity(entity, index);
      } else {
        this.entitiesToRemove.push(entity);
      }
    }

    this.entityRemoveAllComponents(entity, immediately);
  }

  _releaseEntity(entity, index) {
    this._entities.splice(index, 1);

    // Prevent any access and free
    entity._entityManager = null;

    if (entity.reset) {
      this._entityPool.release(entity);
    }
  }

  /**
   * Remove all entities from this manager
   */
  disposeAllEntities() {
    for (var i = this._entities.length - 1; i >= 0; i--) {
      this.disposeEntity(this._entities[i]);
    }
  }

  processDeferredRemoval() {
    if (!this.deferredRemovalEnabled) {
      return;
    }

    for (let i = 0; i < this.entitiesToRemove.length; i++) {
      let entity = this.entitiesToRemove[i];
      let index = this._entities.indexOf(entity);
      this._releaseEntity(entity, index);
    }
    this.entitiesToRemove.length = 0;

    for (let i = 0; i < this.entitiesWithComponentsToRemove.length; i++) {
      let entity = this.entitiesWithComponentsToRemove[i];
      while (entity._ComponentTypesToRemove.length > 0) {
        let Component = entity._ComponentTypesToRemove.pop();

        var propName = componentPropertyName(Component);
        var componentName = getName(Component);
        var component = entity._componentsToRemove[componentName];
        delete entity._componentsToRemove[componentName];
        this.componentsManager._componentPool[propName].release(component);
        this.world.componentsManager.componentRemovedFromEntity(Component);

        //this._entityRemoveComponentSync(entity, Component, index);
      }
    }

    this.entitiesWithComponentsToRemove.length = 0;
  }

  /**
   * Get a query based on a list of components
   * @param {Array(Component)} Components List of components that will form the query
   */
  queryComponents(Components) {
    return this._queryManager.getQuery(Components);
  }

  // EXTRAS

  /**
   * Return number of entities
   */
  count() {
    return this._entities.length;
  }

  /**
   * Return some stats
   */
  stats() {
    var stats = {
      numEntities: this._entities.length,
      numQueries: Object.keys(this._queryManager._queries).length,
      queries: this._queryManager.stats(),
      numComponentPool: Object.keys(this.componentsManager._componentPool)
        .length,
      componentPool: {},
      eventDispatcher: this.eventDispatcher.stats
    };

    for (var cname in this.componentsManager._componentPool) {
      var pool = this.componentsManager._componentPool[cname];
      stats.componentPool[cname] = {
        used: pool.totalUsed(),
        size: pool.count
      };
    }

    return stats;
  }
}

const ENTITY_CREATED = "EntityManager#ENTITY_CREATE";
const ENTITY_REMOVED = "EntityManager#ENTITY_REMOVED";
const COMPONENT_ADDED = "EntityManager#COMPONENT_ADDED";
const COMPONENT_REMOVE = "EntityManager#COMPONENT_REMOVE";
