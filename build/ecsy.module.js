class SystemManager {
  constructor(world) {
    this._systems = [];
    this._executeSystems = []; // Systems that have `execute` method
    this.world = world;
    this.lastExecutedSystem = null;
  }

  registerSystem(System, attributes) {
    if (
      this._systems.find(s => s.constructor.name === System.name) !== undefined
    ) {
      console.warn(`System '${System.name}' already registered.`);
      return this;
    }

    var system = new System(this.world, attributes);
    if (system.init) system.init();
    system.order = this._systems.length;
    this._systems.push(system);
    if (system.execute) {
      this._executeSystems.push(system);
      this.sortSystems();
    }
    return this;
  }

  sortSystems() {
    this._executeSystems.sort((a, b) => {
      return a.priority - b.priority || a.order - b.order;
    });
  }

  getSystem(System) {
    return this._systems.find(s => s instanceof System);
  }

  getSystems() {
    return this._systems;
  }

  removeSystem(System) {
    var index = this._systems.indexOf(System);
    if (!~index) return;

    this._systems.splice(index, 1);
  }

  executeSystem(system, delta, time) {
    if (system.initialized) {
      if (system.canExecute()) {
        let startTime = performance.now();
        system.execute(delta, time);
        system.executeTime = performance.now() - startTime;
        this.lastExecutedSystem = system;
        system.clearEvents();
      }
    }
  }

  stop() {
    this._executeSystems.forEach(system => system.stop());
  }

  execute(delta, time, forcePlay) {
    this._executeSystems.forEach(
      system =>
        (forcePlay || system.enabled) && this.executeSystem(system, delta, time)
    );
  }

  stats() {
    var stats = {
      numSystems: this._systems.length,
      systems: {}
    };

    for (var i = 0; i < this._systems.length; i++) {
      var system = this._systems[i];
      var systemStats = (stats.systems[system.constructor.name] = {
        queries: {}
      });
      for (var name in system.ctx) {
        systemStats.queries[name] = system.ctx[name].stats();
      }
    }

    return stats;
  }
}

const Version = "0.2.2";

/**
 * @private
 * @class EventDispatcher
 */
class EventDispatcher {
  constructor() {
    this._listeners = {};
    this.stats = {
      fired: 0,
      handled: 0
    };
  }

  /**
   * Add an event listener
   * @param {String} eventName Name of the event to listen
   * @param {Function} listener Callback to trigger when the event is fired
   */
  addEventListener(eventName, listener) {
    let listeners = this._listeners;
    if (listeners[eventName] === undefined) {
      listeners[eventName] = [];
    }

    if (listeners[eventName].indexOf(listener) === -1) {
      listeners[eventName].push(listener);
    }
  }

  /**
   * Check if an event listener is already added to the list of listeners
   * @param {String} eventName Name of the event to check
   * @param {Function} listener Callback for the specified event
   */
  hasEventListener(eventName, listener) {
    return (
      this._listeners[eventName] !== undefined &&
      this._listeners[eventName].indexOf(listener) !== -1
    );
  }

  /**
   * Remove an event listener
   * @param {String} eventName Name of the event to remove
   * @param {Function} listener Callback for the specified event
   */
  removeEventListener(eventName, listener) {
    var listenerArray = this._listeners[eventName];
    if (listenerArray !== undefined) {
      var index = listenerArray.indexOf(listener);
      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }
  }

  /**
   * Dispatch an event
   * @param {String} eventName Name of the event to dispatch
   * @param {Entity} entity (Optional) Entity to emit
   * @param {Component} component
   */
  dispatchEvent(eventName, entity, component) {
    this.stats.fired++;

    var listenerArray = this._listeners[eventName];
    if (listenerArray !== undefined) {
      var array = listenerArray.slice(0);

      for (var i = 0; i < array.length; i++) {
        array[i].call(this, entity, component);
      }
    }
  }

  /**
   * Reset stats counters
   */
  resetCounters() {
    this.stats.fired = this.stats.handled = 0;
  }
}

/**
 * Get a key from a list of components
 * @param {Array(Component)} Components Array of components to generate the key
 * @private
 */
function queryKey(Components) {
  var names = [];
  for (var n = 0; n < Components.length; n++) {
    var T = Components[n];
    if (typeof T === "object") {
      var operator = T.operator === "not" ? "!" : T.operator;
      names.push(operator + T.Component.name);
    } else {
      names.push(T.name);
    }
  }

  return names.sort().join("-");
}

let _lut = [];

for (let i = 0; i < 256; i++) {
  _lut[i] = (i < 16 ? "0" : "") + i.toString(16);
}

// https://github.com/mrdoob/three.js/blob/dev/src/math/MathUtils.js#L21
// prettier-ignore
function generateUUID() {
  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136

  let d0 = Math.random() * 0xffffffff | 0;
  let d1 = Math.random() * 0xffffffff | 0;
  let d2 = Math.random() * 0xffffffff | 0;
  let d3 = Math.random() * 0xffffffff | 0;
  let uuid = _lut[ d0 & 0xff ] + _lut[ d0 >> 8 & 0xff ] + _lut[ d0 >> 16 & 0xff ] + _lut[ d0 >> 24 & 0xff ] + '-' +
    _lut[ d1 & 0xff ] + _lut[ d1 >> 8 & 0xff ] + '-' + _lut[ d1 >> 16 & 0x0f | 0x40 ] + _lut[ d1 >> 24 & 0xff ] + '-' +
    _lut[ d2 & 0x3f | 0x80 ] + _lut[ d2 >> 8 & 0xff ] + '-' + _lut[ d2 >> 16 & 0xff ] + _lut[ d2 >> 24 & 0xff ] +
    _lut[ d3 & 0xff ] + _lut[ d3 >> 8 & 0xff ] + _lut[ d3 >> 16 & 0xff ] + _lut[ d3 >> 24 & 0xff ];

  // .toUpperCase() here flattens concatenated strings to save heap memory space.
  return uuid.toUpperCase();
}

class Query {
  /**
   * @param {Array(Component)} Components List of types of components to query
   */
  constructor(Components, world) {
    this.Components = [];
    this.NotComponents = [];

    Components.forEach(component => {
      if (typeof component === "object") {
        this.NotComponents.push(component.Component);
      } else {
        this.Components.push(component);
      }
    });

    if (this.Components.length === 0) {
      throw new Error("Can't create a query without components");
    }

    this.entities = [];

    this.eventDispatcher = new EventDispatcher();

    // This query is being used by a reactive system
    this.reactive = false;

    this.key = queryKey(Components);

    // Fill the query with the existing entities
    for (var i = 0; i < world.entities.length; i++) {
      var entity = world.entities[i];
      if (this.match(entity)) {
        // @todo ??? this.addEntity(entity); => preventing the event to be generated
        entity.queries.push(this);
        this.entities.push(entity);
      }
    }
  }

  /**
   * Add entity to this query
   * @param {Entity} entity
   */
  addEntity(entity) {
    entity.queries.push(this);
    this.entities.push(entity);

    this.eventDispatcher.dispatchEvent(Query.prototype.ENTITY_ADDED, entity);
  }

  /**
   * Remove entity from this query
   * @param {Entity} entity
   */
  removeEntity(entity) {
    let index = this.entities.indexOf(entity);
    if (~index) {
      this.entities.splice(index, 1);

      index = entity.queries.indexOf(this);
      entity.queries.splice(index, 1);

      this.eventDispatcher.dispatchEvent(
        Query.prototype.ENTITY_REMOVED,
        entity
      );
    }
  }

  match(entity) {
    return (
      entity.hasAllComponents(this.Components) &&
      !entity.hasAnyComponents(this.NotComponents)
    );
  }

  toJSON() {
    return {
      key: this.key,
      reactive: this.reactive,
      components: {
        included: this.Components.map(C => C.name),
        not: this.NotComponents.map(C => C.name)
      },
      numEntities: this.entities.length
    };
  }

  /**
   * Return stats for this query
   */
  stats() {
    return {
      numComponents: this.Components.length,
      numEntities: this.entities.length
    };
  }
}

Query.prototype.ENTITY_ADDED = "Query#ENTITY_ADDED";
Query.prototype.ENTITY_REMOVED = "Query#ENTITY_REMOVED";
Query.prototype.COMPONENT_CHANGED = "Query#COMPONENT_CHANGED";

const proxyMap = new WeakMap();

const proxyHandler = {
  set(target, prop) {
    throw new Error(
      `Tried to write to "${target.constructor.name}#${String(
        prop
      )}" on immutable component. Use .getMutableComponent() to modify a component.`
    );
  }
};

function wrapImmutableComponent(T, component) {
  if (component === undefined) {
    return undefined;
  }

  let wrappedComponent = proxyMap.get(component);

  if (!wrappedComponent) {
    wrappedComponent = new Proxy(component, proxyHandler);
    proxyMap.set(component, wrappedComponent);
  }

  return wrappedComponent;
}

class Entity {
  constructor(world) {
    this.world = world;

    // Unique ID for this entity
    this.uuid = generateUUID();

    // List of components types the entity has
    this.componentTypes = [];

    // Instance of the components
    this.components = {};

    this._componentsToRemove = {};

    // Queries where the entity is added
    this.queries = [];

    // Used for deferred removal
    this._componentTypesToRemove = [];

    this.alive = false;

    this._numSystemStateComponents = 0;
  }

  // COMPONENTS

  getComponent(Component, includeRemoved) {
    var component = this.components[Component.name];

    if (!component && includeRemoved === true) {
      component = this._componentsToRemove[Component.name];
    }

    return  component;
  }

  getRemovedComponent(Component) {
    return this._componentsToRemove[Component.name];
  }

  getComponents() {
    return this.components;
  }

  getComponentsToRemove() {
    return this._componentsToRemove;
  }

  getComponentTypes() {
    return this.componentTypes;
  }

  getMutableComponent(Component) {
    var component = this.components[Component.name];

    if (this.alive) {
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

  addComponent(Component, props) {
    if (~this.componentTypes.indexOf(Component)) return;

    this.componentTypes.push(Component);

    if (Component.isSystemStateComponent) {
      this._numSystemStateComponents++;
    }

    var componentPool = this.world.getComponentPool(Component);

    var component =
      componentPool === undefined
        ? new Component(props)
        : componentPool.acquire();

    if (componentPool && props) {
      component.copy(props);
    }

    this.components[Component.name] = component;

    if (this.alive) {
      this.world.onComponentAdded(this, Component);
    }

    return this;
  }

  hasComponent(Component, includeRemoved) {
    return (
      !!~this.componentTypes.indexOf(Component) ||
      (includeRemoved === true && this.hasRemovedComponent(Component))
    );
  }

  hasRemovedComponent(Component) {
    return !!~this._componentTypesToRemove.indexOf(Component);
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

    if (!this._componentsToRemove[componentName]) {
      delete this.components[componentName];

      const index = this.componentTypes.indexOf(Component);
      this.componentTypes.splice(index, 1);

      if (this.alive) {
        this.world.onRemoveComponent(this, Component);
      }
    }

    const component = this.components[componentName];

    if (immediately) {
      if (component) {
        component.dispose();
      }

      if (this._componentsToRemove[componentName]) {
        delete this._componentsToRemove[componentName];
        const index = this._componentTypesToRemove.indexOf(Component);

        if (index !== -1) {
          this._componentTypesToRemove.splice(index, 1);
        }
      }
    } else if (this.alive) {
      this._componentTypesToRemove.push(Component);
      this._componentsToRemove[componentName] = component;
      this.world.queueComponentRemoval(this, Component);
    }

    if (Component.isSystemStateComponent) {
      this._numSystemStateComponents--;

      // Check if the entity was a ghost waiting for the last system state component to be removed
      if (this._numSystemStateComponents === 0 && !this.alive) {
        this.dispose();
      }
    }

    return true;
  }

  processRemovedComponents() {
    while (this._componentTypesToRemove.length > 0) {
      let Component = this._componentTypesToRemove.pop();
      this.removeComponent(Component, true);
    }
  }

  removeAllComponents(immediately) {
    let Components = this.componentTypes;

    for (let j = Components.length - 1; j >= 0; j--) {
      this.removeComponent(Components[j], immediately);
    }
  }

  copy(source) {
    // DISCUSS: Should we reset ComponentTypes and components here or in dispose?
    for (const componentName in source.components) {
      const sourceComponent = source.components[componentName];
      this.components[componentName] = sourceComponent.clone();
      this.componentTypes.push(sourceComponent.constructor);
    }

    return this;
  }

  clone() {
    return new this.constructor(this.world).copy(this);
  }

  dispose(immediately) {
    if (this.alive) {
      this.world.onDisposeEntity(this);
    }

    if (immediately) {
      this.uuid = generateUUID();
      this.alive = true;

      for (let i = 0; i < this.queries.length; i++) {
        this.queries[i].removeEntity(this);
      }

      for (const componentName in this.components) {
        this.components[componentName].dispose();
        delete this.components[componentName];
      }

      for (const componentName in this._componentsToRemove) {
        delete this._componentsToRemove[componentName];
      }

      this.queries.length = 0;
      this.componentTypes.length = 0;
      this._componentTypesToRemove.length = 0;

      if (this._pool) {
        this._pool.release(this);
      }

      this.world.onEntityDisposed(this);
    } else {
      this.alive = false;
      this.world.queueEntityDisposal(this);
    }
  }
}

class ObjectPool {
  constructor(baseObject, initialSize) {
    this.freeList = [];
    this.count = 0;
    this.baseObject = baseObject;
    this.isObjectPool = true;

    if (typeof initialSize !== "undefined") {
      this.expand(initialSize);
    }
  }

  acquire() {
    // Grow the list by 20%ish if we're out
    if (this.freeList.length <= 0) {
      this.expand(Math.round(this.count * 0.2) + 1);
    }

    var item = this.freeList.pop();

    return item;
  }

  release(item) {
    item.copy(this.baseObject);
    this.freeList.push(item);
  }

  expand(count) {
    for (var n = 0; n < count; n++) {
      const clone = this.baseObject.clone();
      clone._pool = this;
      this.freeList.push(clone);
    }
    this.count += count;
  }

  totalSize() {
    return this.count;
  }

  totalFree() {
    return this.freeList.length;
  }

  totalUsed() {
    return this.count - this.freeList.length;
  }
}

class World {
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

    this.isWorld = true;
  }

  registerComponent(Component, objectPool) {
    if (this.componentTypes[Component.name]) {
      console.warn(`Component type: '${Component.name}' already registered.`);
      return this;
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

class System {
  canExecute() {
    if (this._mandatoryQueries.length === 0) return true;

    for (let i = 0; i < this._mandatoryQueries.length; i++) {
      var query = this._mandatoryQueries[i];
      if (query.entities.length === 0) {
        return false;
      }
    }

    return true;
  }

  constructor(world, attributes) {
    this.world = world;
    this.enabled = true;

    // @todo Better naming :)
    this._queries = {};
    this.queries = {};

    this.priority = 0;

    // Used for stats
    this.executeTime = 0;

    if (attributes && attributes.priority) {
      this.priority = attributes.priority;
    }

    this._mandatoryQueries = [];

    this.initialized = true;

    if (this.constructor.queries) {
      for (var queryName in this.constructor.queries) {
        var queryConfig = this.constructor.queries[queryName];
        var Components = queryConfig.components;
        if (!Components || Components.length === 0) {
          throw new Error("'components' attribute can't be empty in a query");
        }
        var query = this.world.getQuery(Components);
        this._queries[queryName] = query;
        if (queryConfig.mandatory === true) {
          this._mandatoryQueries.push(query);
        }
        this.queries[queryName] = {
          results: query.entities
        };

        // Reactive configuration added/removed/changed
        var validEvents = ["added", "removed", "changed"];

        const eventMapping = {
          added: Query.prototype.ENTITY_ADDED,
          removed: Query.prototype.ENTITY_REMOVED,
          changed: Query.prototype.COMPONENT_CHANGED // Query.prototype.ENTITY_CHANGED
        };

        if (queryConfig.listen) {
          validEvents.forEach(eventName => {
            // Is the event enabled on this system's query?
            if (queryConfig.listen[eventName]) {
              let event = queryConfig.listen[eventName];

              if (eventName === "changed") {
                query.reactive = true;
                if (event === true) {
                  // Any change on the entity from the components in the query
                  let eventList = (this.queries[queryName][eventName] = []);
                  query.eventDispatcher.addEventListener(
                    Query.prototype.COMPONENT_CHANGED,
                    entity => {
                      // Avoid duplicates
                      if (eventList.indexOf(entity) === -1) {
                        eventList.push(entity);
                      }
                    }
                  );
                } else if (Array.isArray(event)) {
                  let eventList = (this.queries[queryName][eventName] = []);
                  query.eventDispatcher.addEventListener(
                    Query.prototype.COMPONENT_CHANGED,
                    (entity, changedComponent) => {
                      // Avoid duplicates
                      if (
                        event.indexOf(changedComponent.constructor) !== -1 &&
                        eventList.indexOf(entity) === -1
                      ) {
                        eventList.push(entity);
                      }
                    }
                  );
                }
              } else {
                let eventList = (this.queries[queryName][eventName] = []);

                query.eventDispatcher.addEventListener(
                  eventMapping[eventName],
                  entity => {
                    // @fixme overhead?
                    if (eventList.indexOf(entity) === -1)
                      eventList.push(entity);
                  }
                );
              }
            }
          });
        }
      }
    }
  }

  stop() {
    this.executeTime = 0;
    this.enabled = false;
  }

  play() {
    this.enabled = true;
  }

  // @question rename to clear queues?
  clearEvents() {
    for (let queryName in this.queries) {
      var query = this.queries[queryName];
      if (query.added) {
        query.added.length = 0;
      }
      if (query.removed) {
        query.removed.length = 0;
      }
      if (query.changed) {
        if (Array.isArray(query.changed)) {
          query.changed.length = 0;
        } else {
          for (let name in query.changed) {
            query.changed[name].length = 0;
          }
        }
      }
    }
  }

  toJSON() {
    var json = {
      name: this.constructor.name,
      enabled: this.enabled,
      executeTime: this.executeTime,
      priority: this.priority,
      queries: {}
    };

    if (this.constructor.queries) {
      var queries = this.constructor.queries;
      for (let queryName in queries) {
        let query = this.queries[queryName];
        let queryDefinition = queries[queryName];
        let jsonQuery = (json.queries[queryName] = {
          key: this._queries[queryName].key
        });

        jsonQuery.mandatory = queryDefinition.mandatory === true;
        jsonQuery.reactive =
          queryDefinition.listen &&
          (queryDefinition.listen.added === true ||
            queryDefinition.listen.removed === true ||
            queryDefinition.listen.changed === true ||
            Array.isArray(queryDefinition.listen.changed));

        if (jsonQuery.reactive) {
          jsonQuery.listen = {};

          const methods = ["added", "removed", "changed"];
          methods.forEach(method => {
            if (query[method]) {
              jsonQuery.listen[method] = {
                entities: query[method].length
              };
            }
          });
        }
      }
    }

    return json;
  }
}

function Not(Component) {
  return {
    operator: "not",
    Component: Component
  };
}

// TODO: The default clone and copy can be made faster by
// generating clone/copy functions at Component registration time
class Component {
  constructor(props) {
    const schema = this.constructor.schema;

    for (const key in schema) {
      const schemaProp = schema[key];

      if (props && props.hasOwnProperty(key)) {
        this[key] = props[key];
      } else if (schemaProp.hasOwnProperty("default")) {
        this[key] = schemaProp.type.clone(schemaProp.default);
      } else {
        const type = schemaProp.type;
        this[key] = type.clone(type.default);
      }
    }

    this._pool = null;
  }

  copy(source) {
    const schema = this.constructor.schema;

    for (const key in source) {
      if (schema.hasOwnProperty(key)) {
        const prop = schema[key];
        prop.type.copy(source, this, key);
      }
    }

    return this;
  }

  clone() {
    return new this.constructor().copy(this);
  }

  dispose() {
    if (this._pool) {
      this._pool.release(this);
    }
  }
}

Component.schema = {};
Component.isComponent = true;

class SystemStateComponent extends Component {
  constructor(props) {
    super(props);
    this.isSystemStateComponent = true;
  }
}

SystemStateComponent.isSystemStateComponent = true;

class TagComponent extends Component {
  constructor() {
    super();
    this.isTagComponent = true;
  }
}

TagComponent.isTagComponent = true;

const copyValue = (src, dest, key) => (dest[key] = src[key]);

const cloneValue = src => src;

const copyArray = (src, dest, key) => {
  const srcArray = src[key];
  const destArray = dest[key];

  destArray.length = 0;

  for (let i = 0; i < srcArray.length; i++) {
    destArray.push(srcArray[i]);
  }

  return destArray;
};

const cloneArray = src => src.slice();

const copyJSON = (src, dest, key) =>
  (dest[key] = JSON.parse(JSON.stringify(src[key])));

const cloneJSON = src => JSON.parse(JSON.stringify(src));

const copyCopyable = (src, dest, key) => dest[key].copy(src[key]);

const cloneClonable = src => src.clone();

const createType = (defaultValue, clone, copy) => ({
  default: defaultValue,
  clone,
  copy
});

const PropTypes = {
  Number: { default: 0, clone: cloneValue, copy: copyValue },
  Boolean: { default: false, clone: cloneValue, copy: copyValue },
  String: { default: "", clone: cloneValue, copy: copyValue },
  Object: { default: undefined, clone: cloneValue, copy: copyValue },
  Array: { default: [], clone: cloneArray, copy: copyArray },
  JSON: { default: null, clone: cloneJSON, copy: copyJSON }
};

function generateId(length) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function injectScript(src, onLoad) {
  var script = document.createElement("script");
  // @todo Use link to the ecsy-devtools repo?
  script.src = src;
  script.onload = onLoad;
  (document.head || document.documentElement).appendChild(script);
}

/* global Peer */

function hookConsoleAndErrors(connection) {
  var wrapFunctions = ["error", "warning", "log"];
  wrapFunctions.forEach(key => {
    if (typeof console[key] === "function") {
      var fn = console[key].bind(console);
      console[key] = (...args) => {
        connection.send({
          method: "console",
          type: key,
          args: JSON.stringify(args)
        });
        return fn.apply(null, args);
      };
    }
  });

  window.addEventListener("error", error => {
    connection.send({
      method: "error",
      error: JSON.stringify({
        message: error.error.message,
        stack: error.error.stack
      })
    });
  });
}

function includeRemoteIdHTML(remoteId) {
  let infoDiv = document.createElement("div");
  infoDiv.style.cssText = `
    align-items: center;
    background-color: #333;
    color: #aaa;
    display:flex;
    font-family: Arial;
    font-size: 1.1em;
    height: 40px;
    justify-content: center;
    left: 0;
    opacity: 0.9;
    position: absolute;
    right: 0;
    text-align: center;
    top: 0;
  `;

  infoDiv.innerHTML = `Open ECSY devtools to connect to this page using the code:&nbsp;<b style="color: #fff">${remoteId}</b>&nbsp;<button onClick="generateNewCode()">Generate new code</button>`;
  document.body.appendChild(infoDiv);

  return infoDiv;
}

function enableRemoteDevtools(remoteId) {
  window.generateNewCode = () => {
    window.localStorage.clear();
    remoteId = generateId(6);
    window.localStorage.setItem("ecsyRemoteId", remoteId);
    window.location.reload(false);
  };

  remoteId = remoteId || window.localStorage.getItem("ecsyRemoteId");
  if (!remoteId) {
    remoteId = generateId(6);
    window.localStorage.setItem("ecsyRemoteId", remoteId);
  }

  let infoDiv = includeRemoteIdHTML(remoteId);

  window.__ECSY_REMOTE_DEVTOOLS_INJECTED = true;
  window.__ECSY_REMOTE_DEVTOOLS = {};

  let Version = "";

  // This is used to collect the worlds created before the communication is being established
  let worldsBeforeLoading = [];
  let onWorldCreated = e => {
    var world = e.detail.world;
    Version = e.detail.version;
    worldsBeforeLoading.push(world);
  };
  window.addEventListener("ecsy-world-created", onWorldCreated);

  let onLoaded = () => {
    var peer = new Peer(remoteId);
    peer.on("open", (/* id */) => {
      peer.on("connection", connection => {
        window.__ECSY_REMOTE_DEVTOOLS.connection = connection;
        connection.on("open", function() {
          // infoDiv.style.visibility = "hidden";
          infoDiv.innerHTML = "Connected";

          // Receive messages
          connection.on("data", function(data) {
            if (data.type === "init") {
              var script = document.createElement("script");
              script.setAttribute("type", "text/javascript");
              script.onload = () => {
                script.parentNode.removeChild(script);

                // Once the script is injected we don't need to listen
                window.removeEventListener(
                  "ecsy-world-created",
                  onWorldCreated
                );
                worldsBeforeLoading.forEach(world => {
                  var event = new CustomEvent("ecsy-world-created", {
                    detail: { world: world, version: Version }
                  });
                  window.dispatchEvent(event);
                });
              };
              script.innerHTML = data.script;
              (document.head || document.documentElement).appendChild(script);
              script.onload();

              hookConsoleAndErrors(connection);
            } else if (data.type === "executeScript") {
              let value = eval(data.script);
              if (data.returnEval) {
                connection.send({
                  method: "evalReturn",
                  value: value
                });
              }
            }
          });
        });
      });
    });
  };

  // Inject PeerJS script
  injectScript(
    "https://cdn.jsdelivr.net/npm/peerjs@0.3.20/dist/peer.min.js",
    onLoaded
  );
}

const urlParams = new URLSearchParams(window.location.search);

// @todo Provide a way to disable it if needed
if (urlParams.has("enable-remote-devtools")) {
  enableRemoteDevtools();
}

export { Component, Not, ObjectPool, PropTypes, System, SystemStateComponent, TagComponent, Version, World, wrapImmutableComponent as _wrapImmutableComponent, cloneArray, cloneClonable, cloneJSON, cloneValue, copyArray, copyCopyable, copyJSON, copyValue, createType, enableRemoteDevtools };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9TeXN0ZW1NYW5hZ2VyLmpzIiwiLi4vc3JjL1ZlcnNpb24uanMiLCIuLi9zcmMvRXZlbnREaXNwYXRjaGVyLmpzIiwiLi4vc3JjL1V0aWxzLmpzIiwiLi4vc3JjL1F1ZXJ5LmpzIiwiLi4vc3JjL1dyYXBJbW11dGFibGVDb21wb25lbnQuanMiLCIuLi9zcmMvRW50aXR5LmpzIiwiLi4vc3JjL09iamVjdFBvb2wuanMiLCIuLi9zcmMvV29ybGQuanMiLCIuLi9zcmMvU3lzdGVtLmpzIiwiLi4vc3JjL0NvbXBvbmVudC5qcyIsIi4uL3NyYy9TeXN0ZW1TdGF0ZUNvbXBvbmVudC5qcyIsIi4uL3NyYy9UYWdDb21wb25lbnQuanMiLCIuLi9zcmMvUHJvcFR5cGVzLmpzIiwiLi4vc3JjL1JlbW90ZURldlRvb2xzL3V0aWxzLmpzIiwiLi4vc3JjL1JlbW90ZURldlRvb2xzL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjbGFzcyBTeXN0ZW1NYW5hZ2VyIHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLl9zeXN0ZW1zID0gW107XG4gICAgdGhpcy5fZXhlY3V0ZVN5c3RlbXMgPSBbXTsgLy8gU3lzdGVtcyB0aGF0IGhhdmUgYGV4ZWN1dGVgIG1ldGhvZFxuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmxhc3RFeGVjdXRlZFN5c3RlbSA9IG51bGw7XG4gIH1cblxuICByZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpIHtcbiAgICBpZiAoXG4gICAgICB0aGlzLl9zeXN0ZW1zLmZpbmQocyA9PiBzLmNvbnN0cnVjdG9yLm5hbWUgPT09IFN5c3RlbS5uYW1lKSAhPT0gdW5kZWZpbmVkXG4gICAgKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFN5c3RlbSAnJHtTeXN0ZW0ubmFtZX0nIGFscmVhZHkgcmVnaXN0ZXJlZC5gKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHZhciBzeXN0ZW0gPSBuZXcgU3lzdGVtKHRoaXMud29ybGQsIGF0dHJpYnV0ZXMpO1xuICAgIGlmIChzeXN0ZW0uaW5pdCkgc3lzdGVtLmluaXQoKTtcbiAgICBzeXN0ZW0ub3JkZXIgPSB0aGlzLl9zeXN0ZW1zLmxlbmd0aDtcbiAgICB0aGlzLl9zeXN0ZW1zLnB1c2goc3lzdGVtKTtcbiAgICBpZiAoc3lzdGVtLmV4ZWN1dGUpIHtcbiAgICAgIHRoaXMuX2V4ZWN1dGVTeXN0ZW1zLnB1c2goc3lzdGVtKTtcbiAgICAgIHRoaXMuc29ydFN5c3RlbXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzb3J0U3lzdGVtcygpIHtcbiAgICB0aGlzLl9leGVjdXRlU3lzdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICByZXR1cm4gYS5wcmlvcml0eSAtIGIucHJpb3JpdHkgfHwgYS5vcmRlciAtIGIub3JkZXI7XG4gICAgfSk7XG4gIH1cblxuICBnZXRTeXN0ZW0oU3lzdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N5c3RlbXMuZmluZChzID0+IHMgaW5zdGFuY2VvZiBTeXN0ZW0pO1xuICB9XG5cbiAgZ2V0U3lzdGVtcygpIHtcbiAgICByZXR1cm4gdGhpcy5fc3lzdGVtcztcbiAgfVxuXG4gIHJlbW92ZVN5c3RlbShTeXN0ZW0pIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLl9zeXN0ZW1zLmluZGV4T2YoU3lzdGVtKTtcbiAgICBpZiAoIX5pbmRleCkgcmV0dXJuO1xuXG4gICAgdGhpcy5fc3lzdGVtcy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG5cbiAgZXhlY3V0ZVN5c3RlbShzeXN0ZW0sIGRlbHRhLCB0aW1lKSB7XG4gICAgaWYgKHN5c3RlbS5pbml0aWFsaXplZCkge1xuICAgICAgaWYgKHN5c3RlbS5jYW5FeGVjdXRlKCkpIHtcbiAgICAgICAgbGV0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICBzeXN0ZW0uZXhlY3V0ZShkZWx0YSwgdGltZSk7XG4gICAgICAgIHN5c3RlbS5leGVjdXRlVGltZSA9IHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICB0aGlzLmxhc3RFeGVjdXRlZFN5c3RlbSA9IHN5c3RlbTtcbiAgICAgICAgc3lzdGVtLmNsZWFyRXZlbnRzKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLl9leGVjdXRlU3lzdGVtcy5mb3JFYWNoKHN5c3RlbSA9PiBzeXN0ZW0uc3RvcCgpKTtcbiAgfVxuXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUsIGZvcmNlUGxheSkge1xuICAgIHRoaXMuX2V4ZWN1dGVTeXN0ZW1zLmZvckVhY2goXG4gICAgICBzeXN0ZW0gPT5cbiAgICAgICAgKGZvcmNlUGxheSB8fCBzeXN0ZW0uZW5hYmxlZCkgJiYgdGhpcy5leGVjdXRlU3lzdGVtKHN5c3RlbSwgZGVsdGEsIHRpbWUpXG4gICAgKTtcbiAgfVxuXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIG51bVN5c3RlbXM6IHRoaXMuX3N5c3RlbXMubGVuZ3RoLFxuICAgICAgc3lzdGVtczoge31cbiAgICB9O1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9zeXN0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3lzdGVtID0gdGhpcy5fc3lzdGVtc1tpXTtcbiAgICAgIHZhciBzeXN0ZW1TdGF0cyA9IChzdGF0cy5zeXN0ZW1zW3N5c3RlbS5jb25zdHJ1Y3Rvci5uYW1lXSA9IHtcbiAgICAgICAgcXVlcmllczoge31cbiAgICAgIH0pO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiBzeXN0ZW0uY3R4KSB7XG4gICAgICAgIHN5c3RlbVN0YXRzLnF1ZXJpZXNbbmFtZV0gPSBzeXN0ZW0uY3R4W25hbWVdLnN0YXRzKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG4iLCJleHBvcnQgY29uc3QgVmVyc2lvbiA9IFwiMC4yLjJcIjtcbiIsIi8qKlxuICogQHByaXZhdGVcbiAqIEBjbGFzcyBFdmVudERpc3BhdGNoZXJcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXZlbnREaXNwYXRjaGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5fbGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5zdGF0cyA9IHtcbiAgICAgIGZpcmVkOiAwLFxuICAgICAgaGFuZGxlZDogMFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQWRkIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gbGlzdGVuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIHRvIHRyaWdnZXIgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWRcbiAgICovXG4gIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIGxldCBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG4gICAgaWYgKGxpc3RlbmVyc1tldmVudE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpc3RlbmVyc1tldmVudE5hbWVdID0gW107XG4gICAgfVxuXG4gICAgaWYgKGxpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpID09PSAtMSkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0ucHVzaChsaXN0ZW5lcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIGFuIGV2ZW50IGxpc3RlbmVyIGlzIGFscmVhZHkgYWRkZWQgdG8gdGhlIGxpc3Qgb2YgbGlzdGVuZXJzXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnRcbiAgICovXG4gIGhhc0V2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBsaXN0ZW5lcikge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXS5pbmRleE9mKGxpc3RlbmVyKSAhPT0gLTFcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbiBldmVudCBsaXN0ZW5lclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIE5hbWUgb2YgdGhlIGV2ZW50IHRvIHJlbW92ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgaW5kZXggPSBsaXN0ZW5lckFycmF5LmluZGV4T2YobGlzdGVuZXIpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBsaXN0ZW5lckFycmF5LnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERpc3BhdGNoIGFuIGV2ZW50XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gZGlzcGF0Y2hcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAoT3B0aW9uYWwpIEVudGl0eSB0byBlbWl0XG4gICAqIEBwYXJhbSB7Q29tcG9uZW50fSBjb21wb25lbnRcbiAgICovXG4gIGRpc3BhdGNoRXZlbnQoZXZlbnROYW1lLCBlbnRpdHksIGNvbXBvbmVudCkge1xuICAgIHRoaXMuc3RhdHMuZmlyZWQrKztcblxuICAgIHZhciBsaXN0ZW5lckFycmF5ID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50TmFtZV07XG4gICAgaWYgKGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGFycmF5ID0gbGlzdGVuZXJBcnJheS5zbGljZSgwKTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBhcnJheVtpXS5jYWxsKHRoaXMsIGVudGl0eSwgY29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgc3RhdHMgY291bnRlcnNcbiAgICovXG4gIHJlc2V0Q291bnRlcnMoKSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCA9IHRoaXMuc3RhdHMuaGFuZGxlZCA9IDA7XG4gIH1cbn1cbiIsIi8qKlxuICogR2V0IGEga2V5IGZyb20gYSBsaXN0IG9mIGNvbXBvbmVudHNcbiAqIEBwYXJhbSB7QXJyYXkoQ29tcG9uZW50KX0gQ29tcG9uZW50cyBBcnJheSBvZiBjb21wb25lbnRzIHRvIGdlbmVyYXRlIHRoZSBrZXlcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBxdWVyeUtleShDb21wb25lbnRzKSB7XG4gIHZhciBuYW1lcyA9IFtdO1xuICBmb3IgKHZhciBuID0gMDsgbiA8IENvbXBvbmVudHMubGVuZ3RoOyBuKyspIHtcbiAgICB2YXIgVCA9IENvbXBvbmVudHNbbl07XG4gICAgaWYgKHR5cGVvZiBUID09PSBcIm9iamVjdFwiKSB7XG4gICAgICB2YXIgb3BlcmF0b3IgPSBULm9wZXJhdG9yID09PSBcIm5vdFwiID8gXCIhXCIgOiBULm9wZXJhdG9yO1xuICAgICAgbmFtZXMucHVzaChvcGVyYXRvciArIFQuQ29tcG9uZW50Lm5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuYW1lcy5wdXNoKFQubmFtZSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWVzLnNvcnQoKS5qb2luKFwiLVwiKTtcbn1cblxubGV0IF9sdXQgPSBbXTtcblxuZm9yIChsZXQgaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuICBfbHV0W2ldID0gKGkgPCAxNiA/IFwiMFwiIDogXCJcIikgKyBpLnRvU3RyaW5nKDE2KTtcbn1cblxuLy8gaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9ibG9iL2Rldi9zcmMvbWF0aC9NYXRoVXRpbHMuanMjTDIxXG4vLyBwcmV0dGllci1pZ25vcmVcbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVVVSUQoKSB7XG4gIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTA1MDM0L2hvdy10by1jcmVhdGUtYS1ndWlkLXV1aWQtaW4tamF2YXNjcmlwdC8yMTk2MzEzNiMyMTk2MzEzNlxuXG4gIGxldCBkMCA9IE1hdGgucmFuZG9tKCkgKiAweGZmZmZmZmZmIHwgMDtcbiAgbGV0IGQxID0gTWF0aC5yYW5kb20oKSAqIDB4ZmZmZmZmZmYgfCAwO1xuICBsZXQgZDIgPSBNYXRoLnJhbmRvbSgpICogMHhmZmZmZmZmZiB8IDA7XG4gIGxldCBkMyA9IE1hdGgucmFuZG9tKCkgKiAweGZmZmZmZmZmIHwgMDtcbiAgbGV0IHV1aWQgPSBfbHV0WyBkMCAmIDB4ZmYgXSArIF9sdXRbIGQwID4+IDggJiAweGZmIF0gKyBfbHV0WyBkMCA+PiAxNiAmIDB4ZmYgXSArIF9sdXRbIGQwID4+IDI0ICYgMHhmZiBdICsgJy0nICtcbiAgICBfbHV0WyBkMSAmIDB4ZmYgXSArIF9sdXRbIGQxID4+IDggJiAweGZmIF0gKyAnLScgKyBfbHV0WyBkMSA+PiAxNiAmIDB4MGYgfCAweDQwIF0gKyBfbHV0WyBkMSA+PiAyNCAmIDB4ZmYgXSArICctJyArXG4gICAgX2x1dFsgZDIgJiAweDNmIHwgMHg4MCBdICsgX2x1dFsgZDIgPj4gOCAmIDB4ZmYgXSArICctJyArIF9sdXRbIGQyID4+IDE2ICYgMHhmZiBdICsgX2x1dFsgZDIgPj4gMjQgJiAweGZmIF0gK1xuICAgIF9sdXRbIGQzICYgMHhmZiBdICsgX2x1dFsgZDMgPj4gOCAmIDB4ZmYgXSArIF9sdXRbIGQzID4+IDE2ICYgMHhmZiBdICsgX2x1dFsgZDMgPj4gMjQgJiAweGZmIF07XG5cbiAgLy8gLnRvVXBwZXJDYXNlKCkgaGVyZSBmbGF0dGVucyBjb25jYXRlbmF0ZWQgc3RyaW5ncyB0byBzYXZlIGhlYXAgbWVtb3J5IHNwYWNlLlxuICByZXR1cm4gdXVpZC50b1VwcGVyQ2FzZSgpO1xufVxuIiwiaW1wb3J0IEV2ZW50RGlzcGF0Y2hlciBmcm9tIFwiLi9FdmVudERpc3BhdGNoZXIuanNcIjtcbmltcG9ydCB7IHF1ZXJ5S2V5IH0gZnJvbSBcIi4vVXRpbHMuanNcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUXVlcnkge1xuICAvKipcbiAgICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIExpc3Qgb2YgdHlwZXMgb2YgY29tcG9uZW50cyB0byBxdWVyeVxuICAgKi9cbiAgY29uc3RydWN0b3IoQ29tcG9uZW50cywgd29ybGQpIHtcbiAgICB0aGlzLkNvbXBvbmVudHMgPSBbXTtcbiAgICB0aGlzLk5vdENvbXBvbmVudHMgPSBbXTtcblxuICAgIENvbXBvbmVudHMuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgdGhpcy5Ob3RDb21wb25lbnRzLnB1c2goY29tcG9uZW50LkNvbXBvbmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLkNvbXBvbmVudHMucHVzaChjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNyZWF0ZSBhIHF1ZXJ5IHdpdGhvdXQgY29tcG9uZW50c1wiKTtcbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzID0gW107XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlciA9IG5ldyBFdmVudERpc3BhdGNoZXIoKTtcblxuICAgIC8vIFRoaXMgcXVlcnkgaXMgYmVpbmcgdXNlZCBieSBhIHJlYWN0aXZlIHN5c3RlbVxuICAgIHRoaXMucmVhY3RpdmUgPSBmYWxzZTtcblxuICAgIHRoaXMua2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG5cbiAgICAvLyBGaWxsIHRoZSBxdWVyeSB3aXRoIHRoZSBleGlzdGluZyBlbnRpdGllc1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgd29ybGQuZW50aXRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBlbnRpdHkgPSB3b3JsZC5lbnRpdGllc1tpXTtcbiAgICAgIGlmICh0aGlzLm1hdGNoKGVudGl0eSkpIHtcbiAgICAgICAgLy8gQHRvZG8gPz8/IHRoaXMuYWRkRW50aXR5KGVudGl0eSk7ID0+IHByZXZlbnRpbmcgdGhlIGV2ZW50IHRvIGJlIGdlbmVyYXRlZFxuICAgICAgICBlbnRpdHkucXVlcmllcy5wdXNoKHRoaXMpO1xuICAgICAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkIGVudGl0eSB0byB0aGlzIHF1ZXJ5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHlcbiAgICovXG4gIGFkZEVudGl0eShlbnRpdHkpIHtcbiAgICBlbnRpdHkucXVlcmllcy5wdXNoKHRoaXMpO1xuICAgIHRoaXMuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuXG4gICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELCBlbnRpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBlbnRpdHkgZnJvbSB0aGlzIHF1ZXJ5XG4gICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHlcbiAgICovXG4gIHJlbW92ZUVudGl0eShlbnRpdHkpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzLmVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcbiAgICBpZiAofmluZGV4KSB7XG4gICAgICB0aGlzLmVudGl0aWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIGluZGV4ID0gZW50aXR5LnF1ZXJpZXMuaW5kZXhPZih0aGlzKTtcbiAgICAgIGVudGl0eS5xdWVyaWVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCxcbiAgICAgICAgZW50aXR5XG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIG1hdGNoKGVudGl0eSkge1xuICAgIHJldHVybiAoXG4gICAgICBlbnRpdHkuaGFzQWxsQ29tcG9uZW50cyh0aGlzLkNvbXBvbmVudHMpICYmXG4gICAgICAhZW50aXR5Lmhhc0FueUNvbXBvbmVudHModGhpcy5Ob3RDb21wb25lbnRzKVxuICAgICk7XG4gIH1cblxuICB0b0pTT04oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleTogdGhpcy5rZXksXG4gICAgICByZWFjdGl2ZTogdGhpcy5yZWFjdGl2ZSxcbiAgICAgIGNvbXBvbmVudHM6IHtcbiAgICAgICAgaW5jbHVkZWQ6IHRoaXMuQ29tcG9uZW50cy5tYXAoQyA9PiBDLm5hbWUpLFxuICAgICAgICBub3Q6IHRoaXMuTm90Q29tcG9uZW50cy5tYXAoQyA9PiBDLm5hbWUpXG4gICAgICB9LFxuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuZW50aXRpZXMubGVuZ3RoXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc3RhdHMgZm9yIHRoaXMgcXVlcnlcbiAgICovXG4gIHN0YXRzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBudW1Db21wb25lbnRzOiB0aGlzLkNvbXBvbmVudHMubGVuZ3RoLFxuICAgICAgbnVtRW50aXRpZXM6IHRoaXMuZW50aXRpZXMubGVuZ3RoXG4gICAgfTtcbiAgfVxufVxuXG5RdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVEID0gXCJRdWVyeSNFTlRJVFlfQURERURcIjtcblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCA9IFwiUXVlcnkjRU5USVRZX1JFTU9WRURcIjtcblF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCA9IFwiUXVlcnkjQ09NUE9ORU5UX0NIQU5HRURcIjtcbiIsImNvbnN0IHByb3h5TWFwID0gbmV3IFdlYWtNYXAoKTtcblxuY29uc3QgcHJveHlIYW5kbGVyID0ge1xuICBzZXQodGFyZ2V0LCBwcm9wKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFRyaWVkIHRvIHdyaXRlIHRvIFwiJHt0YXJnZXQuY29uc3RydWN0b3IubmFtZX0jJHtTdHJpbmcoXG4gICAgICAgIHByb3BcbiAgICAgICl9XCIgb24gaW1tdXRhYmxlIGNvbXBvbmVudC4gVXNlIC5nZXRNdXRhYmxlQ29tcG9uZW50KCkgdG8gbW9kaWZ5IGEgY29tcG9uZW50LmBcbiAgICApO1xuICB9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gd3JhcEltbXV0YWJsZUNvbXBvbmVudChULCBjb21wb25lbnQpIHtcbiAgaWYgKGNvbXBvbmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGxldCB3cmFwcGVkQ29tcG9uZW50ID0gcHJveHlNYXAuZ2V0KGNvbXBvbmVudCk7XG5cbiAgaWYgKCF3cmFwcGVkQ29tcG9uZW50KSB7XG4gICAgd3JhcHBlZENvbXBvbmVudCA9IG5ldyBQcm94eShjb21wb25lbnQsIHByb3h5SGFuZGxlcik7XG4gICAgcHJveHlNYXAuc2V0KGNvbXBvbmVudCwgd3JhcHBlZENvbXBvbmVudCk7XG4gIH1cblxuICByZXR1cm4gd3JhcHBlZENvbXBvbmVudDtcbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHsgd3JhcEltbXV0YWJsZUNvbXBvbmVudCB9IGZyb20gXCIuL1dyYXBJbW11dGFibGVDb21wb25lbnQuanNcIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVJRCB9IGZyb20gXCIuL1V0aWxzXCI7XG5cbi8vIEB0b2RvIFRha2UgdGhpcyBvdXQgZnJvbSB0aGVyZSBvciB1c2UgRU5WXG5jb25zdCBERUJVRyA9IGZhbHNlO1xuXG5leHBvcnQgY2xhc3MgRW50aXR5IHtcbiAgY29uc3RydWN0b3Iod29ybGQpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG5cbiAgICAvLyBVbmlxdWUgSUQgZm9yIHRoaXMgZW50aXR5XG4gICAgdGhpcy51dWlkID0gZ2VuZXJhdGVVVUlEKCk7XG5cbiAgICAvLyBMaXN0IG9mIGNvbXBvbmVudHMgdHlwZXMgdGhlIGVudGl0eSBoYXNcbiAgICB0aGlzLmNvbXBvbmVudFR5cGVzID0gW107XG5cbiAgICAvLyBJbnN0YW5jZSBvZiB0aGUgY29tcG9uZW50c1xuICAgIHRoaXMuY29tcG9uZW50cyA9IHt9O1xuXG4gICAgdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlID0ge307XG5cbiAgICAvLyBRdWVyaWVzIHdoZXJlIHRoZSBlbnRpdHkgaXMgYWRkZWRcbiAgICB0aGlzLnF1ZXJpZXMgPSBbXTtcblxuICAgIC8vIFVzZWQgZm9yIGRlZmVycmVkIHJlbW92YWxcbiAgICB0aGlzLl9jb21wb25lbnRUeXBlc1RvUmVtb3ZlID0gW107XG5cbiAgICB0aGlzLmFsaXZlID0gZmFsc2U7XG5cbiAgICB0aGlzLl9udW1TeXN0ZW1TdGF0ZUNvbXBvbmVudHMgPSAwO1xuICB9XG5cbiAgLy8gQ09NUE9ORU5UU1xuXG4gIGdldENvbXBvbmVudChDb21wb25lbnQsIGluY2x1ZGVSZW1vdmVkKSB7XG4gICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuY29tcG9uZW50c1tDb21wb25lbnQubmFtZV07XG5cbiAgICBpZiAoIWNvbXBvbmVudCAmJiBpbmNsdWRlUmVtb3ZlZCA9PT0gdHJ1ZSkge1xuICAgICAgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlW0NvbXBvbmVudC5uYW1lXTtcbiAgICB9XG5cbiAgICByZXR1cm4gREVCVUcgPyB3cmFwSW1tdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCwgY29tcG9uZW50KSA6IGNvbXBvbmVudDtcbiAgfVxuXG4gIGdldFJlbW92ZWRDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZVtDb21wb25lbnQubmFtZV07XG4gIH1cblxuICBnZXRDb21wb25lbnRzKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudHM7XG4gIH1cblxuICBnZXRDb21wb25lbnRzVG9SZW1vdmUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZTtcbiAgfVxuXG4gIGdldENvbXBvbmVudFR5cGVzKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudFR5cGVzO1xuICB9XG5cbiAgZ2V0TXV0YWJsZUNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcblxuICAgIGlmICh0aGlzLmFsaXZlKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbaV07XG4gICAgICAgIC8vIEB0b2RvIGFjY2VsZXJhdGUgdGhpcyBjaGVjay4gTWF5YmUgaGF2aW5nIHF1ZXJ5Ll9Db21wb25lbnRzIGFzIGFuIG9iamVjdFxuICAgICAgICBpZiAocXVlcnkucmVhY3RpdmUgJiYgcXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgIT09IC0xKSB7XG4gICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgY29tcG9uZW50XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjb21wb25lbnQ7XG4gIH1cblxuICBhZGRDb21wb25lbnQoQ29tcG9uZW50LCBwcm9wcykge1xuICAgIGlmICh+dGhpcy5jb21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkpIHJldHVybjtcblxuICAgIHRoaXMuY29tcG9uZW50VHlwZXMucHVzaChDb21wb25lbnQpO1xuXG4gICAgaWYgKENvbXBvbmVudC5pc1N5c3RlbVN0YXRlQ29tcG9uZW50KSB7XG4gICAgICB0aGlzLl9udW1TeXN0ZW1TdGF0ZUNvbXBvbmVudHMrKztcbiAgICB9XG5cbiAgICB2YXIgY29tcG9uZW50UG9vbCA9IHRoaXMud29ybGQuZ2V0Q29tcG9uZW50UG9vbChDb21wb25lbnQpO1xuXG4gICAgdmFyIGNvbXBvbmVudCA9XG4gICAgICBjb21wb25lbnRQb29sID09PSB1bmRlZmluZWRcbiAgICAgICAgPyBuZXcgQ29tcG9uZW50KHByb3BzKVxuICAgICAgICA6IGNvbXBvbmVudFBvb2wuYWNxdWlyZSgpO1xuXG4gICAgaWYgKGNvbXBvbmVudFBvb2wgJiYgcHJvcHMpIHtcbiAgICAgIGNvbXBvbmVudC5jb3B5KHByb3BzKTtcbiAgICB9XG5cbiAgICB0aGlzLmNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdID0gY29tcG9uZW50O1xuXG4gICAgaWYgKHRoaXMuYWxpdmUpIHtcbiAgICAgIHRoaXMud29ybGQub25Db21wb25lbnRBZGRlZCh0aGlzLCBDb21wb25lbnQpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgaGFzQ29tcG9uZW50KENvbXBvbmVudCwgaW5jbHVkZVJlbW92ZWQpIHtcbiAgICByZXR1cm4gKFxuICAgICAgISF+dGhpcy5jb21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCkgfHxcbiAgICAgIChpbmNsdWRlUmVtb3ZlZCA9PT0gdHJ1ZSAmJiB0aGlzLmhhc1JlbW92ZWRDb21wb25lbnQoQ29tcG9uZW50KSlcbiAgICApO1xuICB9XG5cbiAgaGFzUmVtb3ZlZENvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICByZXR1cm4gISF+dGhpcy5fY29tcG9uZW50VHlwZXNUb1JlbW92ZS5pbmRleE9mKENvbXBvbmVudCk7XG4gIH1cblxuICBoYXNBbGxDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5oYXNDb21wb25lbnQoQ29tcG9uZW50c1tpXSkpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBoYXNBbnlDb21wb25lbnRzKENvbXBvbmVudHMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLmhhc0NvbXBvbmVudChDb21wb25lbnRzW2ldKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJlbW92ZUNvbXBvbmVudChDb21wb25lbnQsIGltbWVkaWF0ZWx5KSB7XG4gICAgY29uc3QgY29tcG9uZW50TmFtZSA9IENvbXBvbmVudC5uYW1lO1xuXG4gICAgaWYgKCF0aGlzLl9jb21wb25lbnRzVG9SZW1vdmVbY29tcG9uZW50TmFtZV0pIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmNvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG5cbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5jb21wb25lbnRUeXBlcy5pbmRleE9mKENvbXBvbmVudCk7XG4gICAgICB0aGlzLmNvbXBvbmVudFR5cGVzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgIGlmICh0aGlzLmFsaXZlKSB7XG4gICAgICAgIHRoaXMud29ybGQub25SZW1vdmVDb21wb25lbnQodGhpcywgQ29tcG9uZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb21wb25lbnQgPSB0aGlzLmNvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG5cbiAgICBpZiAoaW1tZWRpYXRlbHkpIHtcbiAgICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgICAgY29tcG9uZW50LmRpc3Bvc2UoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZVtjb21wb25lbnROYW1lXSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlW2NvbXBvbmVudE5hbWVdO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2NvbXBvbmVudFR5cGVzVG9SZW1vdmUuaW5kZXhPZihDb21wb25lbnQpO1xuXG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICB0aGlzLl9jb21wb25lbnRUeXBlc1RvUmVtb3ZlLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuYWxpdmUpIHtcbiAgICAgIHRoaXMuX2NvbXBvbmVudFR5cGVzVG9SZW1vdmUucHVzaChDb21wb25lbnQpO1xuICAgICAgdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlW2NvbXBvbmVudE5hbWVdID0gY29tcG9uZW50O1xuICAgICAgdGhpcy53b3JsZC5xdWV1ZUNvbXBvbmVudFJlbW92YWwodGhpcywgQ29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBpZiAoQ29tcG9uZW50LmlzU3lzdGVtU3RhdGVDb21wb25lbnQpIHtcbiAgICAgIHRoaXMuX251bVN5c3RlbVN0YXRlQ29tcG9uZW50cy0tO1xuXG4gICAgICAvLyBDaGVjayBpZiB0aGUgZW50aXR5IHdhcyBhIGdob3N0IHdhaXRpbmcgZm9yIHRoZSBsYXN0IHN5c3RlbSBzdGF0ZSBjb21wb25lbnQgdG8gYmUgcmVtb3ZlZFxuICAgICAgaWYgKHRoaXMuX251bVN5c3RlbVN0YXRlQ29tcG9uZW50cyA9PT0gMCAmJiAhdGhpcy5hbGl2ZSkge1xuICAgICAgICB0aGlzLmRpc3Bvc2UoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByb2Nlc3NSZW1vdmVkQ29tcG9uZW50cygpIHtcbiAgICB3aGlsZSAodGhpcy5fY29tcG9uZW50VHlwZXNUb1JlbW92ZS5sZW5ndGggPiAwKSB7XG4gICAgICBsZXQgQ29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50VHlwZXNUb1JlbW92ZS5wb3AoKTtcbiAgICAgIHRoaXMucmVtb3ZlQ29tcG9uZW50KENvbXBvbmVudCwgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlQWxsQ29tcG9uZW50cyhpbW1lZGlhdGVseSkge1xuICAgIGxldCBDb21wb25lbnRzID0gdGhpcy5jb21wb25lbnRUeXBlcztcblxuICAgIGZvciAobGV0IGogPSBDb21wb25lbnRzLmxlbmd0aCAtIDE7IGogPj0gMDsgai0tKSB7XG4gICAgICB0aGlzLnJlbW92ZUNvbXBvbmVudChDb21wb25lbnRzW2pdLCBpbW1lZGlhdGVseSk7XG4gICAgfVxuICB9XG5cbiAgY29weShzb3VyY2UpIHtcbiAgICAvLyBESVNDVVNTOiBTaG91bGQgd2UgcmVzZXQgQ29tcG9uZW50VHlwZXMgYW5kIGNvbXBvbmVudHMgaGVyZSBvciBpbiBkaXNwb3NlP1xuICAgIGZvciAoY29uc3QgY29tcG9uZW50TmFtZSBpbiBzb3VyY2UuY29tcG9uZW50cykge1xuICAgICAgY29uc3Qgc291cmNlQ29tcG9uZW50ID0gc291cmNlLmNvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgICB0aGlzLmNvbXBvbmVudHNbY29tcG9uZW50TmFtZV0gPSBzb3VyY2VDb21wb25lbnQuY2xvbmUoKTtcbiAgICAgIHRoaXMuY29tcG9uZW50VHlwZXMucHVzaChzb3VyY2VDb21wb25lbnQuY29uc3RydWN0b3IpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgY2xvbmUoKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLmNvbnN0cnVjdG9yKHRoaXMud29ybGQpLmNvcHkodGhpcyk7XG4gIH1cblxuICBkaXNwb3NlKGltbWVkaWF0ZWx5KSB7XG4gICAgaWYgKHRoaXMuYWxpdmUpIHtcbiAgICAgIHRoaXMud29ybGQub25EaXNwb3NlRW50aXR5KHRoaXMpO1xuICAgIH1cblxuICAgIGlmIChpbW1lZGlhdGVseSkge1xuICAgICAgdGhpcy51dWlkID0gZ2VuZXJhdGVVVUlEKCk7XG4gICAgICB0aGlzLmFsaXZlID0gdHJ1ZTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnF1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5xdWVyaWVzW2ldLnJlbW92ZUVudGl0eSh0aGlzKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBjb21wb25lbnROYW1lIGluIHRoaXMuY29tcG9uZW50cykge1xuICAgICAgICB0aGlzLmNvbXBvbmVudHNbY29tcG9uZW50TmFtZV0uZGlzcG9zZSgpO1xuICAgICAgICBkZWxldGUgdGhpcy5jb21wb25lbnRzW2NvbXBvbmVudE5hbWVdO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudE5hbWUgaW4gdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmVbY29tcG9uZW50TmFtZV07XG4gICAgICB9XG5cbiAgICAgIHRoaXMucXVlcmllcy5sZW5ndGggPSAwO1xuICAgICAgdGhpcy5jb21wb25lbnRUeXBlcy5sZW5ndGggPSAwO1xuICAgICAgdGhpcy5fY29tcG9uZW50VHlwZXNUb1JlbW92ZS5sZW5ndGggPSAwO1xuXG4gICAgICBpZiAodGhpcy5fcG9vbCkge1xuICAgICAgICB0aGlzLl9wb29sLnJlbGVhc2UodGhpcyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMud29ybGQub25FbnRpdHlEaXNwb3NlZCh0aGlzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hbGl2ZSA9IGZhbHNlO1xuICAgICAgdGhpcy53b3JsZC5xdWV1ZUVudGl0eURpc3Bvc2FsKHRoaXMpO1xuICAgIH1cbiAgfVxufVxuIiwiZXhwb3J0IGNsYXNzIE9iamVjdFBvb2wge1xuICBjb25zdHJ1Y3RvcihiYXNlT2JqZWN0LCBpbml0aWFsU2l6ZSkge1xuICAgIHRoaXMuZnJlZUxpc3QgPSBbXTtcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLmJhc2VPYmplY3QgPSBiYXNlT2JqZWN0O1xuICAgIHRoaXMuaXNPYmplY3RQb29sID0gdHJ1ZTtcblxuICAgIGlmICh0eXBlb2YgaW5pdGlhbFNpemUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHRoaXMuZXhwYW5kKGluaXRpYWxTaXplKTtcbiAgICB9XG4gIH1cblxuICBhY3F1aXJlKCkge1xuICAgIC8vIEdyb3cgdGhlIGxpc3QgYnkgMjAlaXNoIGlmIHdlJ3JlIG91dFxuICAgIGlmICh0aGlzLmZyZWVMaXN0Lmxlbmd0aCA8PSAwKSB7XG4gICAgICB0aGlzLmV4cGFuZChNYXRoLnJvdW5kKHRoaXMuY291bnQgKiAwLjIpICsgMSk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSB0aGlzLmZyZWVMaXN0LnBvcCgpO1xuXG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cblxuICByZWxlYXNlKGl0ZW0pIHtcbiAgICBpdGVtLmNvcHkodGhpcy5iYXNlT2JqZWN0KTtcbiAgICB0aGlzLmZyZWVMaXN0LnB1c2goaXRlbSk7XG4gIH1cblxuICBleHBhbmQoY291bnQpIHtcbiAgICBmb3IgKHZhciBuID0gMDsgbiA8IGNvdW50OyBuKyspIHtcbiAgICAgIGNvbnN0IGNsb25lID0gdGhpcy5iYXNlT2JqZWN0LmNsb25lKCk7XG4gICAgICBjbG9uZS5fcG9vbCA9IHRoaXM7XG4gICAgICB0aGlzLmZyZWVMaXN0LnB1c2goY2xvbmUpO1xuICAgIH1cbiAgICB0aGlzLmNvdW50ICs9IGNvdW50O1xuICB9XG5cbiAgdG90YWxTaXplKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50O1xuICB9XG5cbiAgdG90YWxGcmVlKCkge1xuICAgIHJldHVybiB0aGlzLmZyZWVMaXN0Lmxlbmd0aDtcbiAgfVxuXG4gIHRvdGFsVXNlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5jb3VudCAtIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG59XG4iLCJpbXBvcnQgeyBTeXN0ZW1NYW5hZ2VyIH0gZnJvbSBcIi4vU3lzdGVtTWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgVmVyc2lvbiB9IGZyb20gXCIuL1ZlcnNpb24uanNcIjtcbmltcG9ydCB7IEVudGl0eSB9IGZyb20gXCIuL0VudGl0eS5qc1wiO1xuaW1wb3J0IHsgT2JqZWN0UG9vbCB9IGZyb20gXCIuL09iamVjdFBvb2wuanNcIjtcbmltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgY2xhc3MgV29ybGQge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIgPSBuZXcgU3lzdGVtTWFuYWdlcih0aGlzKTtcblxuICAgIHRoaXMuZW50aXR5UG9vbCA9IG5ldyBPYmplY3RQb29sKG5ldyBFbnRpdHkodGhpcykpO1xuXG4gICAgdGhpcy5lbnRpdGllcyA9IFtdO1xuICAgIHRoaXMuZW50aXRpZXNCeVVVSUQgPSB7fTtcblxuICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlID0gW107XG4gICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlID0gW107XG4gICAgdGhpcy5kZWZlcnJlZFJlbW92YWxFbmFibGVkID0gdHJ1ZTtcblxuICAgIHRoaXMuY29tcG9uZW50VHlwZXMgPSB7fTtcbiAgICB0aGlzLmNvbXBvbmVudFBvb2xzID0ge307XG4gICAgdGhpcy5jb21wb25lbnRDb3VudHMgPSB7fTtcblxuICAgIHRoaXMucXVlcmllcyA9IHt9O1xuXG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcblxuICAgIGlmICh0eXBlb2YgQ3VzdG9tRXZlbnQgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgIHZhciBldmVudCA9IG5ldyBDdXN0b21FdmVudChcImVjc3ktd29ybGQtY3JlYXRlZFwiLCB7XG4gICAgICAgIGRldGFpbDogeyB3b3JsZDogdGhpcywgdmVyc2lvbjogVmVyc2lvbiB9XG4gICAgICB9KTtcbiAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICB9XG5cbiAgICB0aGlzLmxhc3RUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cbiAgICB0aGlzLmlzV29ybGQgPSB0cnVlO1xuICB9XG5cbiAgcmVnaXN0ZXJDb21wb25lbnQoQ29tcG9uZW50LCBvYmplY3RQb29sKSB7XG4gICAgaWYgKHRoaXMuY29tcG9uZW50VHlwZXNbQ29tcG9uZW50Lm5hbWVdKSB7XG4gICAgICBjb25zb2xlLndhcm4oYENvbXBvbmVudCB0eXBlOiAnJHtDb21wb25lbnQubmFtZX0nIGFscmVhZHkgcmVnaXN0ZXJlZC5gKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHRoaXMuY29tcG9uZW50VHlwZXNbQ29tcG9uZW50Lm5hbWVdID0gQ29tcG9uZW50O1xuICAgIHRoaXMuY29tcG9uZW50Q291bnRzW0NvbXBvbmVudC5uYW1lXSA9IDA7XG5cbiAgICBpZiAob2JqZWN0UG9vbCA9PT0gZmFsc2UpIHtcbiAgICAgIG9iamVjdFBvb2wgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIGlmIChvYmplY3RQb29sID09PSB1bmRlZmluZWQpIHtcbiAgICAgIG9iamVjdFBvb2wgPSBuZXcgT2JqZWN0UG9vbChuZXcgQ29tcG9uZW50KCkpO1xuICAgIH1cblxuICAgIHRoaXMuY29tcG9uZW50UG9vbHNbQ29tcG9uZW50Lm5hbWVdID0gb2JqZWN0UG9vbDtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgdGhpcy5zeXN0ZW1NYW5hZ2VyLnJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBjcmVhdGVFbnRpdHkoKSB7XG4gICAgY29uc3QgZW50aXR5ID0gdGhpcy5jcmVhdGVEZXRhY2hlZEVudGl0eSgpO1xuICAgIHJldHVybiB0aGlzLmFkZEVudGl0eShlbnRpdHkpO1xuICB9XG5cbiAgY3JlYXRlRGV0YWNoZWRFbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50aXR5UG9vbC5hY3F1aXJlKCk7XG4gIH1cblxuICBhZGRFbnRpdHkoZW50aXR5KSB7XG4gICAgaWYgKHRoaXMuZW50aXRpZXNCeVVVSURbZW50aXR5LnV1aWRdKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEVudGl0eSAke2VudGl0eS51dWlkfSBhbHJlYWR5IGFkZGVkLmApO1xuICAgICAgcmV0dXJuIGVudGl0eTtcbiAgICB9XG5cbiAgICB0aGlzLmVudGl0aWVzQnlVVUlEW2VudGl0eS51dWlkXSA9IGVudGl0eTtcbiAgICB0aGlzLmVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICBlbnRpdHkuYWxpdmUgPSB0cnVlO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbnRpdHkuY29tcG9uZW50VHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IENvbXBvbmVudCA9IGVudGl0eS5jb21wb25lbnRUeXBlc1tpXTtcbiAgICAgIHRoaXMub25Db21wb25lbnRBZGRlZChlbnRpdHksIENvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudGl0eTtcbiAgfVxuXG4gIGdldEVudGl0eUJ5VVVJRCh1dWlkKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50aXRpZXNCeVVVSURbdXVpZF07XG4gIH1cblxuICBjcmVhdGVDb21wb25lbnQoQ29tcG9uZW50KSB7XG4gICAgY29uc3QgY29tcG9uZW50UG9vbCA9IHRoaXMuY29tcG9uZW50UG9vbHNbQ29tcG9uZW50Lm5hbWVdO1xuXG4gICAgaWYgKGNvbXBvbmVudFBvb2wpIHtcbiAgICAgIHJldHVybiBjb21wb25lbnRQb29sLmFjcXVpcmUoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IENvbXBvbmVudCgpO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50UG9vbChDb21wb25lbnQpIHtcbiAgICByZXR1cm4gdGhpcy5jb21wb25lbnRQb29sc1tDb21wb25lbnQubmFtZV07XG4gIH1cblxuICBnZXRTeXN0ZW0oU3lzdGVtQ2xhc3MpIHtcbiAgICByZXR1cm4gdGhpcy5zeXN0ZW1NYW5hZ2VyLmdldFN5c3RlbShTeXN0ZW1DbGFzcyk7XG4gIH1cblxuICBnZXRTeXN0ZW1zKCkge1xuICAgIHJldHVybiB0aGlzLnN5c3RlbU1hbmFnZXIuZ2V0U3lzdGVtcygpO1xuICB9XG5cbiAgZ2V0UXVlcnkoQ29tcG9uZW50cykge1xuICAgIGNvbnN0IGtleSA9IHF1ZXJ5S2V5KENvbXBvbmVudHMpO1xuICAgIGxldCBxdWVyeSA9IHRoaXMucXVlcmllc1trZXldO1xuXG4gICAgaWYgKCFxdWVyeSkge1xuICAgICAgdGhpcy5xdWVyaWVzW2tleV0gPSBxdWVyeSA9IG5ldyBRdWVyeShDb21wb25lbnRzLCB0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICBvbkNvbXBvbmVudEFkZGVkKGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgaWYgKCF0aGlzLmNvbXBvbmVudFR5cGVzW0NvbXBvbmVudC5uYW1lXSkge1xuICAgICAgY29uc29sZS53YXJuKGBDb21wb25lbnQgJHtDb21wb25lbnQubmFtZX0gbm90IHJlZ2lzdGVyZWQuYCk7XG4gICAgfVxuXG4gICAgdGhpcy5jb21wb25lbnRDb3VudHNbQ29tcG9uZW50Lm5hbWVdKys7XG5cbiAgICAvLyBDaGVjayBlYWNoIGluZGV4ZWQgcXVlcnkgdG8gc2VlIGlmIHdlIG5lZWQgdG8gYWRkIHRoaXMgZW50aXR5IHRvIHRoZSBsaXN0XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMucXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHRoZSBlbnRpdHkgb25seSBpZjpcbiAgICAgIC8vIENvbXBvbmVudCBpcyBpbiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaGFzIEFMTCB0aGUgY29tcG9uZW50cyBvZiB0aGUgcXVlcnlcbiAgICAgIC8vIGFuZCBFbnRpdHkgaXMgbm90IGFscmVhZHkgaW4gdGhlIHF1ZXJ5XG4gICAgICBpZiAoXG4gICAgICAgICF+cXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgfHxcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSkgfHxcbiAgICAgICAgfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KVxuICAgICAgKVxuICAgICAgICBjb250aW51ZTtcblxuICAgICAgcXVlcnkuYWRkRW50aXR5KGVudGl0eSk7XG4gICAgfVxuICB9XG5cbiAgb25Db21wb25lbnRDaGFuZ2VkKGVudGl0eSwgQ29tcG9uZW50LCBjb21wb25lbnQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVudGl0eS5xdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSBlbnRpdHkucXVlcmllc1tpXTtcbiAgICAgIC8vIEB0b2RvIGFjY2VsZXJhdGUgdGhpcyBjaGVjay4gTWF5YmUgaGF2aW5nIHF1ZXJ5Ll9Db21wb25lbnRzIGFzIGFuIG9iamVjdFxuICAgICAgaWYgKHF1ZXJ5LnJlYWN0aXZlICYmIHF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICE9PSAtMSkge1xuICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgICAgZW50aXR5LFxuICAgICAgICAgIGNvbXBvbmVudFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHF1ZXVlQ29tcG9uZW50UmVtb3ZhbChlbnRpdHkpIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLmluZGV4T2YoZW50aXR5KTtcblxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLnB1c2goZW50aXR5KTtcbiAgICB9XG4gIH1cblxuICBvblJlbW92ZUNvbXBvbmVudChlbnRpdHksIENvbXBvbmVudCkge1xuICAgIHRoaXMuY29tcG9uZW50Q291bnRzW0NvbXBvbmVudC5uYW1lXS0tO1xuXG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMucXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChcbiAgICAgICAgISF+cXVlcnkuTm90Q29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgJiZcbiAgICAgICAgIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkgJiZcbiAgICAgICAgcXVlcnkubWF0Y2goZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LmFkZEVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICAhIX5xdWVyeS5lbnRpdGllcy5pbmRleE9mKGVudGl0eSkgJiZcbiAgICAgICAgIXF1ZXJ5Lm1hdGNoKGVudGl0eSlcbiAgICAgICkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcXVldWVFbnRpdHlEaXNwb3NhbChlbnRpdHkpIHtcbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUucHVzaChlbnRpdHkpO1xuICB9XG5cbiAgb25EaXNwb3NlRW50aXR5KGVudGl0eSkge1xuICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3F1ZXJ5TmFtZV07XG5cbiAgICAgIGlmIChlbnRpdHkucXVlcmllcy5pbmRleE9mKHF1ZXJ5KSAhPT0gLTEpIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25FbnRpdHlEaXNwb3NlZChlbnRpdHkpIHtcbiAgICBpZiAoIXRoaXMuZW50aXRpZXNCeVVVSURbZW50aXR5LnV1aWRdKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZGVsZXRlIHRoaXMuZW50aXRpZXNCeVVVSURbZW50aXR5LnV1aWRdO1xuXG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmVudGl0aWVzLmluZGV4T2YoZW50aXR5KTtcblxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIHRoaXMuZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG4gIH1cblxuICBleGVjdXRlKGRlbHRhLCB0aW1lKSB7XG4gICAgaWYgKCFkZWx0YSkge1xuICAgICAgbGV0IHRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIGRlbHRhID0gdGltZSAtIHRoaXMubGFzdFRpbWU7XG4gICAgICB0aGlzLmxhc3RUaW1lID0gdGltZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICB0aGlzLnN5c3RlbU1hbmFnZXIuZXhlY3V0ZShkZWx0YSwgdGltZSk7XG5cbiAgICAgIGlmICghdGhpcy5kZWZlcnJlZFJlbW92YWxFbmFibGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmVudGl0aWVzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IGVudGl0eSA9IHRoaXMuZW50aXRpZXNUb1JlbW92ZVtpXTtcbiAgICAgICAgZW50aXR5LmRpc3Bvc2UodHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZW50aXRpZXNUb1JlbW92ZS5sZW5ndGggPSAwO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBlbnRpdHkgPSB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZVtpXTtcbiAgICAgICAgZW50aXR5LnByb2Nlc3NSZW1vdmVkQ29tcG9uZW50cygpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmVudGl0aWVzV2l0aENvbXBvbmVudHNUb1JlbW92ZS5sZW5ndGggPSAwO1xuICAgIH1cbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG4gIH1cblxuICBwbGF5KCkge1xuICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG4gIH1cblxuICBzdGF0cygpIHtcbiAgICB2YXIgc3RhdHMgPSB7XG4gICAgICBlbnRpdGllczoge1xuICAgICAgICBudW1FbnRpdGllczogdGhpcy5lbnRpdGllcy5sZW5ndGgsXG4gICAgICAgIG51bVF1ZXJpZXM6IE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykubGVuZ3RoLFxuICAgICAgICBxdWVyaWVzOiB7fSxcbiAgICAgICAgbnVtQ29tcG9uZW50UG9vbDogT2JqZWN0LmtleXModGhpcy5jb21wb25lbnRQb29scykubGVuZ3RoLFxuICAgICAgICBjb21wb25lbnRQb29sOiB7fVxuICAgICAgfSxcbiAgICAgIHN5c3RlbTogdGhpcy5zeXN0ZW1NYW5hZ2VyLnN0YXRzKClcbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBxdWVyeU5hbWUgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgICBzdGF0cy5xdWVyaWVzW3F1ZXJ5TmFtZV0gPSB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXS5zdGF0cygpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY29tcG9uZW50TmFtZSBpbiB0aGlzLmNvbXBvbmVudFBvb2xzKSB7XG4gICAgICBjb25zdCBwb29sID0gdGhpcy5jb21wb25lbnRQb29sc1tjb21wb25lbnROYW1lXTtcblxuICAgICAgc3RhdHMuY29tcG9uZW50UG9vbFtjb21wb25lbnROYW1lXSA9IHtcbiAgICAgICAgdXNlZDogcG9vbC50b3RhbFVzZWQoKSxcbiAgICAgICAgc2l6ZTogcG9vbC5jb3VudFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShzdGF0cywgbnVsbCwgMikpO1xuICB9XG59XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSBcIi4vUXVlcnkuanNcIjtcblxuZXhwb3J0IGNsYXNzIFN5c3RlbSB7XG4gIGNhbkV4ZWN1dGUoKSB7XG4gICAgaWYgKHRoaXMuX21hbmRhdG9yeVF1ZXJpZXMubGVuZ3RoID09PSAwKSByZXR1cm4gdHJ1ZTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWFuZGF0b3J5UXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy5fbWFuZGF0b3J5UXVlcmllc1tpXTtcbiAgICAgIGlmIChxdWVyeS5lbnRpdGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgY29uc3RydWN0b3Iod29ybGQsIGF0dHJpYnV0ZXMpIHtcbiAgICB0aGlzLndvcmxkID0gd29ybGQ7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcblxuICAgIC8vIEB0b2RvIEJldHRlciBuYW1pbmcgOilcbiAgICB0aGlzLl9xdWVyaWVzID0ge307XG4gICAgdGhpcy5xdWVyaWVzID0ge307XG5cbiAgICB0aGlzLnByaW9yaXR5ID0gMDtcblxuICAgIC8vIFVzZWQgZm9yIHN0YXRzXG4gICAgdGhpcy5leGVjdXRlVGltZSA9IDA7XG5cbiAgICBpZiAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLnByaW9yaXR5KSB7XG4gICAgICB0aGlzLnByaW9yaXR5ID0gYXR0cmlidXRlcy5wcmlvcml0eTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzID0gW107XG5cbiAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcblxuICAgIGlmICh0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXMpIHtcbiAgICAgIGZvciAodmFyIHF1ZXJ5TmFtZSBpbiB0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXMpIHtcbiAgICAgICAgdmFyIHF1ZXJ5Q29uZmlnID0gdGhpcy5jb25zdHJ1Y3Rvci5xdWVyaWVzW3F1ZXJ5TmFtZV07XG4gICAgICAgIHZhciBDb21wb25lbnRzID0gcXVlcnlDb25maWcuY29tcG9uZW50cztcbiAgICAgICAgaWYgKCFDb21wb25lbnRzIHx8IENvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiJ2NvbXBvbmVudHMnIGF0dHJpYnV0ZSBjYW4ndCBiZSBlbXB0eSBpbiBhIHF1ZXJ5XCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBxdWVyeSA9IHRoaXMud29ybGQuZ2V0UXVlcnkoQ29tcG9uZW50cyk7XG4gICAgICAgIHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXSA9IHF1ZXJ5O1xuICAgICAgICBpZiAocXVlcnlDb25maWcubWFuZGF0b3J5ID09PSB0cnVlKSB7XG4gICAgICAgICAgdGhpcy5fbWFuZGF0b3J5UXVlcmllcy5wdXNoKHF1ZXJ5KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXSA9IHtcbiAgICAgICAgICByZXN1bHRzOiBxdWVyeS5lbnRpdGllc1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFJlYWN0aXZlIGNvbmZpZ3VyYXRpb24gYWRkZWQvcmVtb3ZlZC9jaGFuZ2VkXG4gICAgICAgIHZhciB2YWxpZEV2ZW50cyA9IFtcImFkZGVkXCIsIFwicmVtb3ZlZFwiLCBcImNoYW5nZWRcIl07XG5cbiAgICAgICAgY29uc3QgZXZlbnRNYXBwaW5nID0ge1xuICAgICAgICAgIGFkZGVkOiBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0FEREVELFxuICAgICAgICAgIHJlbW92ZWQ6IFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfUkVNT1ZFRCxcbiAgICAgICAgICBjaGFuZ2VkOiBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQgLy8gUXVlcnkucHJvdG90eXBlLkVOVElUWV9DSEFOR0VEXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHF1ZXJ5Q29uZmlnLmxpc3Rlbikge1xuICAgICAgICAgIHZhbGlkRXZlbnRzLmZvckVhY2goZXZlbnROYW1lID0+IHtcbiAgICAgICAgICAgIC8vIElzIHRoZSBldmVudCBlbmFibGVkIG9uIHRoaXMgc3lzdGVtJ3MgcXVlcnk/XG4gICAgICAgICAgICBpZiAocXVlcnlDb25maWcubGlzdGVuW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgICAgICAgbGV0IGV2ZW50ID0gcXVlcnlDb25maWcubGlzdGVuW2V2ZW50TmFtZV07XG5cbiAgICAgICAgICAgICAgaWYgKGV2ZW50TmFtZSA9PT0gXCJjaGFuZ2VkXCIpIHtcbiAgICAgICAgICAgICAgICBxdWVyeS5yZWFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAvLyBBbnkgY2hhbmdlIG9uIHRoZSBlbnRpdHkgZnJvbSB0aGUgY29tcG9uZW50cyBpbiB0aGUgcXVlcnlcbiAgICAgICAgICAgICAgICAgIGxldCBldmVudExpc3QgPSAodGhpcy5xdWVyaWVzW3F1ZXJ5TmFtZV1bZXZlbnROYW1lXSA9IFtdKTtcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gQXZvaWQgZHVwbGljYXRlc1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGV2ZW50KSkge1xuICAgICAgICAgICAgICAgICAgbGV0IGV2ZW50TGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0gW10pO1xuICAgICAgICAgICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgKGVudGl0eSwgY2hhbmdlZENvbXBvbmVudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIEF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5pbmRleE9mKGNoYW5nZWRDb21wb25lbnQuY29uc3RydWN0b3IpICE9PSAtMSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LmluZGV4T2YoZW50aXR5KSA9PT0gLTFcbiAgICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TGlzdC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgICAgLy8gQ2hlY2tpbmcganVzdCBzcGVjaWZpYyBjb21wb25lbnRzXG4gICAgICAgICAgICAgICAgICBsZXQgY2hhbmdlZExpc3QgPSAodGhpcy5xdWVyaWVzW3F1ZXJ5TmFtZV1bZXZlbnROYW1lXSA9IHt9KTtcbiAgICAgICAgICAgICAgICAgIGV2ZW50LmZvckVhY2goY29tcG9uZW50ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGV2ZW50TGlzdCA9IChjaGFuZ2VkTGlzdFtcbiAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBdID0gW10pO1xuICAgICAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgICAgICBRdWVyeS5wcm90b3R5cGUuQ09NUE9ORU5UX0NIQU5HRUQsXG4gICAgICAgICAgICAgICAgICAgICAgKGVudGl0eSwgY2hhbmdlZENvbXBvbmVudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkQ29tcG9uZW50LmNvbnN0cnVjdG9yID09PSBjb21wb25lbnQgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LmluZGV4T2YoZW50aXR5KSA9PT0gLTFcbiAgICAgICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGV2ZW50TGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0gW10pO1xuXG4gICAgICAgICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgICBldmVudE1hcHBpbmdbZXZlbnROYW1lXSxcbiAgICAgICAgICAgICAgICAgIGVudGl0eSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEBmaXhtZSBvdmVyaGVhZD9cbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50TGlzdC5pbmRleE9mKGVudGl0eSkgPT09IC0xKVxuICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TGlzdC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLmV4ZWN1dGVUaW1lID0gMDtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIEBxdWVzdGlvbiByZW5hbWUgdG8gY2xlYXIgcXVldWVzP1xuICBjbGVhckV2ZW50cygpIHtcbiAgICBmb3IgKGxldCBxdWVyeU5hbWUgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgIGlmIChxdWVyeS5hZGRlZCkge1xuICAgICAgICBxdWVyeS5hZGRlZC5sZW5ndGggPSAwO1xuICAgICAgfVxuICAgICAgaWYgKHF1ZXJ5LnJlbW92ZWQpIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlZC5sZW5ndGggPSAwO1xuICAgICAgfVxuICAgICAgaWYgKHF1ZXJ5LmNoYW5nZWQpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocXVlcnkuY2hhbmdlZCkpIHtcbiAgICAgICAgICBxdWVyeS5jaGFuZ2VkLmxlbmd0aCA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yIChsZXQgbmFtZSBpbiBxdWVyeS5jaGFuZ2VkKSB7XG4gICAgICAgICAgICBxdWVyeS5jaGFuZ2VkW25hbWVdLmxlbmd0aCA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdG9KU09OKCkge1xuICAgIHZhciBqc29uID0ge1xuICAgICAgbmFtZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgZW5hYmxlZDogdGhpcy5lbmFibGVkLFxuICAgICAgZXhlY3V0ZVRpbWU6IHRoaXMuZXhlY3V0ZVRpbWUsXG4gICAgICBwcmlvcml0eTogdGhpcy5wcmlvcml0eSxcbiAgICAgIHF1ZXJpZXM6IHt9XG4gICAgfTtcblxuICAgIGlmICh0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyaWVzID0gdGhpcy5jb25zdHJ1Y3Rvci5xdWVyaWVzO1xuICAgICAgZm9yIChsZXQgcXVlcnlOYW1lIGluIHF1ZXJpZXMpIHtcbiAgICAgICAgbGV0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3F1ZXJ5TmFtZV07XG4gICAgICAgIGxldCBxdWVyeURlZmluaXRpb24gPSBxdWVyaWVzW3F1ZXJ5TmFtZV07XG4gICAgICAgIGxldCBqc29uUXVlcnkgPSAoanNvbi5xdWVyaWVzW3F1ZXJ5TmFtZV0gPSB7XG4gICAgICAgICAga2V5OiB0aGlzLl9xdWVyaWVzW3F1ZXJ5TmFtZV0ua2V5XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGpzb25RdWVyeS5tYW5kYXRvcnkgPSBxdWVyeURlZmluaXRpb24ubWFuZGF0b3J5ID09PSB0cnVlO1xuICAgICAgICBqc29uUXVlcnkucmVhY3RpdmUgPVxuICAgICAgICAgIHF1ZXJ5RGVmaW5pdGlvbi5saXN0ZW4gJiZcbiAgICAgICAgICAocXVlcnlEZWZpbml0aW9uLmxpc3Rlbi5hZGRlZCA9PT0gdHJ1ZSB8fFxuICAgICAgICAgICAgcXVlcnlEZWZpbml0aW9uLmxpc3Rlbi5yZW1vdmVkID09PSB0cnVlIHx8XG4gICAgICAgICAgICBxdWVyeURlZmluaXRpb24ubGlzdGVuLmNoYW5nZWQgPT09IHRydWUgfHxcbiAgICAgICAgICAgIEFycmF5LmlzQXJyYXkocXVlcnlEZWZpbml0aW9uLmxpc3Rlbi5jaGFuZ2VkKSk7XG5cbiAgICAgICAgaWYgKGpzb25RdWVyeS5yZWFjdGl2ZSkge1xuICAgICAgICAgIGpzb25RdWVyeS5saXN0ZW4gPSB7fTtcblxuICAgICAgICAgIGNvbnN0IG1ldGhvZHMgPSBbXCJhZGRlZFwiLCBcInJlbW92ZWRcIiwgXCJjaGFuZ2VkXCJdO1xuICAgICAgICAgIG1ldGhvZHMuZm9yRWFjaChtZXRob2QgPT4ge1xuICAgICAgICAgICAgaWYgKHF1ZXJ5W21ldGhvZF0pIHtcbiAgICAgICAgICAgICAganNvblF1ZXJ5Lmxpc3RlblttZXRob2RdID0ge1xuICAgICAgICAgICAgICAgIGVudGl0aWVzOiBxdWVyeVttZXRob2RdLmxlbmd0aFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGpzb247XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIE5vdChDb21wb25lbnQpIHtcbiAgcmV0dXJuIHtcbiAgICBvcGVyYXRvcjogXCJub3RcIixcbiAgICBDb21wb25lbnQ6IENvbXBvbmVudFxuICB9O1xufVxuIiwiLy8gVE9ETzogVGhlIGRlZmF1bHQgY2xvbmUgYW5kIGNvcHkgY2FuIGJlIG1hZGUgZmFzdGVyIGJ5XG4vLyBnZW5lcmF0aW5nIGNsb25lL2NvcHkgZnVuY3Rpb25zIGF0IENvbXBvbmVudCByZWdpc3RyYXRpb24gdGltZVxuZXhwb3J0IGNsYXNzIENvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgY29uc3Qgc2NoZW1hID0gdGhpcy5jb25zdHJ1Y3Rvci5zY2hlbWE7XG5cbiAgICBmb3IgKGNvbnN0IGtleSBpbiBzY2hlbWEpIHtcbiAgICAgIGNvbnN0IHNjaGVtYVByb3AgPSBzY2hlbWFba2V5XTtcblxuICAgICAgaWYgKHByb3BzICYmIHByb3BzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgdGhpc1trZXldID0gcHJvcHNba2V5XTtcbiAgICAgIH0gZWxzZSBpZiAoc2NoZW1hUHJvcC5oYXNPd25Qcm9wZXJ0eShcImRlZmF1bHRcIikpIHtcbiAgICAgICAgdGhpc1trZXldID0gc2NoZW1hUHJvcC50eXBlLmNsb25lKHNjaGVtYVByb3AuZGVmYXVsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB0eXBlID0gc2NoZW1hUHJvcC50eXBlO1xuICAgICAgICB0aGlzW2tleV0gPSB0eXBlLmNsb25lKHR5cGUuZGVmYXVsdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fcG9vbCA9IG51bGw7XG4gIH1cblxuICBjb3B5KHNvdXJjZSkge1xuICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuY29uc3RydWN0b3Iuc2NoZW1hO1xuXG4gICAgZm9yIChjb25zdCBrZXkgaW4gc291cmNlKSB7XG4gICAgICBpZiAoc2NoZW1hLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgY29uc3QgcHJvcCA9IHNjaGVtYVtrZXldO1xuICAgICAgICBwcm9wLnR5cGUuY29weShzb3VyY2UsIHRoaXMsIGtleSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IoKS5jb3B5KHRoaXMpO1xuICB9XG5cbiAgZGlzcG9zZSgpIHtcbiAgICBpZiAodGhpcy5fcG9vbCkge1xuICAgICAgdGhpcy5fcG9vbC5yZWxlYXNlKHRoaXMpO1xuICAgIH1cbiAgfVxufVxuXG5Db21wb25lbnQuc2NoZW1hID0ge307XG5Db21wb25lbnQuaXNDb21wb25lbnQgPSB0cnVlO1xuIiwiaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSBcIi4vQ29tcG9uZW50XCI7XG5cbmV4cG9ydCBjbGFzcyBTeXN0ZW1TdGF0ZUNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgc3VwZXIocHJvcHMpO1xuICAgIHRoaXMuaXNTeXN0ZW1TdGF0ZUNvbXBvbmVudCA9IHRydWU7XG4gIH1cbn1cblxuU3lzdGVtU3RhdGVDb21wb25lbnQuaXNTeXN0ZW1TdGF0ZUNvbXBvbmVudCA9IHRydWU7XG4iLCJpbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tIFwiLi9Db21wb25lbnRcIjtcblxuZXhwb3J0IGNsYXNzIFRhZ0NvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pc1RhZ0NvbXBvbmVudCA9IHRydWU7XG4gIH1cbn1cblxuVGFnQ29tcG9uZW50LmlzVGFnQ29tcG9uZW50ID0gdHJ1ZTtcbiIsImV4cG9ydCBjb25zdCBjb3B5VmFsdWUgPSAoc3JjLCBkZXN0LCBrZXkpID0+IChkZXN0W2tleV0gPSBzcmNba2V5XSk7XG5cbmV4cG9ydCBjb25zdCBjbG9uZVZhbHVlID0gc3JjID0+IHNyYztcblxuZXhwb3J0IGNvbnN0IGNvcHlBcnJheSA9IChzcmMsIGRlc3QsIGtleSkgPT4ge1xuICBjb25zdCBzcmNBcnJheSA9IHNyY1trZXldO1xuICBjb25zdCBkZXN0QXJyYXkgPSBkZXN0W2tleV07XG5cbiAgZGVzdEFycmF5Lmxlbmd0aCA9IDA7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcmNBcnJheS5sZW5ndGg7IGkrKykge1xuICAgIGRlc3RBcnJheS5wdXNoKHNyY0FycmF5W2ldKTtcbiAgfVxuXG4gIHJldHVybiBkZXN0QXJyYXk7XG59O1xuXG5leHBvcnQgY29uc3QgY2xvbmVBcnJheSA9IHNyYyA9PiBzcmMuc2xpY2UoKTtcblxuZXhwb3J0IGNvbnN0IGNvcHlKU09OID0gKHNyYywgZGVzdCwga2V5KSA9PlxuICAoZGVzdFtrZXldID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShzcmNba2V5XSkpKTtcblxuZXhwb3J0IGNvbnN0IGNsb25lSlNPTiA9IHNyYyA9PiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHNyYykpO1xuXG5leHBvcnQgY29uc3QgY29weUNvcHlhYmxlID0gKHNyYywgZGVzdCwga2V5KSA9PiBkZXN0W2tleV0uY29weShzcmNba2V5XSk7XG5cbmV4cG9ydCBjb25zdCBjbG9uZUNsb25hYmxlID0gc3JjID0+IHNyYy5jbG9uZSgpO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlVHlwZSA9IChkZWZhdWx0VmFsdWUsIGNsb25lLCBjb3B5KSA9PiAoe1xuICBkZWZhdWx0OiBkZWZhdWx0VmFsdWUsXG4gIGNsb25lLFxuICBjb3B5XG59KTtcblxuZXhwb3J0IGNvbnN0IFByb3BUeXBlcyA9IHtcbiAgTnVtYmVyOiB7IGRlZmF1bHQ6IDAsIGNsb25lOiBjbG9uZVZhbHVlLCBjb3B5OiBjb3B5VmFsdWUgfSxcbiAgQm9vbGVhbjogeyBkZWZhdWx0OiBmYWxzZSwgY2xvbmU6IGNsb25lVmFsdWUsIGNvcHk6IGNvcHlWYWx1ZSB9LFxuICBTdHJpbmc6IHsgZGVmYXVsdDogXCJcIiwgY2xvbmU6IGNsb25lVmFsdWUsIGNvcHk6IGNvcHlWYWx1ZSB9LFxuICBPYmplY3Q6IHsgZGVmYXVsdDogdW5kZWZpbmVkLCBjbG9uZTogY2xvbmVWYWx1ZSwgY29weTogY29weVZhbHVlIH0sXG4gIEFycmF5OiB7IGRlZmF1bHQ6IFtdLCBjbG9uZTogY2xvbmVBcnJheSwgY29weTogY29weUFycmF5IH0sXG4gIEpTT046IHsgZGVmYXVsdDogbnVsbCwgY2xvbmU6IGNsb25lSlNPTiwgY29weTogY29weUpTT04gfVxufTtcbiIsImV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUlkKGxlbmd0aCkge1xuICB2YXIgcmVzdWx0ID0gXCJcIjtcbiAgdmFyIGNoYXJhY3RlcnMgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaMDEyMzQ1Njc4OVwiO1xuICB2YXIgY2hhcmFjdGVyc0xlbmd0aCA9IGNoYXJhY3RlcnMubGVuZ3RoO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgcmVzdWx0ICs9IGNoYXJhY3RlcnMuY2hhckF0KE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJhY3RlcnNMZW5ndGgpKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5qZWN0U2NyaXB0KHNyYywgb25Mb2FkKSB7XG4gIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xuICAvLyBAdG9kbyBVc2UgbGluayB0byB0aGUgZWNzeS1kZXZ0b29scyByZXBvP1xuICBzY3JpcHQuc3JjID0gc3JjO1xuICBzY3JpcHQub25sb2FkID0gb25Mb2FkO1xuICAoZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpLmFwcGVuZENoaWxkKHNjcmlwdCk7XG59XG4iLCIvKiBnbG9iYWwgUGVlciAqL1xuaW1wb3J0IHsgaW5qZWN0U2NyaXB0LCBnZW5lcmF0ZUlkIH0gZnJvbSBcIi4vdXRpbHMuanNcIjtcblxuZnVuY3Rpb24gaG9va0NvbnNvbGVBbmRFcnJvcnMoY29ubmVjdGlvbikge1xuICB2YXIgd3JhcEZ1bmN0aW9ucyA9IFtcImVycm9yXCIsIFwid2FybmluZ1wiLCBcImxvZ1wiXTtcbiAgd3JhcEZ1bmN0aW9ucy5mb3JFYWNoKGtleSA9PiB7XG4gICAgaWYgKHR5cGVvZiBjb25zb2xlW2tleV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdmFyIGZuID0gY29uc29sZVtrZXldLmJpbmQoY29uc29sZSk7XG4gICAgICBjb25zb2xlW2tleV0gPSAoLi4uYXJncykgPT4ge1xuICAgICAgICBjb25uZWN0aW9uLnNlbmQoe1xuICAgICAgICAgIG1ldGhvZDogXCJjb25zb2xlXCIsXG4gICAgICAgICAgdHlwZToga2V5LFxuICAgICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KGFyZ3MpXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZm4uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICB9O1xuICAgIH1cbiAgfSk7XG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCBlcnJvciA9PiB7XG4gICAgY29ubmVjdGlvbi5zZW5kKHtcbiAgICAgIG1ldGhvZDogXCJlcnJvclwiLFxuICAgICAgZXJyb3I6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgbWVzc2FnZTogZXJyb3IuZXJyb3IubWVzc2FnZSxcbiAgICAgICAgc3RhY2s6IGVycm9yLmVycm9yLnN0YWNrXG4gICAgICB9KVxuICAgIH0pO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gaW5jbHVkZVJlbW90ZUlkSFRNTChyZW1vdGVJZCkge1xuICBsZXQgaW5mb0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gIGluZm9EaXYuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgIGJhY2tncm91bmQtY29sb3I6ICMzMzM7XG4gICAgY29sb3I6ICNhYWE7XG4gICAgZGlzcGxheTpmbGV4O1xuICAgIGZvbnQtZmFtaWx5OiBBcmlhbDtcbiAgICBmb250LXNpemU6IDEuMWVtO1xuICAgIGhlaWdodDogNDBweDtcbiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICBsZWZ0OiAwO1xuICAgIG9wYWNpdHk6IDAuOTtcbiAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgcmlnaHQ6IDA7XG4gICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIHRvcDogMDtcbiAgYDtcblxuICBpbmZvRGl2LmlubmVySFRNTCA9IGBPcGVuIEVDU1kgZGV2dG9vbHMgdG8gY29ubmVjdCB0byB0aGlzIHBhZ2UgdXNpbmcgdGhlIGNvZGU6Jm5ic3A7PGIgc3R5bGU9XCJjb2xvcjogI2ZmZlwiPiR7cmVtb3RlSWR9PC9iPiZuYnNwOzxidXR0b24gb25DbGljaz1cImdlbmVyYXRlTmV3Q29kZSgpXCI+R2VuZXJhdGUgbmV3IGNvZGU8L2J1dHRvbj5gO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGluZm9EaXYpO1xuXG4gIHJldHVybiBpbmZvRGl2O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlUmVtb3RlRGV2dG9vbHMocmVtb3RlSWQpIHtcbiAgd2luZG93LmdlbmVyYXRlTmV3Q29kZSA9ICgpID0+IHtcbiAgICB3aW5kb3cubG9jYWxTdG9yYWdlLmNsZWFyKCk7XG4gICAgcmVtb3RlSWQgPSBnZW5lcmF0ZUlkKDYpO1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcImVjc3lSZW1vdGVJZFwiLCByZW1vdGVJZCk7XG4gICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZChmYWxzZSk7XG4gIH07XG5cbiAgcmVtb3RlSWQgPSByZW1vdGVJZCB8fCB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJlY3N5UmVtb3RlSWRcIik7XG4gIGlmICghcmVtb3RlSWQpIHtcbiAgICByZW1vdGVJZCA9IGdlbmVyYXRlSWQoNik7XG4gICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiZWNzeVJlbW90ZUlkXCIsIHJlbW90ZUlkKTtcbiAgfVxuXG4gIGxldCBpbmZvRGl2ID0gaW5jbHVkZVJlbW90ZUlkSFRNTChyZW1vdGVJZCk7XG5cbiAgd2luZG93Ll9fRUNTWV9SRU1PVEVfREVWVE9PTFNfSU5KRUNURUQgPSB0cnVlO1xuICB3aW5kb3cuX19FQ1NZX1JFTU9URV9ERVZUT09MUyA9IHt9O1xuXG4gIGxldCBWZXJzaW9uID0gXCJcIjtcblxuICAvLyBUaGlzIGlzIHVzZWQgdG8gY29sbGVjdCB0aGUgd29ybGRzIGNyZWF0ZWQgYmVmb3JlIHRoZSBjb21tdW5pY2F0aW9uIGlzIGJlaW5nIGVzdGFibGlzaGVkXG4gIGxldCB3b3JsZHNCZWZvcmVMb2FkaW5nID0gW107XG4gIGxldCBvbldvcmxkQ3JlYXRlZCA9IGUgPT4ge1xuICAgIHZhciB3b3JsZCA9IGUuZGV0YWlsLndvcmxkO1xuICAgIFZlcnNpb24gPSBlLmRldGFpbC52ZXJzaW9uO1xuICAgIHdvcmxkc0JlZm9yZUxvYWRpbmcucHVzaCh3b3JsZCk7XG4gIH07XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwiZWNzeS13b3JsZC1jcmVhdGVkXCIsIG9uV29ybGRDcmVhdGVkKTtcblxuICBsZXQgb25Mb2FkZWQgPSAoKSA9PiB7XG4gICAgdmFyIHBlZXIgPSBuZXcgUGVlcihyZW1vdGVJZCk7XG4gICAgcGVlci5vbihcIm9wZW5cIiwgKC8qIGlkICovKSA9PiB7XG4gICAgICBwZWVyLm9uKFwiY29ubmVjdGlvblwiLCBjb25uZWN0aW9uID0+IHtcbiAgICAgICAgd2luZG93Ll9fRUNTWV9SRU1PVEVfREVWVE9PTFMuY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XG4gICAgICAgIGNvbm5lY3Rpb24ub24oXCJvcGVuXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIC8vIGluZm9EaXYuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XG4gICAgICAgICAgaW5mb0Rpdi5pbm5lckhUTUwgPSBcIkNvbm5lY3RlZFwiO1xuXG4gICAgICAgICAgLy8gUmVjZWl2ZSBtZXNzYWdlc1xuICAgICAgICAgIGNvbm5lY3Rpb24ub24oXCJkYXRhXCIsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLnR5cGUgPT09IFwiaW5pdFwiKSB7XG4gICAgICAgICAgICAgIHZhciBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xuICAgICAgICAgICAgICBzY3JpcHQuc2V0QXR0cmlidXRlKFwidHlwZVwiLCBcInRleHQvamF2YXNjcmlwdFwiKTtcbiAgICAgICAgICAgICAgc2NyaXB0Lm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBzY3JpcHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHQpO1xuXG4gICAgICAgICAgICAgICAgLy8gT25jZSB0aGUgc2NyaXB0IGlzIGluamVjdGVkIHdlIGRvbid0IG5lZWQgdG8gbGlzdGVuXG4gICAgICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgICBcImVjc3ktd29ybGQtY3JlYXRlZFwiLFxuICAgICAgICAgICAgICAgICAgb25Xb3JsZENyZWF0ZWRcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHdvcmxkc0JlZm9yZUxvYWRpbmcuZm9yRWFjaCh3b3JsZCA9PiB7XG4gICAgICAgICAgICAgICAgICB2YXIgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoXCJlY3N5LXdvcmxkLWNyZWF0ZWRcIiwge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWw6IHsgd29ybGQ6IHdvcmxkLCB2ZXJzaW9uOiBWZXJzaW9uIH1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICBzY3JpcHQuaW5uZXJIVE1MID0gZGF0YS5zY3JpcHQ7XG4gICAgICAgICAgICAgIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgICAgICAgICAgICAgc2NyaXB0Lm9ubG9hZCgpO1xuXG4gICAgICAgICAgICAgIGhvb2tDb25zb2xlQW5kRXJyb3JzKGNvbm5lY3Rpb24pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnR5cGUgPT09IFwiZXhlY3V0ZVNjcmlwdFwiKSB7XG4gICAgICAgICAgICAgIGxldCB2YWx1ZSA9IGV2YWwoZGF0YS5zY3JpcHQpO1xuICAgICAgICAgICAgICBpZiAoZGF0YS5yZXR1cm5FdmFsKSB7XG4gICAgICAgICAgICAgICAgY29ubmVjdGlvbi5zZW5kKHtcbiAgICAgICAgICAgICAgICAgIG1ldGhvZDogXCJldmFsUmV0dXJuXCIsXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIEluamVjdCBQZWVySlMgc2NyaXB0XG4gIGluamVjdFNjcmlwdChcbiAgICBcImh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9ucG0vcGVlcmpzQDAuMy4yMC9kaXN0L3BlZXIubWluLmpzXCIsXG4gICAgb25Mb2FkZWRcbiAgKTtcbn1cblxuY29uc3QgdXJsUGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcblxuLy8gQHRvZG8gUHJvdmlkZSBhIHdheSB0byBkaXNhYmxlIGl0IGlmIG5lZWRlZFxuaWYgKHVybFBhcmFtcy5oYXMoXCJlbmFibGUtcmVtb3RlLWRldnRvb2xzXCIpKSB7XG4gIGVuYWJsZVJlbW90ZURldnRvb2xzKCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQU8sTUFBTSxhQUFhLENBQUM7QUFDM0IsRUFBRSxXQUFXLENBQUMsS0FBSyxFQUFFO0FBQ3JCLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDdkIsSUFBSSxJQUFJLENBQUMsZUFBZSxHQUFHLEVBQUUsQ0FBQztBQUM5QixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQ3ZCLElBQUksSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztBQUNuQyxHQUFHO0FBQ0g7QUFDQSxFQUFFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFO0FBQ3JDLElBQUk7QUFDSixNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUztBQUMvRSxNQUFNO0FBQ04sTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0FBQ2xFLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3BELElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNuQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7QUFDeEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMvQixJQUFJLElBQUksTUFBTSxD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
