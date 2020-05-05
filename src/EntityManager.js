import { Entity, EntityState } from "./Entity.js";
import ObjectPool from "./ObjectPool.js";
import QueryManager from "./QueryManager.js";
import EventDispatcher from "./EventDispatcher.js";

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

    this._entitiesByUUID = {};

    this._queryManager = new QueryManager(this);
    this.eventDispatcher = new EventDispatcher();
    this._entityPool = new ObjectPool(new Entity(world));
    this._entityPools = {};
    this._entityTypes = {};

    // Deferred deletion
    this.entitiesWithComponentsToRemove = [];
    this.entitiesToRemove = [];
    this.deferredRemovalEnabled = true;

    this.numStateComponents = 0;
  }

  registerEntityType(EntityType, entityPool) {
    if (this._entityTypes[EntityType.name]) {
      console.warn(`Entity type: '${EntityType.name}' already registered.`);
      return;
    }

    this._entityTypes[EntityType.name] = EntityType;

    if (entityPool === false) {
      entityPool = null;
    } else if (entityPool === undefined) {
      entityPool = new ObjectPool(new EntityType(this.world));
    }

    this._entityPools[EntityType.name] = entityPool;
  }

  getEntityByUUID(name) {
    return this._entitiesByUUID[name];
  }

  /**
   * Create a new entity
   */
  createEntity(EntityType) {
    const entity = this.createDetachedEntity(EntityType);
    return this.addEntity(entity)
  }

  createDetachedEntity(EntityType) {
    const entityPool = EntityType === undefined ? this._entityPool : this._entityPools[EntityType.name];

    const entity = entityPool ? entityPool.acquire() : new EntityType(this.world);

    return entity;
  }

  addEntity(entity) {
    if (this._entitiesByUUID[entity.uuid])  {
      console.warn(`Entity ${entity.uuid} already added.`);
      return entity;
    }

    this._entitiesByUUID[entity.uuid] = entity;
    this._entities.push(entity);
    entity.state = EntityState.alive;
    this.eventDispatcher.dispatchEvent(ENTITY_CREATED, entity);

    return entity;
  }

  onComponentAdded() {
    
  }

  queueComponentRemoval() {

  }

  queueEntityDisposal() {

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

        var propName = Component.name;
        var componentName = Component.name;
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
