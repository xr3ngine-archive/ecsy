import { SystemManager } from "./SystemManager.js";
import { Version } from "./Version.js";
import { Entity } from "./Entity.js";
import { ObjectPool } from "./ObjectPool.js";
import Query from "./Query.js";
import { queryKey } from "./Utils.js";

export class World {
  constructor() {
    this.systemManager = new SystemManager(this);

    this.entityPool = new ObjectPool(new Entity(this));

    this.entities = [];
    this.entitiesByUUID = {};

    this.entitiesWithComponentsToRemove = [];
    this.entitiesToRemove = [];
    this.deferredRemovalEnabled = true;

    this.componentTypes = {};
    this.componentPools = {};
    this.componentCounts = {};

    this.queries = {};

    this.enabled = true;

    if (typeof CustomEvent !== "undefined") {
      var event = new CustomEvent("ecsy-world-created", {
        detail: { world: this, version: Version }
      });
      window.dispatchEvent(event);
    }

    this.lastTime = performance.now();
  }

  registerComponent(Component, objectPool) {
    if (this.componentTypes[Component.name]) {
      console.warn(`Component type: '${Component.name}' already registered.`);
      return;
    }

    this.componentTypes[Component.name] = Component;
    this.componentCounts[Component.name] = 0;

    if (objectPool === false) {
      objectPool = undefined;
    } else if (objectPool === undefined) {
      objectPool = new ObjectPool(new Component());
    }

    this.componentPools[Component.name] = objectPool;

    return this;
  }

  registerSystem(System, attributes) {
    this.systemManager.registerSystem(System, attributes);
    return this;
  }

  createEntity() {
    const entity = this.createDetachedEntity();
    return this.addEntity(entity);
  }

  createDetachedEntity() {
    return this.entityPool.acquire();
  }

  addEntity(entity) {
    if (this.entitiesByUUID[entity.uuid]) {
      console.warn(`Entity ${entity.uuid} already added.`);
      return entity;
    }

    this.entitiesByUUID[entity.uuid] = entity;
    this.entities.push(entity);
    entity.alive = true;

    for (let i = 0; i < entity.componentTypes.length; i++) {
      const Component = entity.componentTypes[i];
      this.onComponentAdded(entity, Component);
    }

    return entity;
  }

  getEntityByUUID(uuid) {
    return this.entitiesByUUID[uuid];
  }

  createComponent(Component) {
    const componentPool = this.componentPools[Component.name];

    if (componentPool) {
      return componentPool.acquire();
    }

    return new Component();
  }

  getComponentPool(Component) {
    return this.componentPools[Component.name];
  }

  getSystem(SystemClass) {
    return this.systemManager.getSystem(SystemClass);
  }

  getSystems() {
    return this.systemManager.getSystems();
  }

  getQuery(Components) {
    const key = queryKey(Components);
    let query = this.queries[key];

    if (!query) {
      this.queries[key] = query = new Query(Components, this);
    }

    return query;
  }

  onComponentAdded(entity, Component) {
    if (!this.componentTypes[Component.name]) {
      console.warn(`Component ${Component.name} not registered.`);
    }

    this.componentCounts[Component.name]++;

    // Check each indexed query to see if we need to add this entity to the list
    for (var queryName in this.queries) {
      var query = this.queries[queryName];

      if (
        !!~query.NotComponents.indexOf(Component) &&
        ~query.entities.indexOf(entity)
      ) {
        query.removeEntity(entity);
        continue;
      }

      // Add the entity only if:
      // Component is in the query
      // and Entity has ALL the components of the query
      // and Entity is not already in the query
      if (
        !~query.Components.indexOf(Component) ||
        !query.match(entity) ||
        ~query.entities.indexOf(entity)
      )
        continue;

      query.addEntity(entity);
    }
  }

  onComponentChanged(entity, Component, component) {
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
  }

  queueComponentRemoval(entity) {
    const index = this.entitiesWithComponentsToRemove.indexOf(entity);

    if (index === -1) {
      this.entitiesWithComponentsToRemove.push(entity);
    }
  }

  onRemoveComponent(entity, Component) {
    this.componentCounts[Component.name]--;

    for (var queryName in this.queries) {
      var query = this.queries[queryName];

      if (
        !!~query.NotComponents.indexOf(Component) &&
        !~query.entities.indexOf(entity) &&
        query.match(entity)
      ) {
        query.addEntity(entity);
        continue;
      }

      if (
        !!~query.Components.indexOf(Component) &&
        !!~query.entities.indexOf(entity) &&
        !query.match(entity)
      ) {
        query.removeEntity(entity);
        continue;
      }
    }
  }

  queueEntityDisposal(entity) {
    this.entitiesToRemove.push(entity);
  }

  onDisposeEntity(entity) {
    for (var queryName in this.queries) {
      const query = this.queries[queryName];

      if (entity.queries.indexOf(query) !== -1) {
        query.removeEntity(entity);
      }
    }
  }

  onEntityDisposed(entity) {
    if (!this.entitiesByUUID[entity.uuid]) {
      return;
    }

    delete this.entitiesByUUID[entity.uuid];

    const index = this.entities.indexOf(entity);

    if (index !== -1) {
      this.entities.splice(index, 1);
    }
  }

  execute(delta, time) {
    if (!delta) {
      let time = performance.now();
      delta = time - this.lastTime;
      this.lastTime = time;
    }

    if (this.enabled) {
      this.systemManager.execute(delta, time);

      if (!this.deferredRemovalEnabled) {
        return;
      }

      for (let i = 0; i < this.entitiesToRemove.length; i++) {
        let entity = this.entitiesToRemove[i];
        entity.dispose(true);
      }

      this.entitiesToRemove.length = 0;

      for (let i = 0; i < this.entitiesWithComponentsToRemove.length; i++) {
        let entity = this.entitiesWithComponentsToRemove[i];
        entity.processRemovedComponents();
      }

      this.entitiesWithComponentsToRemove.length = 0;
    }
  }

  stop() {
    this.enabled = false;
  }

  play() {
    this.enabled = true;
  }

  stats() {
    var stats = {
      entities: {
        numEntities: this.entities.length,
        numQueries: Object.keys(this.queries).length,
        queries: {},
        numComponentPool: Object.keys(this.componentPools).length,
        componentPool: {}
      },
      system: this.systemManager.stats()
    };

    for (const queryName in this.queries) {
      stats.queries[queryName] = this.queries[queryName].stats();
    }

    for (const componentName in this.componentPools) {
      const pool = this.componentPools[componentName];

      stats.componentPool[componentName] = {
        used: pool.totalUsed(),
        size: pool.count
      };
    }

    console.log(JSON.stringify(stats, null, 2));
  }
}
