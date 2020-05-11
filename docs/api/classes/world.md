
# Class: World

The World is the root of the ECS.

## Constructors

###  constructor

\+ **new World**(): *[World](world.md)*

Create a new World.

**Returns:** *[World](world.md)*

## Properties

###  enabled

• **enabled**: *boolean*

Whether the world tick should execute.

## Methods

###  createEntity

▸ **createEntity**(`name?`: string): *[Entity](entity.md)*

Create a new entity

**Parameters:**

Name | Type |
------ | ------ |
`name?` | string |

**Returns:** *[Entity](entity.md)*

___

###  execute

▸ **execute**(`delta`: number, `time`: number): *void*

Update the systems per frame.

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`delta` | number | Delta time since the last call |
`time` | number | Elapsed time  |

**Returns:** *void*

___

###  getSystem

▸ **getSystem**<**T**>(`System`: SystemConstructor‹T›): *System*

Get a system registered in this world.

**Type parameters:**

▪ **T**: *System*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`System` | SystemConstructor‹T› | Type of system to get.  |

**Returns:** *System*

___

###  getSystems

▸ **getSystems**(): *Array‹System›*

Get a list of systems registered in this world.

**Returns:** *Array‹System›*

___

###  play

▸ **play**(): *void*

Resume execution of this world.

**Returns:** *void*

___

###  registerComponent

▸ **registerComponent**<**T**>(`Component`: [ComponentConstructor](../interfaces/componentconstructor.md)‹T›): *this*

Register a component.

**Type parameters:**

▪ **T**: *[Component](component.md)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`Component` | [ComponentConstructor](../interfaces/componentconstructor.md)‹T› | Type of component to register  |

**Returns:** *this*

___

###  registerSystem

▸ **registerSystem**<**T**>(`System`: SystemConstructor‹T›, `attributes?`: object): *this*

Register a system.

**Type parameters:**

▪ **T**: *System*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`System` | SystemConstructor‹T› | Type of system to register  |
`attributes?` | object | - |

**Returns:** *this*

___

###  stop

▸ **stop**(): *void*

Stop execution of this world.

**Returns:** *void*
