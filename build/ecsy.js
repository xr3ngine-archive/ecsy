(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, (function () {
		var current = global.ECSY;
		var exports = global.ECSY = {};
		factory(exports);
		exports.noConflict = function () { global.ECSY = current; return exports; };
	}()));
}(this, (function (exports) { 'use strict';

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

	exports.Component = Component;
	exports.Not = Not;
	exports.ObjectPool = ObjectPool;
	exports.PropTypes = PropTypes;
	exports.System = System;
	exports.SystemStateComponent = SystemStateComponent;
	exports.TagComponent = TagComponent;
	exports.Version = Version;
	exports.World = World;
	exports._wrapImmutableComponent = wrapImmutableComponent;
	exports.cloneArray = cloneArray;
	exports.cloneClonable = cloneClonable;
	exports.cloneJSON = cloneJSON;
	exports.cloneValue = cloneValue;
	exports.copyArray = copyArray;
	exports.copyCopyable = copyCopyable;
	exports.copyJSON = copyJSON;
	exports.copyValue = copyValue;
	exports.createType = createType;
	exports.enableRemoteDevtools = enableRemoteDevtools;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzeS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL1N5c3RlbU1hbmFnZXIuanMiLCIuLi9zcmMvVmVyc2lvbi5qcyIsIi4uL3NyYy9FdmVudERpc3BhdGNoZXIuanMiLCIuLi9zcmMvVXRpbHMuanMiLCIuLi9zcmMvUXVlcnkuanMiLCIuLi9zcmMvV3JhcEltbXV0YWJsZUNvbXBvbmVudC5qcyIsIi4uL3NyYy9FbnRpdHkuanMiLCIuLi9zcmMvT2JqZWN0UG9vbC5qcyIsIi4uL3NyYy9Xb3JsZC5qcyIsIi4uL3NyYy9TeXN0ZW0uanMiLCIuLi9zcmMvQ29tcG9uZW50LmpzIiwiLi4vc3JjL1N5c3RlbVN0YXRlQ29tcG9uZW50LmpzIiwiLi4vc3JjL1RhZ0NvbXBvbmVudC5qcyIsIi4uL3NyYy9Qcm9wVHlwZXMuanMiLCIuLi9zcmMvUmVtb3RlRGV2VG9vbHMvdXRpbHMuanMiLCIuLi9zcmMvUmVtb3RlRGV2VG9vbHMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIFN5c3RlbU1hbmFnZXIge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMuX3N5c3RlbXMgPSBbXTtcbiAgICB0aGlzLl9leGVjdXRlU3lzdGVtcyA9IFtdOyAvLyBTeXN0ZW1zIHRoYXQgaGF2ZSBgZXhlY3V0ZWAgbWV0aG9kXG4gICAgdGhpcy53b3JsZCA9IHdvcmxkO1xuICAgIHRoaXMubGFzdEV4ZWN1dGVkU3lzdGVtID0gbnVsbDtcbiAgfVxuXG4gIHJlZ2lzdGVyU3lzdGVtKFN5c3RlbSwgYXR0cmlidXRlcykge1xuICAgIGlmIChcbiAgICAgIHRoaXMuX3N5c3RlbXMuZmluZChzID0+IHMuY29uc3RydWN0b3IubmFtZSA9PT0gU3lzdGVtLm5hbWUpICE9PSB1bmRlZmluZWRcbiAgICApIHtcbiAgICAgIGNvbnNvbGUud2FybihgU3lzdGVtICcke1N5c3RlbS5uYW1lfScgYWxyZWFkeSByZWdpc3RlcmVkLmApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgdmFyIHN5c3RlbSA9IG5ldyBTeXN0ZW0odGhpcy53b3JsZCwgYXR0cmlidXRlcyk7XG4gICAgaWYgKHN5c3RlbS5pbml0KSBzeXN0ZW0uaW5pdCgpO1xuICAgIHN5c3RlbS5vcmRlciA9IHRoaXMuX3N5c3RlbXMubGVuZ3RoO1xuICAgIHRoaXMuX3N5c3RlbXMucHVzaChzeXN0ZW0pO1xuICAgIGlmIChzeXN0ZW0uZXhlY3V0ZSkge1xuICAgICAgdGhpcy5fZXhlY3V0ZVN5c3RlbXMucHVzaChzeXN0ZW0pO1xuICAgICAgdGhpcy5zb3J0U3lzdGVtcygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNvcnRTeXN0ZW1zKCkge1xuICAgIHRoaXMuX2V4ZWN1dGVTeXN0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIHJldHVybiBhLnByaW9yaXR5IC0gYi5wcmlvcml0eSB8fCBhLm9yZGVyIC0gYi5vcmRlcjtcbiAgICB9KTtcbiAgfVxuXG4gIGdldFN5c3RlbShTeXN0ZW0pIHtcbiAgICByZXR1cm4gdGhpcy5fc3lzdGVtcy5maW5kKHMgPT4gcyBpbnN0YW5jZW9mIFN5c3RlbSk7XG4gIH1cblxuICBnZXRTeXN0ZW1zKCkge1xuICAgIHJldHVybiB0aGlzLl9zeXN0ZW1zO1xuICB9XG5cbiAgcmVtb3ZlU3lzdGVtKFN5c3RlbSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuX3N5c3RlbXMuaW5kZXhPZihTeXN0ZW0pO1xuICAgIGlmICghfmluZGV4KSByZXR1cm47XG5cbiAgICB0aGlzLl9zeXN0ZW1zLnNwbGljZShpbmRleCwgMSk7XG4gIH1cblxuICBleGVjdXRlU3lzdGVtKHN5c3RlbSwgZGVsdGEsIHRpbWUpIHtcbiAgICBpZiAoc3lzdGVtLmluaXRpYWxpemVkKSB7XG4gICAgICBpZiAoc3lzdGVtLmNhbkV4ZWN1dGUoKSkge1xuICAgICAgICBsZXQgc3RhcnRUaW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHN5c3RlbS5leGVjdXRlKGRlbHRhLCB0aW1lKTtcbiAgICAgICAgc3lzdGVtLmV4ZWN1dGVUaW1lID0gcGVyZm9ybWFuY2Uubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICAgIHRoaXMubGFzdEV4ZWN1dGVkU3lzdGVtID0gc3lzdGVtO1xuICAgICAgICBzeXN0ZW0uY2xlYXJFdmVudHMoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMuX2V4ZWN1dGVTeXN0ZW1zLmZvckVhY2goc3lzdGVtID0+IHN5c3RlbS5zdG9wKCkpO1xuICB9XG5cbiAgZXhlY3V0ZShkZWx0YSwgdGltZSwgZm9yY2VQbGF5KSB7XG4gICAgdGhpcy5fZXhlY3V0ZVN5c3RlbXMuZm9yRWFjaChcbiAgICAgIHN5c3RlbSA9PlxuICAgICAgICAoZm9yY2VQbGF5IHx8IHN5c3RlbS5lbmFibGVkKSAmJiB0aGlzLmV4ZWN1dGVTeXN0ZW0oc3lzdGVtLCBkZWx0YSwgdGltZSlcbiAgICApO1xuICB9XG5cbiAgc3RhdHMoKSB7XG4gICAgdmFyIHN0YXRzID0ge1xuICAgICAgbnVtU3lzdGVtczogdGhpcy5fc3lzdGVtcy5sZW5ndGgsXG4gICAgICBzeXN0ZW1zOiB7fVxuICAgIH07XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX3N5c3RlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzeXN0ZW0gPSB0aGlzLl9zeXN0ZW1zW2ldO1xuICAgICAgdmFyIHN5c3RlbVN0YXRzID0gKHN0YXRzLnN5c3RlbXNbc3lzdGVtLmNvbnN0cnVjdG9yLm5hbWVdID0ge1xuICAgICAgICBxdWVyaWVzOiB7fVxuICAgICAgfSk7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHN5c3RlbS5jdHgpIHtcbiAgICAgICAgc3lzdGVtU3RhdHMucXVlcmllc1tuYW1lXSA9IHN5c3RlbS5jdHhbbmFtZV0uc3RhdHMoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cbn1cbiIsImV4cG9ydCBjb25zdCBWZXJzaW9uID0gXCIwLjIuMlwiO1xuIiwiLyoqXG4gKiBAcHJpdmF0ZVxuICogQGNsYXNzIEV2ZW50RGlzcGF0Y2hlclxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFdmVudERpc3BhdGNoZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgZmlyZWQ6IDAsXG4gICAgICBoYW5kbGVkOiAwXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBsaXN0ZW5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgQ2FsbGJhY2sgdG8gdHJpZ2dlciB3aGVuIHRoZSBldmVudCBpcyBmaXJlZFxuICAgKi9cbiAgYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgbGV0IGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgbGlzdGVuZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICB9XG5cbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihsaXN0ZW5lcikgPT09IC0xKSB7XG4gICAgICBsaXN0ZW5lcnNbZXZlbnROYW1lXS5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgYW4gZXZlbnQgbGlzdGVuZXIgaXMgYWxyZWFkeSBhZGRlZCB0byB0aGUgbGlzdCBvZiBsaXN0ZW5lcnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBjaGVja1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBDYWxsYmFjayBmb3IgdGhlIHNwZWNpZmllZCBldmVudFxuICAgKi9cbiAgaGFzRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdICE9PSB1bmRlZmluZWQgJiZcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdLmluZGV4T2YobGlzdGVuZXIpICE9PSAtMVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFuIGV2ZW50IGxpc3RlbmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgTmFtZSBvZiB0aGUgZXZlbnQgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIENhbGxiYWNrIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50XG4gICAqL1xuICByZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpIHtcbiAgICB2YXIgbGlzdGVuZXJBcnJheSA9IHRoaXMuX2xpc3RlbmVyc1tldmVudE5hbWVdO1xuICAgIGlmIChsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBpbmRleCA9IGxpc3RlbmVyQXJyYXkuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGxpc3RlbmVyQXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlzcGF0Y2ggYW4gZXZlbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBOYW1lIG9mIHRoZSBldmVudCB0byBkaXNwYXRjaFxuICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IChPcHRpb25hbCkgRW50aXR5IHRvIGVtaXRcbiAgICogQHBhcmFtIHtDb21wb25lbnR9IGNvbXBvbmVudFxuICAgKi9cbiAgZGlzcGF0Y2hFdmVudChldmVudE5hbWUsIGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgdGhpcy5zdGF0cy5maXJlZCsrO1xuXG4gICAgdmFyIGxpc3RlbmVyQXJyYXkgPSB0aGlzLl9saXN0ZW5lcnNbZXZlbnROYW1lXTtcbiAgICBpZiAobGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgYXJyYXkgPSBsaXN0ZW5lckFycmF5LnNsaWNlKDApO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFycmF5W2ldLmNhbGwodGhpcywgZW50aXR5LCBjb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBzdGF0cyBjb3VudGVyc1xuICAgKi9cbiAgcmVzZXRDb3VudGVycygpIHtcbiAgICB0aGlzLnN0YXRzLmZpcmVkID0gdGhpcy5zdGF0cy5oYW5kbGVkID0gMDtcbiAgfVxufVxuIiwiLyoqXG4gKiBHZXQgYSBrZXkgZnJvbSBhIGxpc3Qgb2YgY29tcG9uZW50c1xuICogQHBhcmFtIHtBcnJheShDb21wb25lbnQpfSBDb21wb25lbnRzIEFycmF5IG9mIGNvbXBvbmVudHMgdG8gZ2VuZXJhdGUgdGhlIGtleVxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1ZXJ5S2V5KENvbXBvbmVudHMpIHtcbiAgdmFyIG5hbWVzID0gW107XG4gIGZvciAodmFyIG4gPSAwOyBuIDwgQ29tcG9uZW50cy5sZW5ndGg7IG4rKykge1xuICAgIHZhciBUID0gQ29tcG9uZW50c1tuXTtcbiAgICBpZiAodHlwZW9mIFQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHZhciBvcGVyYXRvciA9IFQub3BlcmF0b3IgPT09IFwibm90XCIgPyBcIiFcIiA6IFQub3BlcmF0b3I7XG4gICAgICBuYW1lcy5wdXNoKG9wZXJhdG9yICsgVC5Db21wb25lbnQubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWVzLnB1c2goVC5uYW1lKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZXMuc29ydCgpLmpvaW4oXCItXCIpO1xufVxuXG5sZXQgX2x1dCA9IFtdO1xuXG5mb3IgKGxldCBpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gIF9sdXRbaV0gPSAoaSA8IDE2ID8gXCIwXCIgOiBcIlwiKSArIGkudG9TdHJpbmcoMTYpO1xufVxuXG4vLyBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL2Jsb2IvZGV2L3NyYy9tYXRoL01hdGhVdGlscy5qcyNMMjFcbi8vIHByZXR0aWVyLWlnbm9yZVxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVVVJRCgpIHtcbiAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMDUwMzQvaG93LXRvLWNyZWF0ZS1hLWd1aWQtdXVpZC1pbi1qYXZhc2NyaXB0LzIxOTYzMTM2IzIxOTYzMTM2XG5cbiAgbGV0IGQwID0gTWF0aC5yYW5kb20oKSAqIDB4ZmZmZmZmZmYgfCAwO1xuICBsZXQgZDEgPSBNYXRoLnJhbmRvbSgpICogMHhmZmZmZmZmZiB8IDA7XG4gIGxldCBkMiA9IE1hdGgucmFuZG9tKCkgKiAweGZmZmZmZmZmIHwgMDtcbiAgbGV0IGQzID0gTWF0aC5yYW5kb20oKSAqIDB4ZmZmZmZmZmYgfCAwO1xuICBsZXQgdXVpZCA9IF9sdXRbIGQwICYgMHhmZiBdICsgX2x1dFsgZDAgPj4gOCAmIDB4ZmYgXSArIF9sdXRbIGQwID4+IDE2ICYgMHhmZiBdICsgX2x1dFsgZDAgPj4gMjQgJiAweGZmIF0gKyAnLScgK1xuICAgIF9sdXRbIGQxICYgMHhmZiBdICsgX2x1dFsgZDEgPj4gOCAmIDB4ZmYgXSArICctJyArIF9sdXRbIGQxID4+IDE2ICYgMHgwZiB8IDB4NDAgXSArIF9sdXRbIGQxID4+IDI0ICYgMHhmZiBdICsgJy0nICtcbiAgICBfbHV0WyBkMiAmIDB4M2YgfCAweDgwIF0gKyBfbHV0WyBkMiA+PiA4ICYgMHhmZiBdICsgJy0nICsgX2x1dFsgZDIgPj4gMTYgJiAweGZmIF0gKyBfbHV0WyBkMiA+PiAyNCAmIDB4ZmYgXSArXG4gICAgX2x1dFsgZDMgJiAweGZmIF0gKyBfbHV0WyBkMyA+PiA4ICYgMHhmZiBdICsgX2x1dFsgZDMgPj4gMTYgJiAweGZmIF0gKyBfbHV0WyBkMyA+PiAyNCAmIDB4ZmYgXTtcblxuICAvLyAudG9VcHBlckNhc2UoKSBoZXJlIGZsYXR0ZW5zIGNvbmNhdGVuYXRlZCBzdHJpbmdzIHRvIHNhdmUgaGVhcCBtZW1vcnkgc3BhY2UuXG4gIHJldHVybiB1dWlkLnRvVXBwZXJDYXNlKCk7XG59XG4iLCJpbXBvcnQgRXZlbnREaXNwYXRjaGVyIGZyb20gXCIuL0V2ZW50RGlzcGF0Y2hlci5qc1wiO1xuaW1wb3J0IHsgcXVlcnlLZXkgfSBmcm9tIFwiLi9VdGlscy5qc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWVyeSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0FycmF5KENvbXBvbmVudCl9IENvbXBvbmVudHMgTGlzdCBvZiB0eXBlcyBvZiBjb21wb25lbnRzIHRvIHF1ZXJ5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihDb21wb25lbnRzLCB3b3JsZCkge1xuICAgIHRoaXMuQ29tcG9uZW50cyA9IFtdO1xuICAgIHRoaXMuTm90Q29tcG9uZW50cyA9IFtdO1xuXG4gICAgQ29tcG9uZW50cy5mb3JFYWNoKGNvbXBvbmVudCA9PiB7XG4gICAgICBpZiAodHlwZW9mIGNvbXBvbmVudCA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICB0aGlzLk5vdENvbXBvbmVudHMucHVzaChjb21wb25lbnQuQ29tcG9uZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuQ29tcG9uZW50cy5wdXNoKGNvbXBvbmVudCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5Db21wb25lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY3JlYXRlIGEgcXVlcnkgd2l0aG91dCBjb21wb25lbnRzXCIpO1xuICAgIH1cblxuICAgIHRoaXMuZW50aXRpZXMgPSBbXTtcblxuICAgIHRoaXMuZXZlbnREaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcigpO1xuXG4gICAgLy8gVGhpcyBxdWVyeSBpcyBiZWluZyB1c2VkIGJ5IGEgcmVhY3RpdmUgc3lzdGVtXG4gICAgdGhpcy5yZWFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgdGhpcy5rZXkgPSBxdWVyeUtleShDb21wb25lbnRzKTtcblxuICAgIC8vIEZpbGwgdGhlIHF1ZXJ5IHdpdGggdGhlIGV4aXN0aW5nIGVudGl0aWVzXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB3b3JsZC5lbnRpdGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGVudGl0eSA9IHdvcmxkLmVudGl0aWVzW2ldO1xuICAgICAgaWYgKHRoaXMubWF0Y2goZW50aXR5KSkge1xuICAgICAgICAvLyBAdG9kbyA/Pz8gdGhpcy5hZGRFbnRpdHkoZW50aXR5KTsgPT4gcHJldmVudGluZyB0aGUgZXZlbnQgdG8gYmUgZ2VuZXJhdGVkXG4gICAgICAgIGVudGl0eS5xdWVyaWVzLnB1c2godGhpcyk7XG4gICAgICAgIHRoaXMuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgZW50aXR5IHRvIHRoaXMgcXVlcnlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eVxuICAgKi9cbiAgYWRkRW50aXR5KGVudGl0eSkge1xuICAgIGVudGl0eS5xdWVyaWVzLnB1c2godGhpcyk7XG4gICAgdGhpcy5lbnRpdGllcy5wdXNoKGVudGl0eSk7XG5cbiAgICB0aGlzLmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsIGVudGl0eSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGVudGl0eSBmcm9tIHRoaXMgcXVlcnlcbiAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eVxuICAgKi9cbiAgcmVtb3ZlRW50aXR5KGVudGl0eSkge1xuICAgIGxldCBpbmRleCA9IHRoaXMuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuICAgIGlmICh+aW5kZXgpIHtcbiAgICAgIHRoaXMuZW50aXRpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgaW5kZXggPSBlbnRpdHkucXVlcmllcy5pbmRleE9mKHRoaXMpO1xuICAgICAgZW50aXR5LnF1ZXJpZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgdGhpcy5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICBlbnRpdHlcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbWF0Y2goZW50aXR5KSB7XG4gICAgcmV0dXJuIChcbiAgICAgIGVudGl0eS5oYXNBbGxDb21wb25lbnRzKHRoaXMuQ29tcG9uZW50cykgJiZcbiAgICAgICFlbnRpdHkuaGFzQW55Q29tcG9uZW50cyh0aGlzLk5vdENvbXBvbmVudHMpXG4gICAgKTtcbiAgfVxuXG4gIHRvSlNPTigpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2V5OiB0aGlzLmtleSxcbiAgICAgIHJlYWN0aXZlOiB0aGlzLnJlYWN0aXZlLFxuICAgICAgY29tcG9uZW50czoge1xuICAgICAgICBpbmNsdWRlZDogdGhpcy5Db21wb25lbnRzLm1hcChDID0+IEMubmFtZSksXG4gICAgICAgIG5vdDogdGhpcy5Ob3RDb21wb25lbnRzLm1hcChDID0+IEMubmFtZSlcbiAgICAgIH0sXG4gICAgICBudW1FbnRpdGllczogdGhpcy5lbnRpdGllcy5sZW5ndGhcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzdGF0cyBmb3IgdGhpcyBxdWVyeVxuICAgKi9cbiAgc3RhdHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG51bUNvbXBvbmVudHM6IHRoaXMuQ29tcG9uZW50cy5sZW5ndGgsXG4gICAgICBudW1FbnRpdGllczogdGhpcy5lbnRpdGllcy5sZW5ndGhcbiAgICB9O1xuICB9XG59XG5cblF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQgPSBcIlF1ZXJ5I0VOVElUWV9BRERFRFwiO1xuUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVEID0gXCJRdWVyeSNFTlRJVFlfUkVNT1ZFRFwiO1xuUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VEID0gXCJRdWVyeSNDT01QT05FTlRfQ0hBTkdFRFwiO1xuIiwiY29uc3QgcHJveHlNYXAgPSBuZXcgV2Vha01hcCgpO1xuXG5jb25zdCBwcm94eUhhbmRsZXIgPSB7XG4gIHNldCh0YXJnZXQsIHByb3ApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVHJpZWQgdG8gd3JpdGUgdG8gXCIke3RhcmdldC5jb25zdHJ1Y3Rvci5uYW1lfSMke1N0cmluZyhcbiAgICAgICAgcHJvcFxuICAgICAgKX1cIiBvbiBpbW11dGFibGUgY29tcG9uZW50LiBVc2UgLmdldE11dGFibGVDb21wb25lbnQoKSB0byBtb2RpZnkgYSBjb21wb25lbnQuYFxuICAgICk7XG4gIH1cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB3cmFwSW1tdXRhYmxlQ29tcG9uZW50KFQsIGNvbXBvbmVudCkge1xuICBpZiAoY29tcG9uZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgbGV0IHdyYXBwZWRDb21wb25lbnQgPSBwcm94eU1hcC5nZXQoY29tcG9uZW50KTtcblxuICBpZiAoIXdyYXBwZWRDb21wb25lbnQpIHtcbiAgICB3cmFwcGVkQ29tcG9uZW50ID0gbmV3IFByb3h5KGNvbXBvbmVudCwgcHJveHlIYW5kbGVyKTtcbiAgICBwcm94eU1hcC5zZXQoY29tcG9uZW50LCB3cmFwcGVkQ29tcG9uZW50KTtcbiAgfVxuXG4gIHJldHVybiB3cmFwcGVkQ29tcG9uZW50O1xufVxuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgeyB3cmFwSW1tdXRhYmxlQ29tcG9uZW50IH0gZnJvbSBcIi4vV3JhcEltbXV0YWJsZUNvbXBvbmVudC5qc1wiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVUlEIH0gZnJvbSBcIi4vVXRpbHNcIjtcblxuLy8gQHRvZG8gVGFrZSB0aGlzIG91dCBmcm9tIHRoZXJlIG9yIHVzZSBFTlZcbmNvbnN0IERFQlVHID0gZmFsc2U7XG5cbmV4cG9ydCBjbGFzcyBFbnRpdHkge1xuICBjb25zdHJ1Y3Rvcih3b3JsZCkge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcblxuICAgIC8vIFVuaXF1ZSBJRCBmb3IgdGhpcyBlbnRpdHlcbiAgICB0aGlzLnV1aWQgPSBnZW5lcmF0ZVVVSUQoKTtcblxuICAgIC8vIExpc3Qgb2YgY29tcG9uZW50cyB0eXBlcyB0aGUgZW50aXR5IGhhc1xuICAgIHRoaXMuY29tcG9uZW50VHlwZXMgPSBbXTtcblxuICAgIC8vIEluc3RhbmNlIG9mIHRoZSBjb21wb25lbnRzXG4gICAgdGhpcy5jb21wb25lbnRzID0ge307XG5cbiAgICB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmUgPSB7fTtcblxuICAgIC8vIFF1ZXJpZXMgd2hlcmUgdGhlIGVudGl0eSBpcyBhZGRlZFxuICAgIHRoaXMucXVlcmllcyA9IFtdO1xuXG4gICAgLy8gVXNlZCBmb3IgZGVmZXJyZWQgcmVtb3ZhbFxuICAgIHRoaXMuX2NvbXBvbmVudFR5cGVzVG9SZW1vdmUgPSBbXTtcblxuICAgIHRoaXMuYWxpdmUgPSBmYWxzZTtcblxuICAgIHRoaXMuX251bVN5c3RlbVN0YXRlQ29tcG9uZW50cyA9IDA7XG4gIH1cblxuICAvLyBDT01QT05FTlRTXG5cbiAgZ2V0Q29tcG9uZW50KENvbXBvbmVudCwgaW5jbHVkZVJlbW92ZWQpIHtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5jb21wb25lbnRzW0NvbXBvbmVudC5uYW1lXTtcblxuICAgIGlmICghY29tcG9uZW50ICYmIGluY2x1ZGVSZW1vdmVkID09PSB0cnVlKSB7XG4gICAgICBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmVbQ29tcG9uZW50Lm5hbWVdO1xuICAgIH1cblxuICAgIHJldHVybiBERUJVRyA/IHdyYXBJbW11dGFibGVDb21wb25lbnQoQ29tcG9uZW50LCBjb21wb25lbnQpIDogY29tcG9uZW50O1xuICB9XG5cbiAgZ2V0UmVtb3ZlZENvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlW0NvbXBvbmVudC5uYW1lXTtcbiAgfVxuXG4gIGdldENvbXBvbmVudHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50cztcbiAgfVxuXG4gIGdldENvbXBvbmVudHNUb1JlbW92ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50VHlwZXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50VHlwZXM7XG4gIH1cblxuICBnZXRNdXRhYmxlQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLmNvbXBvbmVudHNbQ29tcG9uZW50Lm5hbWVdO1xuXG4gICAgaWYgKHRoaXMuYWxpdmUpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5xdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1tpXTtcbiAgICAgICAgLy8gQHRvZG8gYWNjZWxlcmF0ZSB0aGlzIGNoZWNrLiBNYXliZSBoYXZpbmcgcXVlcnkuX0NvbXBvbmVudHMgYXMgYW4gb2JqZWN0XG4gICAgICAgIGlmIChxdWVyeS5yZWFjdGl2ZSAmJiBxdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAhPT0gLTEpIHtcbiAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBjb21wb25lbnRcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgfVxuXG4gIGFkZENvbXBvbmVudChDb21wb25lbnQsIHByb3BzKSB7XG4gICAgaWYgKH50aGlzLmNvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KSkgcmV0dXJuO1xuXG4gICAgdGhpcy5jb21wb25lbnRUeXBlcy5wdXNoKENvbXBvbmVudCk7XG5cbiAgICBpZiAoQ29tcG9uZW50LmlzU3lzdGVtU3RhdGVDb21wb25lbnQpIHtcbiAgICAgIHRoaXMuX251bVN5c3RlbVN0YXRlQ29tcG9uZW50cysrO1xuICAgIH1cblxuICAgIHZhciBjb21wb25lbnRQb29sID0gdGhpcy53b3JsZC5nZXRDb21wb25lbnRQb29sKENvbXBvbmVudCk7XG5cbiAgICB2YXIgY29tcG9uZW50ID1cbiAgICAgIGNvbXBvbmVudFBvb2wgPT09IHVuZGVmaW5lZFxuICAgICAgICA/IG5ldyBDb21wb25lbnQocHJvcHMpXG4gICAgICAgIDogY29tcG9uZW50UG9vbC5hY3F1aXJlKCk7XG5cbiAgICBpZiAoY29tcG9uZW50UG9vbCAmJiBwcm9wcykge1xuICAgICAgY29tcG9uZW50LmNvcHkocHJvcHMpO1xuICAgIH1cblxuICAgIHRoaXMuY29tcG9uZW50c1tDb21wb25lbnQubmFtZV0gPSBjb21wb25lbnQ7XG5cbiAgICBpZiAodGhpcy5hbGl2ZSkge1xuICAgICAgdGhpcy53b3JsZC5vbkNvbXBvbmVudEFkZGVkKHRoaXMsIENvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBoYXNDb21wb25lbnQoQ29tcG9uZW50LCBpbmNsdWRlUmVtb3ZlZCkge1xuICAgIHJldHVybiAoXG4gICAgICAhIX50aGlzLmNvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KSB8fFxuICAgICAgKGluY2x1ZGVSZW1vdmVkID09PSB0cnVlICYmIHRoaXMuaGFzUmVtb3ZlZENvbXBvbmVudChDb21wb25lbnQpKVxuICAgICk7XG4gIH1cblxuICBoYXNSZW1vdmVkQ29tcG9uZW50KENvbXBvbmVudCkge1xuICAgIHJldHVybiAhIX50aGlzLl9jb21wb25lbnRUeXBlc1RvUmVtb3ZlLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgfVxuXG4gIGhhc0FsbENvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCF0aGlzLmhhc0NvbXBvbmVudChDb21wb25lbnRzW2ldKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGhhc0FueUNvbXBvbmVudHMoQ29tcG9uZW50cykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuaGFzQ29tcG9uZW50KENvbXBvbmVudHNbaV0pKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmVtb3ZlQ29tcG9uZW50KENvbXBvbmVudCwgaW1tZWRpYXRlbHkpIHtcbiAgICBjb25zdCBjb21wb25lbnROYW1lID0gQ29tcG9uZW50Lm5hbWU7XG5cbiAgICBpZiAoIXRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZVtjb21wb25lbnROYW1lXSkge1xuICAgICAgZGVsZXRlIHRoaXMuY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcblxuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmNvbXBvbmVudFR5cGVzLmluZGV4T2YoQ29tcG9uZW50KTtcbiAgICAgIHRoaXMuY29tcG9uZW50VHlwZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgICAgaWYgKHRoaXMuYWxpdmUpIHtcbiAgICAgICAgdGhpcy53b3JsZC5vblJlbW92ZUNvbXBvbmVudCh0aGlzLCBDb21wb25lbnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbXBvbmVudCA9IHRoaXMuY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcblxuICAgIGlmIChpbW1lZGlhdGVseSkge1xuICAgICAgaWYgKGNvbXBvbmVudCkge1xuICAgICAgICBjb21wb25lbnQuZGlzcG9zZSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fY29tcG9uZW50c1RvUmVtb3ZlW2NvbXBvbmVudE5hbWVdKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmVbY29tcG9uZW50TmFtZV07XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fY29tcG9uZW50VHlwZXNUb1JlbW92ZS5pbmRleE9mKENvbXBvbmVudCk7XG5cbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIHRoaXMuX2NvbXBvbmVudFR5cGVzVG9SZW1vdmUuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy5hbGl2ZSkge1xuICAgICAgdGhpcy5fY29tcG9uZW50VHlwZXNUb1JlbW92ZS5wdXNoKENvbXBvbmVudCk7XG4gICAgICB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmVbY29tcG9uZW50TmFtZV0gPSBjb21wb25lbnQ7XG4gICAgICB0aGlzLndvcmxkLnF1ZXVlQ29tcG9uZW50UmVtb3ZhbCh0aGlzLCBDb21wb25lbnQpO1xuICAgIH1cblxuICAgIGlmIChDb21wb25lbnQuaXNTeXN0ZW1TdGF0ZUNvbXBvbmVudCkge1xuICAgICAgdGhpcy5fbnVtU3lzdGVtU3RhdGVDb21wb25lbnRzLS07XG5cbiAgICAgIC8vIENoZWNrIGlmIHRoZSBlbnRpdHkgd2FzIGEgZ2hvc3Qgd2FpdGluZyBmb3IgdGhlIGxhc3Qgc3lzdGVtIHN0YXRlIGNvbXBvbmVudCB0byBiZSByZW1vdmVkXG4gICAgICBpZiAodGhpcy5fbnVtU3lzdGVtU3RhdGVDb21wb25lbnRzID09PSAwICYmICF0aGlzLmFsaXZlKSB7XG4gICAgICAgIHRoaXMuZGlzcG9zZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHJvY2Vzc1JlbW92ZWRDb21wb25lbnRzKCkge1xuICAgIHdoaWxlICh0aGlzLl9jb21wb25lbnRUeXBlc1RvUmVtb3ZlLmxlbmd0aCA+IDApIHtcbiAgICAgIGxldCBDb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnRUeXBlc1RvUmVtb3ZlLnBvcCgpO1xuICAgICAgdGhpcy5yZW1vdmVDb21wb25lbnQoQ29tcG9uZW50LCB0cnVlKTtcbiAgICB9XG4gIH1cblxuICByZW1vdmVBbGxDb21wb25lbnRzKGltbWVkaWF0ZWx5KSB7XG4gICAgbGV0IENvbXBvbmVudHMgPSB0aGlzLmNvbXBvbmVudFR5cGVzO1xuXG4gICAgZm9yIChsZXQgaiA9IENvbXBvbmVudHMubGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcbiAgICAgIHRoaXMucmVtb3ZlQ29tcG9uZW50KENvbXBvbmVudHNbal0sIGltbWVkaWF0ZWx5KTtcbiAgICB9XG4gIH1cblxuICBjb3B5KHNvdXJjZSkge1xuICAgIC8vIERJU0NVU1M6IFNob3VsZCB3ZSByZXNldCBDb21wb25lbnRUeXBlcyBhbmQgY29tcG9uZW50cyBoZXJlIG9yIGluIGRpc3Bvc2U/XG4gICAgZm9yIChjb25zdCBjb21wb25lbnROYW1lIGluIHNvdXJjZS5jb21wb25lbnRzKSB7XG4gICAgICBjb25zdCBzb3VyY2VDb21wb25lbnQgPSBzb3VyY2UuY29tcG9uZW50c1tjb21wb25lbnROYW1lXTtcbiAgICAgIHRoaXMuY29tcG9uZW50c1tjb21wb25lbnROYW1lXSA9IHNvdXJjZUNvbXBvbmVudC5jbG9uZSgpO1xuICAgICAgdGhpcy5jb21wb25lbnRUeXBlcy5wdXNoKHNvdXJjZUNvbXBvbmVudC5jb25zdHJ1Y3Rvcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IodGhpcy53b3JsZCkuY29weSh0aGlzKTtcbiAgfVxuXG4gIGRpc3Bvc2UoaW1tZWRpYXRlbHkpIHtcbiAgICBpZiAodGhpcy5hbGl2ZSkge1xuICAgICAgdGhpcy53b3JsZC5vbkRpc3Bvc2VFbnRpdHkodGhpcyk7XG4gICAgfVxuXG4gICAgaWYgKGltbWVkaWF0ZWx5KSB7XG4gICAgICB0aGlzLnV1aWQgPSBnZW5lcmF0ZVVVSUQoKTtcbiAgICAgIHRoaXMuYWxpdmUgPSB0cnVlO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0aGlzLnF1ZXJpZXNbaV0ucmVtb3ZlRW50aXR5KHRoaXMpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudE5hbWUgaW4gdGhpcy5jb21wb25lbnRzKSB7XG4gICAgICAgIHRoaXMuY29tcG9uZW50c1tjb21wb25lbnROYW1lXS5kaXNwb3NlKCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmNvbXBvbmVudHNbY29tcG9uZW50TmFtZV07XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgY29tcG9uZW50TmFtZSBpbiB0aGlzLl9jb21wb25lbnRzVG9SZW1vdmUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NvbXBvbmVudHNUb1JlbW92ZVtjb21wb25lbnROYW1lXTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5xdWVyaWVzLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLmNvbXBvbmVudFR5cGVzLmxlbmd0aCA9IDA7XG4gICAgICB0aGlzLl9jb21wb25lbnRUeXBlc1RvUmVtb3ZlLmxlbmd0aCA9IDA7XG5cbiAgICAgIGlmICh0aGlzLl9wb29sKSB7XG4gICAgICAgIHRoaXMuX3Bvb2wucmVsZWFzZSh0aGlzKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy53b3JsZC5vbkVudGl0eURpc3Bvc2VkKHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFsaXZlID0gZmFsc2U7XG4gICAgICB0aGlzLndvcmxkLnF1ZXVlRW50aXR5RGlzcG9zYWwodGhpcyk7XG4gICAgfVxuICB9XG59XG4iLCJleHBvcnQgY2xhc3MgT2JqZWN0UG9vbCB7XG4gIGNvbnN0cnVjdG9yKGJhc2VPYmplY3QsIGluaXRpYWxTaXplKSB7XG4gICAgdGhpcy5mcmVlTGlzdCA9IFtdO1xuICAgIHRoaXMuY291bnQgPSAwO1xuICAgIHRoaXMuYmFzZU9iamVjdCA9IGJhc2VPYmplY3Q7XG4gICAgdGhpcy5pc09iamVjdFBvb2wgPSB0cnVlO1xuXG4gICAgaWYgKHR5cGVvZiBpbml0aWFsU2l6ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgdGhpcy5leHBhbmQoaW5pdGlhbFNpemUpO1xuICAgIH1cbiAgfVxuXG4gIGFjcXVpcmUoKSB7XG4gICAgLy8gR3JvdyB0aGUgbGlzdCBieSAyMCVpc2ggaWYgd2UncmUgb3V0XG4gICAgaWYgKHRoaXMuZnJlZUxpc3QubGVuZ3RoIDw9IDApIHtcbiAgICAgIHRoaXMuZXhwYW5kKE1hdGgucm91bmQodGhpcy5jb3VudCAqIDAuMikgKyAxKTtcbiAgICB9XG5cbiAgICB2YXIgaXRlbSA9IHRoaXMuZnJlZUxpc3QucG9wKCk7XG5cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuXG4gIHJlbGVhc2UoaXRlbSkge1xuICAgIGl0ZW0uY29weSh0aGlzLmJhc2VPYmplY3QpO1xuICAgIHRoaXMuZnJlZUxpc3QucHVzaChpdGVtKTtcbiAgfVxuXG4gIGV4cGFuZChjb3VudCkge1xuICAgIGZvciAodmFyIG4gPSAwOyBuIDwgY291bnQ7IG4rKykge1xuICAgICAgY29uc3QgY2xvbmUgPSB0aGlzLmJhc2VPYmplY3QuY2xvbmUoKTtcbiAgICAgIGNsb25lLl9wb29sID0gdGhpcztcbiAgICAgIHRoaXMuZnJlZUxpc3QucHVzaChjbG9uZSk7XG4gICAgfVxuICAgIHRoaXMuY291bnQgKz0gY291bnQ7XG4gIH1cblxuICB0b3RhbFNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gIH1cblxuICB0b3RhbEZyZWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuZnJlZUxpc3QubGVuZ3RoO1xuICB9XG5cbiAgdG90YWxVc2VkKCkge1xuICAgIHJldHVybiB0aGlzLmNvdW50IC0gdGhpcy5mcmVlTGlzdC5sZW5ndGg7XG4gIH1cbn1cbiIsImltcG9ydCB7IFN5c3RlbU1hbmFnZXIgfSBmcm9tIFwiLi9TeXN0ZW1NYW5hZ2VyLmpzXCI7XG5pbXBvcnQgeyBWZXJzaW9uIH0gZnJvbSBcIi4vVmVyc2lvbi5qc1wiO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSBcIi4vRW50aXR5LmpzXCI7XG5pbXBvcnQgeyBPYmplY3RQb29sIH0gZnJvbSBcIi4vT2JqZWN0UG9vbC5qc1wiO1xuaW1wb3J0IFF1ZXJ5IGZyb20gXCIuL1F1ZXJ5LmpzXCI7XG5pbXBvcnQgeyBxdWVyeUtleSB9IGZyb20gXCIuL1V0aWxzLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBXb3JsZCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuc3lzdGVtTWFuYWdlciA9IG5ldyBTeXN0ZW1NYW5hZ2VyKHRoaXMpO1xuXG4gICAgdGhpcy5lbnRpdHlQb29sID0gbmV3IE9iamVjdFBvb2wobmV3IEVudGl0eSh0aGlzKSk7XG5cbiAgICB0aGlzLmVudGl0aWVzID0gW107XG4gICAgdGhpcy5lbnRpdGllc0J5VVVJRCA9IHt9O1xuXG4gICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUgPSBbXTtcbiAgICB0aGlzLmVudGl0aWVzVG9SZW1vdmUgPSBbXTtcbiAgICB0aGlzLmRlZmVycmVkUmVtb3ZhbEVuYWJsZWQgPSB0cnVlO1xuXG4gICAgdGhpcy5jb21wb25lbnRUeXBlcyA9IHt9O1xuICAgIHRoaXMuY29tcG9uZW50UG9vbHMgPSB7fTtcbiAgICB0aGlzLmNvbXBvbmVudENvdW50cyA9IHt9O1xuXG4gICAgdGhpcy5xdWVyaWVzID0ge307XG5cbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgaWYgKHR5cGVvZiBDdXN0b21FdmVudCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgdmFyIGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KFwiZWNzeS13b3JsZC1jcmVhdGVkXCIsIHtcbiAgICAgICAgZGV0YWlsOiB7IHdvcmxkOiB0aGlzLCB2ZXJzaW9uOiBWZXJzaW9uIH1cbiAgICAgIH0pO1xuICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuICAgIH1cblxuICAgIHRoaXMubGFzdFRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcblxuICAgIHRoaXMuaXNXb3JsZCA9IHRydWU7XG4gIH1cblxuICByZWdpc3RlckNvbXBvbmVudChDb21wb25lbnQsIG9iamVjdFBvb2wpIHtcbiAgICBpZiAodGhpcy5jb21wb25lbnRUeXBlc1tDb21wb25lbnQubmFtZV0pIHtcbiAgICAgIGNvbnNvbGUud2FybihgQ29tcG9uZW50IHR5cGU6ICcke0NvbXBvbmVudC5uYW1lfScgYWxyZWFkeSByZWdpc3RlcmVkLmApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgdGhpcy5jb21wb25lbnRUeXBlc1tDb21wb25lbnQubmFtZV0gPSBDb21wb25lbnQ7XG4gICAgdGhpcy5jb21wb25lbnRDb3VudHNbQ29tcG9uZW50Lm5hbWVdID0gMDtcblxuICAgIGlmIChvYmplY3RQb29sID09PSBmYWxzZSkge1xuICAgICAgb2JqZWN0UG9vbCA9IHVuZGVmaW5lZDtcbiAgICB9IGVsc2UgaWYgKG9iamVjdFBvb2wgPT09IHVuZGVmaW5lZCkge1xuICAgICAgb2JqZWN0UG9vbCA9IG5ldyBPYmplY3RQb29sKG5ldyBDb21wb25lbnQoKSk7XG4gICAgfVxuXG4gICAgdGhpcy5jb21wb25lbnRQb29sc1tDb21wb25lbnQubmFtZV0gPSBvYmplY3RQb29sO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICByZWdpc3RlclN5c3RlbShTeXN0ZW0sIGF0dHJpYnV0ZXMpIHtcbiAgICB0aGlzLnN5c3RlbU1hbmFnZXIucmVnaXN0ZXJTeXN0ZW0oU3lzdGVtLCBhdHRyaWJ1dGVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGNyZWF0ZUVudGl0eSgpIHtcbiAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmNyZWF0ZURldGFjaGVkRW50aXR5KCk7XG4gICAgcmV0dXJuIHRoaXMuYWRkRW50aXR5KGVudGl0eSk7XG4gIH1cblxuICBjcmVhdGVEZXRhY2hlZEVudGl0eSgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRpdHlQb29sLmFjcXVpcmUoKTtcbiAgfVxuXG4gIGFkZEVudGl0eShlbnRpdHkpIHtcbiAgICBpZiAodGhpcy5lbnRpdGllc0J5VVVJRFtlbnRpdHkudXVpZF0pIHtcbiAgICAgIGNvbnNvbGUud2FybihgRW50aXR5ICR7ZW50aXR5LnV1aWR9IGFscmVhZHkgYWRkZWQuYCk7XG4gICAgICByZXR1cm4gZW50aXR5O1xuICAgIH1cblxuICAgIHRoaXMuZW50aXRpZXNCeVVVSURbZW50aXR5LnV1aWRdID0gZW50aXR5O1xuICAgIHRoaXMuZW50aXRpZXMucHVzaChlbnRpdHkpO1xuICAgIGVudGl0eS5hbGl2ZSA9IHRydWU7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVudGl0eS5jb21wb25lbnRUeXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgQ29tcG9uZW50ID0gZW50aXR5LmNvbXBvbmVudFR5cGVzW2ldO1xuICAgICAgdGhpcy5vbkNvbXBvbmVudEFkZGVkKGVudGl0eSwgQ29tcG9uZW50KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW50aXR5O1xuICB9XG5cbiAgZ2V0RW50aXR5QnlVVUlEKHV1aWQpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRpdGllc0J5VVVJRFt1dWlkXTtcbiAgfVxuXG4gIGNyZWF0ZUNvbXBvbmVudChDb21wb25lbnQpIHtcbiAgICBjb25zdCBjb21wb25lbnRQb29sID0gdGhpcy5jb21wb25lbnRQb29sc1tDb21wb25lbnQubmFtZV07XG5cbiAgICBpZiAoY29tcG9uZW50UG9vbCkge1xuICAgICAgcmV0dXJuIGNvbXBvbmVudFBvb2wuYWNxdWlyZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgQ29tcG9uZW50KCk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQb29sKENvbXBvbmVudCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudFBvb2xzW0NvbXBvbmVudC5uYW1lXTtcbiAgfVxuXG4gIGdldFN5c3RlbShTeXN0ZW1DbGFzcykge1xuICAgIHJldHVybiB0aGlzLnN5c3RlbU1hbmFnZXIuZ2V0U3lzdGVtKFN5c3RlbUNsYXNzKTtcbiAgfVxuXG4gIGdldFN5c3RlbXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3lzdGVtTWFuYWdlci5nZXRTeXN0ZW1zKCk7XG4gIH1cblxuICBnZXRRdWVyeShDb21wb25lbnRzKSB7XG4gICAgY29uc3Qga2V5ID0gcXVlcnlLZXkoQ29tcG9uZW50cyk7XG4gICAgbGV0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW2tleV07XG5cbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICB0aGlzLnF1ZXJpZXNba2V5XSA9IHF1ZXJ5ID0gbmV3IFF1ZXJ5KENvbXBvbmVudHMsIHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiBxdWVyeTtcbiAgfVxuXG4gIG9uQ29tcG9uZW50QWRkZWQoZW50aXR5LCBDb21wb25lbnQpIHtcbiAgICBpZiAoIXRoaXMuY29tcG9uZW50VHlwZXNbQ29tcG9uZW50Lm5hbWVdKSB7XG4gICAgICBjb25zb2xlLndhcm4oYENvbXBvbmVudCAke0NvbXBvbmVudC5uYW1lfSBub3QgcmVnaXN0ZXJlZC5gKTtcbiAgICB9XG5cbiAgICB0aGlzLmNvbXBvbmVudENvdW50c1tDb21wb25lbnQubmFtZV0rKztcblxuICAgIC8vIENoZWNrIGVhY2ggaW5kZXhlZCBxdWVyeSB0byBzZWUgaWYgd2UgbmVlZCB0byBhZGQgdGhpcyBlbnRpdHkgdG8gdGhlIGxpc3RcbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Ob3RDb21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgcXVlcnkucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBBZGQgdGhlIGVudGl0eSBvbmx5IGlmOlxuICAgICAgLy8gQ29tcG9uZW50IGlzIGluIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBoYXMgQUxMIHRoZSBjb21wb25lbnRzIG9mIHRoZSBxdWVyeVxuICAgICAgLy8gYW5kIEVudGl0eSBpcyBub3QgYWxyZWFkeSBpbiB0aGUgcXVlcnlcbiAgICAgIGlmIChcbiAgICAgICAgIX5xdWVyeS5Db21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSB8fFxuICAgICAgICAhcXVlcnkubWF0Y2goZW50aXR5KSB8fFxuICAgICAgICB+cXVlcnkuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpXG4gICAgICApXG4gICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICBxdWVyeS5hZGRFbnRpdHkoZW50aXR5KTtcbiAgICB9XG4gIH1cblxuICBvbkNvbXBvbmVudENoYW5nZWQoZW50aXR5LCBDb21wb25lbnQsIGNvbXBvbmVudCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW50aXR5LnF1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBxdWVyeSA9IGVudGl0eS5xdWVyaWVzW2ldO1xuICAgICAgLy8gQHRvZG8gYWNjZWxlcmF0ZSB0aGlzIGNoZWNrLiBNYXliZSBoYXZpbmcgcXVlcnkuX0NvbXBvbmVudHMgYXMgYW4gb2JqZWN0XG4gICAgICBpZiAocXVlcnkucmVhY3RpdmUgJiYgcXVlcnkuQ29tcG9uZW50cy5pbmRleE9mKENvbXBvbmVudCkgIT09IC0xKSB7XG4gICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICBlbnRpdHksXG4gICAgICAgICAgY29tcG9uZW50XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcXVldWVDb21wb25lbnRSZW1vdmFsKGVudGl0eSkge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUuaW5kZXhPZihlbnRpdHkpO1xuXG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUucHVzaChlbnRpdHkpO1xuICAgIH1cbiAgfVxuXG4gIG9uUmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgQ29tcG9uZW50KSB7XG4gICAgdGhpcy5jb21wb25lbnRDb3VudHNbQ29tcG9uZW50Lm5hbWVdLS07XG5cbiAgICBmb3IgKHZhciBxdWVyeU5hbWUgaW4gdGhpcy5xdWVyaWVzKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKFxuICAgICAgICAhIX5xdWVyeS5Ob3RDb21wb25lbnRzLmluZGV4T2YoQ29tcG9uZW50KSAmJlxuICAgICAgICAhfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSAmJlxuICAgICAgICBxdWVyeS5tYXRjaChlbnRpdHkpXG4gICAgICApIHtcbiAgICAgICAgcXVlcnkuYWRkRW50aXR5KGVudGl0eSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgICEhfnF1ZXJ5LkNvbXBvbmVudHMuaW5kZXhPZihDb21wb25lbnQpICYmXG4gICAgICAgICEhfnF1ZXJ5LmVudGl0aWVzLmluZGV4T2YoZW50aXR5KSAmJlxuICAgICAgICAhcXVlcnkubWF0Y2goZW50aXR5KVxuICAgICAgKSB7XG4gICAgICAgIHF1ZXJ5LnJlbW92ZUVudGl0eShlbnRpdHkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBxdWV1ZUVudGl0eURpc3Bvc2FsKGVudGl0eSkge1xuICAgIHRoaXMuZW50aXRpZXNUb1JlbW92ZS5wdXNoKGVudGl0eSk7XG4gIH1cblxuICBvbkRpc3Bvc2VFbnRpdHkoZW50aXR5KSB7XG4gICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMucXVlcmllcykge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXTtcblxuICAgICAgaWYgKGVudGl0eS5xdWVyaWVzLmluZGV4T2YocXVlcnkpICE9PSAtMSkge1xuICAgICAgICBxdWVyeS5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkVudGl0eURpc3Bvc2VkKGVudGl0eSkge1xuICAgIGlmICghdGhpcy5lbnRpdGllc0J5VVVJRFtlbnRpdHkudXVpZF0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5lbnRpdGllc0J5VVVJRFtlbnRpdHkudXVpZF07XG5cbiAgICBjb25zdCBpbmRleCA9IHRoaXMuZW50aXRpZXMuaW5kZXhPZihlbnRpdHkpO1xuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgdGhpcy5lbnRpdGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbiAgfVxuXG4gIGV4ZWN1dGUoZGVsdGEsIHRpbWUpIHtcbiAgICBpZiAoIWRlbHRhKSB7XG4gICAgICBsZXQgdGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgZGVsdGEgPSB0aW1lIC0gdGhpcy5sYXN0VGltZTtcbiAgICAgIHRoaXMubGFzdFRpbWUgPSB0aW1lO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgIHRoaXMuc3lzdGVtTWFuYWdlci5leGVjdXRlKGRlbHRhLCB0aW1lKTtcblxuICAgICAgaWYgKCF0aGlzLmRlZmVycmVkUmVtb3ZhbEVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuZW50aXRpZXNUb1JlbW92ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgZW50aXR5ID0gdGhpcy5lbnRpdGllc1RvUmVtb3ZlW2ldO1xuICAgICAgICBlbnRpdHkuZGlzcG9zZSh0cnVlKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5lbnRpdGllc1RvUmVtb3ZlLmxlbmd0aCA9IDA7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5lbnRpdGllc1dpdGhDb21wb25lbnRzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IGVudGl0eSA9IHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlW2ldO1xuICAgICAgICBlbnRpdHkucHJvY2Vzc1JlbW92ZWRDb21wb25lbnRzKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZW50aXRpZXNXaXRoQ29tcG9uZW50c1RvUmVtb3ZlLmxlbmd0aCA9IDA7XG4gICAgfVxuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIHN0YXRzKCkge1xuICAgIHZhciBzdGF0cyA9IHtcbiAgICAgIGVudGl0aWVzOiB7XG4gICAgICAgIG51bUVudGl0aWVzOiB0aGlzLmVudGl0aWVzLmxlbmd0aCxcbiAgICAgICAgbnVtUXVlcmllczogT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5sZW5ndGgsXG4gICAgICAgIHF1ZXJpZXM6IHt9LFxuICAgICAgICBudW1Db21wb25lbnRQb29sOiBPYmplY3Qua2V5cyh0aGlzLmNvbXBvbmVudFBvb2xzKS5sZW5ndGgsXG4gICAgICAgIGNvbXBvbmVudFBvb2w6IHt9XG4gICAgICB9LFxuICAgICAgc3lzdGVtOiB0aGlzLnN5c3RlbU1hbmFnZXIuc3RhdHMoKVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IHF1ZXJ5TmFtZSBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICAgIHN0YXRzLnF1ZXJpZXNbcXVlcnlOYW1lXSA9IHRoaXMucXVlcmllc1txdWVyeU5hbWVdLnN0YXRzKCk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjb21wb25lbnROYW1lIGluIHRoaXMuY29tcG9uZW50UG9vbHMpIHtcbiAgICAgIGNvbnN0IHBvb2wgPSB0aGlzLmNvbXBvbmVudFBvb2xzW2NvbXBvbmVudE5hbWVdO1xuXG4gICAgICBzdGF0cy5jb21wb25lbnRQb29sW2NvbXBvbmVudE5hbWVdID0ge1xuICAgICAgICB1c2VkOiBwb29sLnRvdGFsVXNlZCgpLFxuICAgICAgICBzaXplOiBwb29sLmNvdW50XG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHN0YXRzLCBudWxsLCAyKSk7XG4gIH1cbn1cbiIsImltcG9ydCBRdWVyeSBmcm9tIFwiLi9RdWVyeS5qc1wiO1xuXG5leHBvcnQgY2xhc3MgU3lzdGVtIHtcbiAgY2FuRXhlY3V0ZSgpIHtcbiAgICBpZiAodGhpcy5fbWFuZGF0b3J5UXVlcmllcy5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcXVlcnkgPSB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzW2ldO1xuICAgICAgaWYgKHF1ZXJ5LmVudGl0aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcih3b3JsZCwgYXR0cmlidXRlcykge1xuICAgIHRoaXMud29ybGQgPSB3b3JsZDtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy8gQHRvZG8gQmV0dGVyIG5hbWluZyA6KVxuICAgIHRoaXMuX3F1ZXJpZXMgPSB7fTtcbiAgICB0aGlzLnF1ZXJpZXMgPSB7fTtcblxuICAgIHRoaXMucHJpb3JpdHkgPSAwO1xuXG4gICAgLy8gVXNlZCBmb3Igc3RhdHNcbiAgICB0aGlzLmV4ZWN1dGVUaW1lID0gMDtcblxuICAgIGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMucHJpb3JpdHkpIHtcbiAgICAgIHRoaXMucHJpb3JpdHkgPSBhdHRyaWJ1dGVzLnByaW9yaXR5O1xuICAgIH1cblxuICAgIHRoaXMuX21hbmRhdG9yeVF1ZXJpZXMgPSBbXTtcblxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgZm9yICh2YXIgcXVlcnlOYW1lIGluIHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgICB2YXIgcXVlcnlDb25maWcgPSB0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgdmFyIENvbXBvbmVudHMgPSBxdWVyeUNvbmZpZy5jb21wb25lbnRzO1xuICAgICAgICBpZiAoIUNvbXBvbmVudHMgfHwgQ29tcG9uZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCInY29tcG9uZW50cycgYXR0cmlidXRlIGNhbid0IGJlIGVtcHR5IGluIGEgcXVlcnlcIik7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHF1ZXJ5ID0gdGhpcy53b3JsZC5nZXRRdWVyeShDb21wb25lbnRzKTtcbiAgICAgICAgdGhpcy5fcXVlcmllc1txdWVyeU5hbWVdID0gcXVlcnk7XG4gICAgICAgIGlmIChxdWVyeUNvbmZpZy5tYW5kYXRvcnkgPT09IHRydWUpIHtcbiAgICAgICAgICB0aGlzLl9tYW5kYXRvcnlRdWVyaWVzLnB1c2gocXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucXVlcmllc1txdWVyeU5hbWVdID0ge1xuICAgICAgICAgIHJlc3VsdHM6IHF1ZXJ5LmVudGl0aWVzXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gUmVhY3RpdmUgY29uZmlndXJhdGlvbiBhZGRlZC9yZW1vdmVkL2NoYW5nZWRcbiAgICAgICAgdmFyIHZhbGlkRXZlbnRzID0gW1wiYWRkZWRcIiwgXCJyZW1vdmVkXCIsIFwiY2hhbmdlZFwiXTtcblxuICAgICAgICBjb25zdCBldmVudE1hcHBpbmcgPSB7XG4gICAgICAgICAgYWRkZWQ6IFF1ZXJ5LnByb3RvdHlwZS5FTlRJVFlfQURERUQsXG4gICAgICAgICAgcmVtb3ZlZDogUXVlcnkucHJvdG90eXBlLkVOVElUWV9SRU1PVkVELFxuICAgICAgICAgIGNoYW5nZWQ6IFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCAvLyBRdWVyeS5wcm90b3R5cGUuRU5USVRZX0NIQU5HRURcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocXVlcnlDb25maWcubGlzdGVuKSB7XG4gICAgICAgICAgdmFsaWRFdmVudHMuZm9yRWFjaChldmVudE5hbWUgPT4ge1xuICAgICAgICAgICAgLy8gSXMgdGhlIGV2ZW50IGVuYWJsZWQgb24gdGhpcyBzeXN0ZW0ncyBxdWVyeT9cbiAgICAgICAgICAgIGlmIChxdWVyeUNvbmZpZy5saXN0ZW5bZXZlbnROYW1lXSkge1xuICAgICAgICAgICAgICBsZXQgZXZlbnQgPSBxdWVyeUNvbmZpZy5saXN0ZW5bZXZlbnROYW1lXTtcblxuICAgICAgICAgICAgICBpZiAoZXZlbnROYW1lID09PSBcImNoYW5nZWRcIikge1xuICAgICAgICAgICAgICAgIHF1ZXJ5LnJlYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgIC8vIEFueSBjaGFuZ2Ugb24gdGhlIGVudGl0eSBmcm9tIHRoZSBjb21wb25lbnRzIGluIHRoZSBxdWVyeVxuICAgICAgICAgICAgICAgICAgbGV0IGV2ZW50TGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0gW10pO1xuICAgICAgICAgICAgICAgICAgcXVlcnkuZXZlbnREaXNwYXRjaGVyLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBBdm9pZCBkdXBsaWNhdGVzXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50TGlzdC5pbmRleE9mKGVudGl0eSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZXZlbnQpKSB7XG4gICAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKHRoaXMucXVlcmllc1txdWVyeU5hbWVdW2V2ZW50TmFtZV0gPSBbXSk7XG4gICAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgICAgUXVlcnkucHJvdG90eXBlLkNPTVBPTkVOVF9DSEFOR0VELFxuICAgICAgICAgICAgICAgICAgICAoZW50aXR5LCBjaGFuZ2VkQ29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gQXZvaWQgZHVwbGljYXRlc1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LmluZGV4T2YoY2hhbmdlZENvbXBvbmVudC5jb25zdHJ1Y3RvcikgIT09IC0xICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMVxuICAgICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICAvLyBDaGVja2luZyBqdXN0IHNwZWNpZmljIGNvbXBvbmVudHNcbiAgICAgICAgICAgICAgICAgIGxldCBjaGFuZ2VkTGlzdCA9ICh0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXVtldmVudE5hbWVdID0ge30pO1xuICAgICAgICAgICAgICAgICAgZXZlbnQuZm9yRWFjaChjb21wb25lbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKGNoYW5nZWRMaXN0W1xuICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5uYW1lXG4gICAgICAgICAgICAgICAgICAgIF0gPSBbXSk7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5LmV2ZW50RGlzcGF0Y2hlci5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgICAgICAgICAgIFF1ZXJ5LnByb3RvdHlwZS5DT01QT05FTlRfQ0hBTkdFRCxcbiAgICAgICAgICAgICAgICAgICAgICAoZW50aXR5LCBjaGFuZ2VkQ29tcG9uZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZWRDb21wb25lbnQuY29uc3RydWN0b3IgPT09IGNvbXBvbmVudCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudExpc3QuaW5kZXhPZihlbnRpdHkpID09PSAtMVxuICAgICAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50TGlzdC5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZXZlbnRMaXN0ID0gKHRoaXMucXVlcmllc1txdWVyeU5hbWVdW2V2ZW50TmFtZV0gPSBbXSk7XG5cbiAgICAgICAgICAgICAgICBxdWVyeS5ldmVudERpc3BhdGNoZXIuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgIGV2ZW50TWFwcGluZ1tldmVudE5hbWVdLFxuICAgICAgICAgICAgICAgICAgZW50aXR5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQGZpeG1lIG92ZXJoZWFkP1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnRMaXN0LmluZGV4T2YoZW50aXR5KSA9PT0gLTEpXG4gICAgICAgICAgICAgICAgICAgICAgZXZlbnRMaXN0LnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMuZXhlY3V0ZVRpbWUgPSAwO1xuICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICB9XG5cbiAgcGxheSgpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuICB9XG5cbiAgLy8gQHF1ZXN0aW9uIHJlbmFtZSB0byBjbGVhciBxdWV1ZXM/XG4gIGNsZWFyRXZlbnRzKCkge1xuICAgIGZvciAobGV0IHF1ZXJ5TmFtZSBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICAgIHZhciBxdWVyeSA9IHRoaXMucXVlcmllc1txdWVyeU5hbWVdO1xuICAgICAgaWYgKHF1ZXJ5LmFkZGVkKSB7XG4gICAgICAgIHF1ZXJ5LmFkZGVkLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkucmVtb3ZlZCkge1xuICAgICAgICBxdWVyeS5yZW1vdmVkLmxlbmd0aCA9IDA7XG4gICAgICB9XG4gICAgICBpZiAocXVlcnkuY2hhbmdlZCkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShxdWVyeS5jaGFuZ2VkKSkge1xuICAgICAgICAgIHF1ZXJ5LmNoYW5nZWQubGVuZ3RoID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmb3IgKGxldCBuYW1lIGluIHF1ZXJ5LmNoYW5nZWQpIHtcbiAgICAgICAgICAgIHF1ZXJ5LmNoYW5nZWRbbmFtZV0ubGVuZ3RoID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB0b0pTT04oKSB7XG4gICAgdmFyIGpzb24gPSB7XG4gICAgICBuYW1lOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBlbmFibGVkOiB0aGlzLmVuYWJsZWQsXG4gICAgICBleGVjdXRlVGltZTogdGhpcy5leGVjdXRlVGltZSxcbiAgICAgIHByaW9yaXR5OiB0aGlzLnByaW9yaXR5LFxuICAgICAgcXVlcmllczoge31cbiAgICB9O1xuXG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IucXVlcmllcykge1xuICAgICAgdmFyIHF1ZXJpZXMgPSB0aGlzLmNvbnN0cnVjdG9yLnF1ZXJpZXM7XG4gICAgICBmb3IgKGxldCBxdWVyeU5hbWUgaW4gcXVlcmllcykge1xuICAgICAgICBsZXQgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgbGV0IHF1ZXJ5RGVmaW5pdGlvbiA9IHF1ZXJpZXNbcXVlcnlOYW1lXTtcbiAgICAgICAgbGV0IGpzb25RdWVyeSA9IChqc29uLnF1ZXJpZXNbcXVlcnlOYW1lXSA9IHtcbiAgICAgICAgICBrZXk6IHRoaXMuX3F1ZXJpZXNbcXVlcnlOYW1lXS5rZXlcbiAgICAgICAgfSk7XG5cbiAgICAgICAganNvblF1ZXJ5Lm1hbmRhdG9yeSA9IHF1ZXJ5RGVmaW5pdGlvbi5tYW5kYXRvcnkgPT09IHRydWU7XG4gICAgICAgIGpzb25RdWVyeS5yZWFjdGl2ZSA9XG4gICAgICAgICAgcXVlcnlEZWZpbml0aW9uLmxpc3RlbiAmJlxuICAgICAgICAgIChxdWVyeURlZmluaXRpb24ubGlzdGVuLmFkZGVkID09PSB0cnVlIHx8XG4gICAgICAgICAgICBxdWVyeURlZmluaXRpb24ubGlzdGVuLnJlbW92ZWQgPT09IHRydWUgfHxcbiAgICAgICAgICAgIHF1ZXJ5RGVmaW5pdGlvbi5saXN0ZW4uY2hhbmdlZCA9PT0gdHJ1ZSB8fFxuICAgICAgICAgICAgQXJyYXkuaXNBcnJheShxdWVyeURlZmluaXRpb24ubGlzdGVuLmNoYW5nZWQpKTtcblxuICAgICAgICBpZiAoanNvblF1ZXJ5LnJlYWN0aXZlKSB7XG4gICAgICAgICAganNvblF1ZXJ5Lmxpc3RlbiA9IHt9O1xuXG4gICAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcImFkZGVkXCIsIFwicmVtb3ZlZFwiLCBcImNoYW5nZWRcIl07XG4gICAgICAgICAgbWV0aG9kcy5mb3JFYWNoKG1ldGhvZCA9PiB7XG4gICAgICAgICAgICBpZiAocXVlcnlbbWV0aG9kXSkge1xuICAgICAgICAgICAgICBqc29uUXVlcnkubGlzdGVuW21ldGhvZF0gPSB7XG4gICAgICAgICAgICAgICAgZW50aXRpZXM6IHF1ZXJ5W21ldGhvZF0ubGVuZ3RoXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ganNvbjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gTm90KENvbXBvbmVudCkge1xuICByZXR1cm4ge1xuICAgIG9wZXJhdG9yOiBcIm5vdFwiLFxuICAgIENvbXBvbmVudDogQ29tcG9uZW50XG4gIH07XG59XG4iLCIvLyBUT0RPOiBUaGUgZGVmYXVsdCBjbG9uZSBhbmQgY29weSBjYW4gYmUgbWFkZSBmYXN0ZXIgYnlcbi8vIGdlbmVyYXRpbmcgY2xvbmUvY29weSBmdW5jdGlvbnMgYXQgQ29tcG9uZW50IHJlZ2lzdHJhdGlvbiB0aW1lXG5leHBvcnQgY2xhc3MgQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmNvbnN0cnVjdG9yLnNjaGVtYTtcblxuICAgIGZvciAoY29uc3Qga2V5IGluIHNjaGVtYSkge1xuICAgICAgY29uc3Qgc2NoZW1hUHJvcCA9IHNjaGVtYVtrZXldO1xuXG4gICAgICBpZiAocHJvcHMgJiYgcHJvcHMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICB0aGlzW2tleV0gPSBwcm9wc1trZXldO1xuICAgICAgfSBlbHNlIGlmIChzY2hlbWFQcm9wLmhhc093blByb3BlcnR5KFwiZGVmYXVsdFwiKSkge1xuICAgICAgICB0aGlzW2tleV0gPSBzY2hlbWFQcm9wLnR5cGUuY2xvbmUoc2NoZW1hUHJvcC5kZWZhdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBzY2hlbWFQcm9wLnR5cGU7XG4gICAgICAgIHRoaXNba2V5XSA9IHR5cGUuY2xvbmUodHlwZS5kZWZhdWx0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9wb29sID0gbnVsbDtcbiAgfVxuXG4gIGNvcHkoc291cmNlKSB7XG4gICAgY29uc3Qgc2NoZW1hID0gdGhpcy5jb25zdHJ1Y3Rvci5zY2hlbWE7XG5cbiAgICBmb3IgKGNvbnN0IGtleSBpbiBzb3VyY2UpIHtcbiAgICAgIGlmIChzY2hlbWEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICBjb25zdCBwcm9wID0gc2NoZW1hW2tleV07XG4gICAgICAgIHByb3AudHlwZS5jb3B5KHNvdXJjZSwgdGhpcywga2V5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGNsb25lKCkge1xuICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcigpLmNvcHkodGhpcyk7XG4gIH1cblxuICBkaXNwb3NlKCkge1xuICAgIGlmICh0aGlzLl9wb29sKSB7XG4gICAgICB0aGlzLl9wb29sLnJlbGVhc2UodGhpcyk7XG4gICAgfVxuICB9XG59XG5cbkNvbXBvbmVudC5zY2hlbWEgPSB7fTtcbkNvbXBvbmVudC5pc0NvbXBvbmVudCA9IHRydWU7XG4iLCJpbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tIFwiLi9Db21wb25lbnRcIjtcblxuZXhwb3J0IGNsYXNzIFN5c3RlbVN0YXRlQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG4gICAgdGhpcy5pc1N5c3RlbVN0YXRlQ29tcG9uZW50ID0gdHJ1ZTtcbiAgfVxufVxuXG5TeXN0ZW1TdGF0ZUNvbXBvbmVudC5pc1N5c3RlbVN0YXRlQ29tcG9uZW50ID0gdHJ1ZTtcbiIsImltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gXCIuL0NvbXBvbmVudFwiO1xuXG5leHBvcnQgY2xhc3MgVGFnQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmlzVGFnQ29tcG9uZW50ID0gdHJ1ZTtcbiAgfVxufVxuXG5UYWdDb21wb25lbnQuaXNUYWdDb21wb25lbnQgPSB0cnVlO1xuIiwiZXhwb3J0IGNvbnN0IGNvcHlWYWx1ZSA9IChzcmMsIGRlc3QsIGtleSkgPT4gKGRlc3Rba2V5XSA9IHNyY1trZXldKTtcblxuZXhwb3J0IGNvbnN0IGNsb25lVmFsdWUgPSBzcmMgPT4gc3JjO1xuXG5leHBvcnQgY29uc3QgY29weUFycmF5ID0gKHNyYywgZGVzdCwga2V5KSA9PiB7XG4gIGNvbnN0IHNyY0FycmF5ID0gc3JjW2tleV07XG4gIGNvbnN0IGRlc3RBcnJheSA9IGRlc3Rba2V5XTtcblxuICBkZXN0QXJyYXkubGVuZ3RoID0gMDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHNyY0FycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgZGVzdEFycmF5LnB1c2goc3JjQXJyYXlbaV0pO1xuICB9XG5cbiAgcmV0dXJuIGRlc3RBcnJheTtcbn07XG5cbmV4cG9ydCBjb25zdCBjbG9uZUFycmF5ID0gc3JjID0+IHNyYy5zbGljZSgpO1xuXG5leHBvcnQgY29uc3QgY29weUpTT04gPSAoc3JjLCBkZXN0LCBrZXkpID0+XG4gIChkZXN0W2tleV0gPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHNyY1trZXldKSkpO1xuXG5leHBvcnQgY29uc3QgY2xvbmVKU09OID0gc3JjID0+IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoc3JjKSk7XG5cbmV4cG9ydCBjb25zdCBjb3B5Q29weWFibGUgPSAoc3JjLCBkZXN0LCBrZXkpID0+IGRlc3Rba2V5XS5jb3B5KHNyY1trZXldKTtcblxuZXhwb3J0IGNvbnN0IGNsb25lQ2xvbmFibGUgPSBzcmMgPT4gc3JjLmNsb25lKCk7XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVUeXBlID0gKGRlZmF1bHRWYWx1ZSwgY2xvbmUsIGNvcHkpID0+ICh7XG4gIGRlZmF1bHQ6IGRlZmF1bHRWYWx1ZSxcbiAgY2xvbmUsXG4gIGNvcHlcbn0pO1xuXG5leHBvcnQgY29uc3QgUHJvcFR5cGVzID0ge1xuICBOdW1iZXI6IHsgZGVmYXVsdDogMCwgY2xvbmU6IGNsb25lVmFsdWUsIGNvcHk6IGNvcHlWYWx1ZSB9LFxuICBCb29sZWFuOiB7IGRlZmF1bHQ6IGZhbHNlLCBjbG9uZTogY2xvbmVWYWx1ZSwgY29weTogY29weVZhbHVlIH0sXG4gIFN0cmluZzogeyBkZWZhdWx0OiBcIlwiLCBjbG9uZTogY2xvbmVWYWx1ZSwgY29weTogY29weVZhbHVlIH0sXG4gIE9iamVjdDogeyBkZWZhdWx0OiB1bmRlZmluZWQsIGNsb25lOiBjbG9uZVZhbHVlLCBjb3B5OiBjb3B5VmFsdWUgfSxcbiAgQXJyYXk6IHsgZGVmYXVsdDogW10sIGNsb25lOiBjbG9uZUFycmF5LCBjb3B5OiBjb3B5QXJyYXkgfSxcbiAgSlNPTjogeyBkZWZhdWx0OiBudWxsLCBjbG9uZTogY2xvbmVKU09OLCBjb3B5OiBjb3B5SlNPTiB9XG59O1xuIiwiZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlSWQobGVuZ3RoKSB7XG4gIHZhciByZXN1bHQgPSBcIlwiO1xuICB2YXIgY2hhcmFjdGVycyA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5XCI7XG4gIHZhciBjaGFyYWN0ZXJzTGVuZ3RoID0gY2hhcmFjdGVycy5sZW5ndGg7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICByZXN1bHQgKz0gY2hhcmFjdGVycy5jaGFyQXQoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2hhcmFjdGVyc0xlbmd0aCkpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTY3JpcHQoc3JjLCBvbkxvYWQpIHtcbiAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gIC8vIEB0b2RvIFVzZSBsaW5rIHRvIHRoZSBlY3N5LWRldnRvb2xzIHJlcG8/XG4gIHNjcmlwdC5zcmMgPSBzcmM7XG4gIHNjcmlwdC5vbmxvYWQgPSBvbkxvYWQ7XG4gIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbn1cbiIsIi8qIGdsb2JhbCBQZWVyICovXG5pbXBvcnQgeyBpbmplY3RTY3JpcHQsIGdlbmVyYXRlSWQgfSBmcm9tIFwiLi91dGlscy5qc1wiO1xuXG5mdW5jdGlvbiBob29rQ29uc29sZUFuZEVycm9ycyhjb25uZWN0aW9uKSB7XG4gIHZhciB3cmFwRnVuY3Rpb25zID0gW1wiZXJyb3JcIiwgXCJ3YXJuaW5nXCIsIFwibG9nXCJdO1xuICB3cmFwRnVuY3Rpb25zLmZvckVhY2goa2V5ID0+IHtcbiAgICBpZiAodHlwZW9mIGNvbnNvbGVba2V5XSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB2YXIgZm4gPSBjb25zb2xlW2tleV0uYmluZChjb25zb2xlKTtcbiAgICAgIGNvbnNvbGVba2V5XSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGNvbm5lY3Rpb24uc2VuZCh7XG4gICAgICAgICAgbWV0aG9kOiBcImNvbnNvbGVcIixcbiAgICAgICAgICB0eXBlOiBrZXksXG4gICAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoYXJncylcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH07XG4gICAgfVxuICB9KTtcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImVycm9yXCIsIGVycm9yID0+IHtcbiAgICBjb25uZWN0aW9uLnNlbmQoe1xuICAgICAgbWV0aG9kOiBcImVycm9yXCIsXG4gICAgICBlcnJvcjogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBtZXNzYWdlOiBlcnJvci5lcnJvci5tZXNzYWdlLFxuICAgICAgICBzdGFjazogZXJyb3IuZXJyb3Iuc3RhY2tcbiAgICAgIH0pXG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpbmNsdWRlUmVtb3RlSWRIVE1MKHJlbW90ZUlkKSB7XG4gIGxldCBpbmZvRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgaW5mb0Rpdi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgYmFja2dyb3VuZC1jb2xvcjogIzMzMztcbiAgICBjb2xvcjogI2FhYTtcbiAgICBkaXNwbGF5OmZsZXg7XG4gICAgZm9udC1mYW1pbHk6IEFyaWFsO1xuICAgIGZvbnQtc2l6ZTogMS4xZW07XG4gICAgaGVpZ2h0OiA0MHB4O1xuICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIGxlZnQ6IDA7XG4gICAgb3BhY2l0eTogMC45O1xuICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICByaWdodDogMDtcbiAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgdG9wOiAwO1xuICBgO1xuXG4gIGluZm9EaXYuaW5uZXJIVE1MID0gYE9wZW4gRUNTWSBkZXZ0b29scyB0byBjb25uZWN0IHRvIHRoaXMgcGFnZSB1c2luZyB0aGUgY29kZTombmJzcDs8YiBzdHlsZT1cImNvbG9yOiAjZmZmXCI+JHtyZW1vdGVJZH08L2I+Jm5ic3A7PGJ1dHRvbiBvbkNsaWNrPVwiZ2VuZXJhdGVOZXdDb2RlKClcIj5HZW5lcmF0ZSBuZXcgY29kZTwvYnV0dG9uPmA7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaW5mb0Rpdik7XG5cbiAgcmV0dXJuIGluZm9EaXY7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVSZW1vdGVEZXZ0b29scyhyZW1vdGVJZCkge1xuICB3aW5kb3cuZ2VuZXJhdGVOZXdDb2RlID0gKCkgPT4ge1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2UuY2xlYXIoKTtcbiAgICByZW1vdGVJZCA9IGdlbmVyYXRlSWQoNik7XG4gICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiZWNzeVJlbW90ZUlkXCIsIHJlbW90ZUlkKTtcbiAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKGZhbHNlKTtcbiAgfTtcblxuICByZW1vdGVJZCA9IHJlbW90ZUlkIHx8IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImVjc3lSZW1vdGVJZFwiKTtcbiAgaWYgKCFyZW1vdGVJZCkge1xuICAgIHJlbW90ZUlkID0gZ2VuZXJhdGVJZCg2KTtcbiAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJlY3N5UmVtb3RlSWRcIiwgcmVtb3RlSWQpO1xuICB9XG5cbiAgbGV0IGluZm9EaXYgPSBpbmNsdWRlUmVtb3RlSWRIVE1MKHJlbW90ZUlkKTtcblxuICB3aW5kb3cuX19FQ1NZX1JFTU9URV9ERVZUT09MU19JTkpFQ1RFRCA9IHRydWU7XG4gIHdpbmRvdy5fX0VDU1lfUkVNT1RFX0RFVlRPT0xTID0ge307XG5cbiAgbGV0IFZlcnNpb24gPSBcIlwiO1xuXG4gIC8vIFRoaXMgaXMgdXNlZCB0byBjb2xsZWN0IHRoZSB3b3JsZHMgY3JlYXRlZCBiZWZvcmUgdGhlIGNvbW11bmljYXRpb24gaXMgYmVpbmcgZXN0YWJsaXNoZWRcbiAgbGV0IHdvcmxkc0JlZm9yZUxvYWRpbmcgPSBbXTtcbiAgbGV0IG9uV29ybGRDcmVhdGVkID0gZSA9PiB7XG4gICAgdmFyIHdvcmxkID0gZS5kZXRhaWwud29ybGQ7XG4gICAgVmVyc2lvbiA9IGUuZGV0YWlsLnZlcnNpb247XG4gICAgd29ybGRzQmVmb3JlTG9hZGluZy5wdXNoKHdvcmxkKTtcbiAgfTtcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJlY3N5LXdvcmxkLWNyZWF0ZWRcIiwgb25Xb3JsZENyZWF0ZWQpO1xuXG4gIGxldCBvbkxvYWRlZCA9ICgpID0+IHtcbiAgICB2YXIgcGVlciA9IG5ldyBQZWVyKHJlbW90ZUlkKTtcbiAgICBwZWVyLm9uKFwib3BlblwiLCAoLyogaWQgKi8pID0+IHtcbiAgICAgIHBlZXIub24oXCJjb25uZWN0aW9uXCIsIGNvbm5lY3Rpb24gPT4ge1xuICAgICAgICB3aW5kb3cuX19FQ1NZX1JFTU9URV9ERVZUT09MUy5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcbiAgICAgICAgY29ubmVjdGlvbi5vbihcIm9wZW5cIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgLy8gaW5mb0Rpdi5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIjtcbiAgICAgICAgICBpbmZvRGl2LmlubmVySFRNTCA9IFwiQ29ubmVjdGVkXCI7XG5cbiAgICAgICAgICAvLyBSZWNlaXZlIG1lc3NhZ2VzXG4gICAgICAgICAgY29ubmVjdGlvbi5vbihcImRhdGFcIiwgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgaWYgKGRhdGEudHlwZSA9PT0gXCJpbml0XCIpIHtcbiAgICAgICAgICAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gICAgICAgICAgICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwidGV4dC9qYXZhc2NyaXB0XCIpO1xuICAgICAgICAgICAgICBzY3JpcHQub25sb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG5cbiAgICAgICAgICAgICAgICAvLyBPbmNlIHRoZSBzY3JpcHQgaXMgaW5qZWN0ZWQgd2UgZG9uJ3QgbmVlZCB0byBsaXN0ZW5cbiAgICAgICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgICAgICAgIFwiZWNzeS13b3JsZC1jcmVhdGVkXCIsXG4gICAgICAgICAgICAgICAgICBvbldvcmxkQ3JlYXRlZFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgd29ybGRzQmVmb3JlTG9hZGluZy5mb3JFYWNoKHdvcmxkID0+IHtcbiAgICAgICAgICAgICAgICAgIHZhciBldmVudCA9IG5ldyBDdXN0b21FdmVudChcImVjc3ktd29ybGQtY3JlYXRlZFwiLCB7XG4gICAgICAgICAgICAgICAgICAgIGRldGFpbDogeyB3b3JsZDogd29ybGQsIHZlcnNpb246IFZlcnNpb24gfVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHNjcmlwdC5pbm5lckhUTUwgPSBkYXRhLnNjcmlwdDtcbiAgICAgICAgICAgICAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzY3JpcHQpO1xuICAgICAgICAgICAgICBzY3JpcHQub25sb2FkKCk7XG5cbiAgICAgICAgICAgICAgaG9va0NvbnNvbGVBbmRFcnJvcnMoY29ubmVjdGlvbik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEudHlwZSA9PT0gXCJleGVjdXRlU2NyaXB0XCIpIHtcbiAgICAgICAgICAgICAgbGV0IHZhbHVlID0gZXZhbChkYXRhLnNjcmlwdCk7XG4gICAgICAgICAgICAgIGlmIChkYXRhLnJldHVybkV2YWwpIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0aW9uLnNlbmQoe1xuICAgICAgICAgICAgICAgICAgbWV0aG9kOiBcImV2YWxSZXR1cm5cIixcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gSW5qZWN0IFBlZXJKUyBzY3JpcHRcbiAgaW5qZWN0U2NyaXB0KFxuICAgIFwiaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L25wbS9wZWVyanNAMC4zLjIwL2Rpc3QvcGVlci5taW4uanNcIixcbiAgICBvbkxvYWRlZFxuICApO1xufVxuXG5jb25zdCB1cmxQYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuXG4vLyBAdG9kbyBQcm92aWRlIGEgd2F5IHRvIGRpc2FibGUgaXQgaWYgbmVlZGVkXG5pZiAodXJsUGFyYW1zLmhhcyhcImVuYWJsZS1yZW1vdGUtZGV2dG9vbHNcIikpIHtcbiAgZW5hYmxlUmVtb3RlRGV2dG9vbHMoKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztDQUFPLE1BQU0sYUFBYSxDQUFDO0NBQzNCLEVBQUUsV0FBVyxDQUFDLEtBQUssRUFBRTtDQUNyQixJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO0NBQ3ZCLElBQUksSUFBSSxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUM7Q0FDOUIsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztDQUN2QixJQUFJLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7Q0FDbkMsR0FBRztBQUNIO0NBQ0EsRUFBRSxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRTtDQUNyQyxJQUFJO0NBQ0osTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVM7Q0FDL0UsTUFBTTtDQUNOLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQztDQUNsRSxNQUFNLE9BQU8sSUFBSSxDQUFDO0NBQ2xCLEtBQUs7QUFDTDtDQUNBLElBQUksSUFBSSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztDQUNwRCxJQUFJLElBQUksTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7Q0FDbkMsSUFBSSxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO0NBQ3hDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Q0FDL0IsSUFBSSxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDeEIsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUN4QyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztDQUN6QixLQUFLO0NBQ0wsSUFBSSxPQUFPLElBQUksQ0FBQztDQUNoQixHQUFHO0FBQ0g7Q0FDQSxFQUFFLFdBQVcsR0FBRztDQUNoQixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSztDQUN4QyxNQUFNLE9BQU8sQ0FBQyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztDQUMxRCxLQUFLLENBQUMsQ0FBQztDQUNQLEdBQUc7QUFDSDtDQUNBLEVBQUUsU0FBUyxDQUFDLE1BQU0sRUFBRTtDQUNwQixJQUFJLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxNQUFNLENBQUMsQ0FBQztDQUN4RCxHQUFHO0FBQ0g7Q0FDQSxFQUFFLFVBQVUsR0FBRztDQUNmLElBQUksT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0NBQ3pCLEdBQUc7QUFDSDtDQUNBLEVBQUUsWUFBWSxDQUFDLE1BQU0sRUFBRTtDQUN2QixJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQzlDLElBQUksSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLE9BQU87QUFDeEI7Q0FDQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztDQUNuQyxHQUFHO0FBQ0g7Q0FDQSxFQUFFLGFBQWEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtDQUNyQyxJQUFJLElBQUksTUFBTSxDQUFDLFdBQVcsRUFBRTtDQUM1QixNQUFNLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxFQUFFO0NBQy9CLFFBQVEsSUFBSSxTQUFTLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDO0NBQzFDLFFBQVEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7Q0FDcEMsUUFBUSxNQUFNLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxTQUFTLENBQUM7Q0FDM0QsUUFBUSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsTUFBTSxDQUFDO0NBQ3pDLFFBQVEsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO0NBQzdCLE9BQU87Q0FDUCxLQUFLO0NBQ0wsR0FBRztBQUNIO0NBQ0EsRUFBRSxJQUFJLEdBQUc7Q0FDVCxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztDQUMxRCxHQUFHO0FBQ0g7Q0FDQSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtDQUNsQyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTztDQUNoQyxNQUFNLE1BQU07Q0FDWixRQUFRLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQztDQUNoRixLQUFLLENBQUM7Q0FDTixHQUFHO0FBQ0g7Q0FDQSxFQUFFLEtBQUssR0FBRztDQUNWLElBQUksSUFBSSxLQUFLLEdBQUc7Q0FDaEIsTUFBTSxVQUFVLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNO0NBQ3RDLE1BQU0sT0FBTyxFQUFFLEVBQUU7Q0FDakIsS0FBSyxDQUFDO0FBQ047Q0FDQSxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUNuRCxNQUFNLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEMsTUFBTSxJQUFJLFdBQVcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUc7Q0FDbEUsUUFBUSxPQUFPLEVBQUUsRUFBRTtDQUNuQixPQUFPLENBQUMsQ0FBQztDQUNULE1BQU0sS0FBSyxJQUFJLElBQUksSUFBSSxNQUFNLENBQUMsR0FBRyxFQUFFO0NBQ25DLFFBQVEsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO0NBQzdELE9BQU87Q0FDUCxLQUFLO0FBQ0w7Q0FDQSxJQUFJLE9BQU8sS0FBSyxDQUFDO0NBQ2pCLEdBQUc7Q0FDSDs7QUN6RlksT0FBQyxPQUFPLEdBQUcsT0FBTzs7Q0NBOUI7Q0FDQTtDQUNBO0NBQ0E7QUFDQSxDQUFlLE1BQU0sZUFBZSxDQUFDO0NBQ3JDLEVBQUUsV0FBVyxHQUFHO0NBQ2hCLElBQUksSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7Q0FDekIsSUFBSSxJQUFJLENBQUMsS0FBSyxHQUFHO0NBQ2pCLE1BQU0sS0FBSyxFQUFFLENBQUM7Q0FDZCxNQUFNLE9BQU8sRUFBRSxDQUFDO0NBQ2hCLEtBQUssQ0FBQztDQUNOLEdBQUc7QUFDSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUU7Q0FDeEMsSUFBSSxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0NBQ3BDLElBQUksSUFBSSxTQUFTLENBQUMsU0FBUyxDQUFDLEtBQUssU0FBUyxFQUFFO0NBQzVDLE1BQU0sU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztDQUNoQyxLQUFLO0FBQ0w7Q0FDQSxJQUFJLElBQUksU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtDQUN2RCxNQUFNLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Q0FDMUMsS0FBSztDQUNMLEdBQUc7QUFDSDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUU7Q0FDeEMsSUFBSTtDQUNKLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxTQUFTO0NBQzlDLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQ3pELE1BQU07Q0FDTixHQUFHO0FBQ0g7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFO0NBQzNDLElBQUksSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztDQUNuRCxJQUFJLElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRTtDQUNyQyxNQUFNLElBQUksS0FBSyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Q0FDbEQsTUFBTSxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRTtDQUN4QixRQUFRLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQ3ZDLE9BQU87Q0FDUCxLQUFLO0NBQ0wsR0FBRztBQUNIO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxhQUFhLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUU7Q0FDOUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQ3ZCO0NBQ0EsSUFBSSxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQ25ELElBQUksSUFBSSxhQUFhLEtBQUssU0FBUyxFQUFFO0NBQ3JDLE1BQU0sSUFBSSxLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6QztDQUNBLE1BQU0sS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Q0FDN0MsUUFBUSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7Q0FDL0MsT0FBTztDQUNQLEtBQUs7Q0FDTCxHQUFHO0FBQ0g7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxFQUFFLGFBQWEsR0FBRztDQUNsQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztDQUM5QyxHQUFHO0NBQ0gsQ0FBQzs7Q0NqRkQ7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtBQUNBLENBQU8sU0FBUyxRQUFRLENBQUMsVUFBVSxFQUFFO0NBQ3JDLEVBQUUsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO0NBQ2pCLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Q0FDOUMsSUFBSSxJQUFJLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDMUIsSUFBSSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsRUFBRTtDQUMvQixNQUFNLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLEtBQUssS0FBSyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDO0NBQzdELE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUM5QyxLQUFLLE1BQU07Q0FDWCxNQUFNLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ3pCLEtBQUs7Q0FDTCxHQUFHO0FBQ0g7Q0FDQSxFQUFFLE9BQU8sS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUNoQyxDQUFDO0FBQ0Q7Q0FDQSxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7QUFDZDtDQUNBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Q0FDOUIsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUNqRCxDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0FBQ0EsQ0FBTyxTQUFTLFlBQVksR0FBRztDQUMvQjtBQUNBO0NBQ0EsRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsVUFBVSxHQUFHLENBQUMsQ0FBQztDQUMxQyxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxVQUFVLEdBQUcsQ0FBQyxDQUFDO0NBQzFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLFVBQVUsR0FBRyxDQUFDLENBQUM7Q0FDMUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsVUFBVSxHQUFHLENBQUMsQ0FBQztDQUMxQyxFQUFFLElBQUksSUFBSSxHQUFHLElBQUksRUFBRSxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsR0FBRztDQUNqSCxJQUFJLElBQUksRUFBRSxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJLEVBQUUsR0FBRyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsR0FBRyxJQUFJLEVBQUUsR0FBRyxHQUFHO0NBQ3JILElBQUksSUFBSSxFQUFFLEVBQUUsR0FBRyxJQUFJLEdBQUcsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksRUFBRSxHQUFHLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksRUFBRTtDQUMvRyxJQUFJLElBQUksRUFBRSxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxFQUFFLENBQUM7QUFDbkc7Q0FDQTtDQUNBLEVBQUUsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7Q0FDNUIsQ0FBQzs7Q0N2Q2MsTUFBTSxLQUFLLENBQUM7Q0FDM0I7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxXQUFXLENBQUMsVUFBVSxFQUFFLEtBQUssRUFBRTtDQUNqQyxJQUFJLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO0NBQ3pCLElBQUksSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7QUFDNUI7Q0FDQSxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxJ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
