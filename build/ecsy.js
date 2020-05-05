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

	var name = "ecsy";
	var version = "0.2.2";
	var description = "Entity Component System in JS";
	var main = "build/ecsy.js";
	var module = "build/ecsy.module.js";
	var types = "src/index.d.ts";
	var scripts = {
		build: "rollup -c && npm run docs",
		docs: "rm docs/api/_sidebar.md; typedoc --readme none --mode file --excludeExternals --plugin typedoc-plugin-markdown  --theme docs/theme --hideSources --hideBreadcrumbs --out docs/api/ --includeDeclarations --includes 'src/**/*.d.ts' src; touch docs/api/_sidebar.md",
		"dev:docs": "nodemon -e ts -x 'npm run docs' -w src",
		dev: "concurrently --names 'ROLLUP,DOCS,HTTP' -c 'bgBlue.bold,bgYellow.bold,bgGreen.bold' 'rollup -c -w -m inline' 'npm run dev:docs' 'npm run dev:server'",
		"dev:server": "http-server -c-1 -p 8080 --cors",
		lint: "eslint src test examples",
		start: "npm run dev",
		test: "ava",
		travis: "npm run lint && npm run test && npm run build",
		"watch:test": "ava --watch"
	};
	var repository = {
		type: "git",
		url: "git+https://github.com/fernandojsg/ecsy.git"
	};
	var keywords = [
		"ecs",
		"entity component system"
	];
	var author = "Fernando Serrano <fernandojsg@gmail.com> (http://fernandojsg.com)";
	var license = "MIT";
	var bugs = {
		url: "https://github.com/fernandojsg/ecsy/issues"
	};
	var ava = {
		files: [
			"test/**/*.test.js"
		],
		sources: [
			"src/**/*.js"
		],
		require: [
			"babel-register",
			"esm"
		]
	};
	var jspm = {
		files: [
			"package.json",
			"LICENSE",
			"README.md",
			"build/ecsy.js",
			"build/ecsy.min.js",
			"build/ecsy.module.js"
		],
		directories: {
		}
	};
	var homepage = "https://github.com/fernandojsg/ecsy#readme";
	var devDependencies = {
		ava: "^1.4.1",
		"babel-cli": "^6.26.0",
		"babel-core": "^6.26.3",
		"babel-eslint": "^10.0.3",
		"babel-loader": "^8.0.6",
		concurrently: "^4.1.2",
		"docsify-cli": "^4.4.0",
		eslint: "^5.16.0",
		"eslint-config-prettier": "^4.3.0",
		"eslint-plugin-prettier": "^3.1.2",
		"http-server": "^0.11.1",
		nodemon: "^1.19.4",
		prettier: "^1.19.1",
		rollup: "^1.29.0",
		"rollup-plugin-json": "^4.0.0",
		"rollup-plugin-terser": "^5.2.0",
		typedoc: "^0.15.8",
		"typedoc-plugin-markdown": "^2.2.16",
		typescript: "^3.7.5"
	};
	var pjson = {
		name: name,
		version: version,
		description: description,
		main: main,
		"jsnext:main": "build/ecsy.module.js",
		module: module,
		types: types,
		scripts: scripts,
		repository: repository,
		keywords: keywords,
		author: author,
		license: license,
		bugs: bugs,
		ava: ava,
		jspm: jspm,
		homepage: homepage,
		devDependencies: devDependencies
	};

	// TODO: Inject this into the build instead of including the package.json
	const Version = pjson.version;

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

	for ( let i = 0; i < 256; i ++ ) {

		_lut[ i ] = ( i < 16 ? '0' : '' ) + ( i ).toString( 16 );

	}

	// https://github.com/mrdoob/three.js/blob/dev/src/math/MathUtils.js#L21
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
	  constructor(Components, manager) {
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
	    for (var i = 0; i < manager._entities.length; i++) {
	      var entity = manager._entities[i];
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

	 const EntityState = {
	   detached: "detached",
	   active: "active",
	   removed: "removed",
	   dead: "dead"
	 };

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

	    var componentPool = this.world.getComponentPool(
	      Component
	    );

	    var component = componentPool.acquire();

	    this.components[Component.name] = component;

	    if (props) {
	      component.copy(props);
	    }

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
	    const component = this.components[componentName];

	    if (!component) {
	      return false;
	    }

	    if (!this._componentsToRemove[componentName]) {
	      delete this.components[componentName];

	      const index = this.componentTypes.findIndex(Component);
	      this.componentTypes.splice(index, 1);

	      this.world.onRemoveComponent(this, Component);
	    }
	    

	    if (immediately) {
	      component.dispose();

	      if (this._componentsToRemove[componentName]) {
	        delete this._componentsToRemove[componentName];
	        const index = this._componentTypesToRemove.findIndex(Component);
	        this._componentTypesToRemove.splice(index, 1);
	      }
	    } else {
	      this._componentTypesToRemove.push(Component);
	      this._componentsToRemove[componentName] = component;
	      this.world.queueComponentRemoval(this, Component);
	    }

	    if (Component.isSystemStateComponent) {
	      this._numSystemStateComponents--;

	      // Check if the entity was a ghost waiting for the last system state component to be removed
	      if (this._numSystemStateComponents === 0 && !entity.alive) {
	        this.dispose();
	      }
	    }

	    return true;
	  }

	  processRemovedComponents() {
	    while (this.componentTypesToRemove.length > 0) {
	      let Component = this.componentTypesToRemove.pop();
	      this.removeComponent(Component, true);
	    }
	  }

	  removeAllComponents(immediately) {
	    let Components = entity.componentTypes;

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

	const ENTITY_CREATED = "ENTITY_CREATED";
	const COMPONENT_ADDED = "COMPONENT_ADDED";

	class World extends EventDispatcher {
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
	      objectPool = null;
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
	    return this.addEntity(entity)
	  }

	  createDetachedEntity() {
	    return this.entityPool.acquire();
	  }

	  addEntity(entity) {
	    if (this.entitiesByUUID[entity.uuid])  {
	      console.warn(`Entity ${entity.uuid} already added.`);
	      return entity;
	    }

	    this.entitiesByUUID[entity.uuid] = entity;
	    this.entities.push(entity);
	    entity.alive = true;
	    this.dispatchEvent(ENTITY_CREATED, entity);

	    return entity;
	  }

	  getEntityByUUID(uuid) {
	    return this.entitiesByUUID[uuid];
	  }

	  createComponent(Component) {
	    const componentPool = this.componentPools[Component.name];
	    return componentPool.acquire();
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
	    const query = this.queries[key];

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

	    this.dispatchEvent(COMPONENT_ADDED, entity, Component);
	  }

	  queueComponentRemoval() {
	    const index = this.entitiesWithComponentsToRemove.indexOf(entity);

	    if (index !== -1) {
	      this.entitiesWithComponentsToRemove.push(entity);
	    }
	  }

	  onRemoveComponent(Component) {
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

	  onDisposeEntity() {
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
	        componentPool: {},
	        eventDispatcher: super.stats()
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
	      const prop = schema[key];

	      if (props.hasOwnProperty(key)) {
	        this[key] = props[key];
	      } else if (prop.hasOwnProperty("default")) {
	        this[key] = prop.default;
	      } else {
	        this[key] = PropTypes.get(prop.type).default;
	      }
	    }

	    this._pool = null;
	  }

	  copy(source) {
	    const schema = this.constructor.schema;

	    for (const key in schema) {
	      const prop = schema[key];
	      const type = PropTypes.get(prop.type);
	      type.copy(source, this, key);
	    }

	    return this;
	  }

	  clone() {
	    return this.constructor().copy(source);
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
	  constructor(...params) {
	    super(...params);
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

	const copyValue = (src, dest, key) => dest[key] = src[key];
	const copyArray = (src, dest, key) => {
	  const srcArray = src[key];
	  const destArray = dest[key];
	  
	  destArray.length = 0;

	  for (let i = 0; i < srcArray.length; i++) {
	    destArray.push(srcArray[i]);
	  }

	  return destArray;
	};
	const copyJSON = (src, dest, key) => dest[key] = JSON.parse(JSON.stringify(src[key]));
	const copyCopyable = (src, dest, key) => dest[key].copy(src[key]);

	const Types = new Map();

	Types.set(Number, { default: 0, copy: copyValue });
	Types.set(Boolean, { default: false, copy: copyValue });
	Types.set(String, { default: "", copy: copyValue });
	Types.set(Object, { default: undefined, copy: copyValue });
	Types.set(Array, { default: [], copy: copyArray });
	Types.set(JSON, { default: null, copy: copyJSON });
	Types.set(Entity, { default: undefined, copy: copyCopyable });
	Types.set(Component, { default: undefined, copy: copyCopyable });

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
	exports.EntityState = EntityState;
	exports.Not = Not;
	exports.ObjectPool = ObjectPool;
	exports.System = System;
	exports.SystemStateComponent = SystemStateComponent;
	exports.TagComponent = TagComponent;
	exports.Types = Types;
	exports.Version = Version;
	exports.World = World;
	exports.enableRemoteDevtools = enableRemoteDevtools;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
