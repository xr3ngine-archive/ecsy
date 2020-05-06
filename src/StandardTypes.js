export const copyValue = (src, dest, key) => (dest[key] = src[key]);

export const cloneValue = src => src;

export const copyArray = (src, dest, key) => {
  const srcArray = src[key];
  const destArray = dest[key];

  destArray.length = 0;

  for (let i = 0; i < srcArray.length; i++) {
    destArray.push(srcArray[i]);
  }

  return destArray;
};

export const cloneArray = src => src.slice();

export const copyJSON = (src, dest, key) =>
  (dest[key] = JSON.parse(JSON.stringify(src[key])));

export const cloneJSON = src => JSON.parse(JSON.stringify(src));

export const copyCopyable = (src, dest, key) => dest[key].copy(src[key]);

export const cloneClonable = src => src.clone();

export const Types = new Map();

Types.set(Number, { default: 0, clone: cloneValue, copy: copyValue });
Types.set(Boolean, { default: false, clone: cloneValue, copy: copyValue });
Types.set(String, { default: "", clone: cloneValue, copy: copyValue });
Types.set(Object, { default: undefined, clone: cloneValue, copy: copyValue });
Types.set(Array, { default: [], clone: cloneArray, copy: copyArray });
Types.set(JSON, { default: null, clone: cloneJSON, copy: copyJSON });
