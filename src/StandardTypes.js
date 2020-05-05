import { Entity } from "./Entity";
import { Component } from "./Component";

export const copyValue = (src, dest, key) => dest[key] = src[key];
export const copyArray = (src, dest, key) => {
  const srcArray = src[key];
  const destArray = dest[key];
  
  destArray.length = 0;

  for (let i = 0; i < srcArray.length; i++) {
    destArray.push(srcArray[i]);
  }

  return destArray;
};
export const copyJSON = (src, dest, key) => dest[key] = JSON.parse(JSON.stringify(src[key]));
export const copyCopyable = (src, dest, key) => dest[key].copy(src[key]);

export const Types = new Map();

Types.set(Number, { default: 0, copy: copyValue });
Types.set(Boolean, { default: false, copy: copyValue });
Types.set(String, { default: "", copy: copyValue });
Types.set(Object, { default: undefined, copy: copyValue });
Types.set(Array, { default: [], copy: copyArray });
Types.set(JSON, { default: null, copy: copyJSON });
Types.set(Entity, { default: undefined, copy: copyCopyable });
Types.set(Component, { default: undefined, copy: copyCopyable });
