export class Component {
  copy(src: Component): void
  reset(): void
  clear(): void
}

export interface ComponentConstructor<T extends Component> {
  new (...args: any): T;
}
