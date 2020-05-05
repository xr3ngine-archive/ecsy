// TODO: The default clone and copy can be made faster by
// generating clone/copy functions at Component registration time
export class Component {
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
